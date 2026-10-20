/**
 * Schema derivation + load/persist for Sanad's 26 collections.
 *
 * Each collection becomes a real Postgres table with typed columns, a primary
 * key and indexes. Column shapes are inferred from the seed data so the DDL can
 * never drift from the domain model. Any field that appears later at runtime
 * (a new optional property, a client extension) is preserved in the `__extra`
 * jsonb column and merged back on read — so nothing is ever dropped.
 */
import { query, transaction, type SqlClient } from './pg.ts';

export type SqlType = 'text' | 'double precision' | 'boolean' | 'jsonb';

export interface TableDef {
  collection: string;
  table: string;
  columns: Record<string, SqlType>;
  /** Primary-key column. Most collections use `id`; a few are keyed naturally
   *  (e.g. currencies are keyed by ISO `code`). */
  primaryKey: string;
}

/** Collections keyed by something other than `id`. */
const PRIMARY_KEY_OVERRIDES: Record<string, string> = {
  currencies: 'code',
};

export function primaryKeyFor(collection: string, rows: Record<string, any>[]): string {
  const override = PRIMARY_KEY_OVERRIDES[collection];
  if (override) return override;

  const sample = rows.find((r) => r && typeof r === 'object');
  if (sample && sample.id === undefined && sample.code !== undefined) return 'code';

  return 'id';
}

const EXTRA_COLUMN = '__extra';

/** Collections that are global (no tenantId) rather than tenant-scoped. */
const GLOBAL_COLLECTIONS = new Set([
  'tenants',
  'subscriptionPlans',
  'currencies',
  'currencyRateHistory',
  'albandarListings',
  'albandarShowrooms',
  'auditLogs',
]);

/** Fields referenced by the most common lookups get a dedicated index. */
const INDEXED_FIELDS = [
  'tenantId',
  'branchId',
  'productId',
  'customerId',
  'status',
  'createdAt',
  'timestamp',
  'submittedAt',
  'saleId',
  'shiftId',
];

function sqlTypeOf(value: unknown): SqlType {
  if (typeof value === 'number') return 'double precision';
  if (typeof value === 'boolean') return 'boolean';
  if (value && typeof value === 'object') return 'jsonb';
  return 'text';
}

/** Infer the column set for one collection by scanning every seed row. */
export function inferColumns(rows: Record<string, any>[]): Record<string, SqlType> {
  const columns: Record<string, SqlType> = {};

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const [key, value] of Object.entries(row)) {
      if (key === 'id') continue;
      const inferred = sqlTypeOf(value);
      const existing = columns[key];
      if (!existing) {
        columns[key] = inferred;
      } else if (existing !== inferred) {
        // Conflicting shapes (e.g. number in one row, string in another) —
        // jsonb keeps both without lossy casting.
        columns[key] = 'jsonb';
      }
    }
  }

  return columns;
}

export function buildTableDefs(seed: Record<string, any[]>): TableDef[] {
  return Object.entries(seed)
    .filter(([, rows]) => Array.isArray(rows))
    .map(([collection, rows]) => {
      const primaryKey = primaryKeyFor(collection, rows);
      const columns = inferColumns(rows);
      delete columns[primaryKey];
      // A collection with no rows still needs a stable shape: key-only.
      return {
        collection,
        table: toTableName(collection),
        columns,
        primaryKey,
      };
    });
}

export function toTableName(collection: string): string {
  return `sanad_${collection.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`;
}

const q = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

export function ddlStatementsFor(def: TableDef): string[] {
  const cols = Object.entries(def.columns).map(
    ([name, type]) => `  ${q(name)} ${type}`
  );

  const statements = [
    `CREATE TABLE IF NOT EXISTS ${q(def.table)} (
  ${q(def.primaryKey)} text PRIMARY KEY,
${cols.map((c) => `${c},`).join('\n')}
  ${q(EXTRA_COLUMN)} jsonb
)`,
  ];

  for (const field of INDEXED_FIELDS) {
    if (field in def.columns) {
      const indexName = `idx_${def.table}_${field.toLowerCase()}`;
      statements.push(
        `CREATE INDEX IF NOT EXISTS ${q(indexName)} ON ${q(def.table)} (${q(field)})`
      );
    }
  }

  return statements;
}

