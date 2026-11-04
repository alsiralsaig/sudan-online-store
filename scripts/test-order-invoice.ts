/**
 * Regression tests for merchant supply invoices.
 * Runs the real Express API on isolated PGlite — never touches production.
 *   npm run test:order-invoice
 */
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';

process.env.SANAD_AUTH_SECRET = 'order-invoice-test-secret-not-for-production-123456';
process.env.SANAD_ADMIN_PASSWORD = 'order-invoice-test-admin';
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
const webpush = (await import('web-push')).default;
const sentPush: { endpoint: string; payload: any }[] = [];
(webpush as any).sendNotification = async (sub: any, payload: string) => {
  sentPush.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
};
const keys = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;

await db.init();
const schema = db.getSchema() as any;
const sellerId = 'tenant_alrowad';
const buyerId = 'tenant_nile_boutique';
const outsiderId = 'tenant_outside_test';
schema.tenants.find((t: any) => t.id === sellerId).accountSegment = 'supplier';
const buyer = schema.tenants.find((t: any) => t.id === buyerId);
buyer.accountSegment = 'retailer'; buyer.isVip = true;
schema.tenants.push({ ...buyer, id: outsiderId, slug: 'outside-test', name: 'متجر خارجي', tradeName: 'متجر خارجي', merchantCodeHash: undefined, merchantCodeDisplay: undefined });
schema.branches.push({ id: 'branch_outside_test', tenantId: outsiderId, name: 'فرع خارجي', code: 'OUT', city: 'الخرطوم', address: '', phone: '', isMain: true, isActive: true });
const product = schema.products.find((p: any) => p.tenantId === sellerId);
product.sellingPriceSdg = 125000;
product.minOrderQty = 0;
const codes: Record<string, string> = {};
for (const id of [sellerId, buyerId, outsiderId]) {
  const code = newMerchantCode();
  codes[id] = code;
  db.setMerchantCode(id, merchantCodeHash(code)!);
}
db.commit(); await db.flush();

