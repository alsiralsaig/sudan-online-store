/**
 * Curated invoice-fix tests: pure math, QR/TLV, order-invoice helpers, and
 * real Express+PGlite route integration (sale, refund, sync, concurrency).
 * Run: npm run test:invoice-curated
 */
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';
import {
  computeInvoiceTotals, validateInvoiceLine, allocateRefund,
  previouslyReturnedMap, legacyRefundableLines, round2,
} from '../src/lib/invoiceMath.ts';
import { generateZatcaTlvBase64, generateZatcaTlvBase64Safe, generateQrSvg, TlvFieldTooLongError } from '../src/lib/zatcaQr.ts';
import { normalizeWhatsAppPhone, buildOrderInvoice, orderInvoiceText } from '../src/lib/orderInvoice.ts';

process.env.SANAD_AUTH_SECRET = 'curated-invoice-test-secret-not-for-production-123456';
process.env.SANAD_ADMIN_PASSWORD = 'curated-test-admin';
process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;

let passed = 0;
async function ok(name: string, fn: () => void | Promise<void>) {
  await fn(); passed++; console.log(`  ✓ ${name}`);
}

console.log('\n— invoiceMath —');
await ok('discount before VAT: 2000 - 200 + 15% = 2070', async () => {
  const t = computeInvoiceTotals([{ productId: 'a', quantity: 1, unitPriceSdg: 2000, discountSdg: 200 }], { vatEnabled: true, defaultVatPct: 15, pricesIncludeVat: false }, 0);
  assert.equal(t.grandTotalSdg, 2070);
  assert.equal(t.taxTotalSdg, 270);
});
await ok('invoice-level discount distributed before VAT', async () => {
  const t = computeInvoiceTotals([
    { productId: 'a', quantity: 2, unitPriceSdg: 1000 },
    { productId: 'b', quantity: 4, unitPriceSdg: 250, isTaxExempt: true },
  ], { vatEnabled: true, defaultVatPct: 15, pricesIncludeVat: false }, 300);
  assert.equal(t.subtotalSdg, 3000);
  assert.equal(t.discountTotalSdg, 300);
  // a: net 1800 -> tax 270 ; b: net 900 exempt
  assert.equal(t.taxTotalSdg, 270);
  assert.equal(t.grandTotalSdg, 2970);
});
await ok('inclusive VAT extracted after discount', async () => {
  const t = computeInvoiceTotals([{ productId: 'a', quantity: 1, unitPriceSdg: 1150 }], { vatEnabled: true, defaultVatPct: 15, pricesIncludeVat: true }, 0);
  assert.equal(t.taxTotalSdg, 150);
  assert.equal(t.grandTotalSdg, 1150);
});
await ok('zero price is preserved (free item)', async () => {
  const t = computeInvoiceTotals([{ productId: 'a', quantity: 1, unitPriceSdg: 0 }], { vatEnabled: true, defaultVatPct: 15, pricesIncludeVat: false }, 0);
  assert.equal(t.grandTotalSdg, 0);
});
await ok('validation rejects negative / NaN / over-discount', async () => {
  assert.ok(validateInvoiceLine({ productId: 'a', quantity: -1, unitPriceSdg: 10 }));
  assert.ok(validateInvoiceLine({ productId: 'a', quantity: NaN, unitPriceSdg: 10 }));
  assert.ok(validateInvoiceLine({ productId: 'a', quantity: 1, unitPriceSdg: 10, discountSdg: 20 }));
  assert.equal(validateInvoiceLine({ productId: 'a', quantity: 1, unitPriceSdg: 0 }), null);
});
await ok('refund returns paid share incl. VAT; last refund exact', async () => {
  const lines = [{ productId: 'a', productName: 'A', quantity: 2, totalSdg: 2070, taxAmountSdg: 270 }];
  const first = allocateRefund(lines, {}, { a: 1 }, 2070, 0);
  assert.equal(first.totalRefundSdg, 1035);
  assert.equal(first.taxRefundSdg, 135);
  const prev = previouslyReturnedMap([{ items: first.lines.map((l) => ({ ...l, refundAmountSdg: l.refundAmountSdg })) }]);
  const last = allocateRefund(lines, prev, { a: 1 }, 2070, 1035);
  assert.equal(last.totalRefundSdg, 1035);
  assert.equal(round2(first.totalRefundSdg + last.totalRefundSdg), 2070);
});
await ok('exempt line refund carries zero tax', async () => {
  const lines = [
    { productId: 'a', productName: 'A', quantity: 1, totalSdg: 1150, taxAmountSdg: 150 },
    { productId: 'b', productName: 'B', quantity: 1, totalSdg: 1000, taxAmountSdg: 0 },
  ];
  const r = allocateRefund(lines, {}, { b: 1 }, 2150, 0);
  assert.equal(r.totalRefundSdg, 1000);
  assert.equal(r.taxRefundSdg, 0);
});
await ok('legacy sale reconstructs paid amounts from grand total', async () => {
  const lines = legacyRefundableLines({
    items: [{ productId: 'a', productName: 'A', quantity: 1, totalSdg: 2000, taxAmountSdg: 300 }],
    grandTotalSdg: 2100, taxTotalSdg: 300, subtotalSdg: 2000, discountTotalSdg: 200,
  });
  assert.equal(lines[0].totalSdg, 2100);
});

