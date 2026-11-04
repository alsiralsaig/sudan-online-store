/**
 * ضمانات ذرّية لنقاط البيع: البيع، الإرجاع، وترقيم التوريد.
 *
 * ليه ملف مستقل؟
 * اللقطة الحالية تحفظ البيانات كصورة في الذاكرة ثم تكتب الفروق في Postgres.
 * هذا ممتاز للعرض، لكنه لا يمنع نسختين من قراءة نفس الرصيد قبل أن تكتب أيٌّ منهما.
 * لذلك العمليات المالية الحساسة تُنفَّذ هنا داخل معاملة واحدة في Postgres:
 *   - خصم المخزون بشرط عدم السالب (UPDATE ... WHERE quantity + delta >= 0)
 *   - حجز معرّف العملية مرة واحدة (INSERT ... ON CONFLICT DO NOTHING)
 *   - كميات الإرجاع تُحجز في جدول مستقل يمنع تجاوز المباع
 *   - رقم فاتورة التوريد يُحجز مرة واحدة لكل طلب
 *
 * بعد نجاح المعاملة نُحدّث صورة الذاكرة و«نُعلّم الصف كمحفوظ» حتى لا يكتبه
 * الحفظ العام بقيمة قديمة فوق القيمة الذرّية.
 */
import { query, transaction, isDbEnabled, type SqlClient } from './pg.ts';
import { writeRow, type TableDef } from './repository.ts';
import type { Sale, StockMovement, ReturnRecord } from '../types/index.ts';

export interface AtomicContext {
  data: any;
  tableDefFor(collection: string): TableDef | undefined;
  markRowPersisted(collection: string, id: string): void;
}

export interface StockDelta {
  productId: string;
  delta: number;
}

export interface SaleCommitResult {
  ok: boolean;
  code?: 'DUPLICATE' | 'INSUFFICIENT_STOCK';
  productId?: string;
  available?: number;
}

export interface RefundCommitResult {
  ok: boolean;
  refundedAmountSdg?: number;
  code?: 'DUPLICATE' | 'ALREADY_REFUNDED' | 'QTY_EXCEEDED';
  productId?: string;
  remaining?: number;
}

/* ------------------------------------------------------------------ */
/*  جداول الحجز (خارج صورة الذاكرة فلا يمسّها الحفظ العام)              */
/* ------------------------------------------------------------------ */

let guardsReady: Promise<void> | null = null;

