/**
 * POS write guard.
 *
 * The in-memory snapshot + diff-flush architecture is safe inside one process
 * (server.ts serialises requests), but NOT across serverless instances: two
 * lambdas can read the same stock / sale, both mutate, and the second flush
 * overwrites the first.
 *
 * We serialise the critical read-modify-write with a short-lived lease row in
 * Postgres (unique per tenant). A lease works on Neon's transaction pooler,
 * releases on crash via expiry, and — unlike a session advisory lock — cannot
 * be silently re-entered by the same pooled session.
 */
import { randomUUID } from 'node:crypto';
import { db } from './db.ts';
import { query } from './pg.ts';
import { resolveActorPerms, type ActorPerms } from '../lib/staffPermissions.ts';
import { round2 } from '../lib/invoiceMath.ts';

const LEASE_MS = 30_000;
const WAIT_MS = 20_000;

async function ensureLockTable(): Promise<void> {
  await query(`CREATE TABLE IF NOT EXISTS sanad_pos_locks (
    tenant_id text PRIMARY KEY,
    token text NOT NULL,
    expires_at timestamptz NOT NULL
  )`);
}

/**
 * Run `fn` while holding the tenant's POS write lease. `fn` must refresh the
 * snapshot, mutate, commit and flush BEFORE returning; the lease is released
 * only after the data is durable.
 */
export async function withTenantPosLock<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  await ensureLockTable();
  const token = randomUUID();
  const deadline = Date.now() + WAIT_MS;
  let delay = 25;

  for (;;) {
    const { rows } = await query(
      `INSERT INTO sanad_pos_locks AS l (tenant_id, token, expires_at)
       VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval)
       ON CONFLICT (tenant_id) DO UPDATE
         SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at
         WHERE l.expires_at < now()
       RETURNING token`,
      [tenantId, token, String(LEASE_MS)]
    );
    if (rows[0]?.token === token) break;
    if (Date.now() > deadline) {
      throw new Error('POS_LOCK_TIMEOUT: another write is still in progress for this store');
    }
    await new Promise((r) => setTimeout(r, delay + Math.random() * delay));
    delay = Math.min(delay * 2, 400);
  }

  try {
    return await fn();
  } finally {
    await query('DELETE FROM sanad_pos_locks WHERE tenant_id = $1 AND token = $2', [tenantId, token]).catch(() => {});
  }
}

/** Next sequential invoice number for a tenant/year: INV-YYYY-NNNNNN. */
export async function nextSalesInvoiceNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const max = (db.getSchema().sales || [])
    .filter((s) => s.tenantId === tenantId)
    .reduce((n, s) => {
      const m = String(s.invoiceNumber || '').match(/^INV-\d{4}-(\d+)$/);
      return m ? Math.max(n, Number(m[1])) : n;
    }, 0);
  const next = await db.nextDocumentSequence(`sales:${tenantId}:${year}`, max + 1);
  return `${prefix}${String(next).padStart(6, '0')}`;
}

/** Next sequential credit-note number: CN-YYYY-NNNNNN. */
export async function nextCreditNoteNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CN-${year}-`;
  const max = (db.getSchema().returns || [])
    .filter((r) => r.tenantId === tenantId)
    .reduce((n, r) => {
      const m = String(r.creditNoteNumber || '').match(/^CN-\d{4}-(\d+)$/);
      return m ? Math.max(n, Number(m[1])) : n;
    }, 0);
  const next = await db.nextDocumentSequence(`credit-notes:${tenantId}:${year}`, max + 1);
  return `${prefix}${String(next).padStart(6, '0')}`;
}

/** Resolve the acting employee's permissions from the session, never the body. */
export function actorPerms(req: { tenantId: string; actorId: string; actorRole?: string }): ActorPerms {
  const employee = (db.getSchema().employees || []).find(
    (e) => e.id === req.actorId && e.tenantId === req.tenantId
  );
  return resolveActorPerms(req.actorRole || 'cashier', employee || null);
}

/** Resolve a safe percentage for the server-side discount policy. */
export function maxAllowedDiscountPct(value: unknown): number {
  const parsed = Number(value ?? 100);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
}

/** Use the stricter of the store-wide cap and the authenticated employee cap. */
export function maxDiscountPctForActor(
  tenantLimit: unknown,
  req: { tenantId: string; actorId: string; actorRole?: string },
): number {
  const storeCap = maxAllowedDiscountPct(tenantLimit);
  const employee = (db.getSchema().employees || []).find(
    (e) => e.id === req.actorId && e.tenantId === req.tenantId,
  );
  if (!employee) return storeCap;
  return Math.min(storeCap, maxAllowedDiscountPct(employee.maxDiscountPct ?? storeCap));
}

export interface DiscountPolicyLine {
  productName?: string;
  quantity: number;
  unitPriceSdg: number;
  discountSdg?: number;
  invoiceDiscountShareSdg?: number;
}

/**
 * Check the effective discount on every line after invoice-level discount has
 * been proportionally allocated. Returns the first violating product name.
 */
export function discountPolicyViolation(
  lines: DiscountPolicyLine[],
  maxDiscountPct: number,
  canOverride: boolean,
): string | null {
  if (canOverride) return null;
  for (const line of lines) {
    const gross = round2(Number(line.quantity) * Number(line.unitPriceSdg));
    if (!Number.isFinite(gross) || gross <= 0) continue;
    const totalDiscount = round2(Number(line.discountSdg ?? 0) + Number(line.invoiceDiscountShareSdg ?? 0));
    if ((totalDiscount / gross) * 100 > maxDiscountPct + 0.005) {
      return line.productName || 'الصنف';
    }
  }
  return null;
}

/** Does this product participate in inventory? Services opt out explicitly. */
export function tracksStock(product: { trackInventory?: boolean } | undefined): boolean {
  return product?.trackInventory !== false;
}
