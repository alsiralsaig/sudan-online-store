/**
 * اختبارات ذرّية نقطة البيع: بيع متزامن، إرجاع مزدوج، بنود مكررة، ضريبة مختلطة.
 * تعمل على Express الحقيقي + PGlite معزول — لا تلمس الإنتاج أبداً.
 *   npm run test:pos-atomic
 */
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';

process.env.SANAD_AUTH_SECRET = 'pos-atomic-test-secret-not-for-production-123456';
process.env.SANAD_ADMIN_PASSWORD = 'pos-atomic-test-admin';
process.env.NODE_ENV = 'test';
delete process.env.NTFY_TOPIC;
delete process.env.TELEGRAM_BOT_TOKEN;

const pglite = new PGlite();
setSqlClient({
  query: async (text: string, params?: any[]) => {
    const res = await pglite.query(text, params);
    return { rows: res.rows as any[], rowCount: res.affectedRows ?? null };
  },
});

const { createApp } = await import('../server.ts');
const { db } = await import('../src/server/db.ts');
const { newMerchantCode, merchantCodeHash } = await import('../src/server/securitySessions.ts');

await db.init();
const schema = db.getSchema() as any;
const tenantId = 'tenant_alrowad';
const branchId = 'branch_kht_main';
const tenant = schema.tenants.find((t: any) => t.id === tenantId);
tenant.settings = { ...(tenant.settings || {}), vatEnabled: true, defaultVatPct: 15, pricesIncludeVat: false, allowNegativeStock: false };

const code = newMerchantCode();
db.setMerchantCode(tenantId, merchantCodeHash(code)!);
db.commit();
await db.flush();