export function ensurePosGuards(): Promise<void> {
  if (!isDbEnabled()) return Promise.resolve();
  if (!guardsReady) {
    guardsReady = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS sanad_pos_operations (key text PRIMARY KEY, createdat text NOT NULL)`);
      await query(`CREATE TABLE IF NOT EXISTS sanad_pos_returned (saleid text NOT NULL, productid text NOT NULL, quantity double precision NOT NULL, PRIMARY KEY (saleid, productid))`);
      await query(`CREATE TABLE IF NOT EXISTS sanad_supply_invoice_numbers (orderid text PRIMARY KEY, number text NOT NULL, issuedat text NOT NULL)`);
    })().catch((err) => { guardsReady = null; throw err; });
  }
  return guardsReady;
}

/* بدائل في الذاكرة عند عدم وجود قاعدة بيانات (تطوير/اختبار بلا Postgres) */
const memOps = new Set<string>();
const memReturned = new Map<string, number>();
const memSupplyNumbers = new Map<string, { number: string; issuedAt: string }>();

export async function claimPosOperation(key: string): Promise<boolean> {
  if (!isDbEnabled()) {
    if (memOps.has(key)) return false;
    memOps.add(key);
    return true;
  }
  await ensurePosGuards();
  const { rows } = await query(
    `INSERT INTO sanad_pos_operations (key, createdat) VALUES ($1, $2)
     ON CONFLICT (key) DO NOTHING RETURNING key`,
    [key, new Date().toISOString()],
  );
  return rows.length > 0;
}

export async function releasePosOperation(key: string): Promise<void> {
  if (!isDbEnabled()) { memOps.delete(key); return; }
  await ensurePosGuards();
  await query(`DELETE FROM sanad_pos_operations WHERE key = $1`, [key]);
}

/** يزيد الكمية المرتجعة ذرّياً ويرفض تجاوز الكمية المباعة. */
async function reserveReturnedQty(
  client: SqlClient,
  saleId: string,
  productId: string,
  delta: number,
  sold: number,
): Promise<{ ok: boolean; total: number }> {
  const { rows } = await client.query(
    `INSERT INTO sanad_pos_returned (saleid, productid, quantity)
     SELECT $1::text, $2::text, $3::double precision WHERE $3::double precision <= $4::double precision
     ON CONFLICT (saleid, productid)
     DO UPDATE SET quantity = sanad_pos_returned.quantity + EXCLUDED.quantity
     WHERE sanad_pos_returned.quantity + EXCLUDED.quantity <= $4::double precision
     RETURNING quantity`,
    [saleId, productId, delta, sold],
  );
  if (rows.length > 0) return { ok: true, total: Number(rows[0].quantity) };
  const cur = await client.query(
    `SELECT quantity FROM sanad_pos_returned WHERE saleid = $1 AND productid = $2`,
    [saleId, productId],
  );
  const already = Number(cur.rows[0]?.quantity || 0);
  return { ok: false, total: Math.max(0, sold - already) };
}

/** يُدخل المرتجعات القديمة (قبل هذا الإصلاح) في دفتر الحجز مرة واحدة. */
export async function seedLegacyReturns(saleId: string, items: Array<{ productId: string; quantity: number }>): Promise<void> {
  if (!isDbEnabled() || items.length === 0) return;
  const first = await claimPosOperation(`returned-seed:${saleId}`);
  if (!first) return;
  await ensurePosGuards();
  for (const it of items) {
    await query(
      `INSERT INTO sanad_pos_returned (saleid, productid, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (saleid, productid) DO UPDATE SET quantity = sanad_pos_returned.quantity + EXCLUDED.quantity`,
      [saleId, it.productId, Number(it.quantity) || 0],
    );
  }
}

/* ------------------------------------------------------------------ */
/*  دوال مساعدة مشتركة                                                 */
/* ------------------------------------------------------------------ */

function invIdFor(tenantId: string, branchId: string, productId: string): string {
  return `inv_${tenantId}_${branchId}_${productId}`.replace(/[^\w-]/g, '_');
}

function nowIso(): string { return new Date().toISOString(); }

function pushMovement(ctx: AtomicContext, m: StockMovement): void {
  if (!Array.isArray(ctx.data.stockMovements)) ctx.data.stockMovements = [];
  ctx.data.stockMovements.unshift(m);
}

function buildMovement(
  ctx: AtomicContext,
  tenantId: string, branchId: string, productId: string, productName: string,
  delta: number, balanceAfter: number, type: StockMovement['type'], reason: string,
  actorName: string, referenceId?: string,
): StockMovement {
  const product = (ctx.data.products || []).find((p: any) => p.id === productId);
  const cost = Number(product?.purchaseCost) || 0;
  return {
    id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId, branchId, productId, productName,
    type, quantityDelta: delta, balanceAfter,
    costPerUnitSdg: cost,
    totalValueSdg: Math.abs(delta) * cost,
    reason, actorName, referenceId,
    timestamp: nowIso(),
  };
}

/** يقرأ قيمة حقل قد يكون عموداً أو داخل __extra. */
function readField(row: any, field: string): any {
  if (!row) return undefined;
  if (row[field] !== undefined && row[field] !== null) return row[field];
  const extra = row.__extra;
  if (extra && typeof extra === 'object' && extra[field] !== undefined) return extra[field];
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  البيع                                                              */
/* ------------------------------------------------------------------ */

export async function commitSaleAtomic(ctx: AtomicContext, params: {
  sale: Sale;
  deltas: StockDelta[];
  allowNegative: boolean;
  operationKey: string;
  actorName: string;
  reason: string;
}): Promise<SaleCommitResult> {
  const { sale, deltas, allowNegative, operationKey, actorName, reason } = params;

  if (!isDbEnabled()) {
    /* لا قاعدة بيانات: العملية كلها في نسخة واحدة، فيكفي فحص صريح قبل الخصم. */
    if (!await claimPosOperation(operationKey)) return { ok: false, code: 'DUPLICATE' };
    const needed = new Map<string, number>();
    for (const d of deltas) needed.set(d.productId, (needed.get(d.productId) || 0) + d.delta);
    if (!allowNegative) {
      for (const [productId, delta] of needed) {
        const inv = (ctx.data.branchInventories || []).find(
          (i: any) => i.tenantId === sale.tenantId && i.branchId === sale.branchId && i.productId === productId,
        );
        const available = inv ? Number(inv.quantity) || 0 : 0;
        if (available + delta < 0) {
          await releasePosOperation(operationKey);
          return { ok: false, code: 'INSUFFICIENT_STOCK', productId, available };
        }
      }
    }
    for (const [productId, delta] of needed) applyMemoryDelta(ctx, sale, productId, delta, 'sale_deduction', reason, actorName);
    ctx.data.sales.unshift(sale);
    return { ok: true };
  }

  await ensurePosGuards();
  const invDef = ctx.tableDefFor('branchInventories');
  const salesDef = ctx.tableDefFor('sales');
  const movDef = ctx.tableDefFor('stockMovements');
  if (!invDef || !salesDef) throw new Error('POS schema is not ready');

  const needed = new Map<string, number>();
  for (const d of deltas) needed.set(d.productId, (needed.get(d.productId) || 0) + d.delta);
  const movements: StockMovement[] = [];
  const balances = new Map<string, { id: string; quantity: number }>();

  try {
    await transaction(async (client) => {
      const claim = await client.query(
        `INSERT INTO sanad_pos_operations (key, createdat) VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING RETURNING key`,
        [operationKey, nowIso()],
      );
      if (claim.rows.length === 0) throw Object.assign(new Error('duplicate'), { posCode: 'DUPLICATE' });

      for (const [productId, delta] of needed) {
        const found = await client.query(
          `SELECT id, quantity FROM "sanad_branch_inventories"
           WHERE "tenantId" = $1 AND "branchId" = $2 AND "productId" = $3 LIMIT 1`,
          [sale.tenantId, sale.branchId, productId],
        );
        let invId: string;
        if (found.rows.length > 0) {
          invId = String(found.rows[0].id);
        } else {
          invId = invIdFor(sale.tenantId, sale.branchId, productId);
          const product = (ctx.data.products || []).find((p: any) => p.id === productId);
          await client.query(
            `INSERT INTO "sanad_branch_inventories"
               (id, "tenantId", "branchId", "productId", quantity, "minAlertQuantity", "lastUpdated")
             VALUES ($1, $2, $3, $4, 0, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            [invId, sale.tenantId, sale.branchId, productId, Number(product?.minStockAlert) || 5, nowIso()],
          );
        }

        const upd = await client.query(
          `UPDATE "sanad_branch_inventories"
           SET quantity = quantity + $1, "lastUpdated" = $2
           WHERE id = $3 AND ($4::boolean OR quantity + $1 >= 0)
           RETURNING quantity`,
          [delta, nowIso(), invId, allowNegative],
        );
        if (upd.rows.length === 0) {
          const cur = await client.query(`SELECT quantity FROM "sanad_branch_inventories" WHERE id = $1`, [invId]);
          throw Object.assign(new Error('insufficient'), {
            posCode: 'INSUFFICIENT_STOCK', productId, available: Number(cur.rows[0]?.quantity || 0),
          });
        }
        const quantity = Number(upd.rows[0].quantity);
        balances.set(productId, { id: invId, quantity });
        const product = (ctx.data.products || []).find((p: any) => p.id === productId);
        movements.push(buildMovement(
          ctx, sale.tenantId, sale.branchId, productId, product?.name || productId,
          delta, quantity, 'sale_deduction', reason, actorName, sale.id,
        ));
      }

      await writeRow(client, salesDef, sale as any);
      if (movDef) for (const m of movements) await writeRow(client, movDef, m as any);
    });
  } catch (err: any) {
    if (err?.posCode === 'DUPLICATE') return { ok: false, code: 'DUPLICATE' };
    if (err?.posCode === 'INSUFFICIENT_STOCK') {
      return { ok: false, code: 'INSUFFICIENT_STOCK', productId: err.productId, available: err.available };
    }
    throw err;
  }

  /* المعاملة نجحت: نزامن الذاكرة ونمنع الحفظ العام من الكتابة فوقها. */
  for (const [productId, info] of balances) {
    let inv = (ctx.data.branchInventories || []).find((i: any) => i.id === info.id);
    if (!inv) {
      inv = (ctx.data.branchInventories || []).find(
        (i: any) => i.tenantId === sale.tenantId && i.branchId === sale.branchId && i.productId === productId,
      );
    }
    if (inv) {
      inv.quantity = info.quantity;
      inv.lastUpdated = nowIso();
      ctx.markRowPersisted('branchInventories', inv.id);
    } else {
      const product = (ctx.data.products || []).find((p: any) => p.id === productId);
      ctx.data.branchInventories.push({
        id: info.id, tenantId: sale.tenantId, branchId: sale.branchId, productId,
        quantity: info.quantity, minAlertQuantity: Number(product?.minStockAlert) || 5, lastUpdated: nowIso(),
      });
      ctx.markRowPersisted('branchInventories', info.id);
    }
  }
  for (const m of movements) { pushMovement(ctx, m); ctx.markRowPersisted('stockMovements', m.id); }
  ctx.data.sales.unshift(sale);
  ctx.markRowPersisted('sales', sale.id);
  return { ok: true };
}