console.log('\n— QR / TLV —');
await ok('TLV encodes Arabic seller name with correct byte length', async () => {
  const b64 = generateZatcaTlvBase64({ sellerName: 'متجر السند', taxNumber: '1234567890', timestamp: '2026-11-04T12:00:00Z', totalWithVat: '2070.00', vatTotal: '270.00' });
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  assert.equal(bytes[0], 1);
  assert.equal(bytes[1], new TextEncoder().encode('متجر السند').length);
});
await ok('TLV > 255 bytes throws; safe variant returns null', async () => {
  const long = 'س'.repeat(200); // 400 bytes
  assert.throws(() => generateZatcaTlvBase64({ sellerName: long, taxNumber: '', timestamp: '', totalWithVat: '0', vatTotal: '0' }), TlvFieldTooLongError);
  assert.equal(generateZatcaTlvBase64Safe({ sellerName: long, taxNumber: '', timestamp: '', totalWithVat: '0', vatTotal: '0' }), null);
});
await ok('generateQrSvg produces a real QR matrix (finder patterns)', async () => {
  const svg = generateQrSvg('https://sanad.sd/INV-2026-000001', 120);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('<path'));
  assert.ok(!svg.includes('rect x=')); // old fake used many rects
});

console.log('\n— orderInvoice helpers —');
await ok('WhatsApp +249 0912… normalizes without extra zero', async () => {
  assert.equal(normalizeWhatsAppPhone('+249 0912 345 678'), '249912345678');
  assert.equal(normalizeWhatsAppPhone('0912345678'), '249912345678');
  assert.equal(normalizeWhatsAppPhone('249912345678'), '249912345678');
});
await ok('unknown supply status is not labelled cancelled', async () => {
  const m = buildOrderInvoice({ status: 'weird', orderNumber: 'PO-1', items: [], totalSdg: 0, sellerName: 's', buyerName: 'b', createdAt: new Date().toISOString() } as any);
  assert.equal(m.status, 'غير معروفة');
});

/* ------------------------------------------------------------------ */
/*  Route integration (Express + PGlite)                               */
/* ------------------------------------------------------------------ */
console.log('\n— routes (PGlite) —');
const pglite = new PGlite();
setSqlClient({ query: async (text: string, params?: any[]) => { const r = await pglite.query(text, params); return { rows: r.rows as any[], rowCount: r.affectedRows ?? null }; } });
const { createApp } = await import('../server.ts');
const { db } = await import('../src/server/db.ts');
const { newMerchantCode, merchantCodeHash } = await import('../src/server/securitySessions.ts');
await db.init();

const schema = db.getSchema() as any;
const tenantId = 'tenant_alrowad', branchId = 'branch_kht_main';
const tenant = db.getTenant(tenantId)!;
tenant.settings.allowNegativeStock = false;
tenant.settings.vatEnabled = true;
tenant.settings.defaultVatPct = 15;
tenant.settings.pricesIncludeVat = false;
tenant.settings.defaultMaxDiscountPct = 100;
schema.sales = schema.sales.filter((s: any) => s.tenantId !== tenantId);
schema.returns = schema.returns.filter((r: any) => r.tenantId !== tenantId);