const server = createApp().listen(0, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const base = `http://127.0.0.1:${(server.address() as any).port}/api`;

async function call(path: string, method = 'GET', body?: any, token?: string, cookie?: string) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

let passed = 0;
function ok(name: string, condition: unknown, detail?: unknown) {
  assert.ok(condition, `${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  passed++;
  console.log(`  ✅ ${name}`);
}

async function stockOf(productId: string): Promise<number> {
  const r = await pglite.query(
    `SELECT quantity FROM "sanad_branch_inventories" WHERE "tenantId"=$1 AND "branchId"=$2 AND "productId"=$3`,
    [tenantId, branchId, productId],
  );
  return Number((r.rows[0] as any)?.quantity ?? NaN);
}
async function setStock(productId: string, qty: number) {
  await pglite.query(
    `UPDATE "sanad_branch_inventories" SET quantity=$1 WHERE "tenantId"=$2 AND "branchId"=$3 AND "productId"=$4`,
    [qty, tenantId, branchId, productId],
  );
  await db.refresh();
}

try {
  const login = await call('/auth/merchant/login', 'POST', { code });
  ok('تسجيل الدخول', login.status === 200, login.body);
  const token = login.body.token;

  /* ---------------------------------------------------------------- */
  console.log('\n١. البيع المتزامن لا يبيع أكثر من الرصيد');
  const P1 = 'prod_sugar_kenana';
  await setStock(P1, 1);
  const [a, b] = await Promise.all([
    call('/pos/sales', 'POST', { id: 'sale_race_a', branchId, items: [{ productId: P1, quantity: 1 }] }, token),
    call('/pos/sales', 'POST', { id: 'sale_race_b', branchId, items: [{ productId: P1, quantity: 1 }] }, token),
  ]);
  const successes = [a, b].filter((r) => r.status === 200);
  ok('فاتورة واحدة فقط تنجح من رصيد ١', successes.length === 1, [a.status, b.status]);
  ok('الأخرى تُرفض بـ409 نقص مخزون', [a, b].some((r) => r.status === 409 && r.body.error === 'INSUFFICIENT_STOCK'), [a.body, b.body]);
  ok('الرصيد النهائي صفر لا سالب', (await stockOf(P1)) === 0, await stockOf(P1));

  /* ---------------------------------------------------------------- */
  console.log('\n٢. إعادة إرسال نفس الفاتورة لا تُنشئ ثانية');
  await setStock(P1, 10);
  const first = await call('/pos/sales', 'POST', { id: 'sale_idem', branchId, items: [{ productId: P1, quantity: 2 }] }, token);
  ok('البيع الأول ينجح', first.status === 200, first.body);
  const again = await call('/pos/sales', 'POST', { id: 'sale_idem', branchId, items: [{ productId: P1, quantity: 2 }] }, token);
  ok('الإعادة تُرجع نفس الفاتورة', again.status === 200 && again.body.isDuplicate === true, again.body);
  ok('المخزون خُصم مرة واحدة', (await stockOf(P1)) === 8, await stockOf(P1));

  /* ---------------------------------------------------------------- */
  console.log('\n٣. الإرجاع المتزامن لا يُرجع المبلغ مرتين');
  const before = await stockOf(P1);
  const [r1, r2] = await Promise.all([
    call(`/pos/sales/sale_idem/refund`, 'POST', { reason: 'اختبار', requestId: 'req_race_1' }, token),
    call(`/pos/sales/sale_idem/refund`, 'POST', { reason: 'اختبار', requestId: 'req_race_2' }, token),
  ]);
  const okRefunds = [r1, r2].filter((r) => r.status === 200);
  ok('إرجاع واحد فقط ينجح', okRefunds.length === 1, [r1.status, r2.status]);
  const afterStock = await stockOf(P1);
  ok('المخزون رُدّ مرة واحدة', afterStock === before + 2, { before, afterStock });
  await db.refresh();
  const saleAfter = db.getSchema().sales.find((s: any) => s.id === 'sale_idem') as any;
  const paid = Number(saleAfter.grandTotalSdg);
  ok('المسترد لا يتجاوز المدفوع', Number(saleAfter.refundedAmountSdg) === paid, { paid, refunded: saleAfter.refundedAmountSdg });
  ok('حالة الفاتورة مرتجع بالكامل', saleAfter.status === 'refunded', saleAfter.status);
  const notes = db.getSchema().returns.filter((r: any) => r.saleId === 'sale_idem');
  ok('إشعار دائن واحد فقط', notes.length === 1, notes.length);

  /* ---------------------------------------------------------------- */
  console.log('\n٤. إعادة نفس طلب الإرجاع بنفس المعرّف');
  const dup = await call(`/pos/sales/sale_idem/refund`, 'POST', { reason: 'اختبار', requestId: okRefunds[0].body.returnRecord.requestId }, token);
  ok('لا يُصدر إشعاراً ثانياً', dup.status === 200 && dup.body.isDuplicate === true, dup.body);
  ok('المخزون لم يتغيّر', (await stockOf(P1)) === afterStock, await stockOf(P1));

  /* ---------------------------------------------------------------- */
  console.log('\n٥. البند المكرر في طلب الإرجاع لا يُضاعف الكمية');
  const P2 = 'prod_cooking_oil';
  await setStock(P2, 20);
  const s2 = await call('/pos/sales', 'POST', { id: 'sale_dup_lines', branchId, items: [{ productId: P2, quantity: 2 }] }, token);
  ok('بيع قطعتين', s2.status === 200, s2.body);
  const stockPre = await stockOf(P2);
  const over = await call('/pos/sales/sale_dup_lines/refund', 'POST', {
    reason: 'بنود مكررة', requestId: 'req_dup_lines',
    returnItems: [{ productId: P2, quantity: 2 }, { productId: P2, quantity: 2 }],
  }, token);
  ok('طلب ٤ من أصل ٢ يُرفض', over.status === 400 && over.body.error === 'RETURN_QTY_EXCEEDED', over.body);
  ok('المخزون لم يتحرّك', (await stockOf(P2)) === stockPre, await stockOf(P2));
  const half = await call('/pos/sales/sale_dup_lines/refund', 'POST', {
    reason: 'قطعة واحدة', requestId: 'req_one',
    returnItems: [{ productId: P2, quantity: 1 }, { productId: P2, quantity: 0 }],
  }, token);
  ok('تجميع البنود: قطعة واحدة تُرجع قطعة', half.status === 200 && half.body.returnRecord.items[0].quantity === 1, half.body);
  ok('المخزون زاد واحداً', (await stockOf(P2)) === stockPre + 1, await stockOf(P2));

  /* ---------------------------------------------------------------- */
  /* إرجاعان جزئيان متتاليان: الثاني يجب أن ينجح ويُكمل الفاتورة بالضبط. */
  const rest = await call('/pos/sales/sale_dup_lines/refund', 'POST', {
    reason: 'إتمام الإرجاع', requestId: 'req_two',
    returnItems: [{ productId: P2, quantity: 1 }],
  }, token);
  ok('إرجاع جزئي ثانٍ ينجح (لا احتساب مزدوج)', rest.status === 200, rest.body);
  ok('المخزون عاد كاملاً', (await stockOf(P2)) === stockPre + 2, await stockOf(P2));
  await db.refresh();
  const dupSale = db.getSchema().sales.find((s: any) => s.id === 'sale_dup_lines') as any;
  ok('مجموع المسترد = المدفوع بالضبط', Number(dupSale.refundedAmountSdg) === Number(dupSale.grandTotalSdg), { paid: dupSale.grandTotalSdg, refunded: dupSale.refundedAmountSdg });
  ok('الحالة مرتجع بالكامل', dupSale.status === 'refunded', dupSale.status);
  const third = await call('/pos/sales/sale_dup_lines/refund', 'POST', { reason: 'بعد الاكتمال', requestId: 'req_three', returnItems: [{ productId: P2, quantity: 1 }] }, token);
  ok('لا إرجاع بعد الاكتمال', third.status === 409, third.status);

  console.log('\n٦. ضريبة الإشعار الدائن تتبع البند لا نسبة الإجمالي');
  const P3 = 'prod_sayga_flour';
  await setStock(P3, 50);
  /* setStock يستدعي refresh فيستبدل النسخة؛ نعدّل بعد آخر تحديث لا قبله. */
  const svc = db.getSchema().products.find((p: any) => p.tenantId === tenantId && ![P1, P2, P3].includes(p.id)) as any;
  svc.isTaxExempt = true;
  svc.trackInventory = false;
  db.commit(); await db.flush();
  await db.refresh();
  const svcReloaded = db.getSchema().products.find((p: any) => p.id === svc.id) as any;
  ok('علم «خدمة غير مخزونية» محفوظ في القاعدة', svcReloaded.trackInventory === false, svcReloaded.trackInventory);
  const mixed = await call('/pos/sales', 'POST', {
    id: 'sale_mixed_tax', branchId,
    items: [
      { productId: P3, quantity: 1, unitPriceSdg: 1000, taxRate: 15 },
      { productId: svc.id, quantity: 1, unitPriceSdg: 1000, isTaxExempt: true },
    ],
  }, token);
  ok('فاتورة مختلطة: 2150 وضريبة 150', mixed.status === 200 && mixed.body.sale.grandTotalSdg === 2150 && mixed.body.sale.taxTotalSdg === 150, { status: mixed.status, body: mixed.body });
  const cn = await call('/pos/sales/sale_mixed_tax/refund', 'POST', {
    reason: 'إرجاع المعفى', requestId: 'req_exempt',
    returnItems: [{ productId: svc.id, quantity: 1 }],
  }, token);
  ok('إرجاع المعفى ينجح', cn.status === 200, cn.body);
  ok('ضريبة الإشعار = صفر (لا 69.77)', Number(cn.body.returnRecord.taxRefundSdg) === 0, cn.body.returnRecord.taxRefundSdg);
  ok('المبلغ المسترد 1000', Number(cn.body.returnRecord.totalRefundSdg) === 1000, cn.body.returnRecord.totalRefundSdg);

  /* ---------------------------------------------------------------- */
  console.log('\n٧. الخدمات غير المخزونية لا تُخصم ولا تُرفض');
  const svcStockBefore = await stockOf(svc.id);
  const svcSale = await call('/pos/sales', 'POST', { id: 'sale_service', branchId, items: [{ productId: svc.id, quantity: 5 }] }, token);
  ok('بيع خدمة بلا رصيد ينجح', svcSale.status === 200, svcSale.body);
  const svcStockAfter = await stockOf(svc.id);
  ok('لا حركة مخزون للخدمة', Object.is(svcStockBefore, svcStockAfter) || (Number.isNaN(svcStockBefore) && Number.isNaN(svcStockAfter)), { svcStockBefore, svcStockAfter });

  /* ---------------------------------------------------------------- */
  console.log('\n٨. السعر صفر سعرٌ مقصود');
  await setStock(P3, 50);
  const zero = await call('/pos/sales', 'POST', { id: 'sale_zero', branchId, items: [{ productId: P3, quantity: 1, unitPriceSdg: 0 }] }, token);
  ok('سعر صفر لا يُستبدل بسعر الصنف', zero.status === 200 && zero.body.sale.grandTotalSdg === 0, zero.body.sale?.grandTotalSdg);

  /* ---------------------------------------------------------------- */
  console.log('\n٩. المزامنة لا تثق بهوية الكاشير من الجهاز');
  await setStock(P2, 30);
  const sync = await call('/sync/batch', 'POST', {
    sales: [{
      id: 'sale_off_forge', branchId, invoiceNumber: 'INV-OFF-TEST-0001',
      cashierId: 'FORGED', cashierName: 'مزيّف',
      items: [{ productId: P2, quantity: 1, unitPriceSdg: 500, taxRate: 15 }],
      paymentMethod: 'cash', createdAt: new Date().toISOString(),
    }],
  }, token);
  ok('المزامنة تنجح', sync.status === 200 && sync.body.syncedCount === 1, sync.body);
  await db.refresh();
  const synced = db.getSchema().sales.find((s: any) => s.id === 'sale_off_forge') as any;
  ok('الكاشير من الجلسة لا من الحمولة', synced.cashierId !== 'FORGED' && synced.cashierName !== 'مزيّف', { id: synced.cashierId, name: synced.cashierName });
  ok('رقم الفاتورة المطبوع محفوظ', synced.offlineInvoiceNumber === 'INV-OFF-TEST-0001', synced.offlineInvoiceNumber);
  ok('لا تغيير صامت على الرقم', Array.isArray(sync.body.renumbered) && sync.body.renumbered[0]?.from === synced.offlineInvoiceNumber && sync.body.renumbered[0]?.to === synced.invoiceNumber, sync.body.renumbered);

  const sync2 = await call('/sync/batch', 'POST', {
    sales: [{
      id: 'sale_off_dupnum', branchId, invoiceNumber: 'INV-OFF-TEST-0001',
      items: [{ productId: P2, quantity: 1, unitPriceSdg: 500, taxRate: 15 }],
      paymentMethod: 'cash', createdAt: new Date().toISOString(),
    }],
  }, token);
  ok('تعارض الرقم يُعلَن لا يُخفى', sync2.body.renumbered?.length === 1 && sync2.body.renumbered[0].from === 'INV-OFF-TEST-0001', sync2.body.renumbered);

  /* ---------------------------------------------------------------- */
  console.log('\n١٠. نقاط الولاء تُمنح للمبيعات المزامَنة');
  const custPhone = '0912345099';
  const created = await call('/pos/customers', 'POST', { name: 'عميل المزامنة', phone: custPhone }, token);
  ok('إنشاء عميل', created.status === 200, created.body);
  const custId = created.body.customer?.id || created.body.id;
  const beforePts = Number((db.getSchema().customers.find((c: any) => c.id === custId) as any)?.loyaltyPoints || 0);
  const loySync = await call('/sync/batch', 'POST', {
    sales: [{
      id: 'sale_off_loyalty', branchId, invoiceNumber: 'INV-OFF-LOY-0001', customerId: custId,
      items: [{ productId: P2, quantity: 1, unitPriceSdg: 5000, taxRate: 0 }],
      paymentMethod: 'cash', createdAt: new Date().toISOString(),
    }],
  }, token);
  ok('مزامنة فاتورة عميل تنجح', loySync.status === 200 && loySync.body.syncedCount === 1, loySync.body);
  await db.refresh();
  const afterPts = Number((db.getSchema().customers.find((c: any) => c.id === custId) as any)?.loyaltyPoints || 0);
  ok('النقاط زادت بعد المزامنة', afterPts > beforePts, { beforePts, afterPts });

  console.log('\n١١. الصلاحيات والإعدادات الضريبية من الخادم لا من الجهاز');
  const vatSpoof = await call('/pos/sales', 'POST', {
    id: 'sale_vat_spoof', branchId,
    vatEnabled: false, defaultVatPct: 0, pricesIncludeVat: true,
    items: [{ productId: P1, quantity: 1 }],
  }, token);
  ok('محاولة تعطيل الضريبة من الجهاز تُتجاهل', vatSpoof.status === 200 && Number(vatSpoof.body.sale.taxTotalSdg) > 0, vatSpoof.body.sale?.taxTotalSdg);

  /* كاشير بلا صلاحية تعديل الأسعار */
  const cashierEmp = db.getSchema().employees.find((e: any) => e.tenantId === tenantId && e.role === 'cashier') as any;
  ok('يوجد كاشير في بيانات الاختبار', !!cashierEmp, cashierEmp?.id);
  const staffLogin = await call('/auth/staff/login', 'POST', { employeeId: cashierEmp.id, pin: cashierEmp.pin }, token);
  ok('دخول الكاشير برمزه السري', staffLogin.status === 200 && !!staffLogin.body?.token, staffLogin.body);
  const cashierCookie = `sanad_staff_token=${staffLogin.body.token}`;
  const listPrice = Number((db.getSchema().products.find((p: any) => p.id === P1) as any).sellingPriceSdg);
  const cheat = await call('/pos/sales', 'POST', {
    id: 'sale_price_cheat', branchId, items: [{ productId: P1, quantity: 1, unitPriceSdg: 1 }],
  }, token, cashierCookie);
  ok('كاشير لا يبيع بأقل من السعر المسجّل', cheat.status === 403 && cheat.body.error === 'PRICE_OVERRIDE_FORBIDDEN', cheat.body);
  const fair = await call('/pos/sales', 'POST', {
    id: 'sale_price_ok', branchId, items: [{ productId: P1, quantity: 1, unitPriceSdg: listPrice }],
  }, token, cashierCookie);
  ok('كاشير يبيع بالسعر المسجّل عادياً', fair.status === 200, fair.body);
  ok('هوية الكاشير الحقيقية مُسجّلة', fair.body.sale?.cashierId === cashierEmp.id, fair.body.sale?.cashierId);

  // Sale ids are global database primary keys: a tenant must never overwrite another tenant's sale.
  const foreignSale: any = {
    id: 'sale_cross_tenant_id_conflict', tenantId: 'tenant_nile_boutique', branchId: 'branch_psd_main',
    branchName: 'فرع بورتسودان', shiftId: '', invoiceNumber: 'INV-2026-990001',
    customerName: 'سجل متجر آخر', customerPhone: '', items: [], subtotalSdg: 100,
    discountTotalSdg: 0, taxTotalSdg: 0, grandTotalSdg: 100, paymentMethod: 'cash',
    status: 'completed', cashierId: 'foreign_cashier', cashierName: 'كاشير آخر', createdAt: new Date().toISOString(),
  };
  db.getSchema().sales.unshift(foreignSale); db.commit(); await db.flush();
  const stockBeforeIdCollision = await stockOf(P1);
  const onlineIdCollision = await call('/pos/sales', 'POST', {
    id: foreignSale.id, branchId, items: [{ productId: P1, quantity: 1, unitPriceSdg: listPrice }],
  }, token, cashierCookie);
  ok('البيع المتصل يرفض معرّفاً يخص متجراً آخر',
    onlineIdCollision.status === 409 && onlineIdCollision.body.error === 'SALE_ID_CONFLICT', onlineIdCollision.body);
  const syncIdCollision = await call('/sync/batch', 'POST', {
    sales: [{ id: foreignSale.id, branchId, invoiceNumber: 'INV-OFF-COLLISION',
      items: [{ productId: P1, quantity: 1, unitPriceSdg: listPrice }], paymentMethod: 'cash', createdAt: new Date().toISOString() }],
  }, token, cashierCookie);
  ok('المزامنة ترفض معرّفاً يخص متجراً آخر',
    syncIdCollision.status === 200 && syncIdCollision.body.syncedCount === 0 && /SALE_ID_CONFLICT/.test(syncIdCollision.body.errors?.[0]?.error || ''), syncIdCollision.body);
  const foreignAfterCollision = db.getSchema().sales.find((s: any) => s.id === foreignSale.id) as any;
  ok('بيانات المتجر الآخر ومخزون المتجر الحالي لم تتغير',
    foreignAfterCollision?.tenantId === foreignSale.tenantId && foreignAfterCollision?.invoiceNumber === foreignSale.invoiceNumber && (await stockOf(P1)) === stockBeforeIdCollision,
    { tenantId: foreignAfterCollision?.tenantId, invoiceNumber: foreignAfterCollision?.invoiceNumber, stock: await stockOf(P1) });

  // Both online and offline paths must enforce store-wide and employee-specific caps.
  // The store cap is 100%, but this cashier's own cap is 10% in the seed data.
  const tenantForPolicy = db.getSchema().tenants.find((t: any) => t.id === tenantId) as any;
  const priorDiscountCap = tenantForPolicy.settings.defaultMaxDiscountPct;
  tenantForPolicy.settings = { ...tenantForPolicy.settings, defaultMaxDiscountPct: 100 };
  db.commit(); await db.flush();
  const stockBeforePolicyChecks = await stockOf(P1);
  const invoiceDiscountAttack = await call('/pos/sales', 'POST', {
    id: 'sale_invoice_discount_attack', branchId,
    items: [{ productId: P1, quantity: 1, unitPriceSdg: listPrice }],
    discountTotalSdg: listPrice, paymentMethod: 'cash',
  }, token, cashierCookie);
  ok('الكاشير لا يتجاوز الحد بخصم الفاتورة الإجمالي',
    invoiceDiscountAttack.status === 403 && invoiceDiscountAttack.body.error === 'DISCOUNT_LIMIT_EXCEEDED', invoiceDiscountAttack.body);
  ok('رفض خصم الفاتورة لا يخصم المخزون', (await stockOf(P1)) === stockBeforePolicyChecks, await stockOf(P1));

  const forgedPriceSync = await call('/sync/batch', 'POST', {
    sales: [{ id: 'sale_sync_price_attack', branchId, invoiceNumber: 'INV-OFF-PRICE-ATTACK',
      items: [{ productId: P1, quantity: 1, unitPriceSdg: 1 }], paymentMethod: 'cash', createdAt: new Date().toISOString() }],
  }, token, cashierCookie);
  ok('مزامنة الكاشير ترفض السعر المصطنع',
    forgedPriceSync.status === 200 && forgedPriceSync.body.syncedCount === 0 && /PRICE_OVERRIDE_FORBIDDEN/.test(forgedPriceSync.body.errors?.[0]?.error || ''), forgedPriceSync.body);
  ok('رفض السعر المصطنع لا ينشئ بيعاً ولا يخصم مخزوناً',
    !db.getSchema().sales.some((s: any) => s.id === 'sale_sync_price_attack') && (await stockOf(P1)) === stockBeforePolicyChecks,
    await stockOf(P1));

  const forgedDiscountSync = await call('/sync/batch', 'POST', {
    sales: [{ id: 'sale_sync_discount_attack', branchId, invoiceNumber: 'INV-OFF-DISCOUNT-ATTACK',
      items: [{ productId: P1, quantity: 1, unitPriceSdg: listPrice }], discountTotalSdg: listPrice,
      paymentMethod: 'cash', createdAt: new Date().toISOString() }],
  }, token, cashierCookie);
  ok('مزامنة الكاشير ترفض الخصم فوق الحد',
    forgedDiscountSync.status === 200 && forgedDiscountSync.body.syncedCount === 0 && /DISCOUNT_LIMIT_EXCEEDED/.test(forgedDiscountSync.body.errors?.[0]?.error || ''), forgedDiscountSync.body);
  ok('رفض الخصم دون اتصال لا ينشئ بيعاً ولا يخصم مخزوناً',
    !db.getSchema().sales.some((s: any) => s.id === 'sale_sync_discount_attack') && (await stockOf(P1)) === stockBeforePolicyChecks,
    await stockOf(P1));
  const tenantAfterPolicy = db.getSchema().tenants.find((t: any) => t.id === tenantId) as any;
  tenantAfterPolicy.settings = { ...tenantAfterPolicy.settings, defaultMaxDiscountPct: priorDiscountCap };
  db.commit(); await db.flush();

  /* مدقّق بلا صلاحية إرجاع */
  const auditor = db.getSchema().employees.find((e: any) => e.tenantId === tenantId && e.role === 'auditor') as any;
  if (auditor) {
    const audLogin = await call('/auth/staff/login', 'POST', { employeeId: auditor.id, pin: auditor.pin }, token);
    ok('دخول المدقّق', audLogin.status === 200 && !!audLogin.body?.token, audLogin.body);
    const denied = await call('/pos/sales/sale_price_ok/refund', 'POST', { reason: 'محاولة' }, token, `sanad_staff_token=${audLogin.body.token}`);
    ok('مدقّق لا يُصدر إشعاراً دائناً', denied.status === 403 && denied.body.error === 'REFUND_FORBIDDEN', denied.body);
  } else {
    console.log('  ⏭️ لا يوجد مدقّق في البيانات الأولية — تُرك التحقق');
  }

  console.log('\n١٢. فاتورة غير صالحة لا تترك أثراً');
  await setStock(P1, 10);
  const bad = await call('/pos/sales', 'POST', {
    id: 'sale_invalid', branchId,
    items: [{ productId: P1, quantity: 1 }, { productId: 'prod_does_not_exist', quantity: 1 }],
  }, token);
  ok('تُرفض 400', bad.status === 400, bad.status);
  ok('المخزون سليم', (await stockOf(P1)) === 10, await stockOf(P1));
  const ghost = await pglite.query(`SELECT id FROM sanad_sales WHERE id='sale_invalid'`);
  ok('لا فاتورة شبحية في القاعدة', ghost.rows.length === 0, ghost.rows);

  console.log(`\n🎉 نجحت ${passed} التحققّات كلها.`);
} finally {
  server.close();
  await pglite.close();
}