function applyMemoryDelta(
  ctx: AtomicContext, sale: Sale, productId: string, delta: number,
  type: StockMovement['type'], reason: string, actorName: string,
): void {
  let inv = (ctx.data.branchInventories || []).find(
    (i: any) => i.tenantId === sale.tenantId && i.branchId === sale.branchId && i.productId === productId,
  );
  const product = (ctx.data.products || []).find((p: any) => p.id === productId);
  const next = (inv ? Number(inv.quantity) || 0 : 0) + delta;
  if (inv) { inv.quantity = next; inv.lastUpdated = nowIso(); }
  else {
    ctx.data.branchInventories.push({
      id: invIdFor(sale.tenantId, sale.branchId, productId),
      tenantId: sale.tenantId, branchId: sale.branchId, productId,
      quantity: next, minAlertQuantity: Number(product?.minStockAlert) || 5, lastUpdated: nowIso(),
    });
  }
  pushMovement(ctx, buildMovement(
    ctx, sale.tenantId, sale.branchId, productId, product?.name || productId,
    delta, next, type, reason, actorName, sale.id,
  ));
}

/* ------------------------------------------------------------------ */
/*  الإرجاع                                                            */
/* ------------------------------------------------------------------ */

export async function commitRefundAtomic(ctx: AtomicContext, params: {
  saleId: string;
  tenantId: string;
  branchId: string;
  operationKey: string;
  items: Array<{ productId: string; productName: string; quantity: number; refundAmountSdg: number; taxAmountSdg?: number }>;
  soldQuantities: Map<string, number>;
  totalRefundSdg: number;
  record: ReturnRecord;
  actorName: string;
}): Promise<RefundCommitResult> {
  const { saleId, tenantId, branchId, operationKey, items, soldQuantities, totalRefundSdg, record, actorName } = params;

  if (!isDbEnabled()) {
    if (!await claimPosOperation(operationKey)) return { ok: false, code: 'DUPLICATE' };
    const sale = (ctx.data.sales || []).find((s: any) => s.id === saleId);
    if (!sale) throw new Error('sale vanished');
    if (sale.status === 'refunded') { await releasePosOperation(operationKey); return { ok: false, code: 'ALREADY_REFUNDED' }; }
    for (const it of items) {
      const key = `${saleId}:${it.productId}`;
      const already = memReturned.get(key) || 0;
      const sold = soldQuantities.get(it.productId) || 0;
      if (already + it.quantity > sold + 1e-9) {
        await releasePosOperation(operationKey);
        return { ok: false, code: 'QTY_EXCEEDED', productId: it.productId, remaining: Math.max(0, sold - already) };
      }
      memReturned.set(key, already + it.quantity);
    }
    for (const it of items) applyMemoryDelta(ctx, sale, it.productId, it.quantity, 'return_refund', `إرجاع بموجب ${record.creditNoteNumber || record.id}`, actorName);
    const refunded = (Number(sale.refundedAmountSdg) || 0) + totalRefundSdg;
    sale.refundedAmountSdg = refunded;
    sale.status = allReturned(sale, saleId) ? 'refunded' : 'partially_refunded';
    ctx.data.returns.unshift(record);
    return { ok: true, refundedAmountSdg: refunded };
  }

  await ensurePosGuards();
  const salesDef = ctx.tableDefFor('sales');
  const returnsDef = ctx.tableDefFor('returns');
  const movDef = ctx.tableDefFor('stockMovements');
  if (!salesDef || !returnsDef) throw new Error('POS schema is not ready');

  const movements: StockMovement[] = [];
  const balances = new Map<string, { id: string; quantity: number }>();
  let refundedAmountSdg = 0;
  let nextStatus: Sale['status'] = 'partially_refunded';

  try {
    await transaction(async (client) => {
      const claim = await client.query(
        `INSERT INTO sanad_pos_operations (key, createdat) VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING RETURNING key`,
        [operationKey, nowIso()],
      );
      if (claim.rows.length === 0) throw Object.assign(new Error('duplicate'), { posCode: 'DUPLICATE' });

      /* قفل صف الفاتورة يُسلسل الإرجاعات على نفس الفاتورة عبر كل النسخ. */
      const locked = await client.query(`SELECT * FROM "sanad_sales" WHERE id = $1 FOR UPDATE`, [saleId]);
      if (locked.rows.length === 0) throw Object.assign(new Error('missing'), { posCode: 'ALREADY_REFUNDED' });
      const saleRow = locked.rows[0];
      if (String(readField(saleRow, 'status')) === 'refunded') {
        throw Object.assign(new Error('refunded'), { posCode: 'ALREADY_REFUNDED' });
      }

      for (const it of items) {
        const sold = soldQuantities.get(it.productId) || 0;
        const reserved = await reserveReturnedQty(client, saleId, it.productId, it.quantity, sold);
        if (!reserved.ok) {
          throw Object.assign(new Error('qty'), { posCode: 'QTY_EXCEEDED', productId: it.productId, remaining: reserved.total });
        }
      }

      for (const it of items) {
        const found = await client.query(
          `SELECT id FROM "sanad_branch_inventories"
           WHERE "tenantId" = $1 AND "branchId" = $2 AND "productId" = $3 LIMIT 1`,
          [tenantId, branchId, it.productId],
        );
        let invId: string;
        if (found.rows.length > 0) invId = String(found.rows[0].id);
        else {
          invId = invIdFor(tenantId, branchId, it.productId);
          const product = (ctx.data.products || []).find((p: any) => p.id === it.productId);
          await client.query(
            `INSERT INTO "sanad_branch_inventories"
               (id, "tenantId", "branchId", "productId", quantity, "minAlertQuantity", "lastUpdated")
             VALUES ($1, $2, $3, $4, 0, $5, $6) ON CONFLICT (id) DO NOTHING`,
            [invId, tenantId, branchId, it.productId, Number(product?.minStockAlert) || 5, nowIso()],
          );
        }
        const upd = await client.query(
          `UPDATE "sanad_branch_inventories" SET quantity = quantity + $1, "lastUpdated" = $2
           WHERE id = $3 RETURNING quantity`,
          [it.quantity, nowIso(), invId],
        );
        const quantity = Number(upd.rows[0].quantity);
        balances.set(it.productId, { id: invId, quantity });
        movements.push(buildMovement(
          ctx, tenantId, branchId, it.productId, it.productName,
          it.quantity, quantity, 'return_refund',
          `إرجاع بموجب إشعار دائن (${record.creditNoteNumber || record.id})`, actorName, saleId,
        ));
      }

      refundedAmountSdg = Math.round(((Number(readField(saleRow, 'refundedAmountSdg')) || 0) + totalRefundSdg) * 100) / 100;

      /* هل اكتمل إرجاع كل الوحدات؟ نقرأ الدفتر الذرّي بعد الحجز. */
      const ledger = await client.query(`SELECT productid, quantity FROM sanad_pos_returned WHERE saleid = $1`, [saleId]);
      const returnedMap = new Map<string, number>(ledger.rows.map((r: any) => [String(r.productid), Number(r.quantity)]));
      let complete = true;
      for (const [productId, sold] of soldQuantities) {
        if ((returnedMap.get(productId) || 0) + 1e-9 < sold) { complete = false; break; }
      }
      nextStatus = complete ? 'refunded' : 'partially_refunded';

      const merged: any = { ...(ctx.data.sales || []).find((s: any) => s.id === saleId) };
      merged.refundedAmountSdg = refundedAmountSdg;
      merged.status = nextStatus;
      await writeRow(client, salesDef, merged);
      await writeRow(client, returnsDef, record as any);
      if (movDef) for (const m of movements) await writeRow(client, movDef, m as any);
    });
  } catch (err: any) {
    if (err?.posCode === 'DUPLICATE') return { ok: false, code: 'DUPLICATE' };
    if (err?.posCode === 'ALREADY_REFUNDED') return { ok: false, code: 'ALREADY_REFUNDED' };
    if (err?.posCode === 'QTY_EXCEEDED') return { ok: false, code: 'QTY_EXCEEDED', productId: err.productId, remaining: err.remaining };
    throw err;
  }

  for (const [productId, info] of balances) {
    const inv = (ctx.data.branchInventories || []).find((i: any) => i.id === info.id)
      || (ctx.data.branchInventories || []).find((i: any) => i.tenantId === tenantId && i.branchId === branchId && i.productId === productId);
    if (inv) { inv.quantity = info.quantity; inv.lastUpdated = nowIso(); ctx.markRowPersisted('branchInventories', inv.id); }
  }
  for (const m of movements) { pushMovement(ctx, m); ctx.markRowPersisted('stockMovements', m.id); }
  const sale = (ctx.data.sales || []).find((s: any) => s.id === saleId);
  if (sale) {
    sale.refundedAmountSdg = refundedAmountSdg;
    sale.status = nextStatus;
    ctx.markRowPersisted('sales', sale.id);
  }
  ctx.data.returns.unshift(record);
  ctx.markRowPersisted('returns', record.id);
  return { ok: true, refundedAmountSdg };
}