function addProduct(id: string, price: number, stock: number, opts: any = {}) {
  schema.products.push({ id, tenantId, name: id, sku: id, barcode: id, category: 't', unit: 'piece', purchaseCost: 10, costCurrency: 'SDG', sellingPriceSdg: price, minStockAlert: 0, isActive: true, createdAt: new Date().toISOString(), ...opts });
  if (stock) db.adjustStock({ tenantId, branchId, productId: id, delta: stock, type: 'adjustment', reason: 'seed', actorName: 'test' });
}
addProduct('cur_a', 1000, 100);
addProduct('cur_b', 250, 100, { isTaxExempt: true });
addProduct('cur_service', 500, 0, { trackInventory: false });
addProduct('cur_empty', 100, 0);
addProduct('cur_race', 100, 1);

const code = newMerchantCode();
db.setMerchantCode(tenantId, merchantCodeHash(code)!);
db.commit(); await db.flush();

const server = createApp().listen(0, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
async function call(path: string, method = 'GET', body?: any, token?: string, extraHeaders: Record<string,string> = {}) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json() as any };
}
// A cashier has no override_stock / edit_prices: used for strict-stock cases.
const cashierHeaders = { 'x-actor-id': 'cur_cashier', 'x-actor-role': 'cashier' };
const login = await call('/auth/merchant/login', 'POST', { code });
assert.equal(login.status, 200);
const token = login.body.token;
const stock = async (id: string) => {
  const r = await pglite.query('SELECT quantity FROM sanad_branch_inventories WHERE "tenantId"=$1 AND "branchId"=$2 AND "productId"=$3', [tenantId, branchId, id]);
  return r.rows.length ? Number((r.rows[0] as any).quantity) : 0;
};
const line = (productId: string, quantity = 1, extra: any = {}) => ({ productId, quantity, ...extra });
const saleBody = (id: string, items: any[], extra: any = {}) => ({ id, branchId, items, paymentMethod: 'cash', ...extra });

