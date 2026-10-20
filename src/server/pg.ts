/**
 * Postgres connection layer for Sanad.
 *
 * Production: Neon Postgres over the `pg` driver (works with any Postgres,
 * including Neon's pooled endpoint and self-hosted instances).
 *
 * The driver is deliberately thin: everything goes through `query()` so tests
 * can inject a PGlite (WASM Postgres) client and exercise the exact same code.
 */
import pg from 'pg';

type QueryResult = { rows: any[]; rowCount: number | null };

/** Minimal client contract — satisfied by pg.Pool, pg.Client and PGlite. */
export interface SqlClient {
  query(text: string, params?: any[]): Promise<QueryResult>;
}

let pool: pg.Pool | null = null;
let injected: SqlClient | null = null;

/** Last connection/query failure, surfaced by /api/health for operations. */
export let lastDbError: string | null = null;

export function recordDbError(err: unknown): void {
  lastDbError = err instanceof Error ? err.message : String(err);
}

export function clearDbError(): void {
  lastDbError = null;
}

/** Redacted connection info — never exposes the password. */
export function dbTarget(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return 'unset';
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname} pooler=${u.hostname.includes('-pooler')} sslmode=${u.searchParams.get('sslmode') || 'none'}`;
  } catch {
    return 'unparseable';
  }
}

/** True when a real database is configured. */
export function isDbEnabled(): boolean {
  return injected !== null || !!process.env.DATABASE_URL;
}

export function getPool(): pg.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  if (!pool) {
    const isNeon = /neon\.tech/.test(process.env.DATABASE_URL);
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      // Neon and most managed Postgres providers require TLS.
      ssl: isNeon ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PG_POOL_MAX || 3),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err.message);
    });
  }

  return pool;
}

/** Inject an alternative client (used by the test harness / PGlite). */
export function setSqlClient(client: SqlClient | null): void {
  injected = client;
}

function activeClient(): SqlClient {
  if (injected) return injected;
  return getPool() as unknown as SqlClient;
}

export async function query(text: string, params?: any[]): Promise<QueryResult> {
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

/**
 * Run a set of statements inside a single transaction.
 * Anything thrown rolls the whole batch back.
 */
export async function transaction<T>(fn: (client: SqlClient) => Promise<T>): Promise<T> {
  const client = activeClient();

  // PGlite exposes transaction(); pg pools need a dedicated connection.
  const anyClient = client as any;
  if (typeof anyClient.transaction === 'function') {
    return anyClient.transaction(async (tx: SqlClient) => fn(tx));
  }

  await client.query('BEGIN');
  try {
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection already gone */
    }
    throw err;
  }
}

const LOCK_KEY = 982_451_301; // arbitrary but stable across deployments

/**
 * Serialise writes across every serverless instance.
 * Without this, two lambdas could each write a stale snapshot and silently
 * lose one another's changes.
 */
export async function acquireWriteLock(): Promise<() => Promise<void>> {
  if (injected) {
    // Single-process test client: no cross-instance contention to guard against.
    return async () => {};
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
  } catch (err) {
    client.release();
    throw err;
  }

  let released = false;
  return async () => {
    if (released) return;
    released = true;
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    } catch (err) {
      console.warn('[DB] Failed to release advisory lock:', (err as Error).message);
    } finally {
      client.release();
    }
  };
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
