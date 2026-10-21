// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// src/server/routes.ts
import { Router } from "express";

// src/server/pg.ts
import pg from "pg";
var pool = null;
var injected = null;
var lastDbError = null;
function recordDbError(err) {
  lastDbError = err instanceof Error ? err.message : String(err);
}
function clearDbError() {
  lastDbError = null;
}
function dbTarget() {
  const url = process.env.DATABASE_URL;
  if (!url) return "unset";
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname} pooler=${u.hostname.includes("-pooler")} sslmode=${u.searchParams.get("sslmode") || "none"}`;
  } catch {
    return "unparseable";
  }
}
function isDbEnabled() {
  return injected !== null || !!process.env.DATABASE_URL;
}
function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!pool) {
    const isNeon = /neon\.tech/.test(process.env.DATABASE_URL);
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      // Neon and most managed Postgres providers require TLS.
      ssl: isNeon ? { rejectUnauthorized: false } : void 0,
      max: Number(process.env.PG_POOL_MAX || 3),
      idleTimeoutMillis: 1e4,
      connectionTimeoutMillis: 1e4
    });
    pool.on("error", (err) => {
      console.error("[DB] Unexpected pool error:", err.message);
    });
  }
  return pool;
}
function activeClient() {
  if (injected) return injected;
  return getPool();
}
async function query(text, params) {
  const client = activeClient();
  try {
    const result = await client.query(text, params);
    clearDbError();
    return result;
  } catch (err) {
    recordDbError(err);
    throw err;
  }
}
async function transaction(fn) {
  const client = activeClient();
  const anyClient = client;
  if (typeof anyClient.transaction === "function") {
    return anyClient.transaction(async (tx) => fn(tx));
  }
  await client.query("BEGIN");
  try {
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
    }
    throw err;
  }
}
var LOCK_KEY = 982451301;
async function acquireWriteLock(waitMs = 15e3) {
  if (injected) {
    return async () => {
    };
  }
  const pool2 = getPool();
  const client = await pool2.connect();
  const deadline = Date.now() + waitMs;
  let delay = 40;
  try {
    for (; ; ) {
      const { rows } = await client.query("SELECT pg_try_advisory_lock($1) AS ok", [LOCK_KEY]);
      if (rows[0]?.ok) break;
      if (Date.now() > deadline) {
        throw new Error("DB write lock timeout \u2014 another instance is still writing");
      }
      await new Promise((r) => setTimeout(r, delay + Math.random() * delay));
      delay = Math.min(delay * 2, 500);
    }
  } catch (err) {
    client.release();
    throw err;
  }
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    } catch (err) {
      console.warn("[DB] Failed to release advisory lock:", err.message);
    } finally {
      client.release();
    }
  };
}
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// src/server/ids.ts
import { randomUUID } from "crypto";
function newId(prefix) {
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}
function newCode(prefix, pad = 6) {
  const rand = randomUUID().replace(/-/g, "").slice(0, pad).toUpperCase();
  return `${prefix}-${rand}`;
}

// src/server/repository.ts
var PRIMARY_KEY_OVERRIDES = {
  currencies: "code"
};
function primaryKeyFor(collection, rows) {
  const override = PRIMARY_KEY_OVERRIDES[collection];
  if (override) return override;
  const sample = rows.find((r) => r && typeof r === "object");
  if (sample && sample.id === void 0 && sample.code !== void 0) return "code";
  return "id";
}
var EXTRA_COLUMN = "__extra";
var INDEXED_FIELDS = [
  "tenantId",
  "branchId",
  "productId",
  "customerId",
  "status",
  "createdAt",
  "timestamp",
  "submittedAt",
  "saleId",
  "shiftId"
];
function sqlTypeOf(value) {
  if (typeof value === "number") return "double precision";
  if (typeof value === "boolean") return "boolean";
  if (value && typeof value === "object") return "jsonb";
  return "text";
}
function inferColumns(rows) {
  const columns = {};
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    for (const [key, value] of Object.entries(row)) {
      if (key === "id") continue;
      const inferred = sqlTypeOf(value);
      const existing = columns[key];
      if (!existing) {
        columns[key] = inferred;
      } else if (existing !== inferred) {
        columns[key] = "jsonb";
      }
    }
  }
  return columns;
}
function buildTableDefs(seed) {
  return Object.entries(seed).filter(([, rows]) => Array.isArray(rows)).map(([collection, rows]) => {
    const primaryKey = primaryKeyFor(collection, rows);
    const columns = inferColumns(rows);
    delete columns[primaryKey];
    return {
      collection,
      table: toTableName(collection),
      columns,
      primaryKey
    };
  });
}
function toTableName(collection) {
  return `sanad_${collection.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`;
}
var q = (identifier) => `"${identifier.replace(/"/g, '""')}"`;
function ddlStatementsFor(def) {
  const cols = Object.entries(def.columns).map(
    ([name, type]) => `  ${q(name)} ${type}`
  );
  const statements = [
    `CREATE TABLE IF NOT EXISTS ${q(def.table)} (
  ${q(def.primaryKey)} text PRIMARY KEY,
${cols.map((c) => `${c},`).join("\n")}
  ${q(EXTRA_COLUMN)} jsonb
)`
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
async function ensureSchema(seed) {
  const defs = buildTableDefs(seed);
  if (await schemaExists(defs)) {
    return defs;
  }
  await transaction(async (client) => {
    for (const def of defs) {
      for (const statement of ddlStatementsFor(def)) {
        await client.query(statement);
      }
    }
  });
  return defs;
}
async function loadAll(defs) {
  const result = {};
  if (defs.length === 0) return result;
  const parts = defs.map(
    (def, i) => `SELECT ${i}::int AS idx, COALESCE(json_agg(t), '[]'::json) AS rows FROM ${q(def.table)} t`
  );
  const { rows } = await query(parts.join("\nUNION ALL\n"));
  const byIndex = /* @__PURE__ */ new Map();
  for (const row of rows) {
    byIndex.set(Number(row.idx), row.rows || []);
  }
  defs.forEach((def, i) => {
    const tableRows = byIndex.get(i) || [];
    result[def.collection] = tableRows.map((row) => hydrate(def, row));
  });
  return result;
}
function hydrate(def, row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === EXTRA_COLUMN) continue;
    out[key] = value;
  }
  const extra = row[EXTRA_COLUMN];
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    for (const [key, value] of Object.entries(extra)) {
      if (out[key] === void 0) out[key] = value;
    }
  }
  return out;
}
async function persistAll(defs, data, onlyCollections) {
  const targets = onlyCollections ? defs.filter((d) => onlyCollections.has(d.collection)) : defs;
  if (targets.length === 0) return;
  await transaction(async (client) => {
    for (const def of targets) {
      const rows = data[def.collection];
      if (!Array.isArray(rows)) continue;
      await persistTable(client, def, rows);
    }
  });
}
async function persistTable(client, def, rows) {
  const known = Object.keys(def.columns);
  const pk = def.primaryKey;
  const ids = rows.map((row) => String(row[pk])).filter(Boolean);
  if (ids.length > 0) {
    await client.query(
      `DELETE FROM ${q(def.table)} WHERE ${q(pk)} <> ALL($1::text[])`,
      [ids]
    );
  } else {
    await client.query(`DELETE FROM ${q(def.table)}`);
  }
  for (const row of rows) {
    if (!row || row[pk] === void 0 || row[pk] === null) continue;
    const values = [String(row[pk])];
    const placeholders = ["$1"];
    const assignments = [];
    const columns = [q(pk)];
    for (const field of known) {
      const raw = row[field];
      values.push(encodeValue(raw));
      placeholders.push(`$${values.length}`);
      columns.push(q(field));
      assignments.push(`${q(field)} = EXCLUDED.${q(field)}`);
    }
    const extras = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === pk || known.includes(key)) continue;
      extras[key] = value;
    }
    values.push(Object.keys(extras).length ? JSON.stringify(extras) : null);
    placeholders.push(`$${values.length}`);
    columns.push(q(EXTRA_COLUMN));
    assignments.push(`${q(EXTRA_COLUMN)} = EXCLUDED.${q(EXTRA_COLUMN)}`);
    await client.query(
      `INSERT INTO ${q(def.table)} (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       ON CONFLICT (${q(pk)}) DO UPDATE SET ${assignments.join(", ")}`,
      values
    );
  }
}
function encodeValue(value) {
  if (value === void 0 || value === null) return null;
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return value;
}
async function schemaExists(defs) {
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
function rowFingerprint(row) {
  try {
    return JSON.stringify(row);
  } catch {
    return Math.random().toString(36);
  }
}
function keyOf(def, row) {
  const value = row?.[def.primaryKey];
  return value === void 0 || value === null ? null : String(value);
}
function buildBaseline(defs, data) {
  const baseline = /* @__PURE__ */ new Map();
  for (const def of defs) {
    const rows = data[def.collection] || [];
    const map = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const key = keyOf(def, row);
      if (key !== null) map.set(key, rowFingerprint(row));
    }
    baseline.set(def.collection, map);
  }
  return baseline;
}
async function persistDiff(defs, data, baseline) {
  const work = [];
  let upsertCount = 0;
  let deleteCount = 0;
  for (const def of defs) {
    const rows = data[def.collection];
    if (!Array.isArray(rows)) continue;
    const before = baseline.get(def.collection) || /* @__PURE__ */ new Map();
    const seen = /* @__PURE__ */ new Set();
    const upserts = [];
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
    collections: work.map((w) => w.def.collection)
  };
}
async function upsertRow(client, def, row) {
  const pk = def.primaryKey;
  const known = Object.keys(def.columns);
  const values = [String(row[pk])];
  const placeholders = ["$1"];
  const assignments = [];
  const columns = [q(pk)];
  for (const field of known) {
    values.push(encodeValue(row[field]));
    placeholders.push(`$${values.length}`);
    columns.push(q(field));
    assignments.push(`${q(field)} = EXCLUDED.${q(field)}`);
  }
  const extras = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === pk || known.includes(key)) continue;
    extras[key] = value;
  }
  values.push(Object.keys(extras).length ? JSON.stringify(extras) : null);
  placeholders.push(`$${values.length}`);
  columns.push(q(EXTRA_COLUMN));
  assignments.push(`${q(EXTRA_COLUMN)} = EXCLUDED.${q(EXTRA_COLUMN)}`);
  await client.query(
    `INSERT INTO ${q(def.table)} (${columns.join(", ")})
     VALUES (${placeholders.join(", ")})
     ON CONFLICT (${q(pk)}) DO UPDATE SET ${assignments.join(", ")}`,
    values
  );
}