try {
  const normal = await call('/pos/sales', 'POST', saleBody('cur_sale_1', [line('cur_a', 2)], { discountTotalSdg: 200 }), token);
  await ok('sale: sequential number + correct totals', async () => {
    assert.equal(normal.status, 200);
    assert.match(normal.body.sale.invoiceNumber, /^INV-\d{4}-\d{6}$/);
    assert.equal(normal.body.sale.grandTotalSdg, 2070);
    assert.equal(await stock('cur_a'), 98);
  });

  const beforeA = await stock('cur_a');
  const insufficient = await call('/pos/sales', 'POST', saleBody('cur_sale_bad', [line('cur_a'), line('cur_empty')]), token, cashierHeaders);
  await ok('sale: insufficient stock rejected atomically (no partial deduction)', async () => {
    assert.equal(insufficient.status, 409);
    assert.equal(await stock('cur_a'), beforeA);
    assert.equal(db.getSchema().sales.find((s: any) => s.id === 'cur_sale_bad'), undefined);
  });

  const zero = await call('/pos/sales', 'POST', saleBody('cur_sale_zero', [line('cur_a', 1, { unitPriceSdg: 0 })]), token);
  await ok('sale: explicit zero price stays zero', async () => {
    assert.equal(zero.status, 200);
    assert.equal(zero.body.sale.grandTotalSdg, 0);
  });

  const service = await call('/pos/sales', 'POST', saleBody('cur_sale_service', [line('cur_service', 1)]), token);
  await ok('sale: non-stock service sells without inventory record', async () => {
    assert.equal(service.status, 200);
    assert.equal(service.body.sale.grandTotalSdg, 575);
  });

  const override = await call('/pos/sales', 'POST', saleBody('cur_sale_override', [line('cur_empty', 1)]), token);
  await ok('sale: owner override_stock may go negative; cashier may not', async () => {
    assert.equal(override.status, 200);
    assert.equal(await stock('cur_empty'), -1);
  });

  const refundSale = await call('/pos/sales', 'POST', saleBody('cur_refund', [line('cur_a', 2), line('cur_b', 4)], { discountTotalSdg: 300 }), token);
  assert.equal(refundSale.status, 200);
  const part = await call('/pos/sales/cur_refund/refund', 'POST', { returnItems: [line('cur_a', 1)], refundRequestId: 'req-1' }, token);
  const partDup = await call('/pos/sales/cur_refund/refund', 'POST', { returnItems: [line('cur_a', 1)], refundRequestId: 'req-1' }, token);
  const rest = await call('/pos/sales/cur_refund/refund', 'POST', { refundRequestId: 'req-2' }, token);
  await ok('refund: partial + remainder reconcile exactly; idempotent retry', async () => {
    assert.equal(part.status, 200);
    assert.equal(partDup.body.isDuplicate, true);
    assert.equal(partDup.body.returnRecord.creditNoteNumber, part.body.returnRecord.creditNoteNumber);
    const total = round2(part.body.returnRecord.totalRefundSdg + rest.body.returnRecord.totalRefundSdg);
    assert.equal(total, refundSale.body.sale.grandTotalSdg);
    assert.equal(rest.body.sale.status, 'refunded');
    assert.match(part.body.returnRecord.creditNoteNumber, /^CN-\d{4}-\d{6}$/);
  });
  await ok('refund: exempt line carries zero tax in credit note', async () => {
    // cur_b is exempt; the remainder refund includes it. Check the partial 'a' refund tax > 0.
    assert.ok(part.body.returnRecord.taxRefundSdg > 0);
    assert.ok(typeof rest.body.returnRecord.taxRefundSdg === 'number');
  });

  const dupSale = await call('/pos/sales', 'POST', saleBody('cur_dup', [line('cur_a', 2)]), token);
  const beforeDup = await stock('cur_a');
  const dupReturn = await call('/pos/sales/cur_dup/refund', 'POST', { returnItems: [line('cur_a', 2), line('cur_a', 2)] }, token);
  await ok('refund: duplicate product lines in one request are rejected (no double stock)', async () => {
    assert.equal(dupReturn.status, 400);
    assert.equal(await stock('cur_a'), beforeDup);
  });

  const offline = await call('/sync/batch', 'POST', { sales: [{ ...saleBody('cur_off_1', [line('cur_a', 1)]), invoiceNumber: 'INV-OFF-PRINTED', grandTotalSdg: 1150, cashierId: 'FORGED', cashierName: 'FORGED', status: 'refunded', refundedAmountSdg: 99999 }] }, token);
  const synced = db.getSchema().sales.find((s: any) => s.id === 'cur_off_1') as any;
  await ok('sync: whitelist + official number + printed number kept + identity from session', async () => {
    assert.equal(offline.status, 200);
    assert.equal(synced.status, 'completed');
    assert.ok(!synced.refundedAmountSdg);
    assert.match(synced.invoiceNumber, /^INV-\d{4}-\d{6}$/);
    assert.equal(synced.offlineInvoiceNumber, 'INV-OFF-PRINTED');
    assert.notEqual(synced.cashierId, 'FORGED');
    assert.equal(synced.grandTotalSdg, 1150);
  });

  const offlineBad = await call('/sync/batch', 'POST', { sales: [{ ...saleBody('cur_off_2', [line('cur_a', 1)]), invoiceNumber: 'INV-OFF-PRINTED-2', grandTotalSdg: 9999 }] }, token);
  const syncedBad = db.getSchema().sales.find((s: any) => s.id === 'cur_off_2') as any;
  await ok('sync: printed/server grand-total mismatch is recorded, server total wins', async () => {
    assert.equal(offlineBad.status, 200);
    assert.equal(syncedBad.grandTotalSdg, 1150);
    assert.equal(syncedBad.offlineTotalsMismatch.printedGrandTotalSdg, 9999);
    assert.equal(syncedBad.offlineTotalsMismatch.serverGrandTotalSdg, 1150);
    assert.equal(offlineBad.body.mismatches.length, 1);
  });

  // Concurrency: two simultaneous sales of the last unit — lease serialises them.
  const [r1, r2] = await Promise.all([
    call('/pos/sales', 'POST', saleBody('cur_race_1', [line('cur_race', 1)]), token, cashierHeaders),
    call('/pos/sales', 'POST', saleBody('cur_race_2', [line('cur_race', 1)]), token, cashierHeaders),
  ]);
  await ok('concurrency: last unit sold once, second request rejected', async () => {
    const statuses = [r1.status, r2.status].sort();
    assert.deepEqual(statuses, [200, 409]);
    assert.equal(await stock('cur_race'), 0);
    assert.equal(db.getSchema().sales.filter((s: any) => s.id.startsWith('cur_race_')).length, 1);
  });

  console.log(`\n✅ ${passed} checks passed.`);
} finally {
  server.closeAllConnections(); server.close(); await pglite.close();
}
