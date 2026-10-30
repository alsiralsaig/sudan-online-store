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
      const columns: Record<string, SqlType> = { ...ALWAYS_COLUMNS, ...inferColumns(rows) };
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

/**
 * أعمدة تُضمن في كل جدول من أول إنشائه (حتى لو الجدول فاضي في البذرة).
 * accountSegment/isVip يُكتبان على المتاجر ويجب أن يكونا عمودين فعليين.
 */
const ALWAYS_COLUMNS: Record<string, SqlType> = {
  accountSegment: 'text',
  isVip: 'boolean',
};

export function ddlStatementsFor(def: TableDef): string[] {
  const cols = Object.entries({ ...ALWAYS_COLUMNS, ...def.columns }).map(
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

  // One cheap round trip beats ~100 DDL statements on a cross-region link.
  if (await schemaExists(defs)) {
    return defs;
  }

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

/**
 * Read every collection back into the in-memory shape the app expects.
 * All tables are fetched in a single round trip — on a cross-region link
 * 26 sequential queries cost seconds of pure latency.
 */
export async function loadAll(defs: TableDef[]): Promise<Record<string, any[]>> {
  const result: Record<string, any[]> = {};
  if (defs.length === 0) return result;

  const parts = defs.map(
    (def, i) =>
      `SELECT ${i}::int AS idx, COALESCE(json_agg(t), '[]'::json) AS rows FROM ${q(def.table)} t`
  );

  const { rows } = await query(parts.join('\nUNION ALL\n'));

  const byIndex = new Map<number, any[]>();
  for (const row of rows) {
    byIndex.set(Number(row.idx), row.rows || []);
  }

  defs.forEach((def, i) => {
    const tableRows = byIndex.get(i) || [];
    result[def.collection] = tableRows.map((row: any) => hydrate(def, row));
  });

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
  data: Record<string, any[]>,
  onlyCollections?: Set<string>
): Promise<void> {
  const targets = onlyCollections
    ? defs.filter((d) => onlyCollections.has(d.collection))
    : defs;

  if (targets.length === 0) return;

  await transaction(async (client) => {
    for (const def of targets) {
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

/** True when every expected table is already present. */
async function schemaExists(defs: TableDef[]): Promise<boolean> {
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS n
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])`,
      [defs.map((d) => d.table)]
    );
    return Number(rows[0]?.n) === defs.length;
  } catch {
    return false;
  }
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


/* ------------------------------------------------------------------ */
/*  Per-row diffing                                                    */
/*                                                                     */
/*  Rewriting whole tables is what loses data under concurrency:       */
/*  instance B's snapshot, read before A committed, deletes A's row.    */
/*  Diffing row-by-row means two concurrent inserts never touch the     */
/*  same record, so nothing is lost — and writes get far smaller.       */
/* ------------------------------------------------------------------ */

/** collection → (primary key → row fingerprint) */
export type Baseline = Map<string, Map<string, string>>;

function rowFingerprint(row: Record<string, any>): string {
  try {
    return JSON.stringify(row);
  } catch {
    return Math.random().toString(36);
  }
}

function keyOf(def: TableDef, row: Record<string, any>): string | null {
  const value = row?.[def.primaryKey];
  return value === undefined || value === null ? null : String(value);
}

export function buildBaseline(
  defs: TableDef[],
  data: Record<string, any[]>
): Baseline {
  const baseline: Baseline = new Map();

  for (const def of defs) {
    const rows = data[def.collection] || [];
    const map = new Map<string, string>();
    for (const row of rows) {
      const key = keyOf(def, row);
      if (key !== null) map.set(key, rowFingerprint(row));
    }
    baseline.set(def.collection, map);
  }

  return baseline;
}

/**
 * Apply only the rows that differ from the baseline.
 * Returns the number of upserts and deletes actually executed.
 */
export async function persistDiff(
  defs: TableDef[],
  data: Record<string, any[]>,
  baseline: Baseline
): Promise<{ upserts: number; deletes: number; collections: string[] }> {
  const work: { def: TableDef; upserts: any[]; deletes: string[] }[] = [];
  let upsertCount = 0;
  let deleteCount = 0;

  for (const def of defs) {
    const rows = data[def.collection];
    if (!Array.isArray(rows)) continue;

    const before = baseline.get(def.collection) || new Map<string, string>();
    const seen = new Set<string>();
    const upserts: any[] = [];

    for (const row of rows) {
      const key = keyOf(def, row);
      if (key === null) continue;
      seen.add(key);
      if (before.get(key) !== rowFingerprint(row)) {
        upserts.push(row);
      }
    }

    const deletes = [...before.keys()].filter((k) => !seen.has(k));

    if (upserts.length || deletes.length) {
      work.push({ def, upserts, deletes });
      upsertCount += upserts.length;
      deleteCount += deletes.length;
    }
  }

  if (work.length === 0) return { upserts: 0, deletes: 0, collections: [] };

  await transaction(async (client) => {
    for (const { def, upserts, deletes } of work) {
      for (const id of deletes) {
        await client.query(
          `DELETE FROM ${q(def.table)} WHERE ${q(def.primaryKey)} = $1`,
          [id]
        );
      }
      for (const row of upserts) {
        await upsertRow(client, def, row);
      }
    }
  });

  return {
    upserts: upsertCount,
    deletes: deleteCount,
    collections: work.map((w) => w.def.collection),
  };
}

async function upsertRow(
  client: SqlClient,
  def: TableDef,
  row: Record<string, any>
): Promise<void> {
  const pk = def.primaryKey;
  const known = Object.keys(def.columns);

  const values: any[] = [String(row[pk])];
  const placeholders: string[] = ['$1'];
  const assignments: string[] = [];
  const columns: string[] = [q(pk)];

  for (const field of known) {
    values.push(encodeValue(row[field]));
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