function allReturned(sale: any, saleId: string): boolean {
  const sold = new Map<string, number>();
  for (const it of sale.items || []) sold.set(it.productId, (sold.get(it.productId) || 0) + (Number(it.quantity) || 0));
  for (const [productId, qty] of sold) {
    if ((memReturned.get(`${saleId}:${productId}`) || 0) + 1e-9 < qty) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/*  رقم فاتورة التوريد: مرة واحدة لكل طلب عبر كل النسخ                  */
/* ------------------------------------------------------------------ */

export async function readSupplyInvoiceNumber(orderId: string): Promise<{ number: string; issuedAt: string } | null> {
  if (!isDbEnabled()) return memSupplyNumbers.get(orderId) || null;
  await ensurePosGuards();
  const { rows } = await query(`SELECT number, issuedat FROM sanad_supply_invoice_numbers WHERE orderid = $1`, [orderId]);
  if (rows.length === 0) return null;
  return { number: String(rows[0].number), issuedAt: String(rows[0].issuedat) };
}

export async function putSupplyInvoiceNumberIfAbsent(orderId: string, number: string, issuedAt: string): Promise<{ number: string; issuedAt: string }> {
  if (!isDbEnabled()) {
    const existing = memSupplyNumbers.get(orderId);
    if (existing) return existing;
    const value = { number, issuedAt };
    memSupplyNumbers.set(orderId, value);
    return value;
  }
  await ensurePosGuards();
  const inserted = await query(
    `INSERT INTO sanad_supply_invoice_numbers (orderid, number, issuedat) VALUES ($1, $2, $3)
     ON CONFLICT (orderid) DO NOTHING RETURNING number, issuedat`,
    [orderId, number, issuedAt],
  );
  if (inserted.rows.length > 0) return { number: String(inserted.rows[0].number), issuedAt: String(inserted.rows[0].issuedat) };
  const existing = await readSupplyInvoiceNumber(orderId);
  return existing || { number, issuedAt };
}

/** للاختبارات فقط: تصفير البدائل في الذاكرة. */
export function resetPosAtomicMemory(): void {
  memOps.clear();
  memReturned.clear();
  memSupplyNumbers.clear();
}