const server = createApp().listen(0, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
async function call(path: string, method = 'GET', body?: any, token?: string, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() as any };
}
let passed = 0;
function ok(name: string, condition: unknown, detail?: unknown) {
  assert.ok(condition, `${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
  passed++; console.log(`  ✅ ${name}`);
}

try {
  const tokens: Record<string, string> = {};
  for (const id of [sellerId, buyerId, outsiderId]) {
    const login = await call('/auth/merchant/login', 'POST', { code: codes[id] });
    ok(`login ${id}`, login.status === 200, login.body);
    tokens[id] = login.body.token;
  }
  ok('unauthenticated issue is 401', (await call('/supply-orders/x/invoice', 'POST', {})).status === 401);
  ok('unauthenticated copy is 401', (await call('/supply-orders/x/invoice-copy', 'POST', {})).status === 401);
  ok('unauthenticated merchant feed is 401', (await call('/notifications?app=merchant')).status === 401);

  const created = await call('/supply-orders', 'POST', {
    sellerTenantId: sellerId,
    items: [{ productId: product.id, quantity: 5 }],
    paymentMethod: 'bankak', paymentCurrency: 'USD', paymentExchangeRate: 10500,
    note: 'تسليم قبل المغرب',
  }, tokens[buyerId]);
  ok('buyer creates order', created.status === 200, created.body);
  const orderId = created.body.order.id;
  ok('pending order has no invoice', !created.body.order.invoiceNumber);
  ok('pending invoice rejected', (await call(`/supply-orders/${orderId}/invoice`, 'POST', {}, tokens[buyerId])).status === 409);
  ok('outsider cannot accept', (await call(`/supply-orders/${orderId}`, 'PATCH', { status: 'accepted' }, tokens[outsiderId])).status === 403);
  ok('buyer cannot accept', (await call(`/supply-orders/${orderId}`, 'PATCH', { status: 'accepted' }, tokens[buyerId])).status === 403);
  const accepted = await call(`/supply-orders/${orderId}`, 'PATCH', { status: 'accepted', sellerInvoiceNumber: 'CLIENT-FAKE' }, tokens[sellerId]);
  ok('seller accepts', accepted.status === 200, accepted.body);
  ok('client cannot inject invoice number', accepted.body.order.sellerInvoiceNumber === undefined);

  const [issueA, issueB] = await Promise.all([
    call(`/supply-orders/${orderId}/invoice`, 'POST', {}, tokens[buyerId]),
    call(`/supply-orders/${orderId}/invoice`, 'POST', {}, tokens[sellerId]),
  ]);
  ok('concurrent issue succeeds', issueA.status === 200 && issueB.status === 200);
  ok('issue is idempotent', issueA.body.invoiceNumber === issueB.body.invoiceNumber, [issueA.body, issueB.body]);
  ok('server serial format', /^PUR-\d{4}-\d{5}$/.test(issueA.body.invoiceNumber), issueA.body.invoiceNumber);
  const invoiceNumber = issueA.body.invoiceNumber;
  ok('outsider cannot issue', (await call(`/supply-orders/${orderId}/invoice`, 'POST', {}, tokens[outsiderId])).status === 403);

  // Bind two merchant devices and one legacy unbound device.
  for (const [id, endpoint] of [[sellerId, 'https://push.example/seller'], [buyerId, 'https://push.example/buyer'], [outsiderId, 'https://push.example/outside']] as const) {
    const sub = await call('/push/subscribe', 'POST', { app: 'merchant', subscription: { endpoint, keys: { p256dh: 'test', auth: 'test' } }, tenantId: outsiderId }, tokens[id]);
    ok(`subscribe ${id}`, sub.status === 200, sub.body);
  }
  db.savePushSubscription({ app: 'merchant', endpoint: 'https://push.example/legacy', keys: { p256dh: 'test', auth: 'test' } });
  db.commit(); await db.flush();
  sentPush.length = 0;
  const copy = await call(`/supply-orders/${orderId}/invoice-copy`, 'POST', { text: 'CLIENT-FAKE-BODY' }, tokens[sellerId]);
  ok('owner copy succeeds', copy.status === 200, copy.body);
  ok('copy push only to seller device', sentPush.length === 1 && sentPush[0].endpoint === 'https://push.example/seller', sentPush);
  const sellerFeed = await call('/notifications?app=merchant&tenantId=' + outsiderId, 'GET', undefined, tokens[sellerId]);
  const buyerFeed = await call('/notifications?app=merchant', 'GET', undefined, tokens[buyerId]);
  const copyNote = sellerFeed.body.notifications.find((n: any) => n.kind === 'invoice_copy');
  ok('server-generated full copy', copyNote && copyNote.body.includes(invoiceNumber) && copyNote.body.includes('125,000') && copyNote.body.includes('59.52 USD'), copyNote);
  ok('copy ignores client text', !copyNote.body.includes('CLIENT-FAKE-BODY'));
  ok('buyer cannot see seller copy', !buyerFeed.body.notifications.some((n: any) => n.kind === 'invoice_copy'));
  ok('buyer was notified of acceptance', buyerFeed.body.notifications.some((n: any) => n.kind === 'order_status' && n.title.includes('مقبول')));
  ok('cross-tenant read denied', (await call(`/notifications/${copyNote.id}/read`, 'POST', {}, tokens[buyerId])).status === 404);
  ok('cross-tenant delete denied', (await call(`/notifications/${copyNote.id}`, 'DELETE', undefined, tokens[buyerId])).status === 404);
  const copyAgain = await call(`/supply-orders/${orderId}/invoice-copy`, 'POST', {}, tokens[sellerId]);
  ok('copy deduplicated', copyAgain.body.notificationId === copy.body.notificationId);
  const { notify } = await import('../src/server/notifications.ts');
  sentPush.length = 0;
  await notify({ app: 'merchant', kind: 'system', title: 'بلا متجر', body: 'يجب ألا يصل لكل الأجهزة', telegram: false, ntfy: false });
  ok('merchant push without tenant is suppressed', sentPush.length === 0, sentPush);

  const beforeStock = db.getSchema().branchInventories.filter((i: any) => i.tenantId === buyerId && i.branchId === 'branch_psd_main').reduce((n: number, i: any) => n + Number(i.quantity || 0), 0);
  const fulfilled = await call(`/supply-orders/${orderId}`, 'PATCH', { status: 'fulfilled' }, tokens[sellerId]);
  ok('delivery succeeds', fulfilled.status === 200, fulfilled.body);
  ok('delivery keeps invoice number', fulfilled.body.order.invoiceNumber === invoiceNumber);
  ok('purchase created once', db.getSchema().purchases.filter((p: any) => p.supplyOrderId === orderId).length === 1);
  const afterStock = db.getSchema().branchInventories.filter((i: any) => i.tenantId === buyerId && i.branchId === 'branch_psd_main').reduce((n: number, i: any) => n + Number(i.quantity || 0), 0);
  ok('stock received once', afterStock - beforeStock === 5, { beforeStock, afterStock });
  const repeat = await call(`/supply-orders/${orderId}`, 'PATCH', { status: 'fulfilled' }, tokens[sellerId]);
  ok('repeat delivery is unchanged', repeat.body.unchanged === true);
  ok('repeat delivery does not restock', db.getSchema().branchInventories.filter((i: any) => i.tenantId === buyerId && i.branchId === 'branch_psd_main').reduce((n: number, i: any) => n + Number(i.quantity || 0), 0) === afterStock);
  ok('cannot reopen fulfilled order', (await call(`/supply-orders/${orderId}`, 'PATCH', { status: 'accepted' }, tokens[sellerId])).status === 409);
  ok('cannot cancel fulfilled order', (await call(`/supply-orders/${orderId}`, 'PATCH', { status: 'cancelled' }, tokens[buyerId])).status === 409);

  // Cold-start persistence.
  await db.refresh();
  const persisted = db.getSchema().supplyOrders.find((o) => o.id === orderId)!;
  ok('invoice survives refresh', persisted.invoiceNumber === invoiceNumber && persisted.status === 'fulfilled');
  const purchase = db.getSchema().purchases.find((p: any) => p.supplyOrderId === orderId) as any;
  ok('purchase uses same number', purchase.invoiceNumber === invoiceNumber);

  // Pure document parity and safety.
  const { buildOrderInvoice, orderInvoiceText, orderInvoiceHtml, orderInvoiceWhatsAppUrl, normalizeWhatsAppPhone } = await import('../src/lib/orderInvoice.ts');
  const model = buildOrderInvoice(persisted, { sellerStoreName: 'متجر <اختبار>', stampText: 'ختم' });
  const text = orderInvoiceText(model); const html = orderInvoiceHtml(model);
  ok('text and print share foreign total', text.includes('59.52 USD') && html.includes('59.52 USD'));
  ok('print contains currency rate', html.includes('10,500'));
  ok('html escapes store name', html.includes('&lt;اختبار&gt;') && !html.includes('<اختبار>'));
  ok('Sudan phone normalized', normalizeWhatsAppPhone('0912345678') === '249912345678');
  ok('WhatsApp uses international number', orderInvoiceWhatsAppUrl(model).startsWith('https://wa.me/249'));
  console.log(`\nPASS: ${passed} order-invoice checks`);
} finally {
  server.close();
  await pglite.close();
}