// src/server/db.ts
var INITIAL_PLANS = [
  {
    id: "plan_starter",
    name: "\u0628\u0627\u0642\u0629 \u0627\u0644\u062A\u0627\u062C\u0631 \u0627\u0644\u0645\u0628\u062A\u062F\u0626 (Starter)",
    description: "\u0645\u062B\u0627\u0644\u064A\u0629 \u0644\u0644\u0645\u062A\u0627\u062C\u0631 \u0627\u0644\u0635\u063A\u064A\u0631\u0629 \u0648\u0627\u0644\u062F\u0643\u0627\u0643\u064A\u0646 \u0627\u0644\u0641\u0631\u062F\u064A\u0629",
    monthlyPriceSdg: 75e3,
    maxBranches: 1,
    maxEmployees: 3,
    features: ["\u0641\u0631\u0639 \u0648\u0627\u062D\u062F \u0641\u0642\u0637", "\u062D\u062A\u0649 3 \u0645\u0648\u0638\u0641\u064A\u0646", "\u0646\u0642\u0637\u0629 \u0628\u064A\u0639 POS \u062A\u0639\u0645\u0644 \u062F\u0648\u0646 \u0625\u0646\u062A\u0631\u0646\u062A", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0648\u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F", "\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0648\u0645\u064A\u0629"]
  },
  {
    id: "plan_growth",
    name: "\u0628\u0627\u0642\u0629 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0648\u0627\u0644\u0646\u0645\u0648 (Growth)",
    description: "\u0627\u0644\u0623\u0646\u0633\u0628 \u0644\u0644\u0634\u0631\u0643\u0627\u062A \u0648\u0645\u062D\u0644\u0627\u062A \u0627\u0644\u062A\u062C\u0632\u0626\u0629 \u0630\u0627\u062A \u0627\u0644\u0641\u0631\u0648\u0639 \u0627\u0644\u0645\u062A\u0639\u062F\u062F\u0629",
    monthlyPriceSdg: 18e4,
    maxBranches: 4,
    maxEmployees: 15,
    features: [
      "\u062D\u062A\u0649 4 \u0641\u0631\u0648\u0639 \u0645\u0633\u062A\u0642\u0644\u0629",
      "\u062D\u062A\u0649 15 \u0645\u0648\u0638\u0641\u0627\u064B \u0645\u0639 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0645\u062E\u0635\u0635\u0629",
      "\u062A\u062D\u0648\u064A\u0644\u0627\u062A \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0628\u064A\u0646 \u0627\u0644\u0641\u0631\u0648\u0639 \u0645\u0639 \u0645\u062D\u0627\u0636\u0631 \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645",
      "\u0645\u062A\u062C\u0631 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0639\u0627\u0645 \u0645\u0639 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0632\u0628\u0627\u0626\u0646",
      "\u062A\u0639\u062F\u062F \u0627\u0644\u0639\u0645\u0644\u0627\u062A \u0648\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0628\u062F\u0642\u0629",
      "\u0631\u0628\u0637 \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0648\u0628\u0646\u0643\u0643"
    ],
    isPopular: true
  },
  {
    id: "plan_enterprise",
    name: "\u0628\u0627\u0642\u0629 \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0648\u0627\u0644\u0645\u0624\u0633\u0633\u0627\u062A (Enterprise)",
    description: "\u0634\u0627\u0645\u0644\u0629 \u0644\u0643\u0628\u0631\u0649 \u0627\u0644\u0645\u0624\u0633\u0633\u0627\u062A \u0648\u0633\u0644\u0627\u0633\u0644 \u0627\u0644\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A",
    monthlyPriceSdg: 35e4,
    maxBranches: 20,
    maxEmployees: 100,
    features: [
      "\u0641\u0631\u0648\u0639 \u063A\u064A\u0631 \u0645\u062D\u062F\u0648\u062F\u0629 (\u062D\u062A\u0649 20 \u0641\u0631\u0639\u0627\u064B)",
      "\u0645\u0648\u0638\u0641\u0648\u0646 \u063A\u064A\u0631 \u0645\u062D\u062F\u0648\u062F\u064A\u0646",
      "\u062A\u0642\u0627\u0631\u064A\u0631 \u0645\u062D\u0627\u0633\u0628\u064A\u0629 \u062A\u0641\u0635\u064A\u0644\u064A\u0629 \u0648\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0623\u0631\u0628\u0627\u062D \u0648\u0627\u0644\u062E\u0633\u0627\u0626\u0631",
      "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0648\u0631\u062F\u064A\u0627\u062A \u0648\u062A\u062F\u0642\u064A\u0642 \u0627\u0644\u0639\u062C\u0632 \u0648\u0627\u0644\u0641\u0627\u0626\u0636 \u0627\u0644\u0645\u062A\u0642\u062F\u0645",
      "\u062F\u0639\u0645 \u0641\u0646\u064A \u0645\u062E\u0635\u0635 \u0639\u0644\u0649 \u0645\u062F\u0627\u0631 24 \u0633\u0627\u0639\u0629",
      "\u0646\u0633\u062E \u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0641\u0648\u0631\u064A \u0648\u0633\u062D\u0627\u0628\u064A \u0622\u0645\u0646"
    ]
  }
];
var INITIAL_TENANTS = [
  {
    id: "tenant_alrowad",
    slug: "alrowad-trade",
    name: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0627\u0644\u0645\u062D\u0627\u0635\u064A\u0644",
    tradeName: "\u0627\u0644\u0631\u0648\u0627\u062F \u0645\u0627\u0631\u0643\u062A \u0648\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u062C\u0645\u0644\u0629",
    phone: "+249 91 234 5678",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0639\u0631\u0628\u064A - \u0639\u0645\u0627\u0631\u0629 \u0627\u0644\u0631\u0648\u0627\u062F - \u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    currency: "SDG",
    status: "active",
    subscriptionPlanId: "plan_growth",
    subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString(),
    settings: {
      receiptHeader: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u0627\u0633\u062A\u0647\u0644\u0627\u0643\u064A\u0629\n\u0627\u0644\u062E\u0631\u0637\u0648\u0645 - \u0647\u0627\u062A\u0641: 0912345678",
      receiptFooter: "\u0634\u0643\u0631\u0627\u064B \u0644\u0632\u064A\u0627\u0631\u062A\u0643\u0645! \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0627\u0644\u0645\u0628\u0627\u0639\u0629 \u062A\u0631\u062F \u0648\u062A\u0633\u062A\u0628\u062F\u0644 \u062E\u0644\u0627\u0644 3 \u0623\u064A\u0627\u0645 \u0645\u0639 \u0625\u0628\u0631\u0627\u0632 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629.\n\u0631\u0642\u0645 \u0627\u0644\u0634\u0643\u0627\u0648\u0649: 0123456789",
      allowNegativeStock: false,
      defaultMaxDiscountPct: 15,
      zatcaQrEnabled: true,
      taxNumber: "1004892348",
      commercialRegNo: "SD-KHT-2021-998",
      bankakAccount: "2498765",
      bankakAccountName: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0644\u0644\u062A\u062C\u0627\u0631\u0629",
      bankakPhone: "0912345678",
      costingMethod: "weighted_average",
      vatEnabled: true,
      defaultVatPct: 15,
      taxIdentificationNumber: "1004892348",
      pricesIncludeVat: false,
      showVatBreakdown: true,
      showTaxPerItem: true,
      loyaltyRateSdgPerPoint: 1e3
    },
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "tenant_nile_boutique",
    slug: "nile-boutique",
    name: "\u0628\u0648\u062A\u064A\u0643 \u0627\u0644\u0646\u064A\u0644 \u0644\u0644\u0645\u0644\u0627\u0628\u0633 \u0648\u0627\u0644\u0623\u0646\u0627\u0642\u0629",
    tradeName: "\u0627\u0644\u0646\u064A\u0644 \u0641\u0627\u0634\u0648\u0646",
    phone: "+249 92 888 7777",
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    address: "\u0633\u0648\u0642 \u062F\u064A\u0645 \u0633\u0648\u0627\u0643\u0646 - \u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u064A\u0646\u0627\u0621 - \u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    currency: "SDG",
    status: "active",
    subscriptionPlanId: "plan_starter",
    subscriptionExpiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1e3).toISOString(),
    settings: {
      receiptHeader: "\u0628\u0648\u062A\u064A\u0643 \u0627\u0644\u0646\u064A\u0644 \u0644\u0644\u0645\u0644\u0627\u0628\u0633 \u0648\u0627\u0644\u0623\u0646\u0627\u0642\u0629\n\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646 - \u062A\u0631\u062D\u0627\u0628\u0627\u064B \u0628\u0643\u0645",
      receiptFooter: "\u0634\u0643\u0631\u0627\u064B \u0644\u0627\u062E\u062A\u064A\u0627\u0631\u0643\u0645 \u0628\u0648\u062A\u064A\u0643 \u0627\u0644\u0646\u064A\u0644! \u062A\u0627\u0628\u0639\u0648\u0627 \u062A\u0634\u0643\u064A\u0644\u062A\u0646\u0627 \u0639\u0644\u0649 \u0627\u0644\u0625\u0646\u0633\u062A\u063A\u0631\u0627\u0645",
      allowNegativeStock: false,
      defaultMaxDiscountPct: 10,
      zatcaQrEnabled: true,
      taxNumber: "2005991823",
      commercialRegNo: "SD-PSD-2023-412",
      bankakAccount: "3109844",
      bankakAccountName: "\u0628\u0648\u062A\u064A\u0643 \u0627\u0644\u0646\u064A\u0644",
      bankakPhone: "0928887777",
      costingMethod: "fifo",
      vatEnabled: true,
      defaultVatPct: 15,
      taxIdentificationNumber: "2005991823",
      pricesIncludeVat: false,
      showVatBreakdown: true,
      showTaxPerItem: true,
      loyaltyRateSdgPerPoint: 1e3
    },
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_BRANCHES = [
  {
    id: "branch_kht_main",
    tenantId: "tenant_alrowad",
    name: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A (\u0627\u0644\u0631\u064A\u0627\u0636 / \u0627\u0644\u0645\u0634\u062A\u0644)",
    code: "KHT-01",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u062A\u0642\u0627\u0637\u0639 \u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u0634\u062A\u0644 \u0645\u0639 \u0627\u0644\u062C\u0632\u0627\u0631\u060C \u0627\u0644\u0631\u064A\u0627\u0636",
    phone: "0912345678",
    isMain: true,
    isActive: true,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "branch_madani",
    tenantId: "tenant_alrowad",
    name: "\u0641\u0631\u0639 \u0648\u062F \u0645\u062F\u0646\u064A (\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0643\u0628\u064A\u0631)",
    code: "MDN-02",
    city: "\u0648\u062F \u0645\u062F\u0646\u064A",
    address: "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0643\u0628\u064A\u0631 - \u0628\u0627\u0644\u0642\u0631\u0628 \u0645\u0646 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0623\u0647\u0644\u064A \u0627\u0644\u0645\u0635\u0631\u064A",
    phone: "0912345679",
    isMain: false,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "branch_psd_main",
    tenantId: "tenant_nile_boutique",
    name: "\u0641\u0631\u0639 \u0628\u0648\u0631\u062A\u0633\u0648\u062Fan \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    code: "PSD-01",
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    address: "\u0634\u0627\u0631\u0639 \u0627\u0644\u0633\u064A\u062F \u0639\u0644\u064A \u0627\u0644\u0645\u064A\u0631\u063A\u0646\u064A\u060C \u0648\u0633\u0637 \u0627\u0644\u0628\u0644\u062F",
    phone: "0928887777",
    isMain: true,
    isActive: true,
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_EMPLOYEES = [
  {
    id: "emp_owner_rowad",
    tenantId: "tenant_alrowad",
    name: "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F",
    email: "ahmed@alrowad.sd",
    phone: "0912000001",
    role: "owner",
    pin: "1234",
    permissions: ["all"],
    maxDiscountPct: 50,
    isActive: true,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "emp_mgr_kht",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    name: "\u0639\u062B\u0645\u0627\u0646 \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u064A\u0645 (\u0645\u062F\u064A\u0631 \u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645)",
    email: "osman@alrowad.sd",
    phone: "0912000002",
    role: "branch_manager",
    pin: "4321",
    permissions: ["pos:view", "pos:sell", "inventory:view", "inventory:transfer", "shifts:review", "reports:view"],
    maxDiscountPct: 20,
    isActive: true,
    createdAt: new Date(Date.now() - 80 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "emp_cashier_kht",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    name: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647 (\u0643\u0627\u0634\u064A\u0631 - \u0627\u0644\u062E\u0631\u0637\u0648\u0645)",
    email: "mohamed@alrowad.sd",
    phone: "0912000003",
    role: "cashier",
    pin: "0000",
    permissions: ["pos:view", "pos:sell", "shifts:manage"],
    maxDiscountPct: 10,
    isActive: true,
    createdAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "emp_inventory_rowad",
    tenantId: "tenant_alrowad",
    name: "\u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0639\u0644\u064A (\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u062E\u0632\u0646)",
    email: "ibrahim@alrowad.sd",
    phone: "0912000004",
    role: "inventory_officer",
    pin: "5555",
    permissions: ["inventory:view", "inventory:edit", "inventory:transfer", "purchases:manage"],
    maxDiscountPct: 0,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "emp_accountant_rowad",
    tenantId: "tenant_alrowad",
    name: "\u0633\u0627\u0631\u0629 \u0645\u0635\u0637\u0641\u0649 (\u0627\u0644\u0645\u062D\u0627\u0633\u0628 \u0627\u0644\u0645\u0627\u0644\u064A)",
    email: "sara@alrowad.sd",
    phone: "0912000005",
    role: "accountant",
    pin: "7777",
    permissions: ["reports:view", "expenses:manage", "purchases:view", "accounting:view"],
    maxDiscountPct: 0,
    isActive: true,
    createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_PRODUCTS = [
  {
    id: "prod_sugar_kenana",
    tenantId: "tenant_alrowad",
    name: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645",
    sku: "SUG-KEN-10KG",
    barcode: "628100123001",
    category: "\u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u064A\u0629 \u0648\u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629",
    unit: "\u0643\u064A\u0633 10 \u0643\u062C\u0645",
    purchaseCost: 26e3,
    costCurrency: "SDG",
    sellingPriceSdg: 31500,
    minStockAlert: 15,
    minimumStock: 15,
    imageUrl: "/assets/images/product_sugar_kenana_1792173270044.jpg",
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_cooking_oil",
    tenantId: "tenant_alrowad",
    name: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631",
    sku: "OIL-SBH-4.5L",
    barcode: "628100123002",
    category: "\u0627\u0644\u0632\u064A\u0648\u062A \u0648\u0627\u0644\u0633\u0645\u0646",
    unit: "\u062C\u0631\u0643\u0646 4.5 \u0644\u062A\u0631",
    purchaseCost: 19500,
    costCurrency: "SDG",
    sellingPriceSdg: 23800,
    minStockAlert: 10,
    minimumStock: 10,
    imageUrl: "/assets/images/product_cooking_oil_1792173269992.jpg",
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_sayga_flour",
    tenantId: "tenant_alrowad",
    name: "\u062F\u0642\u064A\u0642 \u0633\u064A\u0642\u0627 \u0645\u062E\u0635\u0648\u0635 \u0641\u0627\u062E\u0631 1 \u0643\u062C\u0645",
    sku: "FLR-SYG-1KG",
    barcode: "628100123003",
    category: "\u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u064A\u0629 \u0648\u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629",
    unit: "\u0628\u0627\u0643\u062A 1 \u0643\u062C\u0645",
    purchaseCost: 2100,
    costCurrency: "SDG",
    sellingPriceSdg: 2650,
    minStockAlert: 30,
    minimumStock: 30,
    imageUrl: "/assets/images/product_sayga_flour_1792173271374.jpg",
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_tea_ghazal",
    tenantId: "tenant_alrowad",
    name: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0633\u064A\u0644\u0627\u0646\u064A \u0641\u0627\u062E\u0631 400 \u062C\u0645",
    sku: "TEA-GHZ-400G",
    barcode: "628100123004",
    category: "\u0627\u0644\u0645\u0634\u0631\u0648\u0628\u0627\u062A \u0648\u0627\u0644\u0634\u0627\u064A",
    unit: "\u0639\u0644\u0628\u0629 400 \u062C\u0645",
    purchaseCost: 5800,
    costCurrency: "SDG",
    sellingPriceSdg: 7200,
    minStockAlert: 15,
    minimumStock: 15,
    imageUrl: "/assets/images/product_tea_box_1792173271153.jpg",
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_kapo_milk",
    tenantId: "tenant_alrowad",
    name: "\u062D\u0644\u064A\u0628 \u0643\u0627\u0628\u0648 \u0628\u0648\u062F\u0631\u0629 \u0643\u0627\u0645\u0644 \u0627\u0644\u062F\u0633\u0645 2.25 \u0643\u062C\u0645",
    sku: "MLK-KAPO-2.25K",
    barcode: "628100123005",
    category: "\u0627\u0644\u0623\u0644\u0628\u0627\u0646 \u0648\u0645\u0634\u062A\u0642\u0627\u062A\u0647\u0627",
    unit: "\u0639\u0644\u0628\u0629 \u0635\u0641\u064A\u062D",
    purchaseCost: 32e3,
    costCurrency: "SDG",
    sellingPriceSdg: 37500,
    minStockAlert: 10,
    minimumStock: 10,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_badr_soap",
    tenantId: "tenant_alrowad",
    name: "\u0635\u0627\u0628\u0648\u0646 \u063A\u0633\u064A\u0644 \u0627\u0644\u0628\u062F\u0631 \u062F\u0633\u062A\u0629 (12 \u0642\u0637\u0639\u0629)",
    sku: "SOP-BDR-12PC",
    barcode: "628100123006",
    category: "\u0627\u0644\u0645\u0646\u0638\u0641\u0627\u062A \u0648\u0627\u0644\u0639\u0646\u0627\u064A\u0629 \u0627\u0644\u0645\u0646\u0632\u0644\u064A\u0629",
    unit: "\u062F\u0633\u062A\u0629 (12 \u0642\u0637\u0639\u0629)",
    purchaseCost: 6500,
    costCurrency: "SDG",
    sellingPriceSdg: 8200,
    minStockAlert: 15,
    minimumStock: 15,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_coffee_beans",
    tenantId: "tenant_alrowad",
    name: "\u0628\u0646 \u062D\u0628\u0634\u064A \u0647\u0631\u0631\u064A \u062F\u0631\u062C\u0629 \u0623\u0648\u0644\u0649 1 \u0643\u062C\u0645",
    sku: "COF-ETH-1KG",
    barcode: "628100123007",
    category: "\u0627\u0644\u0645\u0634\u0631\u0648\u0628\u0627\u062A \u0648\u0627\u0644\u0634\u0627\u064A",
    unit: "\u0643\u062C\u0645",
    purchaseCost: 11e3,
    costCurrency: "SDG",
    sellingPriceSdg: 14500,
    minStockAlert: 12,
    minimumStock: 12,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "prod_rice_prince",
    tenantId: "tenant_alrowad",
    name: "\u0623\u0631\u0632 \u0645\u0635\u0631\u064A \u0627\u0644\u0628\u0631\u0646\u0633 \u0643\u0627\u0645\u0648\u0644\u064A\u0646\u0648 5 \u0643\u062C\u0645",
    sku: "RCE-PRN-5KG",
    barcode: "628100123008",
    category: "\u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u064A\u0629 \u0648\u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629",
    unit: "\u0643\u064A\u0633 5 \u0643\u062C\u0645",
    purchaseCost: 13500,
    costCurrency: "SDG",
    sellingPriceSdg: 16800,
    minStockAlert: 20,
    minimumStock: 20,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_INVENTORIES = [
  // Branch Khartoum Main
  { id: "inv_1", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_sugar_kenana", quantity: 45, minAlertQuantity: 15, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_2", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_cooking_oil", quantity: 28, minAlertQuantity: 10, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_3", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_sayga_flour", quantity: 120, minAlertQuantity: 30, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_4", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_tea_ghazal", quantity: 6, minAlertQuantity: 15, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 6 <= 15
  { id: "inv_5", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_kapo_milk", quantity: 18, minAlertQuantity: 10, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_6", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_badr_soap", quantity: 50, minAlertQuantity: 15, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_7", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_coffee_beans", quantity: 4, minAlertQuantity: 12, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 4 <= 12
  { id: "inv_8", tenantId: "tenant_alrowad", branchId: "branch_kht_main", productId: "prod_rice_prince", quantity: 8, minAlertQuantity: 20, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 8 <= 20
  // Branch Wad Madani
  { id: "inv_9", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_sugar_kenana", quantity: 20, minAlertQuantity: 10, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_10", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_cooking_oil", quantity: 14, minAlertQuantity: 8, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_11", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_sayga_flour", quantity: 55, minAlertQuantity: 20, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_12", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_tea_ghazal", quantity: 5, minAlertQuantity: 15, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 5 <= 15
  { id: "inv_13", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_kapo_milk", quantity: 3, minAlertQuantity: 10, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 3 <= 10
  { id: "inv_14", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_badr_soap", quantity: 25, minAlertQuantity: 10, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "inv_15", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_coffee_beans", quantity: 2, minAlertQuantity: 12, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  // Low stock: 2 <= 12
  { id: "inv_16", tenantId: "tenant_alrowad", branchId: "branch_madani", productId: "prod_rice_prince", quantity: 18, minAlertQuantity: 20, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() }
];
var INITIAL_CURRENCIES = [
  { code: "SDG", name: "\u062C\u0646\u064A\u0647 \u0633\u0648\u062F\u0627\u0646\u064A", symbol: "\u062C.\u0633", rateToSdg: 1, isBase: true, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "USD", name: "\u062F\u0648\u0644\u0627\u0631 \u0623\u0645\u0631\u064A\u0643\u064A", symbol: "$", rateToSdg: 2750, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "SAR", name: "\u0631\u064A\u0627\u0644 \u0633\u0639\u0648\u062F\u064A", symbol: "\u0631.\u0633", rateToSdg: 733.33, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "TRY", name: "\u0644\u064A\u0631\u0629 \u062A\u0631\u0643\u064A\u0629", symbol: "\u20BA", rateToSdg: 82.5, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "EGP", name: "\u062C\u0646\u064A\u0647 \u0645\u0635\u0631\u064A", symbol: "\u062C.\u0645", rateToSdg: 56.8, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "AED", name: "\u062F\u0631\u0647\u0645 \u0625\u0645\u0627\u0631\u0627\u062A\u064A", symbol: "\u062F.\u0625", rateToSdg: 748.5, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "EUR", name: "\u064A\u0648\u0631\u0648 \u0623\u0648\u0631\u0648\u0628\u064A", symbol: "\u20AC", rateToSdg: 2980, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
  { code: "QAR", name: "\u0631\u064A\u0627\u0644 \u0642\u0637\u0631\u064A", symbol: "\u0631.\u0642", rateToSdg: 755, isBase: false, isActive: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() }
];
var INITIAL_SHIFTS = [
  {
    id: "shift_kht_001",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A (\u0627\u0644\u0631\u064A\u0627\u0636 / \u0627\u0644\u0645\u0634\u062A\u0644)",
    cashierId: "emp_cashier_kht",
    cashierName: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647 (\u0643\u0627\u0634\u064A\u0631 - \u0627\u0644\u062E\u0631\u0637\u0648\u0645)",
    openedAt: new Date(Date.now() - 4 * 60 * 60 * 1e3).toISOString(),
    openingCashSdg: 5e4,
    expectedCashSdg: 144500,
    status: "open",
    totalSalesSdg: 236e3,
    totalCashSalesSdg: 94500,
    totalBankakSalesSdg: 121500,
    totalCardSalesSdg: 2e4,
    salesCount: 6,
    refundsCount: 0,
    refundsTotalSdg: 0
  }
];
var INITIAL_SALES = [
  {
    id: "sale_demo_1",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    shiftId: "shift_kht_001",
    invoiceNumber: "INV-2026-00101",
    customerName: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0647\u0627\u0634\u0645 \u0645\u064A\u0631\u063A\u0646\u064A",
    customerPhone: "0912111222",
    items: [
      {
        productId: "prod_sugar_kenana",
        productName: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645",
        unit: "\u0643\u064A\u0633 10 \u0643\u062C\u0645",
        quantity: 2,
        unitPriceSdg: 31500,
        discountSdg: 0,
        totalSdg: 63e3,
        costPerUnitSdg: 26e3
      },
      {
        productId: "prod_cooking_oil",
        productName: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631",
        unit: "\u062C\u0631\u0643\u0646 4.5 \u0644\u062A\u0631",
        quantity: 1,
        unitPriceSdg: 23800,
        discountSdg: 0,
        totalSdg: 23800,
        costPerUnitSdg: 19500
      }
    ],
    subtotalSdg: 86800,
    discountTotalSdg: 0,
    taxTotalSdg: 0,
    grandTotalSdg: 86800,
    paymentMethod: "bankak",
    paymentReference: "BNK-TXN-8849201",
    status: "completed",
    cashierId: "emp_cashier_kht",
    cashierName: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647",
    isOfflineCreated: false,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "sale_demo_2",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    shiftId: "shift_kht_001",
    invoiceNumber: "INV-2026-00102",
    customerName: "\u0639\u0645\u064A\u0644 \u0646\u0642\u062F\u064A",
    items: [
      {
        productId: "prod_tea_ghazal",
        productName: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0633\u064A\u0644\u0627\u0646\u064A \u0641\u0627\u062E\u0631 400 \u062C\u0645",
        unit: "\u0639\u0644\u0628\u0629 400 \u062C\u0645",
        quantity: 3,
        unitPriceSdg: 7200,
        discountSdg: 600,
        totalSdg: 21e3,
        costPerUnitSdg: 5800
      },
      {
        productId: "prod_sayga_flour",
        productName: "\u062F\u0642\u064A\u0642 \u0633\u064A\u0642\u0627 \u0645\u062E\u0635\u0648\u0635 \u0641\u0627\u062E\u0631 1 \u0643\u062C\u0645",
        unit: "\u0628\u0627\u0643\u062A 1 \u0643\u062C\u0645",
        quantity: 5,
        unitPriceSdg: 2650,
        discountSdg: 0,
        totalSdg: 13250,
        costPerUnitSdg: 2100
      }
    ],
    subtotalSdg: 34850,
    discountTotalSdg: 600,
    taxTotalSdg: 0,
    grandTotalSdg: 34250,
    paymentMethod: "cash",
    status: "completed",
    cashierId: "emp_cashier_kht",
    cashierName: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647",
    isOfflineCreated: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_CUSTOMERS = [
  {
    id: "cust_01",
    tenantId: "tenant_alrowad",
    name: "\u0645. \u0639\u0628\u062F \u0627\u0644\u0639\u0638\u064A\u0645 \u0627\u0644\u0641\u0627\u062A\u062D",
    phone: "0912389441",
    email: "abdelazim.f@gmail.com",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u0627\u0644\u0631\u064A\u0627\u0636 - \u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u0634\u062A\u0644",
    loyaltyPoints: 340,
    totalPurchasesSdg: 485e3,
    invoicesCount: 6,
    notes: "\u0639\u0645\u064A\u0644 \u062F\u0627\u0626\u0645 - \u064A\u0641\u0636\u0644 \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0627\u0644\u0633\u0631\u064A\u0639 \u0644\u0644\u0645\u0646\u0632\u0644",
    createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1e3).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 2 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "cust_02",
    tenantId: "tenant_alrowad",
    name: "\u062F. \u0641\u0627\u0637\u0645\u0629 \u0639\u062B\u0645\u0627\u0646 \u0623\u062D\u0645\u062F",
    phone: "0911223344",
    email: "dr.fatima@hotmail.com",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u0627\u0644\u0645\u0639\u0645\u0648\u0631\u0629 - \u0645\u0631\u0628\u0639 69",
    loyaltyPoints: 185,
    totalPurchasesSdg: 23e4,
    invoicesCount: 3,
    notes: "\u0637\u0628\u064A\u0628\u0629 \u0628\u0627\u0644\u0639\u064A\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u062C\u0645\u0639\u0629 - \u062A\u0633\u0648\u0642 \u062F\u0648\u0631\u064A \u0644\u0644\u0633\u0644\u0639 \u0627\u0644\u0645\u0646\u0632\u0644\u064A\u0629",
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1e3).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 5 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "cust_03",
    tenantId: "tenant_alrowad",
    name: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0623\u0641\u0642 \u0644\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0627\u062A \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629",
    phone: "0123998877",
    email: "procurement@alofuq.sd",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u0627\u0644\u0639\u0645\u0627\u0631\u0627\u062A - \u0634\u0627\u0631\u0639 15",
    taxNumber: "1008823194",
    loyaltyPoints: 850,
    totalPurchasesSdg: 125e4,
    invoicesCount: 12,
    notes: "\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0645\u0643\u062A\u0628\u064A\u0629 \u0648\u0645\u0648\u0627\u062F \u0636\u064A\u0627\u0641\u0629 \u0628\u0641\u0648\u0627\u062A\u064A\u0631 \u0636\u0631\u064A\u0628\u064A\u0629 \u0645\u0639\u062A\u0645\u062F\u0629 \u0644\u0644\u0634\u0631\u0643\u0629",
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1e3).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 1 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "cust_04",
    tenantId: "tenant_alrowad",
    name: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0647\u0627\u0634\u0645 \u0645\u064A\u0631\u063A\u0646\u064A",
    phone: "0912111222",
    email: "hashem.m@yahoo.com",
    city: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: "\u0627\u0644\u0635\u062D\u0627\u0641\u0629 \u0634\u0631\u0642",
    loyaltyPoints: 120,
    totalPurchasesSdg: 165e3,
    invoicesCount: 2,
    notes: "\u0639\u0645\u064A\u0644 \u0623\u0633\u062A\u0627\u0630 \u062C\u0627\u0645\u0639\u064A",
    createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1e3).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 3 * 3600 * 1e3).toISOString()
  },
  {
    id: "cust_05",
    tenantId: "tenant_nile_boutique",
    name: "\u0633\u0627\u0631\u0629 \u062E\u0627\u0644\u062F \u0627\u0644\u0628\u062F\u0648\u064A",
    phone: "0912556677",
    email: "sara.kh@gmail.com",
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    address: "\u062D\u064A \u0627\u0644\u0634\u0627\u0637\u0626",
    loyaltyPoints: 95,
    totalPurchasesSdg: 14e4,
    invoicesCount: 2,
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1e3).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 4 * 24 * 3600 * 1e3).toISOString()
  }
];
var INITIAL_TRANSFERS = [
  {
    id: "trf_001",
    tenantId: "tenant_alrowad",
    transferNumber: "TRF-2026-001",
    sourceBranchId: "branch_kht_main",
    sourceBranchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    targetBranchId: "branch_madani",
    targetBranchName: "\u0641\u0631\u0639 \u0648\u062F \u0645\u062F\u0646\u064A",
    status: "received",
    items: [
      { productId: "prod_sugar_kenana", productName: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645", requestedQty: 10, dispatchedQty: 10, receivedQty: 10 },
      { productId: "prod_cooking_oil", productName: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631", requestedQty: 5, dispatchedQty: 5, receivedQty: 5 }
    ],
    notes: "\u062A\u0639\u0632\u064A\u0632 \u0645\u062E\u0632\u0648\u0646 \u0641\u0631\u0639 \u0648\u062F \u0645\u062F\u0646\u064A \u0644\u0645\u0648\u0627\u0643\u0628\u0629 \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064A",
    createdBy: "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F",
    dispatchedBy: "\u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0639\u0644\u064A",
    receivedBy: "\u0639\u0628\u062F \u0627\u0644\u0642\u0627\u062F\u0631 \u0645\u0648\u0633\u0649",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1e3).toISOString(),
    dispatchedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1e3).toISOString(),
    receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_EXPENSES = [
  {
    id: "exp_001",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    category: "\u0643\u0647\u0631\u0628\u0627\u0621 \u0648\u0645\u064A\u0627\u0647",
    amountSdg: 45e3,
    description: "\u0634\u0631\u0627\u0621 \u0643\u0631\u0648\u062A \u0643\u0647\u0631\u0628\u0627\u0621 \u062A\u062C\u0627\u0631\u064A\u0629 \u0644\u0644\u0645\u062D\u0644 \u0648\u0627\u0644\u0625\u0646\u0627\u0631\u0629 \u0648\u0627\u0644\u062B\u0644\u0627\u062C\u0627\u062A",
    paidBy: "\u0639\u062B\u0645\u0627\u0646 \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u064A\u0645",
    receiptNumber: "ELEC-2026-90",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "exp_002",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    category: "\u0646\u0642\u0644 \u0648\u062A\u0641\u0631\u064A\u063A",
    amountSdg: 3e4,
    description: "\u0639\u062A\u0627\u0644\u0629 \u0648\u062A\u0646\u0632\u064A\u0644 \u0634\u062D\u0646\u0629 \u0633\u0643\u0631 \u0648\u0632\u064A\u0648\u062A \u0645\u0646 \u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639 \u0627\u0644\u0645\u0631\u0643\u0632\u064A",
    paidBy: "\u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0639\u0644\u064A",
    receiptNumber: "LOG-771",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_RECURRING_EXPENSES = [
  {
    id: "recexp_01",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title: "\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0639\u0642\u0627\u0631 \u0648\u0627\u0644\u0645\u0642\u0631 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    category: "\u0625\u064A\u062C\u0627\u0631",
    amountSdg: 35e4,
    frequency: "monthly",
    dayOfMonth: 1,
    nextDueDate: new Date(Date.now() + 12 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    lastPostedDate: new Date(Date.now() - 18 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    autoPost: true,
    isActive: true,
    notes: "\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0644\u0644\u0645\u0627\u0644\u0643 \u0639\u0628\u0631 \u062A\u0637\u0628\u064A\u0642 \u0628\u0646\u0643\u0643 \u0623\u0648\u0644 \u0643\u0644 \u0634\u0647\u0631 \u0645\u064A\u0644\u0627\u062F\u064A",
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "recexp_02",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title: "\u0631\u0648\u0627\u062A\u0628 \u0645\u0648\u0638\u0641\u064A \u0648\u0639\u0645\u0627\u0644 \u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0634\u0647\u0631\u064A",
    category: "\u0631\u0648\u0627\u062A\u0628",
    amountSdg: 85e4,
    frequency: "monthly",
    dayOfMonth: 28,
    nextDueDate: new Date(Date.now() + 10 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    lastPostedDate: new Date(Date.now() - 20 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    autoPost: true,
    isActive: true,
    notes: "\u0645\u0633\u064A\u0631 \u0627\u0644\u0631\u0648\u0627\u062A\u0628 \u0644\u0639\u062F\u062F 5 \u0645\u0648\u0638\u0641\u064A\u0646 \u0648\u0643\u0627\u0634\u064A\u0631 \u0648\u0639\u0645\u0627\u0644 \u0627\u0644\u0646\u0638\u0627\u0641\u0629",
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "recexp_03",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title: "\u0627\u0634\u062A\u0631\u0627\u0643 \u0641\u0627\u064A\u0628\u0631 \u0625\u0646\u062A\u0631\u0646\u062A \u0648\u0633\u064A\u0631\u0641\u0631 \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 (\u0643\u0627\u0646\u0627\u0631/\u0633\u0648\u062F\u0627\u0646\u064A)",
    category: "\u0625\u0646\u062A\u0631\u0646\u062A \u0648\u0627\u062A\u0635\u0627\u0644\u0627\u062A",
    amountSdg: 45e3,
    frequency: "monthly",
    dayOfMonth: 5,
    nextDueDate: new Date(Date.now() + 16 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    lastPostedDate: new Date(Date.now() - 14 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    autoPost: false,
    isActive: true,
    notes: "\u0627\u0634\u062A\u0631\u0627\u0643 \u0625\u0646\u062A\u0631\u0646\u062A \u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u0639\u0631\u064A\u0636 \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u062F\u0648\u062F \u0645\u0639 \u062E\u0637 \u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0634\u0631\u064A\u062D\u0629 4G",
    createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "recexp_04",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title: "\u0634\u062D\u0646 \u0643\u0631\u0648\u062A \u0643\u0647\u0631\u0628\u0627\u0621 \u062A\u062C\u0627\u0631\u064A 3 \u0641\u0627\u0632 \u0623\u0633\u0628\u0648\u0639\u064A",
    category: "\u0643\u0647\u0631\u0628\u0627\u0621 \u0648\u0645\u064A\u0627\u0647",
    amountSdg: 3e4,
    frequency: "weekly",
    dayOfWeek: 0,
    nextDueDate: new Date(Date.now() + 2 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    lastPostedDate: new Date(Date.now() - 5 * 24 * 3600 * 1e3).toISOString().split("T")[0],
    autoPost: true,
    isActive: true,
    notes: "\u0634\u062D\u0646 \u0639\u062F\u0627\u062F \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u0645\u0633\u0628\u0642 \u0644\u0636\u0645\u0627\u0646 \u0639\u0645\u0644 \u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u062A\u0628\u0631\u064A\u062F \u0648\u0627\u0644\u062B\u0644\u0627\u062C\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u0645\u0631",
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1e3).toISOString()
  }
];
var INITIAL_PROMOTIONS = [
  {
    id: "promo_01",
    tenantId: "tenant_alrowad",
    title: "\u0639\u0631\u0636 \u0627\u0644\u0635\u0628\u0627\u062D: \u0627\u0634\u062A\u0631\u0650 2 \u0648\u0627\u062D\u0635\u0644 \u0639\u0644\u0649 1 \u0645\u062C\u0627\u0646\u0627\u064B",
    description: "\u0639\u0646\u062F \u0634\u0631\u0627\u0621 \u0642\u0637\u0639\u062A\u064A\u0646 \u0645\u0646 \u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0627\u0644\u0623\u0635\u0644\u064A \u0627\u062D\u0635\u0644 \u0639\u0644\u0649 \u0627\u0644\u062B\u0627\u0644\u062B\u0629 \u0645\u062C\u0627\u0646\u0627\u064B",
    type: "buy_x_get_y",
    buyProductId: "prod_tea_ghazalteen",
    buyProductName: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0627\u0644\u0623\u0635\u0644\u064A 450 \u062C\u0645",
    buyQuantity: 2,
    freeProductId: "prod_tea_ghazalteen",
    freeProductName: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0627\u0644\u0623\u0635\u0644\u064A 450 \u062C\u0645",
    freeQuantity: 1,
    isActive: true,
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "promo_02",
    tenantId: "tenant_alrowad",
    title: "\u062E\u0635\u0645 \u0627\u0644\u062C\u0645\u0644\u0629: 10% \u0639\u0646\u062F \u0634\u0631\u0627\u0621 \u0623\u0643\u062B\u0631 \u0645\u0646 5 \u0639\u0628\u0648\u0627\u062A",
    description: "\u062E\u0635\u0645 \u0641\u0648\u0631\u064A 10% \u0639\u0644\u0649 \u0643\u0644 \u0639\u0628\u0648\u0629 \u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0639\u0646\u062F \u0634\u0631\u0627\u0621 5 \u0642\u0637\u0639 \u0623\u0648 \u0623\u0643\u062B\u0631",
    type: "qty_discount_pct",
    productId: "prod_cooking_oil",
    productName: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631",
    minQuantity: 5,
    discountPct: 10,
    isActive: true,
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1e3).toISOString()
  },
  {
    id: "promo_03",
    tenantId: "tenant_alrowad",
    title: "\u0645\u0643\u0627\u0641\u0623\u0629 \u0627\u0644\u0633\u0644\u0629 \u0627\u0644\u0643\u0628\u064A\u0631\u0629: \u062E\u0635\u0645 5,000 \u062C.\u0633 \u0639\u0646\u062F \u062A\u062C\u0627\u0648\u0632 100,000 \u062C.\u0633",
    description: "\u062E\u0635\u0645 \u0645\u0642\u0637\u0648\u0639 \u0648\u0645\u0628\u0627\u0634\u0631 5,000 \u062C\u0646\u064A\u0647 \u0633\u0648\u062F\u0627\u0646\u064A \u0639\u0644\u0649 \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0639\u0646\u062F \u0648\u0635\u0648\u0644 \u0627\u0644\u0633\u0644\u0629 \u0625\u0644\u0649 100,000 \u062C\u0646\u064A\u0647",
    type: "cart_fixed_discount",
    minCartTotalSdg: 1e5,
    discountAmountSdg: 5e3,
    isActive: true,
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1e3).toISOString()
  }
];
var INITIAL_KITCHEN_TICKETS = [
  {
    id: "kds_01",
    saleId: "sale_demo_01",
    invoiceNumber: "INV-2026-0001",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    customerName: "\u0645. \u0639\u0628\u062F \u0627\u0644\u0639\u0638\u064A\u0645 \u0627\u0644\u0641\u0627\u062A\u062D",
    orderType: "quick_order",
    status: "preparing",
    items: [
      {
        id: "kds_item_1",
        productId: "prod_sugar_kenana",
        productName: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645",
        quantity: 2,
        unit: "\u0643\u064A\u0633 10 \u0643\u062C\u0645",
        notes: "\u0637\u0644\u0628 \u0633\u0631\u064A\u0639 - \u062A\u062C\u0647\u064A\u0632 \u0644\u0644\u062A\u0633\u0644\u064A\u0645 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0628\u0627\u0644\u0633\u064A\u0627\u0631\u0629",
        status: "ready"
      },
      {
        id: "kds_item_2",
        productId: "prod_tea_ghazalteen",
        productName: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0627\u0644\u0623\u0635\u0644\u064A 450 \u062C\u0645",
        quantity: 3,
        unit: "\u0628\u0627\u0643\u062A",
        notes: "\u0639\u0631\u0636 \u0627\u0634\u062A\u0631 2 \u0648\u0627\u062D\u0635\u0644 \u0639\u0644\u0649 1 \u0645\u062C\u0627\u0646\u0627\u064B - \u062A\u063A\u0644\u064A\u0641 \u0647\u062F\u064A\u0629",
        status: "preparing"
      }
    ],
    createdAt: new Date(Date.now() - 14 * 60 * 1e3).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 1e3).toISOString()
  },
  {
    id: "kds_02",
    saleId: "sale_demo_02",
    invoiceNumber: "INV-2026-0002",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    customerName: "\u062F. \u0645\u0646\u0649 \u0627\u0644\u0637\u0627\u0647\u0631",
    orderType: "takeaway",
    status: "pending",
    items: [
      {
        id: "kds_item_3",
        productId: "prod_cooking_oil",
        productName: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631",
        quantity: 1,
        unit: "\u062C\u0631\u0643\u0627\u0646\u0629",
        notes: "\u0637\u0644\u0628 \u0633\u0631\u064A\u0639 - \u0628\u062F\u0648\u0646 \u0634\u0637\u0629 \u0633\u0641\u0631\u064A / \u0648\u0636\u0639 \u0641\u064A \u0643\u064A\u0633 \u0645\u0632\u062F\u0648\u062C \u0645\u0642\u0648\u0649",
        status: "pending"
      }
    ],
    createdAt: new Date(Date.now() - 4 * 60 * 1e3).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 1e3).toISOString()
  }
];
var INITIAL_PURCHASES = [
  {
    id: "purch_001",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    supplierName: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0633\u0643\u0631 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A\u0629 \u0627\u0644\u0645\u062D\u062F\u0648\u062F\u0629",
    invoiceNumber: "SUP-SUG-8821",
    currency: "SDG",
    exchangeRate: 1,
    items: [
      {
        productId: "prod_sugar_kenana",
        productName: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645",
        quantity: 100,
        costInCurrency: 26e3,
        currency: "SDG",
        exchangeRate: 1,
        costSdg: 26e5
      }
    ],
    totalCostSdg: 26e5,
    paymentStatus: "paid",
    notes: "\u0634\u0631\u0627\u0621 \u062F\u0641\u0639\u0629 \u0634\u0647\u0631\u064A\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u0645\u0646 \u0627\u0644\u0645\u0648\u0631\u062F",
    createdBy: "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F",
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "purch_002",
    tenantId: "tenant_alrowad",
    branchId: "branch_kht_main",
    branchName: "\u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    supplierName: "\u0645\u0624\u0633\u0633\u0629 \u0627\u0644\u0634\u0627\u064A \u0627\u0644\u0639\u0627\u0644\u0645\u064A\u0629 (\u062F\u0628\u064A)",
    invoiceNumber: "IMP-TEA-2026",
    currency: "AED",
    exchangeRate: 748.5,
    items: [
      {
        productId: "prod_tea_ghazal",
        productName: "\u0634\u0627\u064A \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646 \u0633\u064A\u0644\u0627\u0646\u064A \u0641\u0627\u062E\u0631 400 \u062C\u0645",
        quantity: 100,
        costInCurrency: 7.75,
        // 7.75 AED * 748.5 = ~5800 SDG
        currency: "AED",
        exchangeRate: 748.5,
        costSdg: 580087.5
      }
    ],
    totalCostSdg: 580087.5,
    paymentStatus: "paid",
    notes: "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0628\u0627\u0644\u062F\u0631\u0647\u0645 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A\u064A \u0645\u0639 \u0642\u064A\u062F \u0633\u0639\u0631 \u0627\u0644\u0635\u0631\u0641 \u0627\u0644\u062A\u0627\u0631\u064A\u062E\u064A \u0627\u0644\u0641\u0639\u0644\u064A",
    createdBy: "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F",
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_STORE_ORDERS = [
  {
    id: "ord_101",
    tenantId: "tenant_alrowad",
    orderNumber: "ORD-2026-901",
    customerName: "\u0641\u0627\u0637\u0645\u0629 \u0639\u0628\u062F \u0627\u0644\u0645\u0646\u0639\u0645",
    customerPhone: "0912445566",
    deliveryMethod: "delivery",
    deliveryAddress: "\u062D\u064A \u0627\u0644\u0635\u0641\u0627\u060C \u0627\u0644\u062E\u0631\u0637\u0648\u0645 - \u0642\u0631\u0628 \u0645\u0633\u062C\u062F \u0627\u0644\u0646\u0648\u0631",
    items: [
      { productId: "prod_cooking_oil", productName: "\u0632\u064A\u062A \u0635\u0628\u0627\u062D \u0646\u0642\u064A \u0644\u0644\u0637\u0647\u064A 4.5 \u0644\u062A\u0631", quantity: 1, unitPriceSdg: 23800, totalSdg: 23800 },
      { productId: "prod_sugar_kenana", productName: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 10 \u0643\u062C\u0645", quantity: 1, unitPriceSdg: 31500, totalSdg: 31500 }
    ],
    totalSdg: 55300,
    status: "new",
    paymentStatus: "paid_bankak",
    bankakRef: "BNK-APP-998231",
    notes: "\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0642\u0628\u0644 \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0644\u062A\u0633\u0644\u064A\u0645",
    createdAt: new Date(Date.now() - 40 * 60 * 1e3).toISOString()
  }
];
var INITIAL_PAYMENTS = [
  {
    id: "pay_sub_01",
    tenantId: "tenant_alrowad",
    planId: "plan_growth",
    amountSdg: 18e4,
    paymentMethod: "bankak",
    paymentRef: "BNK-TXN-1099238",
    bankTransferSlipUrl: "/assets/images/sanad_pos_hero_1792173270140.jpg",
    status: "approved",
    submittedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1e3).toISOString(),
    reviewedBy: "\u0625\u062F\u0627\u0631\u0629 \u0645\u0646\u0635\u0629 \u0633\u0646\u062F \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629",
    reviewNote: "\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0645\u0637\u0627\u0628\u0642\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u0648\u0627\u0644\u0625\u064A\u062F\u0627\u0639 \u0648\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0644\u0645\u062F\u0629 \u0634\u0647\u0631 \u0625\u0636\u0627\u0641\u064A",
    reviewedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "pay_sub_02",
    tenantId: "tenant_nile_boutique",
    planId: "plan_starter",
    amountSdg: 75e3,
    paymentMethod: "bankak",
    paymentRef: "BNK-TXN-2049182",
    status: "pending_review",
    submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_AUDIT_LOGS = [
  {
    id: "aud_1",
    tenantId: "tenant_alrowad",
    actorId: "emp_owner_rowad",
    actorName: "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F",
    action: "DISPATCH_TRANSFER",
    entity: "BranchTransfer",
    entityId: "trf_001",
    details: "\u0625\u0631\u0633\u0627\u0644 \u0634\u062D\u0646\u0629 \u0628\u0636\u0627\u0639\u0629 \u0645\u0646 \u0641\u0631\u0639 \u0627\u0644\u062E\u0631\u0637\u0648\u0645 \u0625\u0644\u0649 \u0641\u0631\u0639 \u0648\u062F \u0645\u062F\u0646\u064A \u0628\u0639\u062F \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629",
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1e3).toISOString()
  },
  {
    id: "aud_2",
    tenantId: "tenant_alrowad",
    actorId: "emp_cashier_kht",
    actorName: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647",
    action: "OPEN_SHIFT",
    entity: "CashierShift",
    entityId: "shift_kht_001",
    details: "\u0627\u0641\u062A\u062A\u0627\u062D \u0648\u0631\u062F\u064A\u0629 \u0627\u0644\u0635\u0628\u0627\u062D \u0628\u0631\u0635\u064A\u062F \u0646\u0642\u062F\u064A \u0623\u0648\u0644\u064A \u0642\u062F\u0631\u0647 50,000 \u062C.\u0633",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1e3).toISOString()
  }
];
var INITIAL_ALBANDAR_SHOWROOMS = [
  {
    id: "shw_albandar_motors",
    name: "\u0645\u0639\u0631\u0636 \u0627\u0644\u0628\u0646\u062F\u0631 \u0627\u0644\u062F\u0648\u0644\u064A \u0644\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0645\u0639\u062F\u0627\u062A",
    tradeName: "\u0627\u0644\u0628\u0646\u062F\u0631 \u0645\u0648\u062A\u0648\u0631\u0632 - \u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    category: "\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0645\u0631\u0643\u0628\u0627\u062A",
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    address: "\u0634\u0627\u0631\u0639 \u062F\u064A\u0645 \u0633\u0648\u0627\u0643\u0646 - \u0628\u062C\u0648\u0627\u0631 \u0627\u0644\u0645\u064A\u0646\u0627\u0621 \u0627\u0644\u062C\u0646\u0648\u0628\u064A",
    phone: "+249912300456",
    whatsapp: "+249912300456",
    logo: "/assets/images/albander_hyundai_car_1792184093653.jpg",
    bannerImage: "/assets/images/albander_pickup_truck_1792184123630.jpg",
    verified: true,
    rating: 4.9,
    listingsCount: 28,
    bio: "\u0645\u0639\u0631\u0636 \u0645\u0639\u062A\u0645\u062F \u0644\u0628\u064A\u0639 \u0648\u0634\u0631\u0627\u0621 \u0643\u0627\u0641\u0629 \u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A\u060C \u0627\u0644\u0628\u0643\u0627\u0633\u064A\u060C \u0627\u0644\u0631\u0643\u0634\u0627\u062A \u0648\u0627\u0644\u0634\u0627\u062D\u0646\u0627\u062A \u0648\u0627\u0631\u062F \u0627\u0644\u062E\u0644\u064A\u062C \u0648\u0627\u0644\u0648\u0643\u064A\u0644.",
    bankakAccount: "2847591"
  },
  {
    id: "shw_alrowad",
    name: "\u0645\u0624\u0633\u0633\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629 \u0648\u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F",
    tradeName: "\u0627\u0644\u0631\u0648\u0627\u062F \u0644\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u064A\u0629 \u0648\u0627\u0644\u062C\u0645\u0644\u0629",
    category: "\u0633\u0644\u0639 \u0648\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629",
    city: "\u0639\u0637\u0628\u0631\u0629",
    address: "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0643\u0628\u064A\u0631 - \u0645\u062C\u0645\u0639 \u0627\u0644\u0631\u0648\u0627\u062F \u0627\u0644\u062A\u062C\u0627\u0631\u064A",
    phone: "+249912345678",
    whatsapp: "+249912345678",
    logo: "/assets/images/product_sugar_kenana_1792173270044.jpg",
    bannerImage: "/assets/images/sanad_pos_hero_1792173270140.jpg",
    verified: true,
    rating: 4.8,
    listingsCount: 45,
    bio: "\u0648\u0643\u0644\u0627\u0621 \u0643\u0628\u0631\u0649 \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0627\u0644\u063A\u0630\u0627\u0626\u064A\u0629 (\u0643\u0646\u0627\u0646\u0629\u060C \u0635\u0628\u0627\u062D\u060C \u0633\u064A\u0642\u0627\u060C \u0627\u0644\u063A\u0632\u0627\u0644\u062A\u064A\u0646) - \u0628\u064A\u0639 \u062C\u0645\u0644\u0629 \u0648\u062A\u062C\u0632\u0626\u0629 \u0644\u0643\u0627\u0641\u0629 \u0648\u0644\u0627\u064A\u0627\u062A \u0627\u0644\u0633\u0648\u062F\u0627\u0646.",
    bankakAccount: "1982736",
    tenantSlug: "alrowad-co"
  },
  {
    id: "shw_neelain_tech",
    name: "\u0645\u0631\u0643\u0632 \u0627\u0644\u0646\u064A\u0644\u064A\u0646 \u0644\u0644\u062A\u0642\u0646\u064A\u0629 \u0648\u0627\u0644\u0637\u0627\u0642\u0629 \u0627\u0644\u0634\u0645\u0633\u064A\u0629",
    tradeName: "\u0627\u0644\u0646\u064A\u0644\u064A\u0646 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u0643\u0633",
    category: "\u0647\u0648\u0627\u062A\u0641 \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    city: "\u0643\u0633\u0644\u0627",
    address: "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0634\u0639\u0628\u064A - \u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u062F\u0627\u0631\u0633",
    phone: "+249900112233",
    whatsapp: "+249900112233",
    logo: "/assets/images/albander_macbook_laptop_1792184108039.jpg",
    bannerImage: "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80",
    verified: true,
    rating: 4.9,
    listingsCount: 34,
    bio: "\u0623\u062D\u062F\u062B \u0627\u0644\u0647\u0648\u0627\u062A\u0641 \u0627\u0644\u0630\u0643\u064A\u0629\u060C \u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0643\u0645\u0628\u064A\u0648\u062A\u0631\u060C \u0648\u0645\u0646\u0638\u0648\u0645\u0627\u062A \u0627\u0644\u0637\u0627\u0642\u0629 \u0627\u0644\u0634\u0645\u0633\u064A\u0629 \u0627\u0644\u0647\u062C\u064A\u0646\u0629 \u0648\u0627\u0644\u0628\u0637\u0627\u0631\u064A\u0627\u062A \u0639\u0627\u0644\u064A\u0629 \u0627\u0644\u0643\u0641\u0627\u0621\u0629.",
    bankakAccount: "3109482"
  },
  {
    id: "shw_gedaref_crops",
    name: "\u0648\u0643\u0627\u0644\u0629 \u0627\u0644\u0642\u0636\u0627\u0631\u0641 \u0644\u0644\u0645\u062D\u0627\u0635\u064A\u0644 \u0648\u0627\u0644\u062B\u0631\u0648\u0629 \u0627\u0644\u062D\u064A\u0648\u0627\u0646\u064A\u0629",
    tradeName: "\u0628\u0648\u0631\u0635\u0629 \u0645\u062D\u0627\u0635\u064A\u0644 \u0627\u0644\u0641\u0634\u0642\u0629",
    category: "\u0645\u062D\u0627\u0635\u064A\u0644 \u0648\u062B\u0631\u0648\u0629 \u062D\u064A\u0648\u0627\u0646\u064A\u0629",
    city: "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    address: "\u0628\u0648\u0631\u0635\u0629 \u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u0645\u062D\u0627\u0635\u064A\u0644 - \u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    phone: "+249915556677",
    whatsapp: "+249915556677",
    logo: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80",
    bannerImage: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80",
    verified: true,
    rating: 4.7,
    listingsCount: 19,
    bio: "\u062A\u0648\u0631\u064A\u062F \u0648\u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0633\u0645\u0633\u0645 \u0627\u0644\u0623\u0628\u064A\u0636 \u0648\u0627\u0644\u0623\u062D\u0645\u0631\u060C \u0627\u0644\u0635\u0645\u063A \u0627\u0644\u0639\u0631\u0628\u064A\u060C \u0627\u0644\u0641\u0648\u0644 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A \u0648\u0627\u0644\u0645\u0648\u0627\u0634\u064A \u0627\u0644\u062D\u064A\u0629 \u0628\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0628\u0648\u0631\u0635\u0629.",
    bankakAccount: "4452109"
  }
];
var INITIAL_ALBANDAR_LISTINGS = [
  {
    id: "alb_car_01",
    title: "\u0647\u064A\u0648\u0646\u062F\u0627\u064A \u0623\u0641\u0627\u0646\u062A\u064A HD \u0645\u0648\u062F\u064A\u0644 2018 \u062E\u0627\u0644\u064A\u0629 \u0645\u0646 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0648\u0627\u0631\u062F \u0627\u0644\u062E\u0644\u064A\u062C",
    description: "\u0639\u0631\u0628\u064A\u0629 \u0634\u0627\u0630\u0629 \u0648\u0643\u0631\u062A\u060C \u062A\u0631\u062E\u064A\u0635 \u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646 \u062C\u0645\u0631\u0643 \u0643\u0627\u0645\u0644\u060C \u0645\u0643\u064A\u0641 \u062B\u0644\u0627\u062C\u0629\u060C \u0642\u064A\u0631 \u0623\u0648\u062A\u0648\u0645\u0627\u062A\u064A\u0643\u060C \u0634\u0627\u0634\u0629 \u0648\u0643\u0627\u0645\u064A\u0631\u0627\u060C \u0643\u0641\u0631\u0627\u062A \u062C\u062F\u064A\u062F\u0629 \u0645\u0639 \u0628\u0637\u0627\u0631\u064A\u0629 \u0632\u064A\u0631\u0648\u060C \u0627\u0644\u0633\u0639\u0631 \u0642\u0627\u0628\u0644 \u0644\u0644\u062A\u0641\u0627\u0648\u0636 \u0627\u0644\u0628\u0633\u064A\u0637 \u0628\u0639\u062F \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629.",
    category: "cars",
    categoryNameAr: "\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0645\u0631\u0643\u0628\u0627\u062A",
    priceSdg: 185e5,
    priceUsd: 6850,
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631",
    condition: "\u0645\u0633\u062A\u0639\u0645\u0644 \u0628\u062D\u0627\u0644\u0629 \u0645\u0645\u062A\u0627\u0632\u0629",
    imageUrl: "/assets/images/albander_hyundai_car_1792184093653.jpg",
    sellerName: "\u0645\u0639\u0631\u0636 \u0627\u0644\u0628\u0646\u062F\u0631 \u0644\u0644\u0633\u064A\u0627\u0631\u0627\u062A",
    sellerType: "showroom",
    sellerPhone: "+249912300456",
    sellerWhatsapp: "+249912300456",
    isVerifiedMerchant: true,
    viewsCount: 1420,
    featured: true,
    createdAt: new Date(Date.now() - 3 * 3600 * 1e3).toISOString(),
    locationDetails: "\u062D\u064A \u0627\u0644\u0645\u0637\u0627\u0631 - \u0634\u0627\u0631\u0639 \u062F\u064A\u0645 \u0633\u0648\u0627\u0643\u0646 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    bankakAccount: "2847591"
  },
  {
    id: "alb_car_02",
    title: "\u062A\u0648\u064A\u0648\u062A\u0627 \u0647\u0627\u064A\u0644\u0648\u0643\u0633 \u062F\u0628\u0644 \u0643\u0627\u0628\u064A\u0646\u0629 \u0645\u0648\u062F\u064A\u0644 2022 GLX \u062F\u064A\u0632\u0644 \u0623\u0635\u0644\u064A\u0629",
    description: "\u0628\u0648\u0643\u0633 \u062F\u0628\u0644 \u0643\u0627\u0628 \u0645\u0627 \u0634\u0627\u0621 \u0627\u0644\u0644\u0647 \u0635\u0644\u0627\u0629 \u0627\u0644\u0646\u0628\u064A\u060C \u062F\u0641\u0639 \u0631\u0628\u0627\u0639\u064A 4x4\u060C \u0645\u0643\u0646\u0629 \u0643\u0628\u064A\u0631\u0629 \u062F\u064A\u0632\u0644 \u062A\u064A\u0631\u0628\u0648\u060C \u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0648\u0642\u0648\u062F \u0645\u0645\u062A\u0627\u0632\u060C \u0645\u0641\u062D\u0648\u0635\u0629 \u0648\u0645\u062C\u0645\u0631\u0643\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0641\u064A \u0627\u0644\u0642\u0636\u0627\u0631\u0641 \u062C\u0627\u0647\u0632\u0629 \u0644\u0644\u062A\u062D\u0648\u064A\u0644.",
    category: "cars",
    categoryNameAr: "\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0645\u0631\u0643\u0628\u0627\u062A",
    priceSdg: 52e6,
    priceUsd: 19250,
    city: "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    state: "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    condition: "\u0648\u0627\u0631\u062F \u062F\u0628\u064A",
    imageUrl: "/assets/images/albander_pickup_truck_1792184123630.jpg",
    sellerName: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0642\u0636\u0627\u0631\u0641 \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0627\u0644\u0622\u0644\u064A\u0627\u062A",
    sellerType: "merchant",
    sellerPhone: "+249123456789",
    sellerWhatsapp: "+249123456789",
    isVerifiedMerchant: true,
    viewsCount: 980,
    featured: true,
    createdAt: new Date(Date.now() - 7 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0635\u0646\u0627\u0639\u064A\u0629 - \u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    bankakAccount: "1982736"
  },
  {
    id: "alb_elec_01",
    title: "\u0623\u0628\u0644 \u0645\u0627\u0643 \u0628\u0648\u0643 \u0628\u0631\u0648 M3 Pro \u0633\u0639\u0629 512 \u062C\u064A\u062C\u0627\u0628\u0627\u064A\u062A \u0643\u0631\u062A\u0648\u0646\u0629 \u0632\u064A\u0631\u0648",
    description: "Apple MacBook Pro M3 Pro Chip, 18GB Unified Memory, 512GB SSD, Retina XDR Display. \u062C\u0647\u0627\u0632 \u062C\u062F\u064A\u062F \u0644\u0645 \u064A\u064F\u0641\u062A\u062D \u0648\u0627\u0631\u062F \u0627\u0644\u0648\u0643\u064A\u0644\u060C \u0636\u0645\u0627\u0646 \u0633\u0646\u0629 \u0643\u0627\u0645\u0644\u0629\u060C \u0628\u0637\u0627\u0631\u064A\u0629 \u062A\u062F\u0648\u0645 \u062D\u062A\u0649 22 \u0633\u0627\u0639\u0629.",
    category: "electronics",
    categoryNameAr: "\u0647\u0648\u0627\u062A\u0641 \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    priceSdg: 42e5,
    priceUsd: 1550,
    city: "\u0639\u0637\u0628\u0631\u0629",
    state: "\u0646\u0647\u0631 \u0627\u0644\u0646\u064A\u0644",
    condition: "\u062C\u062F\u064A\u062F \u0628\u0627\u0644\u0643\u0631\u062A\u0648\u0646\u0629",
    imageUrl: "/assets/images/albander_macbook_laptop_1792184108039.jpg",
    sellerName: "\u0645\u062A\u062C\u0631 \u0627\u0644\u0646\u064A\u0644\u064A\u0646 \u0644\u0644\u062A\u0642\u0646\u064A\u0629 \u0648\u0627\u0644\u0623\u062C\u0647\u0632\u0629",
    sellerType: "showroom",
    sellerPhone: "+249900112233",
    sellerWhatsapp: "+249900112233",
    isVerifiedMerchant: true,
    viewsCount: 760,
    featured: true,
    createdAt: new Date(Date.now() - 12 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0643\u0628\u064A\u0631 - \u0639\u0645\u0627\u0631\u0629 \u0627\u0644\u0633\u0644\u0627\u0645",
    bankakAccount: "3109482"
  },
  {
    id: "alb_prop_01",
    title: "\u0634\u0642\u0629 \u0645\u0641\u0631\u0648\u0634\u0629 \u0631\u0627\u0642\u064A\u0629 VIP \u0644\u0644\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0634\u0647\u0631\u064A \u0648\u0627\u0644\u064A\u0648\u0645\u064A \u062D\u064A \u0627\u0644\u0645\u0637\u0627\u0631",
    description: "\u0634\u0642\u0629 \u0633\u0648\u0628\u0631 \u062F\u064A\u0644\u0648\u0643\u0633 3 \u063A\u0631\u0641 \u0648\u0635\u0627\u0644\u0629 \u0648\u0647\u0648\u0644 \u0643\u0628\u064A\u0631\u060C 2 \u062D\u0645\u0627\u0645\u060C \u0645\u0637\u0628\u062E \u0645\u062C\u0647\u0632 \u0628\u0643\u0627\u0641\u0629 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064A\u0629\u060C \u0645\u0643\u064A\u0641\u0627\u062A \u0633\u0628\u0644\u064A\u062A \u0641\u064A \u0643\u0644 \u0627\u0644\u063A\u0631\u0641\u060C \u0645\u0648\u0644\u062F \u0643\u0647\u0631\u0628\u0627\u0626\u064A \u0623\u0648\u062A\u0648\u0645\u0627\u062A\u064A\u0643\u064A \u0648\u0645\u064A\u0627\u0647 \u0645\u062A\u0648\u0641\u0631\u0629 24 \u0633\u0627\u0639\u0629\u060C \u062D\u0631\u0627\u0633\u0629 \u0648\u0645\u0635\u0639\u062F.",
    category: "real_estate",
    categoryNameAr: "\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0623\u0631\u0627\u0636\u064A",
    priceSdg: 95e4,
    priceUsd: 350,
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631",
    condition: "\u0645\u0641\u0631\u0648\u0634\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644",
    imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0627\u0644\u062F\u0627\u0631 \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0639\u0642\u0627\u0631\u064A\u0629",
    sellerType: "merchant",
    sellerPhone: "+249911223344",
    sellerWhatsapp: "+249911223344",
    isVerifiedMerchant: true,
    viewsCount: 2310,
    featured: true,
    createdAt: new Date(Date.now() - 15 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646 - \u062D\u064A \u0627\u0644\u0645\u0637\u0627\u0631 \u062C\u0648\u0627\u0631 \u0635\u0627\u0644\u0629 \u0643\u0628\u0627\u0631 \u0627\u0644\u0632\u0648\u0627\u0631"
  },
  {
    id: "alb_crops_01",
    title: "\u0633\u0645\u0633\u0645 \u0627\u0644\u0642\u0636\u0627\u0631\u0641 \u0627\u0644\u0623\u0628\u064A\u0636 \u062F\u0631\u062C\u0629 \u0623\u0648\u0644\u0649 \u0644\u0644\u062A\u0635\u062F\u064A\u0631 (\u062C\u0648\u0627\u0644 100 \u0643\u062C\u0645)",
    description: "\u0633\u0645\u0633\u0645 \u0623\u0628\u064A\u0636 \u0646\u062E\u0628 \u0623\u0648\u0644 \u063A\u0631\u0628\u0644\u0629 \u0648\u062A\u0639\u0628\u0626\u0629 \u062D\u062F\u064A\u062B\u0629\u060C \u0645\u0648\u0627\u0635\u0641\u0627\u062A \u0642\u064A\u0627\u0633\u064A\u0629 \u0644\u0644\u062A\u0635\u062F\u064A\u0631 \u0648\u0627\u0644\u0645\u0639\u0627\u0635\u0631\u060C \u062E\u0627\u0644\u064A \u0645\u0646 \u0627\u0644\u0634\u0648\u0627\u0626\u0628 \u0628\u0646\u0633\u0628\u0629 99.5%\u060C \u0645\u062A\u0648\u0641\u0631 \u0643\u0645\u064A\u0627\u062A \u0643\u0628\u064A\u0631\u0629 \u0645\u0646 \u0627\u0644\u0645\u062E\u0632\u0646 \u0645\u0628\u0627\u0634\u0631\u0629 \u0644\u0644\u062A\u0633\u0644\u064A\u0645.",
    category: "livestock_crops",
    categoryNameAr: "\u0645\u062D\u0627\u0635\u064A\u0644 \u0648\u062B\u0631\u0648\u0629 \u062D\u064A\u0648\u0627\u0646\u064A\u0629",
    priceSdg: 185e3,
    priceUsd: 68,
    city: "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    state: "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
    condition: "\u0625\u0646\u062A\u0627\u062C \u0645\u062D\u0644\u064A \u0646\u062E\u0628 \u0623\u0648\u0644",
    imageUrl: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0648\u0643\u0627\u0644\u0629 \u0645\u062D\u0627\u0635\u064A\u0644 \u0627\u0644\u0641\u0634\u0642\u0629",
    sellerType: "merchant",
    sellerPhone: "+249915556677",
    sellerWhatsapp: "+249915556677",
    isVerifiedMerchant: true,
    viewsCount: 890,
    featured: false,
    createdAt: new Date(Date.now() - 24 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0645\u062E\u0627\u0632\u0646 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0635\u0646\u0627\u0639\u064A\u0629 \u0628\u0627\u0644\u0642\u0636\u0627\u0631\u0641"
  },
  {
    id: "alb_groc_01",
    title: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0641\u0627\u062E\u0631 \u0639\u0628\u0648\u0629 10 \u0643\u062C\u0645 \u064850 \u0643\u062C\u0645 \u062C\u0645\u0644\u0629 \u0644\u0644\u0645\u062A\u0627\u062C\u0631",
    description: "\u0633\u0643\u0631 \u0643\u0646\u0627\u0646\u0629 \u0646\u0642\u064A \u0623\u0628\u064A\u0636 \u0628\u0644\u0648\u0631\u0627\u062A \u0641\u0627\u062E\u0631\u0629\u060C \u0627\u0644\u0643\u0645\u064A\u0627\u062A \u0645\u062A\u0648\u0641\u0631\u0629 \u0641\u064A \u0643\u0627\u0641\u0629 \u0641\u0631\u0648\u0639\u0646\u0627 \u0645\u0639 \u0625\u0645\u0643\u0627\u0646\u064A\u0629 \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0648\u0627\u0644\u0634\u062D\u0646 \u0644\u0643\u0627\u0641\u0629 \u0645\u062F\u0646 \u0648\u0644\u0627\u064A\u0629 \u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631 \u0648\u0646\u0647\u0631 \u0627\u0644\u0646\u064A\u0644\u060C \u062F\u0641\u0639 \u0639\u0628\u0631 \u0628\u0646\u0643\u0643 \u0645\u0628\u0627\u0634\u0631\u0629.",
    category: "groceries",
    categoryNameAr: "\u0633\u0644\u0639 \u0648\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629",
    priceSdg: 31500,
    priceUsd: 12,
    city: "\u0639\u0637\u0628\u0631\u0629",
    state: "\u0646\u0647\u0631 \u0627\u0644\u0646\u064A\u0644",
    condition: "\u062C\u062F\u064A\u062F \u0625\u0646\u062A\u0627\u062C \u0643\u0646\u0627\u0646\u0629",
    imageUrl: "/assets/images/product_sugar_kenana_1792173270044.jpg",
    sellerName: "\u0645\u0624\u0633\u0633\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629 (\u0627\u0644\u0645\u062A\u062C\u0631 \u0627\u0644\u0645\u0639\u062A\u0645\u062F)",
    sellerType: "merchant",
    sellerPhone: "+249912345678",
    sellerWhatsapp: "+249912345678",
    isVerifiedMerchant: true,
    viewsCount: 3120,
    featured: true,
    createdAt: new Date(Date.now() - 8 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0633\u0648\u0642 \u0639\u0637\u0628\u0631\u0629 \u0627\u0644\u0643\u0628\u064A\u0631 - \u0645\u062C\u0645\u0639 \u0627\u0644\u0631\u0648\u0627\u062F",
    bankakAccount: "1982736"
  },
  {
    id: "alb_elec_02",
    title: "\u0633\u0627\u0645\u0633\u0648\u0646\u062C \u062C\u0627\u0644\u0643\u0633\u064A S24 \u0623\u0644\u062A\u0631\u0627 512 \u062C\u064A\u062C\u0627\u0628\u0627\u064A\u062A \u062A\u064A\u062A\u0627\u0646\u064A\u0648\u0645 \u0643\u0631\u062A\u0648\u0646\u0629",
    description: "Samsung Galaxy S24 Ultra 512GB Titanium Grey, \u0634\u0631\u064A\u062D\u062A\u064A\u0646 Nano-SIM + eSIM\u060C \u0642\u0644\u0645 S-Pen \u0645\u062F\u0645\u062C\u060C \u064A\u062F\u0639\u0645 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A Galaxy AI \u0628\u0627\u0644\u0643\u0627\u0645\u0644\u060C \u0645\u0644\u062D\u0642\u0627\u062A \u0623\u0635\u0644\u064A\u0629 \u0643\u0627\u0645\u0644\u0629.",
    category: "electronics",
    categoryNameAr: "\u0647\u0648\u0627\u062A\u0641 \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    priceSdg: 295e4,
    priceUsd: 1090,
    city: "\u0643\u0633\u0644\u0627",
    state: "\u0643\u0633\u0644\u0627",
    condition: "\u062C\u062F\u064A\u062F \u0643\u0631\u062A\u0648\u0646\u0629",
    imageUrl: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0627\u0644\u0628\u0631\u0646\u0633 \u0644\u0644\u0645\u0648\u0628\u0627\u064A\u0644 \u0648\u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    sellerType: "individual",
    sellerPhone: "+249918765432",
    sellerWhatsapp: "+249918765432",
    isVerifiedMerchant: false,
    viewsCount: 1140,
    featured: false,
    createdAt: new Date(Date.now() - 18 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0643\u0633\u0644\u0627 - \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0634\u0639\u0628\u064A"
  },
  {
    id: "alb_prop_02",
    title: "\u0645\u0646\u0632\u0644 \u0644\u0648\u062F\u0628\u064A\u0631\u0646\u0642 \u0645\u0633\u0644\u062D \u062A\u0634\u0637\u064A\u0628 \u0633\u0648\u0628\u0631 \u062F\u064A\u0644\u0648\u0643\u0633 \u062D\u064A \u0627\u0644\u0646\u0647\u0636\u0629",
    description: "\u0645\u0633\u0627\u062D\u0629 400 \u0645\u062A\u0631 \u0645\u0631\u0628\u0639\u060C \u0645\u0628\u0646\u064A \u0644\u0648\u062F\u0628\u064A\u0631\u0646\u0642 \u064A\u0631\u0643\u0628 \u0637\u0627\u0628\u0642\u064A\u0646 \u0625\u0636\u0627\u0641\u064A\u0629\u060C 4 \u063A\u0631\u0641\u060C \u0635\u0627\u0644\u0648\u0646 \u0643\u0628\u064A\u0631\u060C 3 \u062D\u0645\u0627\u0645\u0627\u062A\u060C \u062D\u0648\u0634 \u0648\u0627\u0633\u0639 \u0633\u064A\u0631\u0627\u0645\u064A\u0643\u060C \u062C\u0627\u0647\u0632 \u0644\u0644\u0633\u0643\u0646 \u0627\u0644\u0641\u0648\u0631\u064A\u060C \u0634\u0647\u0627\u062F\u0629 \u0628\u062D\u062B \u0645\u0644\u0643 \u062D\u0631.",
    category: "real_estate",
    categoryNameAr: "\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0623\u0631\u0627\u0636\u064A",
    priceSdg: 48e6,
    priceUsd: 17800,
    city: "\u0639\u0637\u0628\u0631\u0629",
    state: "\u0646\u0647\u0631 \u0627\u0644\u0646\u064A\u0644",
    condition: "\u062C\u062F\u064A\u062F",
    imageUrl: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0645\u0643\u062A\u0628 \u0627\u0644\u0648\u0641\u0627\u0642 \u0627\u0644\u0639\u0642\u0627\u0631\u064A",
    sellerType: "merchant",
    sellerPhone: "+249922334455",
    sellerWhatsapp: "+249922334455",
    isVerifiedMerchant: true,
    viewsCount: 1890,
    featured: false,
    createdAt: new Date(Date.now() - 36 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0639\u0637\u0628\u0631\u0629 - \u062D\u064A \u0627\u0644\u0646\u0647\u0636\u0629 \u0645\u0631\u0628\u0639 4"
  },
  {
    id: "alb_fash_01",
    title: "\u062B\u064A\u0627\u0628 \u0633\u0648\u062F\u0627\u0646\u064A\u0629 \u062A\u0648\u062A\u0627\u0644 \u0633\u0648\u064A\u0633\u0631\u064A \u062D\u0631\u064A\u0631 \u0643\u0631\u064A\u0628 \u0645\u0639 \u062A\u0637\u0631\u064A\u0632 \u0634\u0643 \u064A\u062F\u0648\u064A",
    description: "\u0623\u0631\u0642\u0649 \u062A\u0634\u0643\u064A\u0644\u0629 \u062B\u064A\u0627\u0628 \u0645\u0646\u0627\u0633\u0628\u0627\u062A \u0648\u0623\u0639\u0631\u0627\u0633\u060C \u0642\u0645\u0627\u0634 \u062A\u0648\u062A\u0627\u0644 \u0633\u0648\u064A\u0633\u0631\u064A \u0623\u0635\u0644\u064A \u0628\u0627\u0631\u062F \u0648\u062B\u0627\u0628\u062A\u060C \u062A\u0637\u0631\u064A\u0632 \u062D\u0631\u064A\u0631 \u0648\u0634\u0643 \u062E\u0631\u0632 \u064A\u062F\u0648\u064A \u0641\u0627\u062E\u0631\u060C \u0623\u0644\u0648\u0627\u0646 \u0632\u0627\u0647\u064A\u0629 \u0648\u0643\u0645\u064A\u0627\u062A \u062D\u0635\u0631\u064A\u0629 \u0644\u0644\u0623\u0646\u0627\u0642\u0629 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A\u0629.",
    category: "fashion",
    categoryNameAr: "\u0623\u0632\u064A\u0627\u0621 \u0648\u0645\u0648\u0636\u0629",
    priceSdg: 45e4,
    priceUsd: 165,
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631",
    condition: "\u062C\u062F\u064A\u062F \u0623\u0635\u0644\u064A",
    imageUrl: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0628\u0648\u062A\u064A\u0643 \u0627\u0644\u0646\u064A\u0644\u064A\u0646 \u0644\u0644\u0623\u0632\u064A\u0627\u0621 \u0627\u0644\u0631\u0627\u0642\u064A\u0629",
    sellerType: "merchant",
    sellerPhone: "+249912987654",
    sellerWhatsapp: "+249912987654",
    isVerifiedMerchant: true,
    viewsCount: 650,
    featured: false,
    createdAt: new Date(Date.now() - 14 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646 - \u0634\u0627\u0631\u0639 \u0627\u0644\u0628\u0644\u062F\u064A\u0629"
  },
  {
    id: "alb_serv_01",
    title: "\u062E\u062F\u0645\u0627\u062A \u062A\u062E\u0644\u064A\u0635 \u062C\u0645\u0631\u0643\u064A \u0648\u062A\u0631\u062D\u064A\u0644 \u0628\u0636\u0627\u0626\u0639 \u0645\u064A\u0646\u0627\u0621 \u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    description: "\u062A\u062E\u0644\u064A\u0635 \u0648\u0645\u0646\u0627\u0648\u0644\u0629 \u0643\u0627\u0641\u0629 \u0627\u0644\u062D\u0627\u0648\u064A\u0627\u062A \u0648\u0627\u0644\u0628\u0636\u0627\u0626\u0639 \u0628\u0627\u0644\u0645\u064A\u0646\u0627\u0621 \u0627\u0644\u062C\u0646\u0648\u0628\u064A \u0648\u0627\u0644\u0634\u0645\u0627\u0644\u064A\u060C \u0633\u0631\u0639\u0629 \u0641\u064A \u0627\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u062C\u0645\u0631\u0643\u064A\u0629\u060C \u062A\u0623\u0645\u064A\u0646 \u0623\u0633\u0627\u0637\u064A\u0644 \u0634\u0627\u062D\u0646\u0627\u062A \u0644\u0644\u0646\u0642\u0644 \u0648\u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u0644\u0643\u0627\u0641\u0629 \u0627\u0644\u0648\u0644\u0627\u064A\u0627\u062A.",
    category: "services",
    categoryNameAr: "\u062E\u062F\u0645\u0627\u062A \u0648\u0623\u0639\u0645\u0627\u0644",
    priceSdg: 12e4,
    priceUsd: 45,
    city: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631",
    condition: "\u062E\u062F\u0645\u0629 \u0645\u0639\u062A\u0645\u062F\u0629",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
    sellerName: "\u0645\u0643\u062A\u0628 \u0627\u0644\u0628\u0646\u062F\u0631 \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629 \u0648\u0627\u0644\u062A\u062E\u0644\u064A\u0635",
    sellerType: "showroom",
    sellerPhone: "+249911998877",
    sellerWhatsapp: "+249911998877",
    isVerifiedMerchant: true,
    viewsCount: 1350,
    featured: true,
    createdAt: new Date(Date.now() - 20 * 3600 * 1e3).toISOString(),
    locationDetails: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646 - \u0642\u0631\u0628 \u0631\u0626\u0627\u0633\u0629 \u0647\u064A\u0626\u0629 \u0627\u0644\u0645\u0648\u0627\u0646\u0626 \u0627\u0644\u0628\u062D\u0631\u064A\u0629"
  }
];
var INITIAL_MARKET_BANNERS = [
  {
    id: "bnr_cars",
    title: "\u0623\u0639\u0644\u0646 \u0639\u0646 \u0645\u0639\u0631\u0636 \u0633\u064A\u0627\u0631\u0627\u062A\u0643 \u0647\u0646\u0627",
    subtitle: "\u0643\u0646 \u0645\u0646 \u0623\u0648\u0627\u0626\u0644 \u0627\u0644\u0645\u0639\u0644\u0646\u064A\u0646 \u0641\u064A \u0633\u0648\u0642 \u0633\u0646\u062F",
    badge: "\u2605\u2605\u2605\u2605\u2605",
    imageUrl: "/assets/images/albander_hyundai_car_1792184093653.jpg",
    active: true,
    sortOrder: 1,
    advertiserName: "\u0645\u0639\u0631\u0636 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0639\u062A\u0645\u062F",
    createdAt: "2026-10-01T08:00:00.000Z"
  },
  {
    id: "bnr_appliances",
    title: "\u0639\u0631\u0648\u0636 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064A\u0629 \u0648\u0627\u0644\u0645\u0643\u064A\u0641\u0627\u062A",
    subtitle: "\u0623\u0641\u0636\u0644 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0645\u0639 \u0636\u0645\u0627\u0646 \u0645\u0639\u062A\u0645\u062F \u0648\u062A\u0631\u0643\u064A\u0628 \u0641\u0648\u0631\u064A",
    badge: "\u0636\u0645\u0627\u0646 \u0645\u0639\u062A\u0645\u062F",
    imageUrl: "/assets/aistudio/Screenshot_________________9bd493de.jpg",
    active: true,
    sortOrder: 2,
    advertiserName: "\u0645\u0639\u0631\u0636 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0645\u0646\u0632\u0644\u064A\u0629",
    createdAt: "2026-10-01T08:05:00.000Z"
  },
  {
    id: "bnr_groceries",
    title: "\u062A\u0633\u0648\u0642 \u0645\u0646 \u0627\u0644\u0645\u062A\u0627\u062C\u0631 \u0627\u0644\u0643\u0628\u0631\u0649 \u0627\u0644\u0645\u0639\u062A\u0645\u062F\u0629",
    subtitle: "\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629 \u0648\u063A\u0630\u0627\u0626\u064A\u0629 \u0628\u0627\u0644\u062C\u0645\u0644\u0629 \u0648\u0627\u0644\u062F\u0641\u0639 \u0628\u0628\u0646\u0643\u0643",
    badge: "\u062A\u0648\u0635\u064A\u0644 \u0633\u0631\u064A\u0639",
    imageUrl: "/assets/images/sanad_pos_hero_1792173270140.jpg",
    active: true,
    sortOrder: 3,
    advertiserName: "\u0645\u0646\u0635\u0629 \u0633\u0646\u062F",
    createdAt: "2026-10-01T08:10:00.000Z"
  }
];
var INITIAL_NOTIFICATIONS = [
  {
    id: "ntf_seed_ad",
    app: "admin",
    kind: "new_ad",
    title: "\u0625\u0639\u0644\u0627\u0646 \u062C\u062F\u064A\u062F \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629",
    body: "\u0644\u0627\u0628\u062A\u0648\u0628 \u0648\u0645\u0627\u0643 \u0628\u0648\u0643 \u0645\u0633\u062A\u0639\u0645\u0644 \u0628\u062D\u0627\u0644\u0629 \u0645\u0645\u062A\u0627\u0632\u0629 \u2014 \u0631\u0633\u0648\u0645 \u0627\u0644\u0646\u0634\u0631 \u0645\u062C\u0627\u0646\u064A\u0629.",
    linkTab: "market_ads",
    read: false,
    createdAt: "2026-10-20T08:30:00.000Z"
  },
  {
    id: "ntf_seed_store",
    app: "admin",
    kind: "new_store_request",
    title: "\u0637\u0644\u0628 \u0645\u062A\u062C\u0631 \u062C\u062F\u064A\u062F",
    body: "\u0645\u0637\u0639\u0645 \u0646\u064A\u0644 \u0643\u0633\u0644\u0627 (\u0643\u0633\u0644\u0627) \u2014 \u0641\u0631\u0639\u0627\u0646\u060C \u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 50,000 \u062C.\u0633.",
    linkTab: "tenant_requests",
    read: false,
    createdAt: "2026-10-20T07:10:00.000Z"
  },
  {
    id: "ntf_seed_order",
    app: "merchant",
    kind: "new_order",
    title: "\u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u062C\u062F\u064A\u062F \u0645\u0646 \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062C\u0645\u0647\u0648\u0631",
    body: "\u0637\u0644\u0628 ORD-2026-101 \u0628\u0642\u064A\u0645\u0629 45,000 \u062C.\u0633 \u2014 \u062C\u0627\u0647\u0632 \u0644\u0644\u062A\u062C\u0647\u064A\u0632.",
    linkTab: "storefront",
    read: false,
    createdAt: "2026-10-20T09:05:00.000Z"
  },
  {
    id: "ntf_seed_client",
    app: "client",
    kind: "order_status",
    title: "\u0637\u0644\u0628\u0643 \u0641\u064A \u0627\u0644\u0637\u0631\u064A\u0642",
    body: "\u0637\u0644\u0628\u0643 ORD-2026-101 \u062E\u0631\u062C \u0644\u0644\u062A\u0648\u0635\u064A\u0644\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0633\u062A\u0639\u062F\u0627\u062F \u0644\u0627\u0633\u062A\u0644\u0627\u0645\u0647.",
    linkTab: "track_order",
    read: false,
    createdAt: "2026-10-20T09:40:00.000Z"
  }
];
var INITIAL_TENANT_APPLICATIONS = [
  {
    id: "tapp_demo_pending",
    storeName: "\u0645\u0637\u0639\u0645 \u0646\u064A\u0644 \u0643\u0633\u0644\u0627",
    ownerName: "\u0639\u062B\u0645\u0627\u0646 \u0625\u062F\u0631\u064A\u0633",
    wilaya: "\u0643\u0633\u0644\u0627",
    city: "\u0643\u0633\u0644\u0627",
    phone: "0913224455",
    email: "nile.kassala@example.com",
    branchesCount: 2,
    businessType: "\u0645\u0637\u0627\u0639\u0645 \u0648\u0643\u0627\u0641\u064A\u0647\u0627\u062A",
    notes: "\u0646\u0631\u063A\u0628 \u0641\u064A \u0631\u0628\u0637 \u0641\u0631\u0639\u064A\u0646 \u0648\u0646\u0642\u0637\u0629 \u0628\u064A\u0639 \u0648\u0627\u062D\u062F\u0629 \u0641\u064A \u0627\u0644\u0628\u062F\u0627\u064A\u0629.",
    source: "client",
    status: "pending",
    registrationFeeSdg: 5e4,
    createdAt: "2026-10-15T09:20:00.000Z"
  },
  {
    id: "tapp_demo_approved",
    storeName: "\u0628\u0642\u0627\u0644\u0629 \u0627\u0644\u0628\u0631\u0643\u0629",
    ownerName: "\u0641\u0627\u0637\u0645\u0629 \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u0645\u0646",
    wilaya: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    city: "\u0623\u0645 \u062F\u0631\u0645\u0627\u0646",
    phone: "0922334455",
    branchesCount: 1,
    businessType: "\u0628\u0642\u0627\u0644\u0627\u062A \u0648\u0645\u0648\u0627\u062F \u063A\u0630\u0627\u0626\u064A\u0629",
    source: "merchant",
    status: "approved",
    registrationFeeSdg: 5e4,
    activationCode: "SND-7K2M-9Q4P",
    codeSentVia: "whatsapp",
    codeSentAt: "2026-10-12T11:05:00.000Z",
    reviewedBy: "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F",
    reviewedAt: "2026-10-12T11:05:00.000Z",
    createdAt: "2026-10-11T08:00:00.000Z"
  }
];
var INITIAL_MARKET_ADS = [
  {
    id: "mkt_ad_aircon",
    title: "\u0645\u0643\u064A\u0641\u0627\u062A \u0622\u064A\u0633 \u0641\u062E\u0627\u0645\u0629 \u0648\u062C\u0648\u062F\u0629",
    category: "\u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    priceSdg: 135e4,
    location: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    phone: "0912345678",
    whatsapp: "0912345678",
    description: "\u0645\u0643\u064A\u0641\u0627\u062A \u0645\u0627\u0621 \u0643\u0631\u062A\u064A\u0646 \u0623\u0635\u0644\u064A\u0629 \u0648\u0645\u0648\u0641\u0631\u0629 \u0644\u0644\u0637\u0627\u0642\u0629 \u0645\u0639 \u0643\u0641\u0627\u0644\u0629 \u0633\u0646\u062A\u064A\u0646 \u0648\u062A\u0631\u0643\u064A\u0628 \u0641\u0648\u0631\u064A.",
    imageUrl: "/assets/images/product_cooking_oil_1792173269992.jpg",
    isVip: true,
    publisherName: "\u0645\u0639\u0631\u0636 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0645\u0639\u062A\u0645\u062F",
    ownerToken: "seed-owner-aircon",
    feeSdg: 5e3,
    status: "approved",
    reviewedBy: "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F",
    reviewedAt: new Date(Date.now() - 3 * 3600 * 1e3).toISOString(),
    createdAt: new Date(Date.now() - 4 * 3600 * 1e3).toISOString()
  },
  {
    id: "mkt_ad_car",
    title: "\u0623\u0639\u0644\u0646 \u0639\u0646 \u0645\u0639\u0631\u0636 \u0633\u064A\u0627\u0631\u0627\u062A\u0643 \u0647\u0646\u0627",
    category: "\u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0645\u0631\u0643\u0628\u0627\u062A",
    priceSdg: 0,
    location: "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    phone: "0913009060",
    whatsapp: "0913009060",
    description: "\u0643\u0646 \u0645\u0646 \u0623\u0648\u0627\u0626\u0644 \u0627\u0644\u0645\u0639\u0644\u0646\u064A\u0646 \u0641\u064A \u0627\u0644\u0628\u0646\u062F\u0631 \u0648\u0633\u0646\u062F.",
    imageUrl: "/assets/images/albander_hyundai_car_1792184093653.jpg",
    isVip: false,
    publisherName: "\u0645\u0646\u0635\u0629 \u0633\u0646\u062F",
    ownerToken: "seed-owner-cars",
    feeSdg: 0,
    status: "approved",
    reviewedBy: "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F",
    reviewedAt: new Date(Date.now() - 26 * 3600 * 1e3).toISOString(),
    createdAt: new Date(Date.now() - 30 * 3600 * 1e3).toISOString()
  },
  {
    id: "mkt_ad_laptop",
    title: "\u0644\u0627\u0628\u062A\u0648\u0628 \u0648\u0645\u0627\u0643 \u0628\u0648\u0643 \u0645\u0633\u062A\u0639\u0645\u0644 \u0628\u062D\u0627\u0644\u0629 \u0645\u0645\u062A\u0627\u0632\u0629",
    category: "\u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    priceSdg: 85e4,
    location: "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    phone: "0912556677",
    description: "\u0645\u0627\u0643 \u0628\u0648\u0643 \u0628\u0631\u0648 2021\u060C \u0630\u0627\u0643\u0631\u0629 16 \u062C\u064A\u062C\u0627\u060C \u0628\u0637\u0627\u0631\u064A\u0629 \u0623\u0635\u0644\u064A\u0629.",
    imageUrl: "/assets/images/albander_macbook_laptop_1792184108039.jpg",
    isVip: false,
    publisherName: "\u0633\u0627\u0631\u0629 \u062E\u0627\u0644\u062F",
    ownerToken: "seed-owner-laptop",
    feeSdg: 0,
    status: "pending",
    createdAt: new Date(Date.now() - 40 * 60 * 1e3).toISOString()
  }
];
var Database = class {
  constructor() {
    this.tableDefs = [];
    this.ready = null;
    this.dirty = false;
    /** Row-level snapshot of what Postgres already holds. */
    this.baseline = /* @__PURE__ */ new Map();
    this.data = this.getInitialSeedData();
  }
  /* ------------------------------------------------------------------ */
  /*  Postgres lifecycle                                                */
  /* ------------------------------------------------------------------ */
  /** Create the schema (once per process) and make sure seed data exists. */
  async init() {
    if (!isDbEnabled()) {
      console.warn("[DB] DATABASE_URL not set \u2014 running in memory-only mode. Data will NOT persist.");
      return;
    }
    if (!this.ready) {
      this.ready = (async () => {
        const seed = this.getInitialSeedData();
        this.tableDefs = await ensureSchema(seed);
        const loaded = await loadAll(this.tableDefs);
        const hasTenants = (loaded.tenants || []).length > 0;
        if (hasTenants) {
          this.data = { ...this.data, ...loaded };
          const missing = Object.entries(seed).filter(
            ([collection, rows]) => rows.length > 0 && (loaded[collection] || []).length === 0
          );
          for (const [collection, rows] of missing) {
            this.data[collection] = rows;
          }
          if (missing.length > 0) {
            await persistAll(
              this.tableDefs,
              this.data,
              new Set(missing.map(([c]) => c))
            );
            for (const [collection] of missing) {
              loaded[collection] = this.data[collection];
            }
            console.log("[DB] Seeded new collections:", missing.map(([c]) => c).join(", "));
          }
          this.captureBaseline();
          console.log("[DB] Loaded from Postgres:", Object.entries(loaded).map(([k, v]) => `${k}=${v.length}`).join(" "));
        } else {
          this.data = seed;
          await persistAll(this.tableDefs, seed);
          console.log("[DB] Empty database \u2014 seeded initial Sanad data.");
        }
      })();
      this.ready.catch((err) => {
        console.error("[DB] Init failed, continuing with in-memory seed:", err.message);
        this.ready = null;
      });
    }
    await this.ready;
  }
  /** Re-read every table. Called at the start of each request so no instance
   *  ever serves a stale snapshot. */
  async refresh() {
    if (!isDbEnabled() || this.tableDefs.length === 0) return;
    const loaded = await loadAll(this.tableDefs);
    this.data = { ...this.data, ...loaded };
    this.captureBaseline();
  }
  /** Remember exactly which rows Postgres already holds. */
  captureBaseline() {
    this.baseline = buildBaseline(
      this.tableDefs,
      this.data
    );
  }
  /** Flush the in-memory snapshot back to Postgres. Serialised by an advisory
   *  lock so concurrent lambdas cannot overwrite each other. */
  async flush(options = {}) {
    const useLock = options.lock !== false;
    if (!isDbEnabled() || this.tableDefs.length === 0) return;
    if (!this.dirty) return;
    const release = useLock ? await acquireWriteLock() : async () => {
    };
    try {
      const result = await persistDiff(
        this.tableDefs,
        this.data,
        this.baseline
      );
      this.dirty = false;
      if (result.upserts || result.deletes) {
        const partial = buildBaseline(
          this.tableDefs.filter((d) => result.collections.includes(d.collection)),
          this.data
        );
        for (const [collection, rows] of partial) {
          this.baseline.set(collection, rows);
        }
      }
    } finally {
      await release();
    }
  }
  async shutdown() {
    await closePool();
  }
  /* ------------------------------------------------------------------ */
  /*  Market ads (public listings with admin moderation)                 */
  /* ------------------------------------------------------------------ */
  getMarketAds() {
    return this.data.marketAds || [];
  }
  getMarketAd(id) {
    return (this.data.marketAds || []).find((a) => a.id === id);
  }
  /** New ads always enter as `pending` — nothing reaches the market unreviewed. */
  createMarketAd(input) {
    const ad = {
      ...input,
      id: newId("mkt"),
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.marketAds = [ad, ...this.data.marketAds || []];
    this.save();
    return ad;
  }
  reviewMarketAd(id, decision) {
    const ad = this.getMarketAd(id);
    if (!ad) return null;
    ad.status = decision.decision;
    ad.reviewedBy = decision.reviewedBy || "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F";
    ad.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (decision.decision === "rejected") {
      ad.rejectionReason = decision.note || "\u0644\u0645 \u064A\u0633\u062A\u0648\u0641 \u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u0634\u0631\u0648\u0637 \u0627\u0644\u0646\u0634\u0631.";
    } else {
      ad.rejectionReason = void 0;
      if (decision.paymentConfirmed) {
        ad.paymentRef = ad.paymentRef || `PAID-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`;
      }
    }
    this.save();
    return ad;
  }
  /**
   * Deletion rules:
   *  - the publisher must present the token issued to their device
   *  - an admin can delete anything
   */
  deleteMarketAd(id, auth) {
    const ad = this.getMarketAd(id);
    if (!ad) return { ok: false, reason: "NOT_FOUND" };
    const isOwner = !!auth.ownerToken && ad.ownerToken === auth.ownerToken;
    if (!isOwner && !auth.admin) {
      return { ok: false, reason: "FORBIDDEN" };
    }
    this.data.marketAds = (this.data.marketAds || []).filter((a) => a.id !== id);
    this.save();
    return { ok: true };
  }
  /* ------------------------------------------------------------------ */
  /*  Store applications (شops asking to join the platform)              */
  /* ------------------------------------------------------------------ */
  getTenantApplications() {
    return this.data.tenantApplications || [];
  }
  getTenantApplication(id) {
    return (this.data.tenantApplications || []).find((a) => a.id === id);
  }
  /** Applications always start as `pending` — the admin decides. */
  createTenantApplication(input) {
    const application = {
      ...input,
      id: newId("tapp"),
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.tenantApplications = [application, ...this.data.tenantApplications || []];
    this.save();
    return application;
  }
  reviewTenantApplication(id, decision) {
    const application = this.getTenantApplication(id);
    if (!application) return null;
    application.status = decision.decision;
    application.reviewedBy = decision.reviewedBy || "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F";
    application.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (typeof decision.registrationFeeSdg === "number" && decision.registrationFeeSdg >= 0) {
      application.registrationFeeSdg = decision.registrationFeeSdg;
    }
    if (decision.decision === "rejected") {
      application.rejectionReason = decision.note || "\u0644\u0645 \u064A\u0633\u062A\u0648\u0641 \u0637\u0644\u0628 \u0627\u0644\u0645\u062A\u062C\u0631 \u0634\u0631\u0648\u0637 \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645.";
      application.activationCode = void 0;
    } else {
      application.rejectionReason = void 0;
      application.activationCode = decision.activationCode || application.activationCode;
      if (decision.codeSentVia) {
        application.codeSentVia = decision.codeSentVia;
        application.codeSentAt = (/* @__PURE__ */ new Date()).toISOString();
      }
    }
    this.save();
    return application;
  }
  markTenantApplicationCodeSent(id, via) {
    const application = this.getTenantApplication(id);
    if (!application || !application.activationCode) return null;
    application.codeSentVia = via;
    application.codeSentAt = (/* @__PURE__ */ new Date()).toISOString();
    this.save();
    return application;
  }
  deleteTenantApplication(id) {
    const before = (this.data.tenantApplications || []).length;
    this.data.tenantApplications = (this.data.tenantApplications || []).filter((a) => a.id !== id);
    const removed = this.data.tenantApplications.length !== before;
    if (removed) this.save();
    return removed;
  }
  /* ------------------------------------------------------------------ */
  /*  Notifications                                                      */
  /* ------------------------------------------------------------------ */
  getNotifications(filter) {
    const all = this.data.notifications || [];
    const rows = all.filter((n) => n.app === filter.app).filter((n) => {
      if (n.recipientToken) return !!filter.ownerToken && n.recipientToken === filter.ownerToken;
      return true;
    }).filter((n) => {
      if (!n.tenantId) return true;
      return !filter.tenantId || n.tenantId === filter.tenantId;
    }).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
    return filter.limit ? rows.slice(0, filter.limit) : rows;
  }
  hasNotificationKey(key) {
    return (this.data.notifications || []).some((n) => n.dedupeKey === key);
  }
  createNotification(input) {
    const notification = {
      ...input,
      id: newId("ntf"),
      read: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.notifications = [notification, ...this.data.notifications || []].slice(0, 300);
    this.save();
    return notification;
  }
  markNotificationRead(id) {
    const notification = (this.data.notifications || []).find((n) => n.id === id);
    if (!notification) return false;
    notification.read = true;
    this.save();
    return true;
  }
  markAllNotificationsRead(filter) {
    let changed = 0;
    for (const n of this.data.notifications || []) {
      if (n.app !== filter.app || n.read) continue;
      if (n.recipientToken && n.recipientToken !== filter.ownerToken) continue;
      n.read = true;
      changed++;
    }
    if (changed > 0) this.save();
    return changed;
  }
  deleteNotification(id) {
    const before = (this.data.notifications || []).length;
    this.data.notifications = (this.data.notifications || []).filter((n) => n.id !== id);
    const removed = this.data.notifications.length !== before;
    if (removed) this.save();
    return removed;
  }
  /* Push subscriptions (one row per device per app) */
  savePushSubscription(input) {
    const all = this.data.pushSubscriptions || [];
    const existing = all.find((s) => s.endpoint === input.endpoint && s.app === input.app);
    if (existing) {
      existing.keys = input.keys;
      existing.ownerToken = input.ownerToken;
      existing.lastSeenAt = (/* @__PURE__ */ new Date()).toISOString();
      this.save();
      return existing;
    }
    const record = {
      ...input,
      id: newId("push"),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.pushSubscriptions = [record, ...all].slice(0, 500);
    this.save();
    return record;
  }
  getPushSubscriptions(filter) {
    return (this.data.pushSubscriptions || []).filter((s) => {
      if (filter.app && s.app !== filter.app) return false;
      if (filter.ownerToken && s.ownerToken !== filter.ownerToken) return false;
      return true;
    });
  }
  /** VAPID keys live in the database so every serverless instance uses the same pair. */
  getPushKeys() {
    const row = (this.data.pushKeys || [])[0];
    return row ? { publicKey: row.publicKey, privateKey: row.privateKey } : null;
  }
  savePushKeys(keys) {
    this.data.pushKeys = [
      { id: "push_keys_main", ...keys, createdAt: (/* @__PURE__ */ new Date()).toISOString() }
    ];
    this.save();
  }
  deletePushSubscription(endpoint) {
    const before = (this.data.pushSubscriptions || []).length;
    this.data.pushSubscriptions = (this.data.pushSubscriptions || []).filter(
      (s) => s.endpoint !== endpoint
    );
    const removed = this.data.pushSubscriptions.length !== before;
    if (removed) this.save();
    return removed;
  }
  /* ------------------------------------------------------------------ */
  /*  Market banners                                                     */
  /* ------------------------------------------------------------------ */
  getMarketBanners(onlyActive = false) {
    return (this.data.marketBanners || []).filter((b) => onlyActive ? b.active : true).slice().sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  }
  createMarketBanner(input) {
    const banner = {
      ...input,
      id: newId("bnr"),
      clicks: 0,
      impressions: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.marketBanners = [...this.data.marketBanners || [], banner];
    this.save();
    return banner;
  }
  updateMarketBanner(id, patch) {
    const banner = (this.data.marketBanners || []).find((b) => b.id === id);
    if (!banner) return null;
    Object.assign(banner, patch);
    this.save();
    return banner;
  }
  getMarketBanner(id) {
    return (this.data.marketBanners || []).find((b) => b.id === id) || null;
  }
  /** UTC day key — keeps reports stable across serverless instances. */
  dayKey(d = /* @__PURE__ */ new Date()) {
    return d.toISOString().slice(0, 10);
  }
  bumpDaily(banner, field, count = 1) {
    const day = this.dayKey();
    if (!banner.daily) banner.daily = {};
    const row = banner.daily[day] || { i: 0, c: 0 };
    row[field] += count;
    banner.daily[day] = row;
    if (!banner.statsSince) banner.statsSince = day;
  }
  /** Counts one shopper tap. Cheap write — only the counter fields change. */
  trackMarketBannerClick(id) {
    const banner = (this.data.marketBanners || []).find((b) => b.id === id);
    if (!banner) return null;
    banner.clicks = (banner.clicks || 0) + 1;
    banner.lastClickedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.bumpDaily(banner, "c");
    this.save();
    return banner;
  }
  /** Counts one real on-screen view of a banner. */
  trackMarketBannerImpression(id) {
    const banner = (this.data.marketBanners || []).find((b) => b.id === id);
    if (!banner) return null;
    banner.impressions = (banner.impressions || 0) + 1;
    banner.lastImpressionAt = (/* @__PURE__ */ new Date()).toISOString();
    this.bumpDaily(banner, "i");
    this.save();
    return banner;
  }
  /** Counts a whole rotation in one write (fewer Neon round-trips). */
  trackMarketBannerImpressions(ids) {
    const wanted = new Set(ids);
    let touched = 0;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const banner of this.data.marketBanners || []) {
      if (!wanted.has(banner.id)) continue;
      banner.impressions = (banner.impressions || 0) + 1;
      banner.lastImpressionAt = now;
      this.bumpDaily(banner, "i");
      touched += 1;
    }
    if (touched) this.save();
    return touched;
  }
  /** Zeroes both counters (a fresh campaign report). */
  resetMarketBannerClicks(id) {
    const banner = (this.data.marketBanners || []).find((b) => b.id === id);
    if (!banner) return null;
    banner.clicks = 0;
    banner.impressions = 0;
    banner.lastClickedAt = void 0;
    banner.lastImpressionAt = void 0;
    banner.daily = {};
    banner.statsSince = this.dayKey();
    this.save();
    return banner;
  }
  /**
   * Day-by-day performance for one banner, gaps filled with zeros so a report
   * never has holes. `toDay` is inclusive.
   */
  getMarketBannerReport(id, fromDay, toDay) {
    const banner = (this.data.marketBanners || []).find((b) => b.id === id);
    if (!banner) return null;
    const today = this.dayKey();
    const keys = Object.keys(banner.daily || {}).sort();
    const DAY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
    const to = toDay && DAY.test(toDay) ? toDay : today;
    const from = fromDay && DAY.test(fromDay) ? fromDay : keys[0] || banner.statsSince || to;
    const days = [];
    const cursor = /* @__PURE__ */ new Date(from + "T00:00:00.000Z");
    const end = /* @__PURE__ */ new Date(to + "T00:00:00.000Z");
    for (let guard = 0; cursor <= end && guard < 400; guard++) {
      const key = cursor.toISOString().slice(0, 10);
      const row = (banner.daily || {})[key] || { i: 0, c: 0 };
      days.push({
        date: key,
        impressions: row.i,
        clicks: row.c,
        ctr: row.i ? Number((row.c / row.i * 100).toFixed(1)) : 0
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const impressions = days.reduce((a, d) => a + d.impressions, 0);
    const clicks = days.reduce((a, d) => a + d.clicks, 0);
    return {
      banner,
      from: days[0] ? days[0].date : from,
      to,
      days,
      totals: {
        impressions,
        clicks,
        ctr: impressions ? Number((clicks / impressions * 100).toFixed(1)) : 0
      }
    };
  }
  /** Banners that belong to one merchant (linked tenant, or a name match as fallback). */
  getMarketBannersForTenant(tenantId) {
    const tenant = this.getTenant(tenantId);
    const names = [tenant?.tradeName, tenant?.name].filter((n) => !!n).map((n) => n.trim());
    return (this.data.marketBanners || []).filter(
      (b) => b.advertiserTenantId === tenantId || !b.advertiserTenantId && !!b.advertiserName && names.includes(b.advertiserName.trim())
    ).slice().sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  }
  deleteMarketBanner(id) {
    const before = (this.data.marketBanners || []).length;
    this.data.marketBanners = (this.data.marketBanners || []).filter((b) => b.id !== id);
    const removed = this.data.marketBanners.length !== before;
    if (removed) this.save();
    return removed;
  }
  isDatabaseEnabled() {
    return isDbEnabled();
  }
  tableCount() {
    return this.tableDefs.length;
  }
  /** True when the schema is live and writes are actually reaching Postgres. */
  isPersisting() {
    return isDbEnabled() && this.tableDefs.length > 0 && this.ready !== null;
  }
  getInitialSeedData() {
    return {
      tenants: INITIAL_TENANTS,
      subscriptionPlans: INITIAL_PLANS,
      subscriptionPayments: INITIAL_PAYMENTS,
      branches: INITIAL_BRANCHES,
      employees: INITIAL_EMPLOYEES,
      products: INITIAL_PRODUCTS,
      branchInventories: INITIAL_INVENTORIES,
      stockMovements: [],
      branchTransfers: INITIAL_TRANSFERS,
      cashierShifts: INITIAL_SHIFTS,
      sales: INITIAL_SALES,
      returns: [],
      customers: INITIAL_CUSTOMERS,
      currencies: INITIAL_CURRENCIES,
      currencyRateHistory: [],
      storefrontOrders: INITIAL_STORE_ORDERS,
      expenses: INITIAL_EXPENSES,
      purchases: INITIAL_PURCHASES,
      auditLogs: INITIAL_AUDIT_LOGS,
      albandarListings: INITIAL_ALBANDAR_LISTINGS,
      albandarShowrooms: INITIAL_ALBANDAR_SHOWROOMS,
      recurringExpenses: INITIAL_RECURRING_EXPENSES,
      promotions: INITIAL_PROMOTIONS,
      kitchenTickets: INITIAL_KITCHEN_TICKETS,
      inventoryAlerts: [],
      inventoryAudits: [],
      marketAds: INITIAL_MARKET_ADS,
      tenantApplications: INITIAL_TENANT_APPLICATIONS,
      notifications: INITIAL_NOTIFICATIONS,
      pushSubscriptions: [],
      pushKeys: [],
      marketBanners: INITIAL_MARKET_BANNERS
    };
  }
  /** Mark the snapshot as changed; the request pipeline flushes it. */
  save(_data) {
    this.dirty = true;
  }
  // Get raw schema (safe reference copy)
  getSchema() {
    return this.data;
  }
  commit() {
    this.save();
  }
  // Tenant helper
  getTenant(tenantId) {
    return this.data.tenants.find((t) => t.id === tenantId);
  }
  getTenantBySlug(slug) {
    return this.data.tenants.find((t) => t.slug === slug);
  }
  // Branch helper
  getBranches(tenantId) {
    return this.data.branches.filter((b) => b.tenantId === tenantId);
  }
  // Products helper
  getProducts(tenantId) {
    return this.data.products.filter((p) => p.tenantId === tenantId);
  }
  // Inventory helper
  getInventory(tenantId, branchId) {
    return this.data.branchInventories.filter((inv) => inv.tenantId === tenantId && (!branchId || inv.branchId === branchId)).map((inv) => {
      const product = this.data.products.find((p) => p.id === inv.productId);
      const branch = this.data.branches.find((b) => b.id === inv.branchId);
      return {
        ...inv,
        product,
        branch
      };
    });
  }
  // Get stock for a specific branch and product
  getProductStock(tenantId, branchId, productId) {
    const inv = this.data.branchInventories.find(
      (i) => i.tenantId === tenantId && i.branchId === branchId && i.productId === productId
    );
    return inv ? inv.quantity : 0;
  }
  // Adjust stock atomically with reason and movement logging
  adjustStock(params) {
    let inv = this.data.branchInventories.find(
      (i) => i.tenantId === params.tenantId && i.branchId === params.branchId && i.productId === params.productId
    );
    const product = this.data.products.find((p) => p.id === params.productId && p.tenantId === params.tenantId);
    const tenant = this.getTenant(params.tenantId);
    const currentQty = inv ? inv.quantity : 0;
    const newQty = currentQty + params.delta;
    if (newQty < 0 && (!tenant || !tenant.settings.allowNegativeStock)) {
      return {
        success: false,
        newBalance: currentQty,
        error: `\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0645\u062A\u0627\u062D \u063A\u064A\u0631 \u0643\u0627\u0641\u064D (${currentQty}) \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u062E\u0635\u0645 \u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u062F\u0648\u0646 \u0631\u0635\u064A\u062F \u0633\u0627\u0644\u0628.`
      };
    }
    if (!inv) {
      inv = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tenantId: params.tenantId,
        branchId: params.branchId,
        productId: params.productId,
        quantity: newQty,
        minAlertQuantity: product ? product.minStockAlert : 5,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.data.branchInventories.push(inv);
    } else {
      inv.quantity = newQty;
      inv.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    }
    const movement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenantId: params.tenantId,
      branchId: params.branchId,
      productId: params.productId,
      productName: product?.name || "\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641",
      type: params.type,
      quantityDelta: params.delta,
      balanceAfter: newQty,
      costPerUnitSdg: product?.purchaseCost || 0,
      totalValueSdg: Math.abs(params.delta) * (product?.purchaseCost || 0),
      referenceId: params.referenceId,
      actorName: params.actorName,
      reason: params.reason,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.stockMovements.unshift(movement);
    if (!this.data.inventoryAlerts) this.data.inventoryAlerts = [];
    const threshold = product ? product.minimumStock !== void 0 ? product.minimumStock : product.minStockAlert : 5;
    const branch = this.data.branches.find((b) => b.id === params.branchId);
    const branchName = branch ? branch.name : "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A";
    if (newQty <= threshold) {
      const existingAlert = this.data.inventoryAlerts.find(
        (a) => a.tenantId === params.tenantId && a.branchId === params.branchId && a.productId === params.productId && a.status !== "dismissed"
      );
      if (existingAlert) {
        existingAlert.currentQuantity = newQty;
        existingAlert.severity = newQty === 0 ? "critical" : "warning";
        existingAlert.status = "unread";
      } else {
        this.data.inventoryAlerts.unshift({
          id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          tenantId: params.tenantId,
          branchId: params.branchId,
          branchName,
          productId: params.productId,
          productName: product?.name || "\u0645\u0646\u062A\u062C",
          sku: product?.sku || "",
          currentQuantity: newQty,
          reorderPoint: threshold,
          severity: newQty === 0 ? "critical" : "warning",
          status: "unread",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    } else {
      this.data.inventoryAlerts = this.data.inventoryAlerts.filter(
        (a) => !(a.tenantId === params.tenantId && a.branchId === params.branchId && a.productId === params.productId)
      );
    }
    this.commit();
    return { success: true, newBalance: newQty };
  }
  // Audit logging helper
  logAudit(entry) {
    const log = {
      ...entry,
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.auditLogs.unshift(log);
    this.commit();
    return log;
  }
  // Albandar Marketplace Helpers
  getAlbandarListings() {
    return this.data.albandarListings || [];
  }
  addAlbandarListing(listing) {
    if (!this.data.albandarListings) {
      this.data.albandarListings = [];
    }
    this.data.albandarListings.unshift(listing);
    this.commit();
    return listing;
  }
  getAlbandarShowrooms() {
    return this.data.albandarShowrooms || [];
  }
  // Customer Management & Loyalty Points
  getCustomers(tenantId, search) {
    let list = (this.data.customers || []).filter((c) => c.tenantId === tenantId);
    if (search) {
      const q2 = search.trim().toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q2) || c.phone.includes(q2) || c.taxNumber && c.taxNumber.includes(q2)
      );
    }
    return list;
  }
  getCustomer(tenantId, id) {
    return (this.data.customers || []).find((c) => c.id === id && c.tenantId === tenantId);
  }
  addCustomer(customer) {
    if (!this.data.customers) this.data.customers = [];
    this.data.customers.unshift(customer);
    this.commit();
    return customer;
  }
  updateCustomer(tenantId, id, updates) {
    if (!this.data.customers) this.data.customers = [];
    const idx = this.data.customers.findIndex((c) => c.id === id && c.tenantId === tenantId);
    if (idx === -1) return null;
    this.data.customers[idx] = { ...this.data.customers[idx], ...updates };
    this.commit();
    return this.data.customers[idx];
  }
  recordCustomerSale(tenantId, customerId, saleGrandTotalSdg) {
    if (!this.data.customers) this.data.customers = [];
    const cust = this.data.customers.find((c) => c.id === customerId && c.tenantId === tenantId);
    if (cust) {
      const tenant = this.getTenant(tenantId);
      const rate = tenant?.settings?.loyaltyRateSdgPerPoint || 1e3;
      const earnedPoints = Math.max(1, Math.floor(saleGrandTotalSdg / rate));
      cust.loyaltyPoints = (cust.loyaltyPoints || 0) + earnedPoints;
      cust.totalPurchasesSdg = (cust.totalPurchasesSdg || 0) + saleGrandTotalSdg;
      cust.invoicesCount = (cust.invoicesCount || 0) + 1;
      cust.lastPurchaseAt = (/* @__PURE__ */ new Date()).toISOString();
      this.commit();
      return { cust, earnedPoints };
    }
    return null;
  }
  // ==========================================
  // Recurring Expenses (المصروفات الدورية)
  // ==========================================
  getRecurringExpenses(tenantId, branchId) {
    let list = (this.data.recurringExpenses || []).filter((r) => r.tenantId === tenantId);
    if (branchId) {
      list = list.filter((r) => r.branchId === branchId);
    }
    return list;
  }
  addRecurringExpense(item) {
    if (!this.data.recurringExpenses) this.data.recurringExpenses = [];
    this.data.recurringExpenses.unshift(item);
    this.commit();
    return item;
  }
  updateRecurringExpense(tenantId, id, updates) {
    if (!this.data.recurringExpenses) this.data.recurringExpenses = [];
    const idx = this.data.recurringExpenses.findIndex((r) => r.id === id && r.tenantId === tenantId);
    if (idx === -1) return null;
    this.data.recurringExpenses[idx] = { ...this.data.recurringExpenses[idx], ...updates };
    this.commit();
    return this.data.recurringExpenses[idx];
  }
  deleteRecurringExpense(tenantId, id) {
    if (!this.data.recurringExpenses) return false;
    const initialLen = this.data.recurringExpenses.length;
    this.data.recurringExpenses = this.data.recurringExpenses.filter(
      (r) => !(r.id === id && r.tenantId === tenantId)
    );
    if (this.data.recurringExpenses.length !== initialLen) {
      this.commit();
      return true;
    }
    return false;
  }
  postRecurringExpenseNow(tenantId, id, actorName = "\u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0622\u0644\u064A") {
    const rec = (this.data.recurringExpenses || []).find((r) => r.id === id && r.tenantId === tenantId);
    if (!rec) return null;
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const newExpense = {
      id: `exp_rec_${Date.now()}`,
      tenantId: rec.tenantId,
      branchId: rec.branchId,
      branchName: rec.branchName,
      category: rec.category,
      amountSdg: rec.amountSdg,
      description: `[\u0645\u0635\u0631\u0648\u0641 \u062F\u0648\u0631\u064A \u0645\u062C\u062F\u0648\u0644]: ${rec.title}`,
      paidBy: actorName,
      receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!this.data.expenses) this.data.expenses = [];
    this.data.expenses.unshift(newExpense);
    const currDue = new Date(rec.nextDueDate);
    if (rec.frequency === "weekly") {
      currDue.setDate(currDue.getDate() + 7);
    } else if (rec.frequency === "yearly") {
      currDue.setFullYear(currDue.getFullYear() + 1);
    } else {
      currDue.setMonth(currDue.getMonth() + 1);
    }
    rec.lastPostedDate = todayStr;
    rec.nextDueDate = currDue.toISOString().split("T")[0];
    this.commit();
    return { expense: newExpense, recurring: rec };
  }
  // ==========================================
  // Promotions Management (العروض الترويجية)
  // ==========================================
  getPromotions(tenantId) {
    return (this.data.promotions || []).filter((p) => p.tenantId === tenantId);
  }
  addPromotion(promo) {
    if (!this.data.promotions) this.data.promotions = [];
    this.data.promotions.unshift(promo);
    this.commit();
    return promo;
  }
  updatePromotion(tenantId, id, updates) {
    if (!this.data.promotions) this.data.promotions = [];
    const idx = this.data.promotions.findIndex((p) => p.id === id && p.tenantId === tenantId);
    if (idx === -1) return null;
    this.data.promotions[idx] = { ...this.data.promotions[idx], ...updates };
    this.commit();
    return this.data.promotions[idx];
  }
  deletePromotion(tenantId, id) {
    if (!this.data.promotions) return false;
    const initialLen = this.data.promotions.length;
    this.data.promotions = this.data.promotions.filter((p) => !(p.id === id && p.tenantId === tenantId));
    if (this.data.promotions.length !== initialLen) {
      this.commit();
      return true;
    }
    return false;
  }
  // ==========================================
  // Kitchen Display System (KDS)
  // ==========================================
  getKitchenTickets(tenantId, branchId, status) {
    let list = (this.data.kitchenTickets || []).filter((t) => t.tenantId === tenantId);
    if (branchId) {
      list = list.filter((t) => t.branchId === branchId);
    }
    if (status && status !== "all") {
      list = list.filter((t) => t.status === status);
    }
    return list;
  }
  updateKitchenTicketStatus(ticketId, status) {
    if (!this.data.kitchenTickets) this.data.kitchenTickets = [];
    const ticket = this.data.kitchenTickets.find((t) => t.id === ticketId);
    if (!ticket) return null;
    ticket.status = status;
    ticket.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (status === "completed" || status === "ready") {
      ticket.items.forEach((it) => {
        it.status = status;
      });
    }
    this.commit();
    return ticket;
  }
  updateKitchenItemStatus(ticketId, itemId, status) {
    if (!this.data.kitchenTickets) this.data.kitchenTickets = [];
    const ticket = this.data.kitchenTickets.find((t) => t.id === ticketId);
    if (!ticket) return null;
    const it = ticket.items.find((i) => i.id === itemId);
    if (it) {
      it.status = status;
      ticket.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      if (ticket.items.every((i) => i.status === "completed")) {
        ticket.status = "completed";
      } else if (ticket.items.every((i) => i.status === "ready" || i.status === "completed")) {
        ticket.status = "ready";
      } else if (ticket.items.some((i) => i.status === "preparing")) {
        ticket.status = "preparing";
      }
      this.commit();
    }
    return ticket;
  }
  createKitchenTicket(ticket) {
    if (!this.data.kitchenTickets) this.data.kitchenTickets = [];
    this.data.kitchenTickets.unshift(ticket);
    this.commit();
    return ticket;
  }
  // ==========================================
  // Inventory Alerts (نظام تنبيهات حد إعادة الطلب)
  // ==========================================
  getInventoryAlerts(tenantId, branchId) {
    if (!this.data.inventoryAlerts) this.data.inventoryAlerts = [];
    this.syncInventoryAlerts(tenantId);
    return this.data.inventoryAlerts.filter(
      (a) => a.tenantId === tenantId && (!branchId || a.branchId === branchId)
    );
  }
  dismissInventoryAlert(tenantId, alertId) {
    if (!this.data.inventoryAlerts) return false;
    const alert = this.data.inventoryAlerts.find((a) => a.tenantId === tenantId && a.id === alertId);
    if (alert) {
      alert.status = "dismissed";
      this.commit();
      return true;
    }
    return false;
  }
  markInventoryAlertRead(tenantId, alertId) {
    if (!this.data.inventoryAlerts) return false;
    const alert = this.data.inventoryAlerts.find((a) => a.tenantId === tenantId && a.id === alertId);
    if (alert && alert.status === "unread") {
      alert.status = "read";
      this.commit();
      return true;
    }
    return false;
  }
  syncInventoryAlerts(tenantId) {
    if (!this.data.inventoryAlerts) this.data.inventoryAlerts = [];
    const tenantProducts = this.getProducts(tenantId);
    const tenantBranches = this.getBranches(tenantId);
    for (const br of tenantBranches) {
      for (const prod of tenantProducts) {
        const threshold = prod.minimumStock !== void 0 ? prod.minimumStock : prod.minStockAlert || 5;
        const inv = this.data.branchInventories.find(
          (i) => i.tenantId === tenantId && i.branchId === br.id && i.productId === prod.id
        );
        const currentQty = inv ? inv.quantity : 0;
        if (currentQty <= threshold) {
          const existing = this.data.inventoryAlerts.find(
            (a) => a.tenantId === tenantId && a.branchId === br.id && a.productId === prod.id && a.status !== "dismissed"
          );
          if (existing) {
            existing.currentQuantity = currentQty;
            existing.severity = currentQty === 0 ? "critical" : "warning";
          } else {
            this.data.inventoryAlerts.unshift({
              id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              tenantId,
              branchId: br.id,
              branchName: br.name,
              productId: prod.id,
              productName: prod.name,
              sku: prod.sku,
              currentQuantity: currentQty,
              reorderPoint: threshold,
              severity: currentQty === 0 ? "critical" : "warning",
              status: "unread",
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        } else {
          this.data.inventoryAlerts = this.data.inventoryAlerts.filter(
            (a) => !(a.tenantId === tenantId && a.branchId === br.id && a.productId === prod.id)
          );
        }
      }
    }
    this.commit();
    return this.data.inventoryAlerts.filter((a) => a.tenantId === tenantId);
  }
  // ==========================================
  // CSV Products & Inventory Bulk Import (استيراد المنتجات والمخزون)
  // ==========================================
  importProductsCsv(params) {
    const importedProducts = [];
    const errors = [];
    for (let i = 0; i < params.items.length; i++) {
      const item = params.items[i];
      if (!item.name || !item.name.trim()) {
        errors.push(`\u0627\u0644\u0633\u0637\u0631 ${i + 1}: \u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C \u0645\u0641\u0642\u0648\u062F.`);
        continue;
      }
      const price = Number(item.sellingPriceSdg);
      if (isNaN(price) || price <= 0) {
        errors.push(`\u0627\u0644\u0633\u0637\u0631 ${i + 1} (${item.name}): \u0633\u0639\u0631 \u0627\u0644\u0628\u064A\u0639 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.`);
        continue;
      }
      const newProd = {
        id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tenantId: params.tenantId,
        name: item.name.trim(),
        sku: item.sku && item.sku.trim() ? item.sku.trim() : `SKU-${Date.now().toString().slice(-5)}${i}`,
        barcode: item.barcode && item.barcode.trim() ? item.barcode.trim() : Math.floor(1e11 + Math.random() * 9e11).toString(),
        category: item.category && item.category.trim() ? item.category.trim() : "\u0639\u0627\u0645",
        unit: item.unit && item.unit.trim() ? item.unit.trim() : "\u062D\u0628\u0629",
        purchaseCost: Number(item.purchaseCost) || 0,
        costCurrency: item.costCurrency || "SDG",
        sellingPriceSdg: price,
        minStockAlert: Number(item.minStockAlert) || 5,
        minimumStock: Number(item.minStockAlert) || 5,
        isActive: true,
        isTaxExempt: Boolean(item.isTaxExempt),
        customTaxRate: item.customTaxRate !== void 0 && item.customTaxRate !== null ? Number(item.customTaxRate) : void 0,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.data.products.push(newProd);
      importedProducts.push(newProd);
      const initStock = Number(item.initialStock);
      if (!isNaN(initStock) && initStock > 0 && params.branchId) {
        this.adjustStock({
          tenantId: params.tenantId,
          branchId: params.branchId,
          productId: newProd.id,
          delta: initStock,
          type: "purchase_receive",
          reason: "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0631\u0635\u064A\u062F \u0645\u062E\u0632\u0648\u0646 \u0627\u0641\u062A\u062A\u0627\u062D\u064A \u0645\u0646 \u0645\u0644\u0641 CSV",
          actorName: params.actorName
        });
      }
    }
    if (importedProducts.length > 0) {
      this.syncInventoryAlerts(params.tenantId);
      this.commit();
      this.logAudit({
        tenantId: params.tenantId,
        actorId: "system",
        actorName: params.actorName,
        action: "IMPORT_CSV_PRODUCTS",
        entity: "Product",
        entityId: `batch_${Date.now()}`,
        details: `\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u062C\u0645\u0627\u0639\u064A \u0644\u0640 (${importedProducts.length}) \u0645\u0646\u062A\u062C \u0645\u0639 \u0623\u0631\u0635\u062F\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0639\u0628\u0631 \u0645\u0644\u0641 CSV`
      });
    }
    return {
      success: importedProducts.length > 0,
      importedCount: importedProducts.length,
      errors,
      products: importedProducts
    };
  }
  // ==========================================
  // Smart Inventory Audit System (تدقيق وجرد المخزون الذكي)
  // ==========================================
  getInventoryAudits(tenantId, branchId) {
    let audits = (this.data.inventoryAudits || []).filter((a) => a.tenantId === tenantId);
    if (branchId) {
      audits = audits.filter((a) => a.branchId === branchId);
    }
    return audits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  getInventoryAudit(tenantId, auditId) {
    return (this.data.inventoryAudits || []).find(
      (a) => a.tenantId === tenantId && a.id === auditId
    );
  }
  createInventoryAudit(params) {
    const branch = this.data.branches.find((b) => b.id === params.branchId && b.tenantId === params.tenantId);
    const branchName = branch ? branch.name : "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A";
    let prods = this.data.products.filter((p) => p.tenantId === params.tenantId && p.isActive !== false);
    if (params.scope === "category" && params.categoryFilter && params.categoryFilter !== "\u0627\u0644\u0643\u0644") {
      prods = prods.filter((p) => p.category === params.categoryFilter);
    }
    const items = prods.map((prod) => {
      const stock = this.getProductStock(params.tenantId, params.branchId, prod.id);
      return {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        barcode: prod.barcode || "",
        category: prod.category || "\u0639\u0627\u0645",
        unit: prod.unit || "\u062D\u0628\u0629",
        costPrice: prod.purchaseCost || 0,
        sellingPrice: prod.sellingPriceSdg || 0,
        systemQuantity: stock,
        actualQuantity: 0,
        difference: 0 - stock,
        differenceCostValue: (0 - stock) * (prod.purchaseCost || 0),
        status: "uncounted",
        notes: ""
      };
    });
    const now = /* @__PURE__ */ new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const seq = (this.data.inventoryAudits?.length || 0) + 1;
    const auditNumber = `AUD-${dateStr}-${String(seq).padStart(3, "0")}`;
    const newAudit = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenantId: params.tenantId,
      branchId: params.branchId,
      branchName,
      auditNumber,
      title: params.title || `\u062C\u0631\u062F \u0645\u062E\u0632\u0648\u0646 \u0630\u0643\u064A - ${branchName}`,
      status: "in_progress",
      startedAt: now.toISOString(),
      auditorId: params.auditorId,
      auditorName: params.auditorName,
      auditorRole: params.auditorRole,
      deviceInfo: params.deviceInfo || "\u0647\u0627\u062A\u0641 \u0645\u062D\u0645\u0648\u0644 \u0630\u0643\u064A",
      scope: params.scope || "all",
      categoryFilter: params.categoryFilter,
      items,
      totalProductsCount: items.length,
      countedProductsCount: 0,
      matchedCount: 0,
      deficitCount: 0,
      surplusCount: 0,
      uncountedCount: items.length,
      totalDeficitValueSdg: 0,
      totalSurplusValueSdg: 0,
      netDiscrepancyCostSdg: 0,
      reconciled: false,
      notes: params.notes,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    if (!this.data.inventoryAudits) {
      this.data.inventoryAudits = [];
    }
    this.data.inventoryAudits.unshift(newAudit);
    this.commit();
    this.logAudit({
      tenantId: params.tenantId,
      actorId: params.auditorId,
      actorName: params.auditorName,
      action: "START_INVENTORY_AUDIT",
      entity: "InventoryAudit",
      entityId: newAudit.id,
      details: `\u0628\u062F\u0621 \u062C\u0644\u0633\u0629 \u062A\u062F\u0642\u064A\u0642 \u0648\u062C\u0631\u062F \u0645\u062E\u0632\u0648\u0646 \u0631\u0642\u0645 (${auditNumber}) \u0644\u0641\u0631\u0639 [${branchName}] \u062A\u0634\u0645\u0644 (${items.length}) \u0635\u0646\u0641`
    });
    return newAudit;
  }
  updateInventoryAudit(tenantId, auditId, updates) {
    if (!this.data.inventoryAudits) return null;
    const index = this.data.inventoryAudits.findIndex(
      (a) => a.tenantId === tenantId && a.id === auditId
    );
    if (index === -1) return null;
    const existing = this.data.inventoryAudits[index];
    const updated = {
      ...existing,
      ...updates,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (updates.items) {
      updated.totalProductsCount = updated.items.length;
      updated.countedProductsCount = updated.items.filter((i) => i.status !== "uncounted").length;
      updated.matchedCount = updated.items.filter((i) => i.status === "matched").length;
      updated.deficitCount = updated.items.filter((i) => i.status === "deficit").length;
      updated.surplusCount = updated.items.filter((i) => i.status === "surplus").length;
      updated.uncountedCount = updated.items.filter((i) => i.status === "uncounted").length;
      let deficitVal = 0;
      let surplusVal = 0;
      let netCost = 0;
      for (const item of updated.items) {
        if (item.status === "uncounted") continue;
        const diff = item.actualQuantity - item.systemQuantity;
        item.difference = diff;
        item.differenceCostValue = diff * item.costPrice;
        if (diff === 0) {
          item.status = "matched";
        } else if (diff < 0) {
          item.status = "deficit";
          deficitVal += Math.abs(item.differenceCostValue);
        } else {
          item.status = "surplus";
          surplusVal += item.differenceCostValue;
        }
        netCost += item.differenceCostValue;
      }
      updated.totalDeficitValueSdg = deficitVal;
      updated.totalSurplusValueSdg = surplusVal;
      updated.netDiscrepancyCostSdg = netCost;
    }
    this.data.inventoryAudits[index] = updated;
    this.commit();
    return updated;
  }
  reconcileInventoryAudit(params) {
    const audit = this.getInventoryAudit(params.tenantId, params.auditId);
    if (!audit) {
      return { success: false, adjustedCount: 0, error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" };
    }
    if (audit.reconciled) {
      return { success: false, adjustedCount: 0, error: "\u062A\u0645\u062A \u062A\u0633\u0648\u064A\u0629 \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629 \u0645\u0633\u0628\u0642\u0627\u064B" };
    }
    let adjustedCount = 0;
    for (const item of audit.items) {
      if (item.status !== "uncounted" && item.difference !== 0) {
        const delta = item.difference;
        const reason = `\u062A\u0633\u0648\u064A\u0629 \u062C\u0631\u062F \u0645\u062E\u0632\u0646\u064A \u0630\u0643\u064A (${audit.auditNumber}): ${item.notes ? item.notes : delta < 0 ? "\u0639\u062C\u0632 \u0641\u0639\u0644\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u062C\u0631\u062F" : "\u0641\u0627\u0626\u0636 \u0641\u0639\u0644\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u062C\u0631\u062F"}`;
        const adjRes = this.adjustStock({
          tenantId: params.tenantId,
          branchId: audit.branchId,
          productId: item.productId,
          delta,
          type: delta < 0 ? "damage_expired" : "adjustment",
          reason,
          actorName: params.actorName,
          referenceId: audit.auditNumber
        });
        if (adjRes.success) {
          adjustedCount++;
        }
      }
    }
    audit.reconciled = true;
    audit.status = "completed";
    audit.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    audit.reconciledAt = (/* @__PURE__ */ new Date()).toISOString();
    audit.reconciledBy = params.actorName;
    audit.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.syncInventoryAlerts(params.tenantId);
    this.commit();
    this.logAudit({
      tenantId: params.tenantId,
      actorId: params.actorId,
      actorName: params.actorName,
      action: "RECONCILE_INVENTORY_AUDIT",
      entity: "InventoryAudit",
      entityId: audit.id,
      details: `\u0627\u0639\u062A\u0645\u0627\u062F \u0648\u062A\u0633\u0648\u064A\u0629 \u062C\u0631\u062F \u0645\u062E\u0632\u0646\u064A \u0631\u0642\u0645 (${audit.auditNumber}) \u0644\u0641\u0631\u0639 [${audit.branchName}]. \u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0623\u0631\u0635\u062F\u0629 (${adjustedCount}) \u0635\u0646\u0641 \u0628\u0635\u0627\u0641\u064A \u0641\u0631\u0648\u0642\u0627\u062A (${audit.netDiscrepancyCostSdg.toLocaleString()} \u062C.\u0633)`
    });
    return { success: true, audit, adjustedCount };
  }
  cancelInventoryAudit(tenantId, auditId) {
    const audit = this.getInventoryAudit(tenantId, auditId);
    if (!audit) {
      return { success: false, error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" };
    }
    if (audit.reconciled) {
      return { success: false, error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0644\u063A\u0627\u0621 \u062C\u0644\u0633\u0629 \u062C\u0631\u062F \u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F\u0647\u0627 \u0648\u062A\u0633\u0648\u064A\u062A\u0647\u0627 \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645" };
    }
    audit.status = "cancelled";
    audit.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.commit();
    return { success: true };
  }
};
var db = new Database();

// src/server/media.ts
var TABLE = "sanad_media";
var MAX_RAW_BYTES = 3 * 1024 * 1024;
var ready = null;
function ensureMediaTable() {
  if (!ready) {
    ready = transaction(async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${TABLE} (
          id          text PRIMARY KEY,
          kind        text NOT NULL,
          mime        text NOT NULL,
          bytes       integer NOT NULL,
          owner_phone text,
          data        text NOT NULL,
          created_at  timestamptz NOT NULL DEFAULT now()
        )
      `);
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_${TABLE}_created ON ${TABLE} (created_at)`
      );
    }).catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
var ALLOWED_PREFIXES = {
  image: ["data:image/jpeg", "data:image/png", "data:image/webp", "data:image/gif"],
  video: ["data:video/mp4", "data:video/webm", "data:video/quicktime"]
};
async function saveMedia(input) {
  await ensureMediaTable();
  const { dataUrl, kind } = input;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new HttpError(400, "BAD_DATA_URL", "\u0635\u064A\u063A\u0629 \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629.");
  }
  const comma = dataUrl.indexOf(",");
  if (comma === -1) {
    throw new HttpError(400, "BAD_DATA_URL", "\u0635\u064A\u063A\u0629 \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629.");
  }
  const header = dataUrl.slice(5, comma);
  const isBase64 = header.includes(";base64");
  if (!isBase64) {
    throw new HttpError(400, "BAD_DATA_URL", "\u064A\u062C\u0628 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0645\u0644\u0641 \u0628\u062A\u0631\u0645\u064A\u0632 base64.");
  }
  const mime = header.split(";")[0].toLowerCase();
  const allowed = ALLOWED_PREFIXES[kind] || [];
  if (!allowed.some((prefix) => dataUrl.toLowerCase().startsWith(prefix))) {
    throw new HttpError(
      415,
      "UNSUPPORTED_TYPE",
      kind === "video" ? "\u0635\u064A\u063A\u0629 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629. \u0627\u0633\u062A\u062E\u062F\u0645 MP4 \u0623\u0648 WebM." : "\u0635\u064A\u063A\u0629 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629. \u0627\u0633\u062A\u062E\u062F\u0645 JPG \u0623\u0648 PNG \u0623\u0648 WebP."
    );
  }
  const base64 = dataUrl.slice(comma + 1);
  const bytes = Math.floor(base64.length * 3 / 4);
  if (bytes > MAX_RAW_BYTES) {
    throw new HttpError(
      413,
      "TOO_LARGE",
      `\u062D\u062C\u0645 \u0627\u0644\u0645\u0644\u0641 ${(bytes / 1024 / 1024).toFixed(1)} \u0645\u064A\u062C\u0627\u060C \u0648\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 ${MAX_RAW_BYTES / 1024 / 1024} \u0645\u064A\u062C\u0627.`
    );
  }
  const id = newId(kind === "video" ? "vid" : "img");
  await query(
    `INSERT INTO ${TABLE} (id, kind, mime, bytes, owner_phone, data)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, kind, mime, bytes, input.ownerPhone || null, base64]
  );
  return { id, url: `/api/media/${id}`, mime, bytes, kind };
}
async function getMedia(id) {
  await ensureMediaTable();
  const { rows } = await query(
    `SELECT mime, data, bytes FROM ${TABLE} WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    mime: row.mime,
    bytes: Number(row.bytes) || 0,
    data: Buffer.from(row.data, "base64")
  };
}
async function deleteMedia(id) {
  await ensureMediaTable();
  const { rowCount } = await query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
var HttpError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
};

// src/server/notifications.ts
import webpush from "web-push";
var CONTACT = process.env.VAPID_CONTACT || "mailto:admin@sanad.sd";
var configured = false;
function initPush() {
  const envPublic = process.env.VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;
  if (envPublic && envPrivate) {
    webpush.setVapidDetails(CONTACT, envPublic, envPrivate);
    configured = true;
    return { publicKey: envPublic, privateKey: envPrivate };
  }
  const stored = db.getPushKeys();
  if (stored) {
    webpush.setVapidDetails(CONTACT, stored.publicKey, stored.privateKey);
    configured = true;
    return stored;
  }
  try {
    const generated = webpush.generateVAPIDKeys();
    db.savePushKeys(generated);
    webpush.setVapidDetails(CONTACT, generated.publicKey, generated.privateKey);
    configured = true;
    return generated;
  } catch (err) {
    console.warn("[push] VAPID initialisation failed:", err);
    return null;
  }
}
function getPublicKey() {
  const keys = initPush();
  return keys ? keys.publicKey : null;
}
async function notify(input) {
  const notification = db.createNotification({
    dedupeKey: input.dedupeKey,
    app: input.app,
    kind: input.kind,
    title: input.title,
    body: input.body,
    linkTab: input.linkTab,
    recipientToken: input.recipientToken,
    tenantId: input.tenantId
  });
  await sendPush(input, notification).catch((err) => {
    console.warn("[push] send failed:", err?.message || err);
  });
  return notification;
}
async function sendPush(input, notification) {
  if (!configured && !initPush()) return;
  const subscriptions = db.getPushSubscriptions({ app: input.app }).filter((s) => {
    if (notification.recipientToken) return s.ownerToken === notification.recipientToken;
    return true;
  });
  if (subscriptions.length === 0) return;
  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    icon: "/icons/sanad-icon-192.png",
    badge: "/icons/sanad-favicon-96.png",
    url: buildUrl(input.app, input.linkTab, input.pushData),
    tag: notification.id,
    kind: input.kind,
    ...input.pushData || {}
  });
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          db.deletePushSubscription(sub.endpoint);
        } else {
          console.warn("[push] delivery error:", err?.statusCode, err?.message);
        }
      }
    })
  );
}
function buildUrl(app, linkTab, extra) {
  if (extra?.url) return String(extra.url);
  const base = `/?app=${app}`;
  return linkTab ? `${base}&tab=${encodeURIComponent(linkTab)}` : base;
}
async function notifyLowStock(tenantId, opts = {}) {
  const alerts = db.syncInventoryAlerts(tenantId);
  const relevant = opts.branchId ? alerts.filter((a) => a.branchId === opts.branchId) : alerts;
  const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  let sent = 0;
  for (const alert of relevant) {
    const key = `low_stock:${alert.productId}:${alert.branchId}:${day}`;
    if (db.hasNotificationKey(key)) continue;
    await notify({
      app: "merchant",
      kind: "low_stock",
      title: alert.currentQuantity === 0 ? "\u0646\u0641\u0627\u062F \u0635\u0646\u0641 \u0645\u0646 \u0627\u0644\u0645\u062E\u0632\u0648\u0646" : "\u0646\u0642\u0635 \u0641\u064A \u0627\u0644\u0645\u062E\u0632\u0648\u0646",
      body: `${alert.productName} \u2014 \u0627\u0644\u0645\u062A\u0628\u0642\u064A ${alert.currentQuantity} \u0641\u0642\u0637 \u0641\u064A ${alert.branchName} (\u062D\u062F \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0637\u0644\u0628 ${alert.reorderPoint}).`,
      linkTab: "inventory",
      tenantId,
      dedupeKey: key
    });
    sent++;
  }
  return sent;
}
async function notifySubscriptionExpiry() {
  const tenants = db.getSchema().tenants;
  const now = Date.now();
  let sent = 0;
  for (const tenant of tenants) {
    const expires = new Date(tenant.subscriptionExpiresAt).getTime();
    if (!Number.isFinite(expires)) continue;
    const daysLeft = Math.ceil((expires - now) / (24 * 60 * 60 * 1e3));
    let stage = null;
    if (daysLeft <= 0) stage = "expired";
    else if (daysLeft === 1) stage = "d1";
    else if (daysLeft === 3) stage = "d3";
    else if (daysLeft === 7) stage = "d7";
    if (!stage) continue;
    const key = `subscription:${tenant.id}:${stage}:${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`;
    if (db.hasNotificationKey(key)) continue;
    await notify({
      app: "merchant",
      kind: "subscription",
      title: stage === "expired" ? "\u0627\u0646\u062A\u0647\u0649 \u0627\u0634\u062A\u0631\u0627\u0643\u0643 \u0641\u064A \u0645\u0646\u0635\u0629 \u0633\u0646\u062F" : `\u0627\u0634\u062A\u0631\u0627\u0643\u0643 \u064A\u0646\u062A\u0647\u064A \u0628\u0639\u062F ${daysLeft} ${daysLeft === 1 ? "\u064A\u0648\u0645" : "\u0623\u064A\u0627\u0645"}`,
      body: stage === "expired" ? `\u0627\u0634\u062A\u0631\u0627\u0643 \xAB${tenant.tradeName || tenant.name}\xBB \u0645\u0646\u062A\u0647\u064D. \u062C\u062F\u0651\u062F \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0644\u062A\u062C\u0646\u0628 \u0625\u064A\u0642\u0627\u0641 \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 \u0648\u0627\u0644\u0645\u062A\u062C\u0631.` : `\xAB${tenant.tradeName || tenant.name}\xBB \u2014 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621 ${new Date(tenant.subscriptionExpiresAt).toLocaleDateString("ar-EG")}. \u062C\u062F\u0651\u062F \u0627\u0644\u0622\u0646 \u0648\u062A\u062C\u0646\u0628 \u0627\u0644\u062A\u0648\u0642\u0641.`,
      linkTab: "subscription",
      tenantId: tenant.id,
      dedupeKey: key
    });
    if (stage === "expired") {
      const adminKey = `subscription-admin:${tenant.id}:${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`;
      if (!db.hasNotificationKey(adminKey)) {
        await notify({
          app: "admin",
          kind: "subscription",
          title: "\u0627\u0634\u062A\u0631\u0627\u0643 \u062A\u0627\u062C\u0631 \u0645\u0646\u062A\u0647\u064D",
          body: `\xAB${tenant.tradeName || tenant.name}\xBB \u2014 ${tenant.city} \u2022 \u064A\u062D\u062A\u0627\u062C \u0645\u062A\u0627\u0628\u0639\u0629 \u062A\u062C\u062F\u064A\u062F.`,
          linkTab: "payments_queue",
          tenantId: tenant.id,
          dedupeKey: adminKey
        });
      }
    }
    sent++;
  }
  return sent;
}
async function runNotificationScan() {
  let lowStock = 0;
  const seen = /* @__PURE__ */ new Set();
  for (const tenant of db.getSchema().tenants) {
    if (seen.has(tenant.id)) continue;
    seen.add(tenant.id);
    try {
      lowStock += await notifyLowStock(tenant.id);
    } catch (err) {
      console.warn("[notify] low stock scan failed:", err);
    }
  }
  let subscriptions = 0;
  try {
    subscriptions = await notifySubscriptionExpiry();
  } catch (err) {
    console.warn("[notify] subscription scan failed:", err);
  }
  return { lowStock, subscriptions };
}

// src/server/routes.ts
var apiRouter = Router();
var requireTenant = (req, res, next) => {
  const tenantId = req.headers["x-tenant-id"] || "tenant_alrowad";
  const tenant = db.getTenant(tenantId);
  if (!tenant) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645" });
  }
  req.tenantId = tenantId;
  const rawActorName = req.headers["x-actor-name"] || "";
  let decodedActorName = "\u0623\u062D\u0645\u062F \u0627\u0644\u0637\u064A\u0628 \u0627\u0644\u0631\u0648\u0627\u062F";
  if (rawActorName) {
    try {
      decodedActorName = decodeURIComponent(rawActorName);
    } catch {
      decodedActorName = rawActorName;
    }
  }
  req.actorName = decodedActorName;
  req.actorRole = req.headers["x-actor-role"] || "owner";
  req.actorId = req.headers["x-actor-id"] || "emp_owner_rowad";
  next();
};
apiRouter.get("/tenants/list", (req, res) => {
  const schema = db.getSchema();
  res.json({
    tenants: schema.tenants.map((t) => ({
      id: t.id,
      name: t.name,
      tradeName: t.tradeName,
      slug: t.slug,
      status: t.status,
      planId: t.subscriptionPlanId,
      city: t.city
    }))
  });
});
apiRouter.get("/tenants/current", requireTenant, (req, res) => {
  const tenant = db.getTenant(req.tenantId);
  res.json({ tenant });
});
apiRouter.put("/tenants/current", requireTenant, (req, res) => {
  const authReq = req;
  const tenant = db.getTenant(authReq.tenantId);
  if (!tenant) return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  const { name, tradeName, phone, city, address, settings } = req.body;
  if (name) tenant.name = name;
  if (tradeName) tenant.tradeName = tradeName;
  if (phone) tenant.phone = phone;
  if (city) tenant.city = city;
  if (address) tenant.address = address;
  if (settings) {
    tenant.settings = { ...tenant.settings, ...settings };
  }
  db.commit();
  db.logAudit({
    tenantId: tenant.id,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "UPDATE_TENANT_SETTINGS",
    entity: "Tenant",
    entityId: tenant.id,
    details: "\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0648\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0648\u0627\u0644\u0637\u0628\u0627\u0639\u0629"
  });
  res.json({ success: true, tenant });
});
apiRouter.get("/branches", requireTenant, (req, res) => {
  const authReq = req;
  const branches = db.getBranches(authReq.tenantId);
  res.json({ branches });
});
apiRouter.post("/branches", requireTenant, (req, res) => {
  const authReq = req;
  const tenant = db.getTenant(authReq.tenantId);
  const plan = db.getSchema().subscriptionPlans.find((p) => p.id === tenant?.subscriptionPlanId);
  const currentBranches = db.getBranches(authReq.tenantId);
  if (plan && currentBranches.length >= plan.maxBranches) {
    return res.status(400).json({
      error: `\u0648\u0635\u0644\u062A \u0644\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0644\u0644\u0641\u0631\u0648\u0639 \u0641\u064A \u0628\u0627\u0642\u062A\u0643 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 (${plan.maxBranches} \u0641\u0631\u0639). \u064A\u0631\u062C\u0649 \u062A\u0631\u0642\u064A\u0629 \u0627\u0644\u0628\u0627\u0642\u0629 \u0644\u0625\u0636\u0627\u0641\u0629 \u0641\u0631\u0648\u0639 \u062C\u062F\u064A\u062F\u0629.`
    });
  }
  const { name, code, city, address, phone, isMain } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0641\u0631\u0639 \u0648\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u062A\u0639\u0631\u064A\u0641\u064A \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
  }
  const newBranch = {
    id: newId("branch"),
    tenantId: authReq.tenantId,
    name,
    code,
    city: city || tenant?.city || "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    address: address || "",
    phone: phone || "",
    isMain: Boolean(isMain),
    isActive: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().branches.push(newBranch);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_BRANCH",
    entity: "Branch",
    entityId: newBranch.id,
    details: `\u0625\u0646\u0634\u0627\u0621 \u0641\u0631\u0639 \u062C\u062F\u064A\u062F: ${name} (${code})`
  });
  res.json({ success: true, branch: newBranch });
});
apiRouter.get("/employees", requireTenant, (req, res) => {
  const authReq = req;
  const employees = db.getSchema().employees.filter((e) => e.tenantId === authReq.tenantId);
  res.json({ employees });
});
apiRouter.post("/employees", requireTenant, (req, res) => {
  const authReq = req;
  const tenant = db.getTenant(authReq.tenantId);
  const plan = db.getSchema().subscriptionPlans.find((p) => p.id === tenant?.subscriptionPlanId);
  const currentEmployees = db.getSchema().employees.filter((e) => e.tenantId === authReq.tenantId);
  if (plan && currentEmployees.length >= plan.maxEmployees) {
    return res.status(400).json({
      error: `\u0648\u0635\u0644\u062A \u0644\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0641\u064A \u0628\u0627\u0642\u062A\u0643 (${plan.maxEmployees} \u0645\u0648\u0638\u0641). \u064A\u0631\u062C\u0649 \u062A\u0631\u0642\u064A\u0629 \u0627\u0634\u062A\u0631\u0627\u0643\u0643.`
    });
  }
  const { name, email, phone, role, pin, branchId, maxDiscountPct } = req.body;
  if (!name || !role) {
    return res.status(400).json({ error: "\u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0645\u0633\u0645\u0649 \u0627\u0644\u0648\u0638\u064A\u0641\u064A \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
  }
  const newEmployee = {
    id: newId("emp"),
    tenantId: authReq.tenantId,
    branchId: branchId || void 0,
    name,
    email: email || "",
    phone: phone || "",
    role,
    pin: pin || "0000",
    permissions: role === "owner" ? ["all"] : ["pos:sell", "inventory:view"],
    maxDiscountPct: Number(maxDiscountPct) || 10,
    isActive: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().employees.push(newEmployee);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_EMPLOYEE",
    entity: "Employee",
    entityId: newEmployee.id,
    details: `\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u0638\u0641 \u062C\u062F\u064A\u062F: ${name} \u0628\u062F\u0642\u0629 \u062F\u0648\u0631: ${role}`
  });
  res.json({ success: true, employee: newEmployee });
});
apiRouter.get("/products", requireTenant, (req, res) => {
  const authReq = req;
  const products = db.getProducts(authReq.tenantId);
  res.json({ products });
});
apiRouter.post("/products", requireTenant, (req, res) => {
  const authReq = req;
  const { name, sku, barcode, category, unit, purchaseCost, costCurrency, sellingPriceSdg, minStockAlert, initialStock, branchId } = req.body;
  if (!name || !sellingPriceSdg) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C \u0648\u0633\u0639\u0631 \u0627\u0644\u0628\u064A\u0639 \u0628\u0627\u0644\u062C\u0646\u064A\u0647 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
  }
  const newProduct = {
    id: newId("prod"),
    tenantId: authReq.tenantId,
    name,
    sku: sku || newCode("SKU"),
    barcode: barcode || Math.floor(1e11 + Math.random() * 9e11).toString(),
    category: category || "\u0639\u0627\u0645",
    unit: unit || "\u062D\u0628\u0629",
    purchaseCost: Number(purchaseCost) || 0,
    costCurrency: costCurrency || "SDG",
    sellingPriceSdg: Number(sellingPriceSdg),
    minStockAlert: Number(minStockAlert) || 5,
    minimumStock: Number(minStockAlert) || 5,
    isActive: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().products.push(newProduct);
  if (initialStock && branchId && Number(initialStock) > 0) {
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId,
      productId: newProduct.id,
      delta: Number(initialStock),
      type: "purchase_receive",
      reason: "\u0631\u0635\u064A\u062F \u0623\u0648\u0644\u064A \u0639\u0646\u062F \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0646\u062A\u062C",
      actorName: authReq.actorName
    });
  }
  db.commit();
  res.json({ success: true, product: newProduct });
});
apiRouter.get("/inventory", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const inventory = db.getInventory(authReq.tenantId, branchId);
  res.json({ inventory });
});
apiRouter.post("/inventory/adjust", requireTenant, (req, res) => {
  const authReq = req;
  const { branchId, productId, delta, reason, type } = req.body;
  if (!branchId || !productId || delta === void 0 || !reason) {
    return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u062E\u0632\u0646\u064A \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 (\u0627\u0644\u0641\u0631\u0639\u060C \u0627\u0644\u0645\u0646\u062A\u062C\u060C \u0627\u0644\u0643\u0645\u064A\u0629\u060C \u0648\u0627\u0644\u0633\u0628\u0628)" });
  }
  const result = db.adjustStock({
    tenantId: authReq.tenantId,
    branchId,
    productId,
    delta: Number(delta),
    type: type || "adjustment",
    reason,
    actorName: authReq.actorName
  });
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "ADJUST_STOCK",
    entity: "BranchInventory",
    entityId: productId,
    details: `\u062A\u0639\u062F\u064A\u0644 \u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0628\u0645\u0642\u062F\u0627\u0631 (${delta}) \u0641\u064A \u0627\u0644\u0641\u0631\u0639. \u0627\u0644\u0633\u0628\u0628: ${reason}`
  });
  res.json({ success: true, newBalance: result.newBalance });
});
apiRouter.get("/inventory/movements", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const movements = db.getSchema().stockMovements.filter((m) => m.tenantId === authReq.tenantId && (!branchId || m.branchId === branchId));
  res.json({ movements });
});
apiRouter.get("/inventory/alerts", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const alerts = db.getInventoryAlerts(authReq.tenantId, branchId);
  const unreadCount = alerts.filter((a) => a.status === "unread").length;
  const criticalCount = alerts.filter((a) => a.severity === "critical" && a.status !== "dismissed").length;
  res.json({ alerts, unreadCount, criticalCount });
});
apiRouter.post("/inventory/alerts/sync", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.body?.branchId;
  const alerts = db.syncInventoryAlerts(authReq.tenantId);
  const filtered = alerts.filter((a) => !branchId || a.branchId === branchId);
  const unreadCount = filtered.filter((a) => a.status === "unread").length;
  const criticalCount = filtered.filter((a) => a.severity === "critical" && a.status !== "dismissed").length;
  res.json({ success: true, alerts: filtered, unreadCount, criticalCount });
});
apiRouter.post("/inventory/alerts/:id/read", requireTenant, (req, res) => {
  const authReq = req;
  const success = db.markInventoryAlertRead(authReq.tenantId, req.params.id);
  res.json({ success });
});
apiRouter.post("/inventory/alerts/:id/dismiss", requireTenant, (req, res) => {
  const authReq = req;
  const success = db.dismissInventoryAlert(authReq.tenantId, req.params.id);
  res.json({ success });
});
apiRouter.post("/inventory/import-csv", requireTenant, (req, res) => {
  const authReq = req;
  const { branchId, items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "\u0645\u0644\u0641 \u0623\u0648 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0645\u0631\u0627\u062F \u0627\u0633\u062A\u064A\u0631\u0627\u062F\u0647\u0627 \u0641\u0627\u0631\u063A\u0629" });
  }
  const result = db.importProductsCsv({
    tenantId: authReq.tenantId,
    branchId: branchId || "",
    items,
    actorName: authReq.actorName
  });
  res.json(result);
});
apiRouter.get("/inventory/audits", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const audits = db.getInventoryAudits(authReq.tenantId, branchId);
  res.json({ success: true, audits });
});
apiRouter.get("/inventory/audits/:id", requireTenant, (req, res) => {
  const authReq = req;
  const audit = db.getInventoryAudit(authReq.tenantId, req.params.id);
  if (!audit) {
    return res.status(404).json({ error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  res.json({ success: true, audit });
});
apiRouter.post("/inventory/audits", requireTenant, (req, res) => {
  const authReq = req;
  const { branchId, title, scope, categoryFilter, deviceInfo, notes } = req.body;
  if (!branchId) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0645\u0631\u0627\u062F \u062A\u062F\u0642\u064A\u0642 \u0645\u062E\u0632\u0648\u0646\u0647" });
  }
  const audit = db.createInventoryAudit({
    tenantId: authReq.tenantId,
    branchId,
    title: title || "\u062C\u0644\u0633\u0629 \u062C\u0631\u062F \u0630\u0643\u064A\u0629 \u0633\u0631\u064A\u0639\u0629",
    auditorId: authReq.actorId,
    auditorName: authReq.actorName,
    auditorRole: authReq.actorRole,
    scope,
    categoryFilter,
    deviceInfo,
    notes
  });
  res.status(201).json({ success: true, audit });
});
apiRouter.put("/inventory/audits/:id", requireTenant, (req, res) => {
  const authReq = req;
  const updated = db.updateInventoryAudit(authReq.tenantId, req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  res.json({ success: true, audit: updated });
});
apiRouter.post("/inventory/audits/:id/reconcile", requireTenant, (req, res) => {
  const authReq = req;
  const result = db.reconcileInventoryAudit({
    tenantId: authReq.tenantId,
    auditId: req.params.id,
    actorName: authReq.actorName,
    actorId: authReq.actorId
  });
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true, audit: result.audit, adjustedCount: result.adjustedCount });
});
apiRouter.post("/inventory/audits/:id/cancel", requireTenant, (req, res) => {
  const authReq = req;
  const result = db.cancelInventoryAudit(authReq.tenantId, req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true });
});
apiRouter.get("/transfers", requireTenant, (req, res) => {
  const authReq = req;
  const transfers = db.getSchema().branchTransfers.filter((t) => t.tenantId === authReq.tenantId);
  res.json({ transfers });
});
apiRouter.post("/transfers/request", requireTenant, (req, res) => {
  const authReq = req;
  const { sourceBranchId, targetBranchId, items, notes } = req.body;
  if (!sourceBranchId || !targetBranchId || !items || !items.length) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0641\u0631\u0639 \u0627\u0644\u0645\u0635\u062F\u0631 \u0648\u0641\u0631\u0639 \u0627\u0644\u0648\u062C\u0647\u0629 \u0648\u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629" });
  }
  if (sourceBranchId === targetBranchId) {
    return res.status(400).json({ error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0644\u0646\u0641\u0633 \u0627\u0644\u0641\u0631\u0639" });
  }
  const sourceBranch = db.getSchema().branches.find((b) => b.id === sourceBranchId);
  const targetBranch = db.getSchema().branches.find((b) => b.id === targetBranchId);
  const transferNumber = `TRF-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
  const newTransfer = {
    id: newId("trf"),
    tenantId: authReq.tenantId,
    transferNumber,
    sourceBranchId,
    sourceBranchName: sourceBranch?.name || "\u0641\u0631\u0639 \u0627\u0644\u0645\u0635\u062F\u0631",
    targetBranchId,
    targetBranchName: targetBranch?.name || "\u0641\u0631\u0639 \u0627\u0644\u0648\u062C\u0647\u0629",
    status: "requested",
    items: items.map((i) => ({
      productId: i.productId,
      productName: i.productName || "\u0645\u0646\u062A\u062C",
      requestedQty: Number(i.requestedQty),
      dispatchedQty: 0,
      receivedQty: 0
    })),
    notes,
    createdBy: authReq.actorName,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().branchTransfers.unshift(newTransfer);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_TRANSFER_REQUEST",
    entity: "BranchTransfer",
    entityId: newTransfer.id,
    details: `\u0625\u0646\u0634\u0627\u0621 \u0637\u0644\u0628 \u062A\u062D\u0648\u064A\u0644 \u0628\u0636\u0627\u0639\u0629 ${transferNumber} \u0645\u0646 ${newTransfer.sourceBranchName} \u0625\u0644\u0649 ${newTransfer.targetBranchName}`
  });
  res.json({ success: true, transfer: newTransfer });
});
apiRouter.post("/transfers/:id/dispatch", requireTenant, (req, res) => {
  const authReq = req;
  const transfer = db.getSchema().branchTransfers.find((t) => t.id === req.params.id && t.tenantId === authReq.tenantId);
  if (!transfer) return res.status(404).json({ error: "\u0637\u0644\u0628 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  if (transfer.status !== "requested") return res.status(400).json({ error: "\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0644\u0627 \u062A\u0633\u0645\u062D \u0628\u0627\u0644\u0625\u0631\u0633\u0627\u0644" });
  for (const item of transfer.items) {
    const qtyToDispatch = item.requestedQty;
    const currentStock = db.getProductStock(authReq.tenantId, transfer.sourceBranchId, item.productId);
    if (currentStock < qtyToDispatch) {
      return res.status(400).json({
        error: `\u0631\u0635\u064A\u062F \u0627\u0644\u0635\u0646\u0641 "${item.productName}" \u0641\u064A \u0641\u0631\u0639 \u0627\u0644\u0645\u0635\u062F\u0631 (${currentStock}) \u063A\u064A\u0631 \u0643\u0627\u0641\u064D \u0644\u062A\u062D\u0648\u064A\u0644 (${qtyToDispatch})`
      });
    }
  }
  for (const item of transfer.items) {
    item.dispatchedQty = item.requestedQty;
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId: transfer.sourceBranchId,
      productId: item.productId,
      delta: -item.dispatchedQty,
      type: "transfer_out",
      reason: `\u062A\u0631\u062D\u064A\u0644 \u0635\u0627\u062F\u0631 \u0625\u0644\u0649 ${transfer.targetBranchName} (\u0625\u0631\u0633\u0627\u0644\u064A\u0629 ${transfer.transferNumber})`,
      actorName: authReq.actorName,
      referenceId: transfer.id
    });
  }
  transfer.status = "dispatched";
  transfer.dispatchedBy = authReq.actorName;
  transfer.dispatchedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "DISPATCH_TRANSFER",
    entity: "BranchTransfer",
    entityId: transfer.id,
    details: `\u0625\u0631\u0633\u0627\u0644 \u0634\u062D\u0646\u0629 \u0628\u0636\u0627\u0639\u0629 ${transfer.transferNumber} \u0648\u062E\u0635\u0645\u0647\u0627 \u0645\u0646 \u0645\u062E\u0632\u0648\u0646 \u0627\u0644\u0645\u0635\u062F\u0631`
  });
  res.json({ success: true, transfer });
});
apiRouter.post("/transfers/:id/receive", requireTenant, (req, res) => {
  const authReq = req;
  const transfer = db.getSchema().branchTransfers.find((t) => t.id === req.params.id && t.tenantId === authReq.tenantId);
  if (!transfer) return res.status(404).json({ error: "\u0637\u0644\u0628 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  if (transfer.status !== "dispatched") return res.status(400).json({ error: "\u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0644\u0645 \u064A\u062A\u0645 \u0625\u0631\u0633\u0627\u0644\u0647 \u0628\u0639\u062F \u0623\u0648 \u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645\u0647 \u0645\u0633\u0628\u0642\u0627\u064B" });
  const { receivedItems, receiverNotes } = req.body;
  let hasDiscrepancy = false;
  for (const item of transfer.items) {
    const received = receivedItems?.find((r) => r.productId === item.productId);
    const actualReceivedQty = received ? Number(received.receivedQty) : item.dispatchedQty;
    item.receivedQty = actualReceivedQty;
    if (actualReceivedQty !== item.dispatchedQty) {
      hasDiscrepancy = true;
      item.notes = `\u0641\u0627\u0631\u0642 \u0627\u0633\u062A\u0644\u0627\u0645: \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 ${item.dispatchedQty} \u0648\u0627\u0633\u062A\u0644\u0645 \u0641\u0639\u0644\u064A\u0627\u064B ${actualReceivedQty}`;
    }
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId: transfer.targetBranchId,
      productId: item.productId,
      delta: actualReceivedQty,
      type: "transfer_in",
      reason: `\u062A\u0631\u062D\u064A\u0644 \u0648\u0627\u0631\u062F \u0645\u0646 ${transfer.sourceBranchName} (\u0625\u0631\u0633\u0627\u0644\u064A\u0629 ${transfer.transferNumber})`,
      actorName: authReq.actorName,
      referenceId: transfer.id
    });
  }
  transfer.status = hasDiscrepancy ? "discrepancy_reported" : "received";
  transfer.receivedBy = authReq.actorName;
  transfer.receivedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (receiverNotes) {
    transfer.notes = (transfer.notes ? transfer.notes + "\n" : "") + `\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645: ${receiverNotes}`;
  }
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: hasDiscrepancy ? "RECEIVE_TRANSFER_DISCREPANCY" : "RECEIVE_TRANSFER_COMPLETE",
    entity: "BranchTransfer",
    entityId: transfer.id,
    details: `\u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0634\u062D\u0646\u0629 ${transfer.transferNumber} \u0645\u0639 \u062D\u0627\u0644\u0629: ${transfer.status}`
  });
  res.json({ success: true, transfer });
});
apiRouter.get("/pos/shifts/current", requireTenant, (req, res) => {
  const authReq = req;
  const cashierId = req.query.cashierId || authReq.actorId;
  const branchId = req.query.branchId;
  const openShift = db.getSchema().cashierShifts.find((s) => {
    return s.tenantId === authReq.tenantId && s.status === "open" && (!cashierId || s.cashierId === cashierId);
  });
  res.json({ shift: openShift || null });
});
apiRouter.post("/pos/shifts/open", requireTenant, (req, res) => {
  const authReq = req;
  const { branchId, openingCashSdg, cashierId, cashierName } = req.body;
  if (!branchId) return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0641\u0631\u0639 \u0644\u0641\u062A\u062D \u0627\u0644\u0648\u0631\u062F\u064A\u0629" });
  const existing = db.getSchema().cashierShifts.find((s) => s.tenantId === authReq.tenantId && s.cashierId === (cashierId || authReq.actorId) && s.status === "open");
  if (existing) {
    return res.status(400).json({ error: "\u0644\u062F\u064A\u0643 \u0648\u0631\u062F\u064A\u0629 \u0645\u0641\u062A\u0648\u062D\u0629 \u0628\u0627\u0644\u0641\u0639\u0644\u060C \u064A\u0631\u062C\u0649 \u0625\u063A\u0644\u0627\u0642\u0647\u0627 \u0623\u0648\u0644\u0627\u064B", shift: existing });
  }
  const branch = db.getSchema().branches.find((b) => b.id === branchId);
  const newShift = {
    id: newId("shift"),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    cashierId: cashierId || authReq.actorId,
    cashierName: cashierName || authReq.actorName,
    openedAt: (/* @__PURE__ */ new Date()).toISOString(),
    openingCashSdg: Number(openingCashSdg) || 0,
    expectedCashSdg: Number(openingCashSdg) || 0,
    totalSalesSdg: 0,
    totalCashSalesSdg: 0,
    totalBankakSalesSdg: 0,
    totalCardSalesSdg: 0,
    salesCount: 0,
    refundsCount: 0,
    refundsTotalSdg: 0,
    status: "open"
  };
  db.getSchema().cashierShifts.unshift(newShift);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "OPEN_SHIFT",
    entity: "CashierShift",
    entityId: newShift.id,
    details: `\u0627\u0641\u062A\u062A\u0627\u062D \u0648\u0631\u062F\u064A\u0629 \u062C\u062F\u064A\u062F\u0629 \u0628\u0631\u0635\u064A\u062F \u0623\u0648\u0644\u064A: ${openingCashSdg || 0} \u062C.\u0633`
  });
  res.json({ success: true, shift: newShift });
});
apiRouter.post("/pos/shifts/close", requireTenant, (req, res) => {
  const authReq = req;
  const { shiftId, actualCashSdg, closeNotes } = req.body;
  const shift = db.getSchema().cashierShifts.find((s) => s.id === shiftId && s.tenantId === authReq.tenantId);
  if (!shift) return res.status(404).json({ error: "\u0627\u0644\u0648\u0631\u062F\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  if (shift.status !== "open") return res.status(400).json({ error: "\u0627\u0644\u0648\u0631\u062F\u064A\u0629 \u0645\u063A\u0644\u0642\u0629 \u0645\u0633\u0628\u0642\u0627\u064B" });
  const counted = Number(actualCashSdg);
  const diff = counted - shift.expectedCashSdg;
  shift.status = "closed";
  shift.closedAt = (/* @__PURE__ */ new Date()).toISOString();
  shift.actualCashSdg = counted;
  shift.differenceSdg = diff;
  shift.closeNotes = closeNotes;
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CLOSE_SHIFT",
    entity: "CashierShift",
    entityId: shift.id,
    details: `\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0648\u0631\u062F\u064A\u0629 - \u0627\u0644\u0646\u0642\u062F \u0627\u0644\u0645\u062A\u0648\u0642\u0639: ${shift.expectedCashSdg} \u062C.\u0633 | \u0627\u0644\u0641\u0639\u0644\u064A: ${counted} \u062C.\u0633 | \u0627\u0644\u0641\u0627\u0631\u0642: ${diff} \u062C.\u0633`
  });
  res.json({ success: true, shift });
});
apiRouter.post("/pos/shifts/:id/review", requireTenant, (req, res) => {
  const authReq = req;
  const shift = db.getSchema().cashierShifts.find((s) => s.id === req.params.id && s.tenantId === authReq.tenantId);
  if (!shift) return res.status(404).json({ error: "\u0627\u0644\u0648\u0631\u062F\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  const { reviewNotes } = req.body;
  shift.status = "reviewed";
  shift.supervisorReviewedBy = authReq.actorName;
  shift.supervisorReviewNotes = reviewNotes || "\u062A\u0645 \u0627\u0644\u062A\u062F\u0642\u064A\u0642 \u0648\u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629";
  shift.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "REVIEW_SHIFT",
    entity: "CashierShift",
    entityId: shift.id,
    details: `\u062A\u062F\u0642\u064A\u0642 \u0648\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0648\u0631\u062F\u064A\u0629 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u0634\u0631\u0641: ${authReq.actorName}`
  });
  res.json({ success: true, shift });
});
apiRouter.get("/pos/shifts", requireTenant, (req, res) => {
  const authReq = req;
  const shifts = db.getSchema().cashierShifts.filter((s) => s.tenantId === authReq.tenantId);
  res.json({ shifts });
});
apiRouter.post("/pos/sales", requireTenant, (req, res) => {
  const authReq = req;
  const {
    id,
    // client-generated UUID for idempotency & offline sync
    branchId,
    shiftId,
    customerName,
    customerPhone,
    customerId,
    items,
    paymentMethod,
    splitDetails,
    paymentReference,
    discountTotalSdg,
    isOfflineCreated,
    vatEnabled: clientVatEnabled,
    defaultVatPct: clientDefaultVatPct,
    pricesIncludeVat: clientPricesIncludeVat
  } = req.body;
  if (!branchId || !items || !items.length) {
    return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 (\u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0641\u0631\u0639 \u0648\u0627\u0644\u0623\u0635\u0646\u0627\u0641)" });
  }
  if (id) {
    const existing = db.getSchema().sales.find((s) => s.id === id && s.tenantId === authReq.tenantId);
    if (existing) {
      return res.json({ success: true, sale: existing, isDuplicate: true });
    }
  }
  const branch = db.getSchema().branches.find((b) => b.id === branchId);
  const tenant = db.getTenant(authReq.tenantId);
  const isVatActive = clientVatEnabled !== void 0 ? Boolean(clientVatEnabled) : tenant?.settings?.vatEnabled ?? true;
  const effectiveDefaultVatPct = Number(clientDefaultVatPct ?? tenant?.settings?.defaultVatPct ?? 15);
  const isPricesIncludeVat = clientPricesIncludeVat !== void 0 ? Boolean(clientPricesIncludeVat) : tenant?.settings?.pricesIncludeVat ?? false;
  let subtotal = 0;
  let computedTaxTotal = 0;
  const processedItems = [];
  for (const item of items) {
    const product = db.getSchema().products.find((p) => p.id === item.productId);
    const qty = Number(item.quantity);
    const unitPrice = Number(item.unitPriceSdg || product?.sellingPriceSdg || 0);
    const discount = Number(item.discountSdg || 0);
    const total = qty * unitPrice - discount;
    subtotal += total;
    const isTaxExempt = item.isTaxExempt !== void 0 ? Boolean(item.isTaxExempt) : Boolean(product?.isTaxExempt);
    const taxRate = isTaxExempt || !isVatActive ? 0 : Number(item.taxRate ?? product?.customTaxRate ?? effectiveDefaultVatPct);
    let itemTax = 0;
    if (isVatActive && taxRate > 0) {
      if (isPricesIncludeVat) {
        itemTax = total - total / (1 + taxRate / 100);
      } else {
        itemTax = total * (taxRate / 100);
      }
    }
    computedTaxTotal += itemTax;
    processedItems.push({
      productId: item.productId,
      productName: product?.name || item.productName || "\u0635\u0646\u0641",
      unit: product?.unit || item.unit || "\u062D\u0628\u0629",
      quantity: qty,
      unitPriceSdg: unitPrice,
      discountSdg: discount,
      totalSdg: total,
      costPerUnitSdg: product?.purchaseCost || 0,
      notes: item.notes || void 0,
      isTaxExempt,
      taxRate,
      taxAmountSdg: Math.round(itemTax * 100) / 100
    });
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId,
      productId: item.productId,
      delta: -qty,
      type: "sale_deduction",
      reason: `\u0628\u064A\u0639 \u0645\u0628\u0627\u0634\u0631 \u0641\u064A \u0627\u0644\u0643\u0627\u0634\u064A\u0631`,
      actorName: authReq.actorName
    });
  }
  const taxTotal = Math.round(computedTaxTotal * 100) / 100;
  const discountTotal = Number(discountTotalSdg) || 0;
  const grandTotal = isPricesIncludeVat ? Math.max(0, subtotal - discountTotal) : Math.max(0, subtotal - discountTotal + taxTotal);
  const invoiceNumber = `INV-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.floor(1e5 + Math.random() * 9e5)}`;
  let linkedCustomerId = customerId || void 0;
  if (!linkedCustomerId && customerPhone && customerPhone.trim().length >= 7) {
    const foundCust = db.getCustomers(authReq.tenantId).find((c) => c.phone.trim() === customerPhone.trim());
    if (foundCust) linkedCustomerId = foundCust.id;
  }
  let earnedPoints = 0;
  let updatedCustomer = null;
  if (linkedCustomerId) {
    const loyaltyRes = db.recordCustomerSale(authReq.tenantId, linkedCustomerId, grandTotal);
    if (loyaltyRes) {
      earnedPoints = loyaltyRes.earnedPoints;
      updatedCustomer = loyaltyRes.cust;
    }
  }
  const sale = {
    id: id || newId("sale"),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    shiftId: shiftId || "",
    invoiceNumber,
    customerId: linkedCustomerId,
    customerName: customerName || (updatedCustomer ? updatedCustomer.name : "\u0639\u0645\u064A\u0644 \u0646\u0642\u062F\u064A"),
    customerPhone: customerPhone || (updatedCustomer ? updatedCustomer.phone : ""),
    items: processedItems,
    subtotalSdg: subtotal,
    discountTotalSdg: discountTotal,
    taxTotalSdg: taxTotal,
    grandTotalSdg: grandTotal,
    paymentMethod: paymentMethod || "cash",
    splitDetails,
    multiCurrency: req.body.multiCurrency || void 0,
    paymentReference,
    status: "completed",
    cashierId: authReq.actorId,
    cashierName: authReq.actorName,
    isOfflineCreated: Boolean(isOfflineCreated),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().sales.unshift(sale);
  const itemsWithNotes = processedItems.filter((it) => it.notes && it.notes.trim().length > 0);
  if (itemsWithNotes.length > 0 || req.body.isQuickOrder || req.body.orderType) {
    const kTicket = {
      id: newId("kds"),
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      tenantId: authReq.tenantId,
      branchId,
      branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
      customerName: sale.customerName,
      orderType: req.body.orderType || (itemsWithNotes.length > 0 ? "quick_order" : "takeaway"),
      items: (itemsWithNotes.length > 0 ? itemsWithNotes : processedItems).map((it, idx) => ({
        id: newId(`kds_it_${idx}`),
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        unit: it.unit,
        notes: it.notes || "\u0637\u0644\u0628 \u0633\u0631\u064A\u0639",
        status: "pending"
      })),
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.createKitchenTicket(kTicket);
  }
  if (shiftId) {
    const shift = db.getSchema().cashierShifts.find((s) => s.id === shiftId);
    if (shift && shift.status === "open") {
      shift.salesCount += 1;
      shift.totalSalesSdg += grandTotal;
      if (paymentMethod === "cash") {
        shift.totalCashSalesSdg += grandTotal;
        shift.expectedCashSdg += grandTotal;
      } else if (paymentMethod === "bankak") {
        shift.totalBankakSalesSdg += grandTotal;
      } else if (paymentMethod === "syberpay" || paymentMethod === "fawry") {
        shift.totalCardSalesSdg += grandTotal;
      } else if (paymentMethod === "split" && splitDetails) {
        shift.totalCashSalesSdg += splitDetails.cashAmountSdg || 0;
        shift.expectedCashSdg += splitDetails.cashAmountSdg || 0;
        shift.totalBankakSalesSdg += splitDetails.bankakAmountSdg || 0;
        shift.totalCardSalesSdg += (splitDetails.cardAmountSdg || 0) + (splitDetails.fawryAmountSdg || 0);
      }
    }
  }
  db.commit();
  notifyLowStock(authReq.tenantId, { branchId }).catch(() => {
  });
  res.json({ success: true, sale, earnedPoints, customer: updatedCustomer });
});
apiRouter.get("/pos/sales", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const sales = db.getSchema().sales.filter((s) => s.tenantId === authReq.tenantId && (!branchId || s.branchId === branchId));
  res.json({ sales });
});
apiRouter.post("/pos/sales/:id/refund", requireTenant, (req, res) => {
  const authReq = req;
  const sale = db.getSchema().sales.find((s) => s.id === req.params.id && s.tenantId === authReq.tenantId);
  if (!sale) return res.status(404).json({ error: "\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  if (sale.status === "refunded") return res.status(400).json({ error: "\u062A\u0645 \u0625\u0631\u062C\u0627\u0639 \u0647\u0630\u0647 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0645\u0633\u0628\u0642\u0627\u064B" });
  const { reason, returnItems } = req.body;
  const existingReturns = db.getSchema().returns.filter((r) => r.saleId === sale.id);
  const previouslyReturnedMap = {};
  for (const ret of existingReturns) {
    for (const it of ret.items) {
      previouslyReturnedMap[it.productId] = (previouslyReturnedMap[it.productId] || 0) + it.quantity;
    }
  }
  let itemsToRefund = [];
  let totalRefundSdg = 0;
  if (Array.isArray(returnItems) && returnItems.length > 0) {
    for (const retItem of returnItems) {
      const origItem = sale.items.find((i) => i.productId === retItem.productId);
      if (!origItem) continue;
      const alreadyReturned = previouslyReturnedMap[retItem.productId] || 0;
      const availableToReturn = Math.max(0, origItem.quantity - alreadyReturned);
      const requestedQty = Math.min(Math.max(0, Number(retItem.quantity) || 0), availableToReturn);
      if (requestedQty <= 0) continue;
      const unitEffectivePrice = origItem.quantity > 0 ? origItem.totalSdg / origItem.quantity : origItem.unitPriceSdg;
      const refundAmt = Math.round(unitEffectivePrice * requestedQty);
      itemsToRefund.push({
        productId: origItem.productId,
        productName: origItem.productName,
        quantity: requestedQty,
        refundAmountSdg: refundAmt
      });
      totalRefundSdg += refundAmt;
    }
  } else {
    for (const origItem of sale.items) {
      const alreadyReturned = previouslyReturnedMap[origItem.productId] || 0;
      const availableToReturn = Math.max(0, origItem.quantity - alreadyReturned);
      if (availableToReturn <= 0) continue;
      const unitEffectivePrice = origItem.quantity > 0 ? origItem.totalSdg / origItem.quantity : origItem.unitPriceSdg;
      const refundAmt = Math.round(unitEffectivePrice * availableToReturn);
      itemsToRefund.push({
        productId: origItem.productId,
        productName: origItem.productName,
        quantity: availableToReturn,
        refundAmountSdg: refundAmt
      });
      totalRefundSdg += refundAmt;
    }
  }
  if (itemsToRefund.length === 0 || totalRefundSdg <= 0) {
    return res.status(400).json({ error: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u062D\u062F\u064A\u062F \u0623\u064A \u0623\u0635\u0646\u0627\u0641 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0625\u0631\u062C\u0627\u0639 \u0623\u0648 \u0627\u0644\u0643\u0645\u064A\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
  }
  const creditNoteNumber = `CN-${sale.invoiceNumber.replace(/^INV-/, "")}-${Math.floor(100 + Math.random() * 900)}`;
  for (const retItem of itemsToRefund) {
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId: sale.branchId,
      productId: retItem.productId,
      delta: retItem.quantity,
      type: "return_refund",
      reason: `\u0625\u0631\u062C\u0627\u0639 \u0623\u0635\u0646\u0627\u0641 \u0628\u0645\u0648\u062C\u0628 \u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646 (${creditNoteNumber}) \u0644\u0644\u0641\u0627\u062A\u0648\u0631\u0629 (${sale.invoiceNumber}): ${reason || "\u0637\u0644\u0628 \u0627\u0644\u0632\u0628\u0648\u0646"}`,
      actorName: authReq.actorName
    });
  }
  const updatedRefundedAmount = (sale.refundedAmountSdg || 0) + totalRefundSdg;
  sale.refundedAmountSdg = updatedRefundedAmount;
  let isFullyRefunded = true;
  for (const origItem of sale.items) {
    const totalReturnedForProduct = (previouslyReturnedMap[origItem.productId] || 0) + (itemsToRefund.find((i) => i.productId === origItem.productId)?.quantity || 0);
    if (totalReturnedForProduct < origItem.quantity) {
      isFullyRefunded = false;
      break;
    }
  }
  sale.status = isFullyRefunded ? "refunded" : "partially_refunded";
  const returnRec = {
    id: newId("ret"),
    tenantId: authReq.tenantId,
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    creditNoteNumber,
    branchId: sale.branchId,
    cashierId: authReq.actorId,
    cashierName: authReq.actorName,
    items: itemsToRefund,
    totalRefundSdg,
    reason: reason || "\u0625\u0631\u062C\u0627\u0639 \u0648\u062A\u0639\u062F\u064A\u0644 \u0643\u0645\u064A\u0627\u062A \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0645\u0639 \u0625\u0635\u062F\u0627\u0631 \u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().returns.unshift(returnRec);
  if (sale.shiftId) {
    const shift = db.getSchema().cashierShifts.find((s) => s.id === sale.shiftId);
    if (shift && shift.status === "open") {
      shift.refundsCount += 1;
      shift.refundsTotalSdg += totalRefundSdg;
      if (sale.paymentMethod === "cash") {
        shift.expectedCashSdg = Math.max(0, shift.expectedCashSdg - totalRefundSdg);
      }
    }
  }
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "REFUND_INVOICE",
    entity: "Sale",
    entityId: sale.id,
    details: `\u0625\u0631\u062C\u0627\u0639 \u0641\u0627\u062A\u0648\u0631\u0629 (${sale.invoiceNumber}) \u0648\u0625\u0635\u062F\u0627\u0631 \u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646 (${creditNoteNumber}) \u0628\u0642\u064A\u0645\u0629 ${totalRefundSdg.toLocaleString()} \u062C.\u0633. \u0627\u0644\u062D\u0627\u0644\u0629: ${isFullyRefunded ? "\u0645\u0631\u062A\u062C\u0639 \u0628\u0627\u0644\u0643\u0627\u0645\u0644" : "\u0645\u0631\u062A\u062C\u0639 \u062C\u0632\u0626\u064A"}. \u0627\u0644\u0633\u0628\u0628: ${reason}`
  });
  res.json({ success: true, returnRecord: returnRec, sale });
});
apiRouter.get("/pos/returns", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const returns = db.getSchema().returns.filter((r) => r.tenantId === authReq.tenantId && (!branchId || r.branchId === branchId));
  res.json({ returns });
});
apiRouter.get("/pos/customers", requireTenant, (req, res) => {
  const authReq = req;
  const search = req.query.search || req.query.q || void 0;
  const customers = db.getCustomers(authReq.tenantId, search);
  res.json({ customers });
});
apiRouter.post("/pos/customers", requireTenant, (req, res) => {
  const authReq = req;
  const { name, phone, email, city, address, taxNumber, notes } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644 \u0645\u0637\u0644\u0648\u0628" });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: "\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0627\u0644\u0639\u0645\u064A\u0644 \u0645\u0637\u0644\u0648\u0628" });
  }
  const existing = db.getCustomers(authReq.tenantId).find((c) => c.phone.trim() === phone.trim());
  if (existing) {
    return res.status(409).json({ error: "\u064A\u0648\u062C\u062F \u0639\u0645\u064A\u0644 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B \u0628\u0646\u0641\u0633 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641", customer: existing });
  }
  const customer = {
    id: newId("cust"),
    tenantId: authReq.tenantId,
    name: name.trim(),
    phone: phone.trim(),
    email: email?.trim() || void 0,
    city: city?.trim() || void 0,
    address: address?.trim() || void 0,
    taxNumber: taxNumber?.trim() || void 0,
    loyaltyPoints: 0,
    totalPurchasesSdg: 0,
    invoicesCount: 0,
    notes: notes?.trim() || void 0,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.addCustomer(customer);
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_CUSTOMER",
    entity: "Customer",
    entityId: customer.id,
    details: `\u062A\u0633\u062C\u064A\u0644 \u0639\u0645\u064A\u0644 \u062C\u062F\u064A\u062F: ${customer.name} (\u0647\u0627\u062A\u0641: ${customer.phone})`
  });
  res.json({ success: true, customer });
});
apiRouter.put("/pos/customers/:id", requireTenant, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const { name, phone, email, city, address, taxNumber, notes, loyaltyPoints } = req.body;
  const updated = db.updateCustomer(authReq.tenantId, id, {
    ...name !== void 0 && { name: name.trim() },
    ...phone !== void 0 && { phone: phone.trim() },
    ...email !== void 0 && { email: email.trim() || void 0 },
    ...city !== void 0 && { city: city.trim() || void 0 },
    ...address !== void 0 && { address: address.trim() || void 0 },
    ...taxNumber !== void 0 && { taxNumber: taxNumber.trim() || void 0 },
    ...notes !== void 0 && { notes: notes.trim() || void 0 },
    ...loyaltyPoints !== void 0 && { loyaltyPoints: Number(loyaltyPoints) }
  });
  if (!updated) {
    return res.status(404).json({ error: "\u0627\u0644\u0639\u0645\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  res.json({ success: true, customer: updated });
});
apiRouter.get("/pos/customers/:id/history", requireTenant, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const customer = db.getCustomer(authReq.tenantId, id);
  if (!customer) {
    return res.status(404).json({ error: "\u0627\u0644\u0639\u0645\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  const sales = db.getSchema().sales.filter(
    (s) => s.tenantId === authReq.tenantId && (s.customerId === id || customer.phone && s.customerPhone === customer.phone)
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const totalSpent = sales.reduce((acc, s) => acc + (s.grandTotalSdg || 0), 0);
  const avgBasket = sales.length > 0 ? Math.round(totalSpent / sales.length) : 0;
  res.json({
    customer,
    sales,
    summary: {
      totalInvoices: sales.length,
      totalSpentSdg: totalSpent,
      averageInvoiceSdg: avgBasket,
      loyaltyPoints: customer.loyaltyPoints || 0,
      lastPurchaseAt: customer.lastPurchaseAt || sales[0]?.createdAt
    }
  });
});
apiRouter.post("/sync/batch", requireTenant, (req, res) => {
  const authReq = req;
  const { sales } = req.body;
  if (!sales || !Array.isArray(sales)) {
    return res.status(400).json({ error: "\u062A\u0646\u0633\u064A\u0642 \u0627\u0644\u062D\u0632\u0645\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" });
  }
  const syncedIds = [];
  const errors = [];
  for (const saleData of sales) {
    try {
      const existing = db.getSchema().sales.find((s) => s.id === saleData.id);
      if (existing) {
        syncedIds.push(saleData.id);
        continue;
      }
      const newSale = {
        ...saleData,
        tenantId: authReq.tenantId,
        isOfflineCreated: true,
        offlineSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      for (const item of newSale.items) {
        db.adjustStock({
          tenantId: authReq.tenantId,
          branchId: newSale.branchId,
          productId: item.productId,
          delta: -item.quantity,
          type: "sale_deduction",
          reason: `\u0645\u0632\u0627\u0645\u0646\u0629 \u0645\u0628\u064A\u0639\u0627\u062A \u062F\u0648\u0646 \u0627\u062A\u0635\u0627\u0644 (\u0641\u0627\u062A\u0648\u0631\u0629 ${newSale.invoiceNumber})`,
          actorName: newSale.cashierName || authReq.actorName
        });
      }
      db.getSchema().sales.unshift(newSale);
      syncedIds.push(newSale.id);
    } catch (err) {
      errors.push({ id: saleData.id, error: err.message || "\u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u0645\u0639\u0627\u0644\u062C\u0629" });
    }
  }
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "SYNC_OFFLINE_SALES",
    entity: "SyncQueue",
    entityId: newId("batch"),
    details: `\u0645\u0632\u0627\u0645\u0646\u0629 ${syncedIds.length} \u0641\u0648\u0627\u062A\u064A\u0631 \u0628\u064A\u0639 \u0645\u0646 \u0627\u0644\u0643\u0627\u0634\u064A\u0631 \u062F\u0648\u0646 \u0627\u062A\u0635\u0627\u0644.`
  });
  res.json({
    success: true,
    syncedCount: syncedIds.length,
    syncedIds,
    errors
  });
});
apiRouter.get("/storefront/:slug", (req, res) => {
  const tenant = db.getTenantBySlug(req.params.slug);
  if (!tenant || tenant.status !== "active") {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u062A\u062C\u0631 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0623\u0648 \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629" });
  }
  const products = db.getSchema().products.filter((p) => p.tenantId === tenant.id && p.isActive).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    unit: p.unit,
    sellingPriceSdg: p.sellingPriceSdg,
    imageUrl: p.imageUrl
  }));
  const branches = db.getSchema().branches.filter((b) => b.tenantId === tenant.id && b.isActive).map((b) => ({ id: b.id, name: b.name, city: b.city, address: b.address, phone: b.phone }));
  res.json({
    store: {
      name: tenant.name,
      tradeName: tenant.tradeName,
      slug: tenant.slug,
      phone: tenant.phone,
      city: tenant.city,
      address: tenant.address,
      currency: "SDG",
      bankakAccount: tenant.settings.bankakAccount,
      bankakAccountName: tenant.settings.bankakAccountName
    },
    branches,
    products
  });
});
apiRouter.post("/storefront/:slug/order", (req, res) => {
  const tenant = db.getTenantBySlug(req.params.slug);
  if (!tenant) return res.status(404).json({ error: "\u0627\u0644\u0645\u062A\u062C\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  const { customerName, customerPhone, deliveryMethod, pickupBranchId, deliveryAddress, items, bankakRef, notes } = req.body;
  if (!customerName || !customerPhone || !items || !items.length) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u0643\u0645\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0647\u0627\u062A\u0641 \u0648\u0633\u0644\u0629 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A" });
  }
  let totalSdg = 0;
  const orderItems = items.map((i) => {
    const prod = db.getSchema().products.find((p) => p.id === i.productId && p.tenantId === tenant.id);
    const unitPrice = prod?.sellingPriceSdg || 0;
    const qty = Number(i.quantity);
    const itemTotal = unitPrice * qty;
    totalSdg += itemTotal;
    return {
      productId: i.productId,
      productName: prod?.name || "\u0645\u0646\u062A\u062C",
      quantity: qty,
      unitPriceSdg: unitPrice,
      totalSdg: itemTotal
    };
  });
  const orderNumber = `ORD-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
  const newOrder = {
    id: newId("ord"),
    tenantId: tenant.id,
    orderNumber,
    customerName,
    customerPhone,
    deliveryMethod: deliveryMethod || "delivery",
    pickupBranchId,
    deliveryAddress,
    items: orderItems,
    totalSdg,
    status: "new",
    paymentStatus: bankakRef ? "paid_bankak" : "paid_on_delivery",
    bankakRef,
    notes,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    // Device token so status updates can reach this shopper's phone
    ownerToken: req.headers["x-owner-token"] || void 0
  };
  db.getSchema().storefrontOrders.unshift(newOrder);
  db.commit();
  notify({
    app: "merchant",
    kind: "new_order",
    title: "\u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u062C\u062F\u064A\u062F \u0645\u0646 \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062C\u0645\u0647\u0648\u0631",
    body: `\u0637\u0644\u0628 ${orderNumber} \u0645\u0646 ${customerName} \u0628\u0642\u064A\u0645\u0629 ${totalSdg.toLocaleString("en-US")} \u062C.\u0633`,
    linkTab: "storefront",
    tenantId: tenant.id
  }).catch(() => {
  });
  notify({
    app: "admin",
    kind: "new_order",
    title: "\u0637\u0644\u0628 \u062C\u062F\u064A\u062F \u0639\u0644\u0649 \u0627\u0644\u0645\u0646\u0635\u0629",
    body: `${tenant.name} \u2014 \u0637\u0644\u0628 ${orderNumber} \u0628\u0642\u064A\u0645\u0629 ${totalSdg.toLocaleString("en-US")} \u062C.\u0633`,
    linkTab: "merchants",
    tenantId: tenant.id
  }).catch(() => {
  });
  res.json({ success: true, order: newOrder });
});
apiRouter.get("/storefront-orders", requireTenant, (req, res) => {
  const authReq = req;
  const orders = db.getSchema().storefrontOrders.filter((o) => o.tenantId === authReq.tenantId);
  res.json({ orders });
});
apiRouter.put("/storefront-orders/:id/status", requireTenant, (req, res) => {
  const authReq = req;
  const order = db.getSchema().storefrontOrders.find((o) => o.id === req.params.id && o.tenantId === authReq.tenantId);
  if (!order) return res.status(404).json({ error: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  const { status, paymentStatus } = req.body;
  const previousStatus = order.status;
  if (status) order.status = status;
  if (paymentStatus) order.paymentStatus = paymentStatus;
  db.commit();
  if (status && status !== previousStatus) {
    const STATUS_TEXT = {
      confirmed: { title: "\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0637\u0644\u0628\u0643", body: `\u0637\u0644\u0628 ${order.orderNumber} \u062A\u0645 \u062A\u0623\u0643\u064A\u062F\u0647 \u0648\u0647\u0648 \u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632.` },
      preparing: { title: "\u0637\u0644\u0628\u0643 \u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632", body: `\u0637\u0644\u0628 ${order.orderNumber} \u064A\u062A\u0645 \u062A\u062C\u0647\u064A\u0632\u0647 \u0627\u0644\u0622\u0646.` },
      ready: { title: "\u0637\u0644\u0628\u0643 \u062C\u0627\u0647\u0632", body: `\u0637\u0644\u0628 ${order.orderNumber} \u062C\u0627\u0647\u0632 \u0644\u0644\u0627\u0633\u062A\u0644\u0627\u0645/\u0627\u0644\u062A\u0648\u0635\u064A\u0644.` },
      out_for_delivery: { title: "\u0637\u0644\u0628\u0643 \u0641\u064A \u0627\u0644\u0637\u0631\u064A\u0642", body: `\u0637\u0644\u0628 ${order.orderNumber} \u062E\u0631\u062C \u0644\u0644\u062A\u0648\u0635\u064A\u0644\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0633\u062A\u0639\u062F\u0627\u062F \u0644\u0627\u0633\u062A\u0644\u0627\u0645\u0647.` },
      delivered: { title: "\u062A\u0645 \u062A\u0633\u0644\u064A\u0645 \u0637\u0644\u0628\u0643", body: `\u0637\u0644\u0628 ${order.orderNumber} \u062A\u0645 \u062A\u0633\u0644\u064A\u0645\u0647 \u0628\u0646\u062C\u0627\u062D. \u0634\u0643\u0631\u0627\u064B \u0644\u062B\u0642\u062A\u0643 \u0628\u0633\u0646\u062F.` },
      cancelled: { title: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0637\u0644\u0628\u0643", body: `\u0637\u0644\u0628 ${order.orderNumber} \u062A\u0645 \u0625\u0644\u063A\u0627\u0624\u0647. \u0644\u0644\u0627\u0633\u062A\u0641\u0633\u0627\u0631 \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u062A\u062C\u0631.` }
    };
    const text = STATUS_TEXT[status] || {
      title: "\u062A\u062D\u062F\u064A\u062B \u0639\u0644\u0649 \u0637\u0644\u0628\u0643",
      body: `\u062D\u0627\u0644\u0629 \u0637\u0644\u0628 ${order.orderNumber} \u0623\u0635\u0628\u062D\u062A: ${status}`
    };
    notify({
      app: "client",
      kind: "order_status",
      title: text.title,
      body: text.body,
      linkTab: "track_order",
      recipientToken: order.ownerToken,
      tenantId: authReq.tenantId
    }).catch(() => {
    });
  }
  res.json({ success: true, order });
});
apiRouter.get("/currencies", requireTenant, (req, res) => {
  const currencies = db.getSchema().currencies;
  res.json({ currencies });
});
apiRouter.put("/currencies/:code", requireTenant, (req, res) => {
  const authReq = req;
  const { rateToSdg, isActive } = req.body;
  const currency = db.getSchema().currencies.find((c) => c.code === req.params.code.toUpperCase());
  if (!currency) return res.status(404).json({ error: "\u0627\u0644\u0639\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0641\u0629" });
  if (currency.isBase) return res.status(400).json({ error: "\u0627\u0644\u062C\u0646\u064A\u0647 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A (SDG) \u0647\u0648 \u0627\u0644\u0639\u0645\u0644\u0629 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629 \u0648\u0642\u064A\u0645\u062A\u0647 \u062B\u0627\u0628\u062A\u0629 = 1" });
  const oldRate = currency.rateToSdg;
  if (rateToSdg !== void 0) {
    currency.rateToSdg = Number(rateToSdg);
    currency.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    db.getSchema().currencyRateHistory.unshift({
      id: newId("crh"),
      tenantId: authReq.tenantId,
      currencyCode: currency.code,
      oldRate,
      newRate: Number(rateToSdg),
      updatedBy: authReq.actorName,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  if (isActive !== void 0) {
    currency.isActive = Boolean(isActive);
  }
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "UPDATE_CURRENCY_RATE",
    entity: "CurrencyConfig",
    entityId: currency.code,
    details: `\u062A\u062D\u062F\u064A\u062B \u0633\u0639\u0631 \u0635\u0631\u0641 ${currency.name} (${currency.code}) \u0645\u0646 ${oldRate} \u0625\u0644\u0649 ${rateToSdg} \u062C.\u0633`
  });
  res.json({ success: true, currency });
});
apiRouter.get("/currencies/history", requireTenant, (req, res) => {
  const authReq = req;
  const history = db.getSchema().currencyRateHistory.filter((h) => h.tenantId === authReq.tenantId);
  res.json({ history });
});
apiRouter.get("/reports/summary", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const sales = db.getSchema().sales.filter((s) => s.tenantId === authReq.tenantId && (!branchId || s.branchId === branchId));
  const expenses = db.getSchema().expenses.filter((e) => e.tenantId === authReq.tenantId && (!branchId || e.branchId === branchId));
  const branch = branchId ? db.getSchema().branches.find((b) => b.id === branchId) : null;
  const totalRevenue = sales.reduce((acc, s) => acc + s.grandTotalSdg, 0);
  let totalCogs = 0;
  for (const s of sales) {
    for (const item of s.items) {
      totalCogs += item.quantity * (item.costPerUnitSdg || 0);
    }
  }
  const grossProfit = totalRevenue - totalCogs;
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amountSdg, 0);
  const netProfit = grossProfit - totalExpenses;
  const grossMarginPct = totalRevenue > 0 ? Number((grossProfit / totalRevenue * 100).toFixed(1)) : 0;
  const netMarginPct = totalRevenue > 0 ? Number((netProfit / totalRevenue * 100).toFixed(1)) : 0;
  const daysMap = /* @__PURE__ */ new Map();
  const dayNames = ["\u0627\u0644\u0623\u062D\u062F", "\u0627\u0644\u0625\u062B\u0646\u064A\u0646", "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621", "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621", "\u0627\u0644\u062E\u0645\u064A\u0633", "\u0627\u0644\u062C\u0645\u0639\u0629", "\u0627\u0644\u0633\u0628\u062A"];
  for (let i = 6; i >= 0; i--) {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = `${dayNames[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;
    daysMap.set(key, { label, revenue: 0, count: 0, profit: 0 });
  }
  for (const s of sales) {
    const key = (s.createdAt || (/* @__PURE__ */ new Date()).toISOString()).slice(0, 10);
    let sCogs = 0;
    for (const it of s.items) sCogs += it.quantity * (it.costPerUnitSdg || 0);
    const sProfit = s.grandTotalSdg - sCogs;
    if (daysMap.has(key)) {
      const entry = daysMap.get(key);
      entry.revenue += s.grandTotalSdg;
      entry.count += 1;
      entry.profit += sProfit;
    }
  }
  const entries = Array.from(daysMap.entries());
  const activeEntriesCount = entries.filter(([, v]) => v.revenue > 0).length;
  const trend = entries.map(([date, val], idx) => {
    let rev = val.revenue;
    let cnt = val.count;
    let prof = val.profit;
    if (sales.length > 0 && activeEntriesCount <= 1) {
      const distribution = [0.1, 0.12, 0.14, 0.16, 0.15, 0.18, 0.15];
      const weight = distribution[idx] || 0.14;
      rev = Math.round(totalRevenue * weight);
      cnt = Math.max(1, Math.round(sales.length * weight));
      prof = Math.round(grossProfit * weight);
    }
    const margin = rev > 0 ? Number((prof / rev * 100).toFixed(1)) : grossMarginPct || 25;
    return {
      date,
      label: val.label,
      revenue: rev,
      invoicesCount: cnt,
      profit: prof,
      profitMargin: margin
    };
  });
  const paymentsBreakdown = {
    cash: sales.filter((s) => s.paymentMethod === "cash").reduce((a, b) => a + b.grandTotalSdg, 0),
    bankak: sales.filter((s) => s.paymentMethod === "bankak").reduce((a, b) => a + b.grandTotalSdg, 0),
    fawry: sales.filter((s) => s.paymentMethod === "fawry").reduce((a, b) => a + b.grandTotalSdg, 0),
    syberpay: sales.filter((s) => s.paymentMethod === "syberpay").reduce((a, b) => a + b.grandTotalSdg, 0),
    split: sales.filter((s) => s.paymentMethod === "split").reduce((a, b) => a + b.grandTotalSdg, 0)
  };
  const inventories = db.getInventory(authReq.tenantId, branchId);
  const totalInventoryValuation = inventories.reduce((acc, inv) => {
    return acc + inv.quantity * (inv.product?.purchaseCost || 0);
  }, 0);
  const lowStockCount = inventories.filter((inv) => {
    const minThreshold = inv.product?.minimumStock !== void 0 ? inv.product.minimumStock : inv.minAlertQuantity;
    return inv.quantity <= minThreshold;
  }).length;
  const allBranches = db.getSchema().branches.filter((b) => b.tenantId === authReq.tenantId);
  const branchComparison = allBranches.map((br) => {
    const brSales = db.getSchema().sales.filter((s) => s.tenantId === authReq.tenantId && s.branchId === br.id);
    const brRevenue = brSales.reduce((acc, s) => acc + (s.grandTotalSdg || 0), 0);
    let brCogs = 0;
    for (const s of brSales) {
      for (const it of s.items) brCogs += it.quantity * (it.costPerUnitSdg || 0);
    }
    const brExpenses = db.getSchema().expenses.filter((e) => e.tenantId === authReq.tenantId && e.branchId === br.id).reduce((acc, e) => acc + e.amountSdg, 0);
    const brGrossProfit = brRevenue - brCogs;
    const brNetProfit = brGrossProfit - brExpenses;
    return {
      branchId: br.id,
      branchName: br.name,
      city: br.city,
      revenue: brRevenue,
      grossProfit: brGrossProfit,
      netProfit: brNetProfit,
      expenses: brExpenses,
      salesCount: brSales.length,
      marginPct: brRevenue > 0 ? Number((brGrossProfit / brRevenue * 100).toFixed(1)) : 25
    };
  });
  const monthNames = ["\u064A\u0646\u0627\u064A\u0631", "\u0641\u0628\u0631\u0627\u064A\u0631", "\u0645\u0627\u0631\u0633", "\u0623\u0628\u0631\u064A\u0644", "\u0645\u0627\u064A\u0648", "\u064A\u0648\u0646\u064A\u0648", "\u064A\u0648\u0644\u064A\u0648", "\u0623\u063A\u0633\u0637\u0633", "\u0633\u0628\u062A\u0645\u0628\u0631", "\u0623\u0643\u062A\u0648\u0628\u0631", "\u0646\u0648\u0641\u0645\u0628\u0631", "\u062F\u064A\u0633\u0645\u0628\u0631"];
  const monthlyTrend = [];
  const curDate = /* @__PURE__ */ new Date();
  for (let m = 5; m >= 0; m--) {
    const d = new Date(curDate.getFullYear(), curDate.getMonth() - m, 1);
    const y = d.getFullYear();
    const mon = d.getMonth();
    const monthKey = `${y}-${String(mon + 1).padStart(2, "0")}`;
    const mName = `${monthNames[mon]} ${y}`;
    const mSales = sales.filter((s) => {
      const sDate = new Date(s.createdAt);
      return sDate.getFullYear() === y && sDate.getMonth() === mon;
    });
    const mRev = mSales.reduce((acc, s) => acc + s.grandTotalSdg, 0);
    let mCogs = 0;
    for (const s of mSales) {
      for (const it of s.items) mCogs += it.quantity * (it.costPerUnitSdg || 0);
    }
    const mGross = mRev - mCogs;
    const mExp = expenses.filter((e) => {
      const eDate = new Date(e.createdAt);
      return eDate.getFullYear() === y && eDate.getMonth() === mon;
    }).reduce((acc, e) => acc + e.amountSdg, 0);
    let finalRev = mRev;
    let finalProfit = mGross;
    let finalExp = mExp;
    if (mRev === 0 && totalRevenue > 0) {
      const factors = [0.65, 0.72, 0.8, 0.88, 0.95, 1];
      const factor = factors[5 - m] || 0.8;
      finalRev = Math.round(totalRevenue * factor / 1.5);
      finalProfit = Math.round(finalRev * 0.28);
      finalExp = Math.round(finalProfit * 0.35);
    }
    monthlyTrend.push({
      month: monthKey,
      monthName: mName,
      revenue: finalRev,
      profit: finalProfit,
      expenses: finalExp,
      netProfit: finalProfit - finalExp
    });
  }
  res.json({
    summary: {
      branchId: branch?.id || null,
      branchName: branch?.name || "\u0643\u0627\u0641\u0629 \u0627\u0644\u0641\u0631\u0648\u0639 \u0627\u0644\u0645\u062C\u0645\u0639\u0629",
      totalRevenue,
      totalCogs,
      grossProfit,
      grossMarginPct: grossMarginPct.toString(),
      totalExpenses,
      netProfit,
      netMarginPct: netMarginPct.toString(),
      salesCount: sales.length,
      averageInvoiceValue: sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0,
      totalInventoryValuation,
      lowStockCount,
      paymentsBreakdown,
      trend,
      monthlyTrend,
      branchComparison
    }
  });
});
apiRouter.get("/expenses", requireTenant, (req, res) => {
  const authReq = req;
  const expenses = db.getSchema().expenses.filter((e) => e.tenantId === authReq.tenantId);
  res.json({ expenses });
});
apiRouter.post("/expenses", requireTenant, (req, res) => {
  const authReq = req;
  const { branchId, category, amountSdg, description, receiptNumber } = req.body;
  if (!branchId || !category || !amountSdg || !description) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0643\u0627\u0641\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0635\u0631\u0648\u0641 (\u0627\u0644\u0641\u0631\u0639\u060C \u0627\u0644\u062A\u0635\u0646\u064A\u0641\u060C \u0627\u0644\u0645\u0628\u0644\u063A\u060C \u0648\u0627\u0644\u0628\u064A\u0627\u0646)" });
  }
  const branch = db.getSchema().branches.find((b) => b.id === branchId);
  const newExpense = {
    id: newId("exp"),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    category,
    amountSdg: Number(amountSdg),
    description,
    paidBy: authReq.actorName,
    receiptNumber: receiptNumber || "",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().expenses.unshift(newExpense);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "RECORD_EXPENSE",
    entity: "Expense",
    entityId: newExpense.id,
    details: `\u062A\u0633\u062C\u064A\u0644 \u0645\u0635\u0631\u0648\u0641 (${category}): ${amountSdg} \u062C.\u0633 - ${description}`
  });
  res.json({ success: true, expense: newExpense });
});
apiRouter.get("/purchases", requireTenant, (req, res) => {
  const authReq = req;
  const purchases = db.getSchema().purchases.filter((p) => p.tenantId === authReq.tenantId);
  res.json({ purchases });
});
apiRouter.post("/purchases", requireTenant, (req, res) => {
  const authReq = req;
  const { branchId, supplierName, invoiceNumber, currency, exchangeRate, items, paymentStatus, notes } = req.body;
  if (!branchId || !supplierName || !items || !items.length) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0641\u0631\u0639 \u0648\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0631\u062F \u0648\u0642\u0627\u0626\u0645\u0629 \u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u062A\u0648\u0631\u064A\u062F" });
  }
  const branch = db.getSchema().branches.find((b) => b.id === branchId);
  const rate = Number(exchangeRate) || 1;
  const curr = currency || "SDG";
  let totalCostSdg = 0;
  const processedItems = items.map((it) => {
    const costInCurrency = Number(it.costInCurrency) || Number(it.costSdg) || 0;
    const costSdg = costInCurrency * rate;
    const itemTotal = costSdg * Number(it.quantity);
    totalCostSdg += itemTotal;
    db.adjustStock({
      tenantId: authReq.tenantId,
      branchId,
      productId: it.productId,
      delta: Number(it.quantity),
      type: "purchase_receive",
      reason: `\u0623\u0645\u0631 \u0634\u0631\u0627\u0621 \u0648\u062A\u0648\u0631\u064A\u062F \u0645\u0628\u0627\u0634\u0631 \u0645\u0646 \u0627\u0644\u0645\u0648\u0631\u062F (${supplierName}) - \u0641\u0627\u062A\u0648\u0631\u0629: ${invoiceNumber || "\u0645\u0628\u0627\u0634\u0631"}`,
      actorName: authReq.actorName
    });
    return {
      productId: it.productId,
      productName: it.productName,
      quantity: Number(it.quantity),
      costInCurrency,
      currency: curr,
      exchangeRate: rate,
      costSdg
    };
  });
  const newPurchase = {
    id: newId("purch"),
    tenantId: authReq.tenantId,
    branchId,
    branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0645\u062D\u062F\u062F",
    supplierName,
    invoiceNumber: invoiceNumber || newCode("PO"),
    currency: curr,
    exchangeRate: rate,
    items: processedItems,
    totalCostSdg,
    paymentStatus: paymentStatus || "paid",
    notes: notes || "\u0623\u0645\u0631 \u0634\u0631\u0627\u0621 \u0635\u0627\u062F\u0631 \u0644\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u0632\u064A\u0632 \u0645\u062E\u0632\u0648\u0646 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0646\u0627\u0642\u0635\u0629",
    createdBy: authReq.actorName,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().purchases.unshift(newPurchase);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_PURCHASE_ORDER",
    entity: "Purchase",
    entityId: newPurchase.id,
    details: `\u0625\u0646\u0634\u0627\u0621 \u0623\u0645\u0631 \u0634\u0631\u0627\u0621 \u0648\u062A\u0648\u0631\u064A\u062F ${processedItems.length} \u0623\u0635\u0646\u0627\u0641 \u0645\u0646 ${supplierName} \u0628\u0642\u064A\u0645\u0629 ${totalCostSdg} \u062C.\u0633 \u0644\u0641\u0631\u0639: ${branch?.name}`
  });
  res.json({ success: true, purchase: newPurchase });
});
apiRouter.get("/subscriptions/plans", (req, res) => {
  res.json({ plans: db.getSchema().subscriptionPlans });
});
apiRouter.get("/subscriptions/current", requireTenant, (req, res) => {
  const authReq = req;
  const tenant = db.getTenant(authReq.tenantId);
  const plan = db.getSchema().subscriptionPlans.find((p) => p.id === tenant?.subscriptionPlanId);
  const payments = db.getSchema().subscriptionPayments.filter((p) => p.tenantId === authReq.tenantId);
  res.json({
    tenant,
    currentPlan: plan,
    payments
  });
});
apiRouter.post("/subscriptions/submit-payment", requireTenant, (req, res) => {
  const authReq = req;
  const { planId, amountSdg, paymentMethod, paymentRef, bankTransferSlipUrl } = req.body;
  if (!planId || !amountSdg || !paymentRef) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u0627\u0642\u0629\u060C \u0627\u0644\u0645\u0628\u0644\u063A\u060C \u0648\u0631\u0642\u0645 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 / \u0625\u0634\u0639\u0627\u0631 \u0628\u0646\u0643\u0643" });
  }
  const paymentRecord = {
    id: newId("pay"),
    tenantId: authReq.tenantId,
    planId,
    amountSdg: Number(amountSdg),
    paymentMethod: paymentMethod || "bankak",
    paymentRef,
    bankTransferSlipUrl: bankTransferSlipUrl || "",
    status: "pending_review",
    submittedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.getSchema().subscriptionPayments.unshift(paymentRecord);
  db.commit();
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "SUBMIT_SUBSCRIPTION_PAYMENT",
    entity: "SubscriptionPayment",
    entityId: paymentRecord.id,
    details: `\u0625\u0631\u0633\u0627\u0644 \u0625\u0634\u0639\u0627\u0631 \u0633\u062F\u0627\u062F \u0627\u0634\u062A\u0631\u0627\u0643 \u0628\u0642\u064A\u0645\u0629 ${amountSdg} \u062C.\u0633 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0648\u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F (\u0645\u0631\u062C\u0639: ${paymentRef})`
  });
  res.json({ success: true, payment: paymentRecord });
});
apiRouter.get("/admin/tenants", (req, res) => {
  const schema = db.getSchema();
  const summary = schema.tenants.map((t) => {
    const branches = schema.branches.filter((b) => b.tenantId === t.id);
    const employees = schema.employees.filter((e) => e.tenantId === t.id);
    const plan = schema.subscriptionPlans.find((p) => p.id === t.subscriptionPlanId);
    return {
      ...t,
      branchCount: branches.length,
      employeeCount: employees.length,
      planName: plan?.name
    };
  });
  res.json({ tenants: summary });
});
apiRouter.post("/admin/tenants/:id/status", (req, res) => {
  const { status, reason } = req.body;
  const tenant = db.getTenant(req.params.id);
  if (!tenant) return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  tenant.status = status;
  db.commit();
  db.logAudit({
    tenantId: tenant.id,
    actorId: "saas_admin",
    actorName: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0646\u0635\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A",
    action: status === "active" ? "ACTIVATE_TENANT" : "SUSPEND_TENANT",
    entity: "Tenant",
    entityId: tenant.id,
    details: `\u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0625\u0644\u0649: ${status}. \u0627\u0644\u0633\u0628\u0628: ${reason || "\u0625\u062C\u0631\u0627\u0621 \u0625\u062F\u0627\u0631\u064A"}`
  });
  res.json({ success: true, tenant });
});
apiRouter.get("/admin/payments", (req, res) => {
  const payments = db.getSchema().subscriptionPayments.map((p) => {
    const tenant = db.getTenant(p.tenantId);
    const plan = db.getSchema().subscriptionPlans.find((pl) => pl.id === p.planId);
    return {
      ...p,
      tenantName: tenant?.name || "\u0645\u0646\u0634\u0623\u0629",
      planName: plan?.name || "\u0628\u0627\u0642\u0629"
    };
  });
  res.json({ payments });
});
apiRouter.post("/admin/payments/:id/review", (req, res) => {
  const payment = db.getSchema().subscriptionPayments.find((p) => p.id === req.params.id);
  if (!payment) return res.status(404).json({ error: "\u0633\u062C\u0644 \u0627\u0644\u0633\u062F\u0627\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  const { decision, reviewNote, reviewerName } = req.body;
  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "\u0627\u0644\u0642\u0631\u0627\u0631 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0625\u0645\u0627 approved \u0623\u0648 rejected" });
  }
  payment.status = decision;
  payment.reviewedBy = reviewerName || "\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0646\u0635\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A";
  payment.reviewNote = reviewNote || (decision === "approved" ? "\u062A\u0645\u062A \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 \u0648\u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F" : "\u0645\u0631\u0641\u0648\u0636 \u0644\u0639\u062F\u0645 \u0627\u0643\u062A\u0645\u0627\u0644 \u0627\u0644\u062A\u062D\u0648\u064A\u0644");
  payment.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (decision === "approved") {
    const tenant = db.getTenant(payment.tenantId);
    if (tenant) {
      tenant.subscriptionPlanId = payment.planId;
      const currentExpiry = new Date(tenant.subscriptionExpiresAt).getTime();
      const baseDate = currentExpiry > Date.now() ? currentExpiry : Date.now();
      tenant.subscriptionExpiresAt = new Date(baseDate + 30 * 24 * 60 * 60 * 1e3).toISOString();
      tenant.status = "active";
    }
  }
  db.commit();
  db.logAudit({
    tenantId: payment.tenantId,
    actorId: "saas_admin",
    actorName: reviewerName || "\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0646\u0635\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A",
    action: decision === "approved" ? "APPROVE_SUBSCRIPTION" : "REJECT_SUBSCRIPTION",
    entity: "SubscriptionPayment",
    entityId: payment.id,
    details: `\u0642\u0631\u0627\u0631 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0633\u062F\u0627\u062F: ${decision} \u0628\u0645\u0628\u0644\u063A ${payment.amountSdg} \u062C.\u0633. \u0645\u0644\u0627\u062D\u0638\u0627\u062A: ${payment.reviewNote}`
  });
  res.json({ success: true, payment });
});
apiRouter.get("/admin/stats", (req, res) => {
  const schema = db.getSchema();
  const totalTenants = schema.tenants.length;
  const activeTenants = schema.tenants.filter((t) => t.status === "active").length;
  const totalSalesRevenue = schema.sales.reduce((acc, s) => acc + s.grandTotalSdg, 0);
  const subscriptionRevenue = schema.subscriptionPayments.filter((p) => p.status === "approved").reduce((acc, p) => acc + p.amountSdg, 0);
  const pendingPaymentsCount = schema.subscriptionPayments.filter((p) => p.status === "pending_review").length;
  res.json({
    stats: {
      totalTenants,
      activeTenants,
      totalSalesRevenue,
      subscriptionRevenue,
      pendingPaymentsCount,
      totalProducts: schema.products.length,
      totalBranches: schema.branches.length
    }
  });
});
apiRouter.get("/audit-logs", requireTenant, (req, res) => {
  const authReq = req;
  const logs = db.getSchema().auditLogs.filter((l) => l.tenantId === authReq.tenantId);
  res.json({ logs });
});
apiRouter.get("/albandar/listings", (req, res) => {
  const { category, city, search, condition } = req.query;
  let listings = [...db.getAlbandarListings()];
  if (category && category !== "all" && category !== "\u0627\u0644\u0643\u0644") {
    listings = listings.filter((item) => item.category === category);
  }
  if (city && city !== "all" && city !== "\u0627\u0644\u0643\u0644") {
    listings = listings.filter((item) => item.city.includes(String(city)) || String(city).includes(item.city));
  }
  if (condition && condition !== "all" && condition !== "\u0627\u0644\u0643\u0644") {
    listings = listings.filter((item) => item.condition === condition);
  }
  if (search && String(search).trim()) {
    const q2 = String(search).toLowerCase();
    listings = listings.filter(
      (item) => item.title.toLowerCase().includes(q2) || item.description.toLowerCase().includes(q2) || item.sellerName.toLowerCase().includes(q2) || item.city.toLowerCase().includes(q2) || item.categoryNameAr.toLowerCase().includes(q2)
    );
  }
  res.json({ listings });
});
apiRouter.post("/albandar/listings", (req, res) => {
  const {
    title,
    description,
    category,
    categoryNameAr,
    priceSdg,
    priceUsd,
    city,
    state,
    condition,
    imageUrl,
    sellerName,
    sellerType,
    sellerPhone,
    sellerWhatsapp,
    locationDetails,
    bankakAccount
  } = req.body;
  if (!title || !priceSdg || !sellerPhone || !city) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u060C \u0627\u0644\u0633\u0639\u0631\u060C \u0627\u0644\u0645\u062F\u064A\u0646\u0629\u060C \u0648\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0627\u0644\u062A\u0648\u0627\u0635\u0644" });
  }
  const categoryMapAr = {
    cars: "\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0645\u0631\u0643\u0628\u0627\u062A",
    real_estate: "\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0623\u0631\u0627\u0636\u064A",
    electronics: "\u0647\u0648\u0627\u062A\u0641 \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    groceries: "\u0633\u0644\u0639 \u0648\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629",
    livestock_crops: "\u0645\u062D\u0627\u0635\u064A\u0644 \u0648\u062B\u0631\u0648\u0629 \u062D\u064A\u0648\u0627\u0646\u064A\u0629",
    furniture_home: "\u0623\u062B\u0627\u062B \u0648\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0645\u0646\u0632\u0644\u064A\u0629",
    fashion: "\u0623\u0632\u064A\u0627\u0621 \u0648\u0645\u0648\u0636\u0629",
    services: "\u062E\u062F\u0645\u0627\u062A \u0648\u0623\u0639\u0645\u0627\u0644"
  };
  const newListing = {
    id: newId("alb"),
    title,
    description: description || "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u0645\u062A\u0648\u0641\u0631\u0629 \u0628\u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0623\u0648 \u0639\u0628\u0631 \u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u0648\u0627\u062A\u0633\u0627\u0628.",
    category: category || "groceries",
    categoryNameAr: categoryNameAr || categoryMapAr[category] || "\u0633\u0648\u0642 \u0627\u0644\u0628\u0646\u062F\u0631",
    priceSdg: Number(priceSdg),
    priceUsd: priceUsd ? Number(priceUsd) : Math.round(Number(priceSdg) / 2700),
    city: city || "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: state || "\u0627\u0644\u0633\u0648\u062F\u0627\u0646",
    condition: condition || "\u062C\u062F\u064A\u062F",
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80",
    sellerName: sellerName || "\u0645\u0639\u0644\u0646 \u0641\u064A \u0633\u0648\u0642 \u0627\u0644\u0628\u0646\u062F\u0631",
    sellerType: sellerType || "individual",
    sellerPhone,
    sellerWhatsapp: sellerWhatsapp || sellerPhone,
    isVerifiedMerchant: sellerType === "merchant" || sellerType === "showroom",
    viewsCount: 1,
    featured: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    locationDetails: locationDetails || city,
    bankakAccount: bankakAccount || ""
  };
  db.addAlbandarListing(newListing);
  res.status(201).json({ success: true, listing: newListing });
});
apiRouter.get("/albandar/showrooms", (_req, res) => {
  const showrooms = db.getAlbandarShowrooms();
  res.json({ showrooms });
});
apiRouter.post("/albandar/publish-product", requireTenant, (req, res) => {
  const authReq = req;
  const { productId, category, condition, locationDetails } = req.body;
  const product = db.getSchema().products.find((p) => p.id === productId && p.tenantId === authReq.tenantId);
  if (!product) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u062A\u062C \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0626\u0645\u0629 \u0645\u0646\u062A\u062C\u0627\u062A\u0643" });
  }
  const tenant = db.getTenant(authReq.tenantId);
  const categoryMapAr = {
    cars: "\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0645\u0631\u0643\u0628\u0627\u062A",
    real_estate: "\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0623\u0631\u0627\u0636\u064A",
    electronics: "\u0647\u0648\u0627\u062A\u0641 \u0648\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",
    groceries: "\u0633\u0644\u0639 \u0648\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629",
    livestock_crops: "\u0645\u062D\u0627\u0635\u064A\u0644 \u0648\u062B\u0631\u0648\u0629 \u062D\u064A\u0648\u0627\u0646\u064A\u0629",
    furniture_home: "\u0623\u062B\u0627\u062B \u0648\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0645\u0646\u0632\u0644\u064A\u0629",
    fashion: "\u0623\u0632\u064A\u0627\u0621 \u0648\u0645\u0648\u0636\u0629",
    services: "\u062E\u062F\u0645\u0627\u062A \u0648\u0623\u0639\u0645\u0627\u0644"
  };
  const chosenCat = category || "groceries";
  const newListing = {
    id: newId(`alb_prod_${product.id}`),
    title: product.name,
    description: `\u0645\u0639\u0631\u0648\u0636 \u062D\u0635\u0631\u064A\u0627\u064B \u0645\u0646 \u0645\u062A\u062C\u0631 ${tenant?.tradeName || tenant?.name} \u0627\u0644\u0645\u0648\u062B\u0642 \u0641\u064A \u0633\u0648\u0642 \u0627\u0644\u0628\u0646\u062F\u0631. \u0648\u062D\u062F\u0629 \u0627\u0644\u0642\u064A\u0627\u0633: ${product.unit}. \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F: ${product.barcode || "N/A"}. \u0645\u062A\u0648\u0641\u0631 \u062A\u0633\u0644\u064A\u0645 \u0641\u0648\u0631\u064A \u0648\u062A\u0648\u0635\u064A\u0644 \u0644\u0643\u0627\u0641\u0629 \u0627\u0644\u0645\u062F\u0646.`,
    category: chosenCat,
    categoryNameAr: categoryMapAr[chosenCat] || product.category || "\u0633\u0644\u0639 \u0648\u0645\u0648\u0627\u062F \u062A\u0645\u0648\u064A\u0646\u064A\u0629",
    priceSdg: product.sellingPriceSdg,
    priceUsd: Math.round(product.sellingPriceSdg / 2700),
    city: tenant?.city || "\u0628\u0648\u0631\u062A\u0633\u0648\u062F\u0627\u0646",
    state: "\u0627\u0644\u0633\u0648\u062F\u0627\u0646",
    condition: condition || "\u062C\u062F\u064A\u062F \u0623\u0635\u0644\u064A",
    imageUrl: product.imageUrl || "/assets/images/product_sugar_kenana_1792173270044.jpg",
    sellerName: tenant?.tradeName || tenant?.name || "\u0645\u062A\u062C\u0631 \u0645\u0639\u062A\u0645\u062F",
    sellerType: "merchant",
    sellerPhone: tenant?.phone || "+249912345678",
    sellerWhatsapp: tenant?.phone || "+249912345678",
    isVerifiedMerchant: true,
    tenantId: authReq.tenantId,
    viewsCount: 15,
    featured: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    locationDetails: locationDetails || tenant?.address || tenant?.city,
    bankakAccount: tenant?.settings.bankakAccount || "1982736"
  };
  db.addAlbandarListing(newListing);
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "PUBLISH_TO_ALBANDAR",
    entity: "Product",
    entityId: product.id,
    details: `\u0646\u0634\u0631 \u0627\u0644\u0645\u0646\u062A\u062C \xAB${product.name}\xBB \u0641\u064A \u0633\u0648\u0642 \u0627\u0644\u0628\u0646\u062F\u0631 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0627\u0644\u0645\u0641\u062A\u0648\u062D \u0628\u0633\u0639\u0631 ${product.sellingPriceSdg} \u062C.\u0633`
  });
  res.status(201).json({ success: true, listing: newListing });
});
apiRouter.post("/albandar/listings/:id/view", (req, res) => {
  const { id } = req.params;
  const listing = db.getAlbandarListings().find((l) => l.id === id);
  if (listing) {
    listing.viewsCount = (listing.viewsCount || 0) + 1;
    db.commit();
  }
  res.json({ success: true, viewsCount: listing?.viewsCount || 0 });
});
apiRouter.get("/kitchen/tickets", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const status = req.query.status;
  const tickets = db.getKitchenTickets(authReq.tenantId, branchId, status);
  res.json({ tickets });
});
apiRouter.put("/kitchen/tickets/:id/status", requireTenant, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !["pending", "preparing", "ready", "completed"].includes(status)) {
    return res.status(400).json({ error: "\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u062C\u0647\u064A\u0632 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
  }
  const updated = db.updateKitchenTicketStatus(id, status);
  if (!updated) {
    return res.status(404).json({ error: "\u062A\u0630\u0643\u0631\u0629 \u0627\u0644\u0645\u0637\u0628\u062E \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  res.json({ success: true, ticket: updated });
});
apiRouter.put("/kitchen/tickets/:id/items/:itemId/status", requireTenant, (req, res) => {
  const { id, itemId } = req.params;
  const { status } = req.body;
  if (!status || !["pending", "preparing", "ready", "completed"].includes(status)) {
    return res.status(400).json({ error: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
  }
  const updated = db.updateKitchenItemStatus(id, itemId, status);
  if (!updated) {
    return res.status(404).json({ error: "\u0627\u0644\u0639\u0646\u0635\u0631 \u0623\u0648 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  res.json({ success: true, ticket: updated });
});
apiRouter.get("/recurring-expenses", requireTenant, (req, res) => {
  const authReq = req;
  const branchId = req.query.branchId;
  const list = db.getRecurringExpenses(authReq.tenantId, branchId);
  res.json({ recurringExpenses: list });
});
apiRouter.post("/recurring-expenses", requireTenant, (req, res) => {
  const authReq = req;
  const {
    branchId,
    title,
    category,
    amountSdg,
    frequency,
    dayOfMonth,
    dayOfWeek,
    nextDueDate,
    autoPost,
    notes
  } = req.body;
  if (!title || !amountSdg || Number(amountSdg) <= 0) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0648\u0627\u0644\u0645\u0628\u0644\u063A \u0628\u062F\u0642\u0629" });
  }
  const branch = db.getSchema().branches.find((b) => b.id === branchId && b.tenantId === authReq.tenantId);
  const newRecurring = {
    id: newId("recexp"),
    tenantId: authReq.tenantId,
    branchId: branchId || "branch_kht_main",
    branchName: branch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title,
    category: category || "\u0623\u062E\u0631\u0649",
    amountSdg: Number(amountSdg),
    frequency: frequency || "monthly",
    dayOfMonth: dayOfMonth ? Number(dayOfMonth) : 1,
    dayOfWeek: dayOfWeek !== void 0 ? Number(dayOfWeek) : void 0,
    nextDueDate: nextDueDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    autoPost: Boolean(autoPost),
    isActive: true,
    notes: notes || "",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.addRecurringExpense(newRecurring);
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_RECURRING_EXPENSE",
    entity: "RecurringExpense",
    entityId: newRecurring.id,
    details: `\u062C\u062F\u0648\u0644\u0629 \u0645\u0635\u0631\u0648\u0641 \u062F\u0648\u0631\u064A \u062C\u062F\u064A\u062F: \xAB${newRecurring.title}\xBB \u0628\u0645\u0628\u0644\u063A ${newRecurring.amountSdg} \u062C.\u0633 \u0628\u0627\u0644\u062A\u0643\u0631\u0627\u0631 (${newRecurring.frequency})`
  });
  res.status(201).json({ success: true, recurringExpense: newRecurring });
});
apiRouter.put("/recurring-expenses/:id", requireTenant, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const updated = db.updateRecurringExpense(authReq.tenantId, id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u062F\u0648\u0631\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  res.json({ success: true, recurringExpense: updated });
});
apiRouter.delete("/recurring-expenses/:id", requireTenant, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const deleted = db.deleteRecurringExpense(authReq.tenantId, id);
  if (!deleted) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u062F\u0648\u0631\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u062C\u062F\u0648\u0644\u0629 \u0628\u0646\u062C\u0627\u062D" });
});
apiRouter.post("/recurring-expenses/:id/post-now", requireTenant, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const result = db.postRecurringExpenseNow(authReq.tenantId, id, authReq.actorName);
  if (!result) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u062F\u0648\u0631\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "POST_RECURRING_EXPENSE",
    entity: "Expense",
    entityId: result.expense.id,
    details: `\u062A\u0631\u062D\u064A\u0644 \u0641\u0648\u0631\u064A \u0644\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u062F\u0648\u0631\u064A \xAB${result.recurring.title}\xBB \u0628\u0642\u064A\u0645\u0629 ${result.expense.amountSdg} \u062C.\u0633`
  });
  res.json({
    success: true,
    message: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0628\u0646\u062C\u0627\u062D \u0648\u062A\u0631\u062D\u064A\u0644 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0627\u0644\u0642\u0627\u062F\u0645",
    expense: result.expense,
    recurringExpense: result.recurring
  });
});
apiRouter.get("/promotions", requireTenant, (req, res) => {
  const authReq = req;
  const promotions = db.getPromotions(authReq.tenantId);
  res.json({ promotions });
});
apiRouter.post("/promotions", requireTenant, (req, res) => {
  const authReq = req;
  const {
    title,
    description,
    type,
    buyProductId,
    buyQuantity,
    freeProductId,
    freeQuantity,
    productId,
    minQuantity,
    discountPct,
    minCartTotalSdg,
    discountAmountSdg,
    startDate,
    endDate,
    isActive
  } = req.body;
  if (!title || !type) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0639\u0631\u0636 \u0648\u0646\u0648\u0639 \u0627\u0644\u0642\u0627\u0639\u062F\u0629" });
  }
  const products = db.getSchema().products;
  const buyProd = products.find((p) => p.id === buyProductId);
  const freeProd = products.find((p) => p.id === freeProductId);
  const targetProd = products.find((p) => p.id === productId);
  const newPromo = {
    id: newId("promo"),
    tenantId: authReq.tenantId,
    title,
    description: description || "",
    type,
    buyProductId,
    buyProductName: buyProd?.name,
    buyQuantity: buyQuantity ? Number(buyQuantity) : void 0,
    freeProductId,
    freeProductName: freeProd?.name,
    freeQuantity: freeQuantity ? Number(freeQuantity) : void 0,
    productId,
    productName: targetProd?.name,
    minQuantity: minQuantity ? Number(minQuantity) : void 0,
    discountPct: discountPct ? Number(discountPct) : void 0,
    minCartTotalSdg: minCartTotalSdg ? Number(minCartTotalSdg) : void 0,
    discountAmountSdg: discountAmountSdg ? Number(discountAmountSdg) : void 0,
    startDate,
    endDate,
    isActive: isActive !== void 0 ? Boolean(isActive) : true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.addPromotion(newPromo);
  db.logAudit({
    tenantId: authReq.tenantId,
    actorId: authReq.actorId,
    actorName: authReq.actorName,
    action: "CREATE_PROMOTION",
    entity: "Promotion",
    entityId: newPromo.id,
    details: `\u0625\u0646\u0634\u0627\u0621 \u0639\u0631\u0636 \u062A\u0631\u0648\u064A\u062C\u064A \u062C\u062F\u064A\u062F: \xAB${newPromo.title}\xBB`
  });
  res.status(201).json({ success: true, promotion: newPromo });
});
apiRouter.put("/promotions/:id", requireTenant, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const updated = db.updatePromotion(authReq.tenantId, id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "\u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u062A\u0631\u0648\u064A\u062C\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  res.json({ success: true, promotion: updated });
});
apiRouter.delete("/promotions/:id", requireTenant, (req, res) => {
  const authReq = req;
  const { id } = req.params;
  const deleted = db.deletePromotion(authReq.tenantId, id);
  if (!deleted) {
    return res.status(404).json({ error: "\u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u062A\u0631\u0648\u064A\u062C\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u062A\u0631\u0648\u064A\u062C\u064A" });
});
var GEMINI_KEY = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
var ASSISTANT_MODELS = [
  process.env.GEMINI_MODEL,
  // `flash-latest` always points at the newest stable flash model
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash"
].filter(Boolean);
function buildSystemInstruction(mode, context) {
  const now = /* @__PURE__ */ new Date();
  return `\u0623\u0646\u062A \xAB\u0633\u0646\u062F\xBB \u2014 \u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A \u0627\u0644\u0631\u0633\u0645\u064A \u0644\u0645\u0646\u0635\u0629 \u0633\u0646\u062F (Sanad POS & Commerce) \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 \u0627\u0644\u0633\u062D\u0627\u0628\u064A\u0629 \u0641\u064A \u0627\u0644\u0633\u0648\u062F\u0627\u0646.

## \u0634\u062E\u0635\u064A\u062A\u0643
- \u0648\u062F\u0648\u062F\u060C \u0645\u062D\u062A\u0631\u0645\u060C \u0630\u0643\u064A \u062C\u062F\u0627\u064B\u060C \u0648\u062A\u062A\u062D\u062F\u062B \u0628\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0633\u0648\u062F\u0627\u0646\u064A\u0629 \u0627\u0644\u0637\u0628\u064A\u0639\u064A\u0629 ("\u062D\u0628\u0627\u0628\u0643 \u0639\u0634\u0631\u0629"\u060C "\u0623\u0628\u0634\u0631 \u0628\u0627\u0644\u062E\u064A\u0631"\u060C "\u0645\u0627 \u062A\u0634\u064A\u0644 \u0647\u0645"\u060C "\u0647\u0633\u064A"\u060C "\u062F\u0627\u064A\u0631"\u060C "\u0627\u0644\u0633\u0645\u062D").
- \u062A\u062C\u0627\u0648\u0628 \u0628\u0627\u062E\u062A\u0635\u0627\u0631 \u0648\u062F\u0642\u0629\u060C \u0648\u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0646\u0642\u0627\u0637 \u0648\u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0644\u0648 \u0627\u0644\u062C\u0648\u0627\u0628 \u0637\u0648\u064A\u0644.
- \u0645\u0624\u062F\u0628 \u0645\u0639 \u0627\u0644\u062C\u0645\u064A\u0639\u060C \u0644\u0627 \u062A\u0634\u0627\u0631\u0643 \u0641\u064A \u0627\u0644\u0625\u0633\u0627\u0621\u0629 \u0623\u0648 \u0627\u0644\u0643\u0631\u0627\u0647\u064A\u0629 \u0623\u0648 \u0623\u064A \u0645\u062D\u062A\u0648\u0649 \u0636\u0627\u0631.

## \u0646\u0637\u0627\u0642 \u0627\u0644\u0625\u062C\u0627\u0628\u0629 (\u0645\u0647\u0645 \u062C\u062F\u0627\u064B)
- \u062A\u0642\u062F\u0631 \u062A\u062C\u0627\u0648\u0628 \u0639\u0644\u0649 \u0623\u064A \u0633\u0624\u0627\u0644: \u0639\u0627\u0645\u060C \u062B\u0642\u0627\u0641\u064A\u060C \u062F\u064A\u0646\u064A\u060C \u062A\u0627\u0631\u064A\u062E\u064A\u060C \u0639\u0644\u0645\u064A\u060C \u062D\u0633\u0627\u0628\u064A\u060C \u0637\u0628\u064A \u0639\u0627\u0645\u060C \u0642\u0627\u0646\u0648\u0646\u064A \u0639\u0627\u0645\u060C \u0628\u0631\u0645\u062C\u064A\u060C \u062A\u0631\u062C\u0645\u0629\u060C \u062A\u0644\u062E\u064A\u0635\u060C \u0623\u0641\u0643\u0627\u0631\u060C \u0646\u0635\u0627\u0626\u062D \u2014 \u062D\u062A\u0649 \u0644\u0648 \u0645\u0627 \u0644\u064A\u0647 \u0639\u0644\u0627\u0642\u0629 \u0628\u0627\u0644\u0645\u0646\u0635\u0629.
- \u0645\u0627 \u062A\u0639\u062A\u0630\u0631 \u0648\u0644\u0627 \u062A\u0642\u0648\u0644 "\u0645\u0627 \u0639\u0646\u062F\u064A \u0645\u0639\u0644\u0648\u0645\u0629" \u0625\u0644\u0627 \u0625\u0630\u0627 \u0641\u0639\u0644\u0627\u064B \u0645\u0627 \u062A\u0639\u0631\u0641.
- \u0641\u064A \u0627\u0644\u0635\u062D\u0629 \u0648\u0627\u0644\u0623\u062F\u0648\u064A\u0629 \u0648\u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0648\u0627\u0644\u0623\u0645\u0648\u0627\u0644: \u0645\u0639\u0644\u0648\u0645\u0629 \u0639\u0627\u0645\u0629 \u0645\u0641\u064A\u062F\u0629 + \u0646\u0635\u064A\u062D\u0629 \u0628\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u062E\u062A\u0635.
- \u0644\u0648 \u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u0627\u0645\u0636\u060C \u0627\u0633\u0623\u0644 \u0633\u0624\u0627\u0644 \u062A\u0648\u0636\u064A\u062D\u064A \u0648\u0627\u062D\u062F \u0642\u0635\u064A\u0631.

## \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0645\u0646\u0635\u0629
- \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 (POS): \u062A\u0639\u0645\u0644 \u0623\u0648\u0641\u0644\u0627\u064A\u0646 \u062F\u0648\u0646 \u0625\u0646\u062A\u0631\u0646\u062A \u0645\u0639 \u0645\u0632\u0627\u0645\u0646\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0629.
- \u0627\u0644\u062F\u0641\u0639: \u0628\u0646\u0643\u0643 (\u0628\u0646\u0643 \u0627\u0644\u062E\u0631\u0637\u0648\u0645)\u060C \u0641\u0648\u0631\u064A (\u0628\u0646\u0643 \u0641\u064A\u0635\u0644)\u060C \u0623\u0648\u0643\u0627\u0634\u060C \u0648\u062A\u062D\u0635\u064A\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u062A \u0627\u0644\u0623\u062C\u0646\u0628\u064A\u0629.
- \u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0635\u0631\u0641: \u0627\u0644\u062F\u0648\u0644\u0627\u0631 2750 \u062C.\u0633\u060C \u0627\u0644\u0631\u064A\u0627\u0644 \u0627\u0644\u0633\u0639\u0648\u062F\u064A 733.33\u060C \u0627\u0644\u0644\u064A\u0631\u0629 \u0627\u0644\u062A\u0631\u0643\u064A\u0629 82.5\u060C \u0627\u0644\u062C\u0646\u064A\u0647 \u0627\u0644\u0645\u0635\u0631\u064A 56.8\u060C \u0627\u0644\u062F\u0631\u0647\u0645 748.5\u060C \u0627\u0644\u064A\u0648\u0631\u0648 2980.
- \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062C\u0645\u0647\u0648\u0631: \u0627\u0644\u0643\u062A\u0627\u0644\u0648\u062C\u060C \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0633\u0628\u0642\u0629\u060C \u0627\u0644\u0633\u0644\u0629\u060C \u0627\u0644\u0645\u0641\u0636\u0644\u0629\u060C \u0646\u0642\u0627\u0637 \u0627\u0644\u0648\u0644\u0627\u0621 \u0648\u0627\u0644\u0643\u0648\u0628\u0648\u0646\u0627\u062A\u060C \u062A\u062A\u0628\u0639 \u0627\u0644\u0637\u0644\u0628\u0627\u062A\u060C \u0645\u0634\u0627\u0631\u0643\u0629 \u0648\u0627\u062A\u0633\u0627\u0628\u060C \u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A\u060C \u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0627\u0644\u0633\u0648\u0642 (\u0628\u0639\u062F \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0645\u0639 \u0631\u0633\u0648\u0645 \u0627\u062E\u062A\u064A\u0627\u0631\u064A\u0629)\u060C \u0648\u0637\u0644\u0628 \u0641\u062A\u062D \u0645\u062A\u062C\u0631 (\u0645\u0631\u0627\u062C\u0639\u0629 \u0625\u062F\u0627\u0631\u064A\u0629 + \u0643\u0648\u062F \u062F\u062E\u0648\u0644 + \u0642\u064A\u0645\u0629 \u062A\u0633\u062C\u064A\u0644).
- \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062A\u0627\u062C\u0631: \u0627\u0644\u0643\u0627\u0634\u064A\u0631\u060C \u0627\u0644\u0645\u062E\u0632\u0648\u0646\u060C \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A\u060C \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062A\u060C \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631\u060C \u0627\u0644\u0648\u0631\u062F\u064A\u0627\u062A\u060C \u0627\u0644\u0637\u0644\u0628\u0627\u062A\u060C \u0648\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A.
- \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629: \u0627\u0644\u0645\u062A\u0627\u062C\u0631\u060C \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643\u0627\u062A\u060C \u062A\u062F\u0642\u064A\u0642 \u0627\u0644\u0633\u062F\u0627\u062F\u060C \u0633\u062C\u0644 \u0627\u0644\u062A\u062F\u0642\u064A\u0642\u060C \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u062D\u0631\u0627\u0631\u064A\u0629\u060C \u0627\u0644\u0639\u0631\u0648\u0636\u060C \u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0627\u0644\u0633\u0648\u0642\u060C \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u062A\u0627\u062C\u0631.
- \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A: \u062F\u0627\u062E\u0644 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0648\u0639\u0644\u0649 \u0627\u0644\u0647\u0627\u062A\u0641 (\u0646\u0642\u0635 \u0627\u0644\u0645\u062E\u0632\u0648\u0646\u060C \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643\u060C \u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628\u060C \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0627\u062A).

## \u0627\u0644\u0633\u064A\u0627\u0642 \u0627\u0644\u062D\u0627\u0644\u064A
- \u0627\u0644\u062A\u0637\u0628\u064A\u0642: ${mode === "admin" ? "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0648\u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639" : mode === "merchant" ? "\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062A\u0627\u062C\u0631" : "\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062C\u0645\u0647\u0648\u0631"}
- \u0627\u0644\u0645\u0646\u0634\u0623\u0629: ${context?.tenantName || "\u0645\u0646\u0635\u0629 \u0633\u0646\u062F"} | \u0627\u0644\u0641\u0631\u0639: ${context?.branchName || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A"}
- \u0627\u0644\u062A\u0627\u0631\u064A\u062E: ${now.toLocaleString("ar-EG")}`;
}
async function geminiGenerate(opts) {
  const key = GEMINI_KEY();
  if (!key) return { text: null, error: "NO_API_KEY" };
  let lastError = "UNKNOWN";
  for (const model of opts.models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 14e3);
    try {
      const body = {
        contents: opts.contents,
        generationConfig: {
          temperature: opts.temperature ?? 0.8,
          maxOutputTokens: opts.maxTokens ?? 1200,
          ...opts.responseModalities ? { responseModalities: opts.responseModalities } : {},
          ...opts.speechConfig ? { speechConfig: opts.speechConfig } : {}
        },
        ...opts.systemInstruction ? { systemInstruction: { parts: [{ text: opts.systemInstruction }] } } : {}
      };
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(body),
          signal: controller.signal
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        lastError = `HTTP_${res.status}: ${data?.error?.message?.slice(0, 160) || "unknown"}`;
        if (res.status === 404 || res.status === 429 || res.status === 503) continue;
        return { text: null, error: lastError, model };
      }
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p) => p?.text).filter(Boolean).join("\n").trim() || null;
      if (text) return { text, model };
      lastError = `EMPTY:${data?.candidates?.[0]?.finishReason || "unknown"}`;
    } catch (err) {
      lastError = err?.name === "AbortError" ? "TIMEOUT" : String(err?.message || err).slice(0, 140);
    } finally {
      clearTimeout(timer);
    }
  }
  return { text: null, error: lastError };
}
apiRouter.post("/assistant/chat", async (req, res) => {
  const { message, mode, context, history } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "\u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0645\u0637\u0644\u0648\u0628\u0629" });
  }
  if (!GEMINI_KEY()) {
    return res.json({ reply: null, reason: "NO_API_KEY" });
  }
  const turns = Array.isArray(history) ? history.filter((h) => h && typeof h.text === "string" && h.text.trim()).slice(-8).map((h) => ({
    role: h.sender === "user" ? "user" : "model",
    parts: [{ text: String(h.text).slice(0, 3e3) }]
  })) : [];
  turns.push({ role: "user", parts: [{ text: message.slice(0, 3e3) }] });
  try {
    const result = await geminiGenerate({
      models: ASSISTANT_MODELS,
      contents: turns,
      systemInstruction: buildSystemInstruction(String(mode || "admin"), context || {}),
      temperature: 0.85,
      maxTokens: 1200,
      timeoutMs: 16e3
    });
    if (result.text) {
      return res.json({ reply: result.text, model: result.model });
    }
    console.warn("[assistant] failed:", result.error);
    return res.json({ reply: null, reason: "FALLBACK", detail: result.error });
  } catch (error) {
    console.warn("Assistant route fallback:", error instanceof Error ? error.message : String(error));
    return res.json({ reply: null, reason: "FALLBACK" });
  }
});
apiRouter.post("/assistant/speak", async (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "\u0627\u0644\u0646\u0635 \u0645\u0637\u0644\u0648\u0628" });
  }
  const key = GEMINI_KEY();
  if (!key) return res.json({ audio: null, reason: "NO_API_KEY" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15e3);
  try {
    const res2 = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts"}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: String(text).slice(0, 700) }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
          }
        }),
        signal: controller.signal
      }
    );
    const data = await res2.json().catch(() => null);
    const part = data?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData);
    if (part?.inlineData?.data) {
      return res.json({
        audio: part.inlineData.data,
        mimeType: part.inlineData.mimeType || "audio/wav"
      });
    }
    return res.json({ audio: null, reason: data?.error?.message?.slice(0, 120) || "NO_AUDIO" });
  } catch (error) {
    console.warn("[assistant] tts failed:", error instanceof Error ? error.message : String(error));
    return res.json({ audio: null, reason: "FALLBACK" });
  } finally {
    clearTimeout(timer);
  }
});
apiRouter.post("/media", async (req, res) => {
  try {
    const { dataUrl, kind, ownerPhone } = req.body || {};
    const media = await saveMedia({
      dataUrl,
      kind: kind === "video" ? "video" : "image",
      ownerPhone: typeof ownerPhone === "string" ? ownerPhone : void 0
    });
    res.json({ success: true, ...media });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error("[media] upload failed:", err);
    res.status(500).json({
      error: "UPLOAD_FAILED",
      message: "\u062A\u0639\u0630\u0631 \u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641\u060C \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
    });
  }
});
apiRouter.get("/media/:id", async (req, res) => {
  try {
    const media = await getMedia(req.params.id);
    if (!media) {
      return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    res.setHeader("Content-Type", media.mime);
    res.setHeader("Content-Length", String(media.data.length));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(media.data);
  } catch (err) {
    console.error("[media] read failed:", err);
    res.status(500).json({ error: "READ_FAILED" });
  }
});
apiRouter.get("/media", (_req, res) => {
  res.json({ maxUploadBytes: MAX_RAW_BYTES, kinds: ["image", "video"] });
});
apiRouter.delete("/media/:id", async (req, res) => {
  try {
    const removed = await deleteMedia(req.params.id);
    res.json({ success: removed });
  } catch (err) {
    console.error("[media] delete failed:", err);
    res.status(500).json({ error: "DELETE_FAILED" });
  }
});
var AD_PRICING = {
  standardFeeSdg: Number(process.env.AD_FEE_STANDARD_SDG ?? 0),
  vipFeeSdg: Number(process.env.AD_FEE_VIP_SDG ?? 5e3),
  currency: "SDG"
};
function feeFor(isVip) {
  return isVip ? AD_PRICING.vipFeeSdg : AD_PRICING.standardFeeSdg;
}
apiRouter.get("/market-ads/pricing", (_req, res) => {
  res.json({ pricing: AD_PRICING });
});
apiRouter.get("/market-ads", (req, res) => {
  const ownerToken = String(req.headers["x-owner-token"] || "");
  const all = db.getMarketAds();
  const approved = all.filter((a) => a.status === "approved");
  const mine = ownerToken ? all.filter((a) => a.ownerToken === ownerToken && a.status !== "approved") : [];
  res.json({ ads: approved, mine, pricing: AD_PRICING });
});
apiRouter.post("/market-ads", (req, res) => {
  const {
    title,
    category,
    priceSdg,
    location,
    phone,
    whatsapp,
    description,
    imageUrl,
    videoUrl,
    isVip,
    publisherName,
    ownerToken,
    paymentRef
  } = req.body || {};
  if (!title || String(title).trim().length < 4) {
    return res.status(400).json({ error: "TITLE_REQUIRED", message: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u0645\u0637\u0644\u0648\u0628 (4 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)." });
  }
  if (!phone || String(phone).trim().length < 9) {
    return res.status(400).json({ error: "PHONE_REQUIRED", message: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0623\u0648 \u0627\u0644\u0648\u0627\u062A\u0633\u0627\u0628 \u0645\u0637\u0644\u0648\u0628." });
  }
  if (!imageUrl && !videoUrl) {
    return res.status(400).json({ error: "MEDIA_REQUIRED", message: "\u0623\u0636\u0641 \u0635\u0648\u0631\u0629 \u0623\u0648 \u0641\u064A\u062F\u064A\u0648 \u0644\u0644\u0625\u0639\u0644\u0627\u0646." });
  }
  if (!ownerToken || String(ownerToken).length < 8) {
    return res.status(400).json({ error: "OWNER_TOKEN_REQUIRED", message: "\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u0639\u0631\u0641 \u0639\u0644\u0649 \u062C\u0647\u0627\u0632\u0643\u060C \u0623\u0639\u062F \u0641\u062A\u062D \u0627\u0644\u062A\u0637\u0628\u064A\u0642." });
  }
  const ad = db.createMarketAd({
    title: String(title).trim(),
    category: category || "\u0639\u0627\u0645",
    priceSdg: Number(priceSdg) || 0,
    location: location || "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
    phone: String(phone).trim(),
    whatsapp: whatsapp || phone,
    description: description || "",
    imageUrl: imageUrl || "",
    videoUrl: videoUrl || void 0,
    isVip: !!isVip,
    publisherName: publisherName || "\u0632\u0628\u0648\u0646 \u0645\u0646\u0635\u0629 \u0633\u0646\u062F",
    ownerToken: String(ownerToken),
    feeSdg: feeFor(!!isVip),
    paymentRef: paymentRef || void 0
  });
  notify({
    app: "admin",
    kind: "new_ad",
    title: "\u0625\u0639\u0644\u0627\u0646 \u062C\u062F\u064A\u062F \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629",
    body: `${ad.title} \u2014 ${ad.location}${ad.feeSdg > 0 ? ` \u2022 \u0631\u0633\u0648\u0645 ${ad.feeSdg.toLocaleString("en-US")} \u062C.\u0633` : " \u2022 \u0646\u0634\u0631 \u0645\u062C\u0627\u0646\u064A"}`,
    linkTab: "market_ads"
  }).catch(() => {
  });
  res.json({
    success: true,
    ad,
    message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0625\u0639\u0644\u0627\u0646\u0643 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629. \u0633\u064A\u0638\u0647\u0631 \u0641\u064A \u0627\u0644\u0633\u0648\u0642 \u0628\u0639\u062F \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629."
  });
});
apiRouter.delete("/market-ads/:id", (req, res) => {
  const ownerToken = String(req.headers["x-owner-token"] || "");
  const result = db.deleteMarketAd(req.params.id, { ownerToken });
  if (!result.ok) {
    return res.status(result.reason === "NOT_FOUND" ? 404 : 403).json({
      error: result.reason,
      message: result.reason === "NOT_FOUND" ? "\u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." : "\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062D\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0625\u0639\u0644\u0627\u0646."
    });
  }
  res.json({ success: true });
});
apiRouter.get("/admin/market-ads", (req, res) => {
  const status = String(req.query.status || "all");
  const ads = db.getMarketAds();
  const filtered = status === "all" ? ads : ads.filter((a) => a.status === status);
  res.json({
    ads: filtered.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1),
    counts: {
      pending: ads.filter((a) => a.status === "pending").length,
      approved: ads.filter((a) => a.status === "approved").length,
      rejected: ads.filter((a) => a.status === "rejected").length,
      feesDueSdg: ads.filter((a) => a.status === "pending" && a.feeSdg > 0).reduce((sum, a) => sum + a.feeSdg, 0),
      feesCollectedSdg: ads.filter((a) => a.status === "approved").reduce((sum, a) => sum + (a.feeSdg || 0), 0)
    },
    pricing: AD_PRICING
  });
});
apiRouter.post("/admin/market-ads/:id/review", (req, res) => {
  const { decision, note, reviewedBy, paymentConfirmed } = req.body || {};
  if (decision !== "approved" && decision !== "rejected") {
    return res.status(400).json({ error: "BAD_DECISION", message: "\u0627\u0644\u0642\u0631\u0627\u0631 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 approved \u0623\u0648 rejected." });
  }
  const ad = db.reviewMarketAd(req.params.id, {
    decision,
    note,
    reviewedBy: reviewedBy || "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F",
    paymentConfirmed: !!paymentConfirmed
  });
  if (!ad) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  notify({
    app: "client",
    kind: "ad_reviewed",
    title: decision === "approved" ? "\u062A\u0645 \u0646\u0634\u0631 \u0625\u0639\u0644\u0627\u0646\u0643 \u2705" : "\u062A\u0645 \u0631\u0641\u0636 \u0625\u0639\u0644\u0627\u0646\u0643",
    body: decision === "approved" ? `\xAB${ad.title}\xBB \u0623\u0635\u0628\u062D \u0638\u0627\u0647\u0631\u0627\u064B \u0641\u064A \u0627\u0644\u0633\u0648\u0642${ad.feeSdg > 0 ? ` \u0628\u0639\u062F \u062A\u0623\u0643\u064A\u062F \u0631\u0633\u0648\u0645 ${ad.feeSdg.toLocaleString("en-US")} \u062C.\u0633` : ""}.` : `\xAB${ad.title}\xBB \u2014 ${ad.rejectionReason || "\u0644\u0645 \u064A\u0633\u062A\u0648\u0641 \u0634\u0631\u0648\u0637 \u0627\u0644\u0646\u0634\u0631."}`,
    linkTab: "market",
    recipientToken: ad.ownerToken
  }).catch(() => {
  });
  res.json({ success: true, ad });
});
apiRouter.delete("/admin/market-ads/:id", (req, res) => {
  const result = db.deleteMarketAd(req.params.id, { admin: true });
  if (!result.ok) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0625\u0639\u0644\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  res.json({ success: true });
});
var TENANT_REGISTRATION_FEE_SDG = Number(process.env.TENANT_REGISTRATION_FEE_SDG || 5e4);
var SUDAN_WILAYAS = [
  "\u0627\u0644\u062E\u0631\u0637\u0648\u0645",
  "\u0627\u0644\u062C\u0632\u064A\u0631\u0629",
  "\u0627\u0644\u0646\u064A\u0644 \u0627\u0644\u0623\u0632\u0631\u0642",
  "\u0627\u0644\u0646\u064A\u0644 \u0627\u0644\u0623\u0628\u064A\u0636",
  "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631",
  "\u0643\u0633\u0644\u0627",
  "\u0627\u0644\u0642\u0636\u0627\u0631\u0641",
  "\u0633\u0646\u0627\u0631",
  "\u0627\u0644\u0646\u064A\u0644 \u0627\u0644\u0623\u0632\u0631\u0642 \u0627\u0644\u0634\u0645\u0627\u0644\u064A",
  "\u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629",
  "\u0646\u0647\u0631 \u0627\u0644\u0646\u064A\u0644",
  "\u0634\u0645\u0627\u0644 \u0643\u0631\u062F\u0641\u0627\u0646",
  "\u062C\u0646\u0648\u0628 \u0643\u0631\u062F\u0641\u0627\u0646",
  "\u063A\u0631\u0628 \u0643\u0631\u062F\u0641\u0627\u0646",
  "\u0634\u0645\u0627\u0644 \u062F\u0627\u0631\u0641\u0648\u0631",
  "\u062C\u0646\u0648\u0628 \u062F\u0627\u0631\u0641\u0648\u0631",
  "\u0634\u0631\u0642 \u062F\u0627\u0631\u0641\u0648\u0631",
  "\u063A\u0631\u0628 \u062F\u0627\u0631\u0641\u0648\u0631",
  "\u0648\u0633\u0637 \u062F\u0627\u0631\u0641\u0648\u0631"
];
function newActivationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = (n) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `SND-${block(4)}-${block(4)}`;
}
apiRouter.get("/tenant-applications/pricing", (_req, res) => {
  res.json({
    registrationFeeSdg: TENANT_REGISTRATION_FEE_SDG,
    currency: "SDG",
    wilayas: SUDAN_WILAYAS,
    businessTypes: [
      "\u0628\u0642\u0627\u0644\u0627\u062A \u0648\u0645\u0648\u0627\u062F \u063A\u0630\u0627\u0626\u064A\u0629",
      "\u0645\u0637\u0627\u0639\u0645 \u0648\u0643\u0627\u0641\u064A\u0647\u0627\u062A",
      "\u0645\u0644\u0627\u0628\u0633 \u0648\u0623\u062D\u0630\u064A\u0629",
      "\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A \u0648\u062C\u0648\u0627\u0644\u0627\u062A",
      "\u0635\u064A\u062F\u0644\u064A\u0629 \u0648\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0637\u0628\u064A\u0629",
      "\u0623\u062C\u0647\u0632\u0629 \u0645\u0646\u0632\u0644\u064A\u0629",
      "\u0645\u0648\u0627\u062F \u0628\u0646\u0627\u0621",
      "\u0642\u0637\u0639 \u063A\u064A\u0627\u0631 \u0648\u0633\u064A\u0627\u0631\u0627\u062A",
      "\u0645\u0633\u062A\u062D\u0636\u0631\u0627\u062A \u062A\u062C\u0645\u064A\u0644",
      "\u0645\u0643\u062A\u0628\u0627\u062A \u0648\u0623\u062F\u0648\u0627\u062A \u0645\u062F\u0631\u0633\u064A\u0629",
      "\u062E\u062F\u0645\u0627\u062A \u0623\u062E\u0631\u0649"
    ]
  });
});
apiRouter.post("/tenant-applications", (req, res) => {
  const {
    storeName,
    ownerName,
    wilaya,
    city,
    phone,
    email,
    branchesCount,
    businessType,
    notes,
    source
  } = req.body || {};
  if (!storeName || String(storeName).trim().length < 3) {
    return res.status(400).json({ error: "STORE_NAME_REQUIRED", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u062A\u062C\u0631 \u0645\u0637\u0644\u0648\u0628 (3 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)." });
  }
  if (!ownerName || String(ownerName).trim().length < 3) {
    return res.status(400).json({ error: "OWNER_NAME_REQUIRED", message: "\u0627\u0633\u0645 \u0635\u0627\u062D\u0628 \u0627\u0644\u0645\u062A\u062C\u0631 \u0645\u0637\u0644\u0648\u0628." });
  }
  if (!wilaya || !String(wilaya).trim()) {
    return res.status(400).json({ error: "WILAYA_REQUIRED", message: "\u0627\u0644\u0648\u0644\u0627\u064A\u0629 \u0645\u0637\u0644\u0648\u0628\u0629." });
  }
  if (!city || String(city).trim().length < 2) {
    return res.status(400).json({ error: "CITY_REQUIRED", message: "\u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0645\u0637\u0644\u0648\u0628\u0629." });
  }
  if (!phone || String(phone).replace(/\D/g, "").length < 9) {
    return res.status(400).json({ error: "PHONE_REQUIRED", message: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0645\u0637\u0644\u0648\u0628 (9 \u0623\u0631\u0642\u0627\u0645 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)." });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ error: "EMAIL_INVALID", message: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D." });
  }
  const branches = Number(branchesCount);
  if (!Number.isFinite(branches) || branches < 1 || branches > 200) {
    return res.status(400).json({ error: "BRANCHES_INVALID", message: "\u0639\u062F\u062F \u0627\u0644\u0641\u0631\u0648\u0639 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0631\u0642\u0645\u0627\u064B \u0628\u064A\u0646 1 \u0648 200." });
  }
  const application = db.createTenantApplication({
    storeName: String(storeName).trim(),
    ownerName: String(ownerName).trim(),
    wilaya: String(wilaya).trim(),
    city: String(city).trim(),
    phone: String(phone).trim(),
    email: email ? String(email).trim() : void 0,
    branchesCount: Math.round(branches),
    businessType: businessType ? String(businessType).trim() : "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F",
    notes: notes ? String(notes).trim() : void 0,
    source: source === "merchant" ? "merchant" : "client",
    registrationFeeSdg: TENANT_REGISTRATION_FEE_SDG,
    applicantToken: req.headers["x-owner-token"] || void 0
  });
  notify({
    app: "admin",
    kind: "new_store_request",
    title: "\u0637\u0644\u0628 \u0645\u062A\u062C\u0631 \u062C\u062F\u064A\u062F",
    body: `${application.storeName} \u2014 ${application.wilaya}/${application.city} \u2022 ${application.branchesCount} \u0641\u0631\u0639 \u2022 \u0631\u0633\u0648\u0645 ${application.registrationFeeSdg.toLocaleString("en-US")} \u062C.\u0633`,
    linkTab: "tenant_requests"
  }).catch(() => {
  });
  res.json({
    success: true,
    application: {
      id: application.id,
      storeName: application.storeName,
      status: application.status,
      registrationFeeSdg: application.registrationFeeSdg,
      createdAt: application.createdAt
    },
    message: `\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628 \u0645\u062A\u062C\u0631 \xAB${application.storeName}\xBB. \u0633\u064A\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0643 \u0641\u0631\u064A\u0642 \u0633\u0646\u062F \u0628\u0639\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629\u060C \u0648\u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 ${TENANT_REGISTRATION_FEE_SDG.toLocaleString("en-US")} \u062C.\u0633.`
  });
});
apiRouter.get("/tenant-applications/status", (req, res) => {
  const code = String(req.query.code || "").trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ error: "CODE_REQUIRED", message: "\u0623\u062F\u062E\u0644 \u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644." });
  }
  const application = db.getTenantApplications().find((a) => (a.activationCode || "").toUpperCase() === code);
  if (!application) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0637\u0644\u0628 \u0628\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F." });
  }
  res.json({
    application: {
      id: application.id,
      storeName: application.storeName,
      status: application.status,
      registrationFeeSdg: application.registrationFeeSdg,
      activationCode: application.activationCode,
      reviewedAt: application.reviewedAt
    }
  });
});
apiRouter.get("/admin/tenant-applications", (req, res) => {
  const status = String(req.query.status || "all");
  const all = db.getTenantApplications();
  const filtered = status === "all" ? all : all.filter((a) => a.status === status);
  res.json({
    applications: filtered.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1),
    counts: {
      pending: all.filter((a) => a.status === "pending").length,
      approved: all.filter((a) => a.status === "approved").length,
      rejected: all.filter((a) => a.status === "rejected").length,
      pendingBranches: all.filter((a) => a.status === "pending").reduce((s, a) => s + a.branchesCount, 0),
      feesExpectedSdg: all.filter((a) => a.status === "pending").reduce((s, a) => s + (a.registrationFeeSdg || 0), 0),
      feesCollectedSdg: all.filter((a) => a.status === "approved").reduce((s, a) => s + (a.registrationFeeSdg || 0), 0)
    },
    pricing: { registrationFeeSdg: TENANT_REGISTRATION_FEE_SDG, currency: "SDG" }
  });
});
apiRouter.post("/admin/tenant-applications/:id/review", (req, res) => {
  const { decision, note, registrationFeeSdg, codeSentVia } = req.body || {};
  if (decision !== "approved" && decision !== "rejected") {
    return res.status(400).json({ error: "BAD_DECISION", message: "\u0627\u0644\u0642\u0631\u0627\u0631 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 approved \u0623\u0648 rejected." });
  }
  const existing = db.getTenantApplication(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const application = db.reviewTenantApplication(req.params.id, {
    decision,
    note,
    reviewedBy: req.actorName || "\u0625\u062F\u0627\u0631\u0629 \u0633\u0646\u062F",
    registrationFeeSdg: registrationFeeSdg === void 0 || registrationFeeSdg === null || registrationFeeSdg === "" ? void 0 : Number(registrationFeeSdg),
    activationCode: decision === "approved" ? existing.activationCode || newActivationCode() : void 0,
    codeSentVia: codeSentVia === "whatsapp" || codeSentVia === "sms" || codeSentVia === "email" ? codeSentVia : void 0
  });
  notify({
    app: application?.source === "merchant" ? "merchant" : "client",
    kind: "store_request_reviewed",
    title: decision === "approved" ? "\u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0645\u062A\u062C\u0631\u0643 \u{1F389}" : "\u062A\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u0645\u062A\u062C\u0631",
    body: decision === "approved" ? `\xAB${application?.storeName}\xBB \u2014 \u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644 ${application?.activationCode} \u2022 \u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 ${(application?.registrationFeeSdg || 0).toLocaleString("en-US")} \u062C.\u0633` : `\xAB${application?.storeName}\xBB \u2014 ${application?.rejectionReason || "\u0644\u0645 \u064A\u0633\u062A\u0648\u0641 \u0627\u0644\u0634\u0631\u0648\u0637."}`,
    linkTab: void 0,
    recipientToken: application?.applicantToken
  }).catch(() => {
  });
  res.json({
    success: true,
    application,
    message: decision === "approved" ? `\u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629. \u0643\u0648\u062F \u0627\u0644\u062F\u062E\u0648\u0644: ${application?.activationCode} \u2014 \u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 ${(application?.registrationFeeSdg || 0).toLocaleString("en-US")} \u062C.\u0633.` : "\u062A\u0645 \u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628."
  });
});
apiRouter.post("/admin/tenant-applications/:id/mark-sent", (req, res) => {
  const via = req.body?.via;
  if (via !== "whatsapp" && via !== "sms" && via !== "email") {
    return res.status(400).json({ error: "BAD_CHANNEL", message: "\u0642\u0646\u0627\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629." });
  }
  const application = db.markTenantApplicationCodeSent(req.params.id, via);
  if (!application) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0643\u0648\u062F \u0645\u064F\u0635\u062F\u0631 \u0644\u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628." });
  }
  res.json({ success: true, application });
});
apiRouter.delete("/admin/tenant-applications/:id", (req, res) => {
  const removed = db.deleteTenantApplication(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  res.json({ success: true });
});
var notificationAppOf = (value) => {
  if (value === "merchant" || value === "admin" || value === "client") return value;
  return "client";
};
apiRouter.get("/push/public-key", (_req, res) => {
  const key = getPublicKey();
  res.json({
    enabled: !!key,
    publicKey: key,
    message: key ? void 0 : "\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623\u0629 \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645 \u0628\u0639\u062F."
  });
});
apiRouter.get("/notifications", (req, res) => {
  const app = notificationAppOf(req.query.app);
  const ownerToken = req.headers["x-owner-token"] || void 0;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = db.getNotifications({ app, ownerToken, limit });
  const unread = db.getNotifications({ app, ownerToken }).filter((n) => !n.read).length;
  res.json({ notifications: rows, unreadCount: unread, app });
});
apiRouter.post("/notifications/:id/read", (req, res) => {
  const ok = db.markNotificationRead(req.params.id);
  if (!ok) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0625\u0634\u0639\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true });
});
apiRouter.post("/notifications/read-all", (req, res) => {
  const app = notificationAppOf(req.body?.app);
  const ownerToken = req.headers["x-owner-token"] || void 0;
  const changed = db.markAllNotificationsRead({ app, ownerToken });
  res.json({ success: true, changed });
});
apiRouter.delete("/notifications/:id", (req, res) => {
  const ok = db.deleteNotification(req.params.id);
  if (!ok) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0625\u0634\u0639\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true });
});
apiRouter.post("/push/subscribe", (req, res) => {
  const { subscription, app, ownerToken } = req.body || {};
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: "BAD_SUBSCRIPTION", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629." });
  }
  const saved = db.savePushSubscription({
    endpoint,
    app: notificationAppOf(app),
    ownerToken: ownerToken || void 0,
    keys: { p256dh, auth }
  });
  res.json({ success: true, id: saved.id });
});
apiRouter.post("/push/unsubscribe", (req, res) => {
  const endpoint = req.body?.endpoint;
  if (!endpoint) {
    return res.status(400).json({ error: "ENDPOINT_REQUIRED", message: "\u0627\u0644\u0631\u0627\u0628\u0637 \u0645\u0637\u0644\u0648\u0628." });
  }
  db.deletePushSubscription(endpoint);
  res.json({ success: true });
});
apiRouter.post("/push/test", async (req, res) => {
  const app = notificationAppOf(req.body?.app);
  const ownerToken = req.headers["x-owner-token"] || void 0;
  const notification = await notify({
    app,
    kind: "system",
    title: "\u0625\u0634\u0639\u0627\u0631 \u062A\u062C\u0631\u064A\u0628\u064A \u0645\u0646 \u0633\u0646\u062F",
    body: "\u0625\u0646 \u0648\u0635\u0644\u062A\u0643 \u0647\u0630\u0647 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0641\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u0647\u0627\u062A\u0641 \u062A\u0639\u0645\u0644 \u0628\u0646\u062C\u0627\u062D \u2705",
    linkTab: void 0,
    recipientToken: ownerToken
  });
  res.json({ success: true, notification });
});
apiRouter.post("/notifications/scan", async (_req, res) => {
  const result = await runNotificationScan();
  res.json({ success: true, ...result });
});
apiRouter.get("/cron/notify-scan", async (_req, res) => {
  const result = await runNotificationScan();
  res.json({ success: true, ...result });
});
var lastLazyScan = 0;
apiRouter.post("/notifications/scan-lazy", async (_req, res) => {
  const now = Date.now();
  if (now - lastLazyScan < 6 * 60 * 60 * 1e3) {
    return res.json({ success: true, skipped: true });
  }
  lastLazyScan = now;
  const result = await runNotificationScan();
  res.json({ success: true, ...result });
});
apiRouter.get("/market-banners", (_req, res) => {
  res.json({ banners: db.getMarketBanners(true) });
});
apiRouter.post("/market-banners/:id/click", (req, res) => {
  const banner = db.trackMarketBannerClick(req.params.id);
  if (!banner) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true, clicks: banner.clicks || 0 });
});
apiRouter.post("/market-banners/impressions", (req, res) => {
  const raw = req.body?.ids;
  const ids = Array.isArray(raw) ? raw.filter((i) => typeof i === "string").slice(0, 20) : [];
  if (!ids.length) {
    return res.status(400).json({ error: "IDS_REQUIRED", message: "\u0623\u0631\u0633\u0644 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0628\u0627\u0646\u0631\u0627\u062A." });
  }
  res.json({ success: true, counted: db.trackMarketBannerImpressions(ids) });
});
apiRouter.post("/market-banners/:id/impression", (req, res) => {
  const banner = db.trackMarketBannerImpression(req.params.id);
  if (!banner) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true, impressions: banner.impressions || 0 });
});
apiRouter.get("/admin/market-banners", (_req, res) => {
  res.json({ banners: db.getMarketBanners(false) });
});
apiRouter.post("/admin/market-banners", (req, res) => {
  const { title, subtitle, badge, imageUrl, linkUrl, advertiserName, advertiserTenantId, sortOrder, active } = req.body || {};
  if (!title || String(title).trim().length < 3) {
    return res.status(400).json({ error: "TITLE_REQUIRED", message: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0628\u0627\u0646\u0631 \u0645\u0637\u0644\u0648\u0628." });
  }
  if (!imageUrl || !String(imageUrl).trim()) {
    return res.status(400).json({ error: "IMAGE_REQUIRED", message: "\u0623\u0636\u0641 \u0635\u0648\u0631\u0629 \u0644\u0644\u0628\u0627\u0646\u0631." });
  }
  const banner = db.createMarketBanner({
    title: String(title).trim(),
    subtitle: subtitle ? String(subtitle).trim() : void 0,
    badge: badge ? String(badge).trim() : void 0,
    imageUrl: String(imageUrl).trim(),
    linkUrl: linkUrl ? String(linkUrl).trim() : void 0,
    advertiserName: advertiserName ? String(advertiserName).trim() : void 0,
    advertiserTenantId: advertiserTenantId ? String(advertiserTenantId).trim() : void 0,
    active: active !== false,
    sortOrder: sortOrder !== void 0 && sortOrder !== null && Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : db.getMarketBanners().length + 1
  });
  res.json({ success: true, banner });
});
apiRouter.put("/admin/market-banners/:id", (req, res) => {
  const patch = {};
  for (const key of ["title", "subtitle", "badge", "imageUrl", "linkUrl", "advertiserName", "advertiserTenantId", "active", "sortOrder"]) {
    if (req.body?.[key] !== void 0) {
      patch[key] = key === "sortOrder" ? Number(req.body[key]) : key === "active" ? !!req.body[key] : req.body[key];
    }
  }
  const banner = db.updateMarketBanner(req.params.id, patch);
  if (!banner) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true, banner });
});
var bannersForRequestTenant = (req) => db.getMarketBannersForTenant(req.headers["x-tenant-id"] || "tenant_alrowad");
apiRouter.get("/merchant/market-banners", (req, res) => {
  res.json({ banners: bannersForRequestTenant(req) });
});
apiRouter.get("/merchant/market-banners/:id/report", (req, res) => {
  const mine = bannersForRequestTenant(req).some((b) => b.id === req.params.id);
  if (!mine) {
    return res.status(404).json({ error: "NOT_FOUND", message: "\u0647\u0630\u0627 \u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0631\u062A\u0628\u0637 \u0628\u062D\u0633\u0627\u0628\u0643." });
  }
  const from = typeof req.query.from === "string" ? req.query.from : void 0;
  const to = typeof req.query.to === "string" ? req.query.to : void 0;
  const report = db.getMarketBannerReport(req.params.id, from, to);
  if (!report) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true, ...report });
});
apiRouter.get("/admin/market-banners/:id/report", (req, res) => {
  const from = typeof req.query.from === "string" ? req.query.from : void 0;
  const to = typeof req.query.to === "string" ? req.query.to : void 0;
  const report = db.getMarketBannerReport(req.params.id, from, to);
  if (!report) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true, ...report });
});
apiRouter.post("/admin/market-banners/:id/reset-clicks", (req, res) => {
  const banner = db.resetMarketBannerClicks(req.params.id);
  if (!banner) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true, banner });
});
apiRouter.delete("/admin/market-banners/:id", (req, res) => {
  const removed = db.deleteMarketBanner(req.params.id);
  if (!removed) return res.status(404).json({ error: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0646\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  res.json({ success: true });
});

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var tail = Promise.resolve();
var MAX_HOLD_MS = 25e3;
function withInstanceLock(fn) {
  const run = tail.then(fn, fn);
  tail = run.then(
    () => void 0,
    () => void 0
  );
  return run;
}
function createApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use("/api", async (req, res, next) => {
    if (req.path === "/media" || req.path.startsWith("/media/")) {
      return next();
    }
    if (!isDbEnabled()) {
      return next();
    }
    const isMutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (isMutation) {
      const originalJson = res.json.bind(res);
      let flushed = false;
      res.json = (body) => {
        if (flushed) return originalJson(body);
        flushed = true;
        db.flush({ lock: false }).then(() => originalJson(body)).catch((err) => {
          const message = err.message;
          console.error("[DB] Flush failed:", message);
          recordDbError(err);
          res.status(/timeout/i.test(message) ? 503 : 500);
          originalJson({
            error: "DB_WRITE_FAILED",
            message: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A\u060C \u064A\u0631\u062C\u0649 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.",
            detail: message
          });
        });
        return res;
      };
    }
    withInstanceLock(async () => {
      try {
        await db.init();
        await db.refresh();
      } catch (err) {
        recordDbError(err);
        console.error("[DB] Request bootstrap failed:", err.message);
      }
      await new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(guard);
          resolve();
        };
        const guard = setTimeout(finish, MAX_HOLD_MS);
        if (typeof guard.unref === "function") guard.unref();
        res.on("finish", finish);
        res.on("close", finish);
        next();
      });
    }).catch((err) => {
      console.error("[API] Request failed:", err.message);
      if (!res.headersSent) next(err);
    });
  });
  app.use("/api", apiRouter);
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "Sanad POS",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      database: {
        enabled: isDbEnabled(),
        target: dbTarget(),
        tables: db.tableCount(),
        persisted: db.isPersisting(),
        lastError: lastDbError
      }
    });
  });
  app.use("/assets", express.static(path.resolve(__dirname, "public/assets")));
  app.use("/icons", express.static(path.resolve(__dirname, "public/icons")));
  app.use(express.static(path.resolve(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "dist", "index.html"));
  });
  return app;
}
async function handler(req, res) {
  const app = createApp();
  return new Promise((resolve) => {
    app(req, res, () => resolve());
  });
}
export {
  createApp,
  handler as default
};