/** Convenience wrapper for tooling that wants one script. */
export function ddlFor(def: TableDef): string {
  return ddlStatementsFor(def).join(';\n') + ';';
}

/** Create every table + index. Safe to run repeatedly. */
export async function ensureSchema(seed: Record<string, any[]>): Promise<TableDef[]> {
  const defs = buildTableDefs(seed);

  await transaction(async (client) => {
    for (const def of defs) {
      // Run statements one at a time: the extended query protocol used by
      // PGlite/Neon rejects multiple statements in a single prepared query.
      for (const statement of ddlStatementsFor(def)) {
        await client.query(statement);
      }
    }
  });

  return defs;
}

/** Read every collection back into the in-memory shape the app expects. */
export async function loadAll(defs: TableDef[]): Promise<Record<string, any[]>> {
  const result: Record<string, any[]> = {};

  for (const def of defs) {
    const { rows } = await query(`SELECT * FROM ${q(def.table)}`);
    result[def.collection] = rows.map((row) => hydrate(def, row));
  }

  return result;
}

function hydrate(def: TableDef, row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};

  for (const [key, value] of Object.entries(row)) {
    if (key === EXTRA_COLUMN) continue;
    out[key] = value;
  }

  const extra = row[EXTRA_COLUMN];
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    for (const [key, value] of Object.entries(extra)) {
      if (out[key] === undefined) out[key] = value;
    }
  }

  return out;
}

/**
 * Write the whole dataset back inside one transaction.
 * Rows are upserted by id; rows deleted in memory are deleted in the database.
 */
export async function persistAll(
  defs: TableDef[],
  data: Record<string, any[]>
): Promise<void> {
  await transaction(async (client) => {
    for (const def of defs) {
      const rows = data[def.collection];
      if (!Array.isArray(rows)) continue;
      await persistTable(client, def, rows);
    }
  });
}

async function persistTable(
  client: SqlClient,
  def: TableDef,
  rows: Record<string, any>[]
): Promise<void> {
  const known = Object.keys(def.columns);
  const pk = def.primaryKey;
  const ids = rows.map((row) => String(row[pk])).filter(Boolean);

  // 1. Remove rows that no longer exist in memory.
  if (ids.length > 0) {
    await client.query(
      `DELETE FROM ${q(def.table)} WHERE ${q(pk)} <> ALL($1::text[])`,
      [ids]
    );
  } else {
    await client.query(`DELETE FROM ${q(def.table)}`);
  }

  // 2. Upsert everything that remains.
  for (const row of rows) {
    if (!row || row[pk] === undefined || row[pk] === null) continue;

    const values: any[] = [String(row[pk])];
    const placeholders: string[] = ['$1'];
    const assignments: string[] = [];
    const columns: string[] = [q(pk)];

    for (const field of known) {
      const raw = row[field];
      values.push(encodeValue(raw));
      placeholders.push(`$${values.length}`);
      columns.push(q(field));
      assignments.push(`${q(field)} = EXCLUDED.${q(field)}`);
    }

    const extras: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === pk || known.includes(key)) continue;
      extras[key] = value;
    }
    values.push(Object.keys(extras).length ? JSON.stringify(extras) : null);
    placeholders.push(`$${values.length}`);
    columns.push(q(EXTRA_COLUMN));
    assignments.push(`${q(EXTRA_COLUMN)} = EXCLUDED.${q(EXTRA_COLUMN)}`);

    await client.query(
      `INSERT INTO ${q(def.table)} (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})
       ON CONFLICT (${q(pk)}) DO UPDATE SET ${assignments.join(', ')}`,
      values
    );
  }
}

/** Postgres can't bind plain objects to a typed column — encode as JSON. */
function encodeValue(value: any): any {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return value;
}

/** True when every table exists and holds at least one row. */
export async function isSeeded(defs: TableDef[]): Promise<boolean> {
  try {
    const { rows } = await query(`SELECT COUNT(*)::int AS n FROM ${q(defs[0].table)}`);
    return Number(rows[0]?.n) > 0;
  } catch {
    return false;
  }
}
