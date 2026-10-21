/**
 * Automatic alerts: low stock, subscription expiry, order status → customer.
 */
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';
const pglite = new PGlite();
setSqlClient({ query: async (t: string, p?: any[]) => { const r = await pglite.query(t, p); return { rows: r.rows as any[], rowCount: r.affectedRows ?? null }; } });

const { createApp } = await import('../server.ts');
const { db } = await import('../src/server/db.ts');
const app = createApp(); const server = app.listen(0); const port = (server.address() as any).port;
const B = `http://127.0.0.1:${port}`;
const call = async (p: string, i: any = {}) => { const r = await fetch(B + p, i); return { code: r.status, body: await r.json().catch(() => null) }; };
const json = (b: any, h: any = {}) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(b) });
let pass = 0, fail = 0; const ok = (n: string, c: boolean, d = '') => { c ? (pass++, console.log('  ✅ ' + n)) : (fail++, console.log('  ❌ ' + n + ' ' + d)); };

const TENANT = 'tenant_alrowad';

console.log('\n=== low stock ===');
// drag one product to zero stock, then scan
const product = db.getSchema().products.find((p: any) => p.tenantId === TENANT);
const branch = db.getSchema().branches.find((b: any) => b.tenantId === TENANT);
const inv = db.getSchema().branchInventories.find(
  (i: any) => i.tenantId === TENANT && i.branchId === branch.id && i.productId === product.id
);
if (inv) inv.quantity = 0;
db.commit();
const scan = await call('/api/notifications/scan', json({}));
ok('scan runs', scan.code === 200, JSON.stringify(scan.body));
ok('low stock alert created', (scan.body.lowStock || 0) > 0, String(scan.body.lowStock));

const merchantFeed = await call('/api/notifications?app=merchant');
const lowStockN = merchantFeed.body.notifications.find((n: any) => n.kind === 'low_stock');
ok('merchant sees low_stock', !!lowStockN, JSON.stringify(merchantFeed.body.notifications.map((n: any) => n.kind)));
ok('alert names a product and its stock', !!lowStockN && /المتبقي/.test(lowStockN.body), lowStockN?.body);

console.log('\n=== de-duplication ===');
const scan2 = await call('/api/notifications/scan', json({}));
ok('second scan adds nothing new', (scan2.body.lowStock || 0) === 0, String(scan2.body.lowStock));
const countAfter = (await call('/api/notifications?app=merchant')).body.notifications.filter((n: any) => n.kind === 'low_stock').length;
const countBefore = merchantFeed.body.notifications.filter((n: any) => n.kind === 'low_stock').length;
ok('no duplicate low-stock alerts', countAfter === countBefore, `${countBefore} -> ${countAfter}`);

console.log('\n=== subscription expiry ===');
const tenant = db.getSchema().tenants.find((t: any) => t.id === TENANT);
db.getSchema().tenants.find((t: any) => t.id === TENANT).subscriptionExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
db.commit();
// The HTTP middleware re-reads every table from Postgres before each request,
// which would drop an in-memory-only edit; so the expiry rules are exercised
// directly against the service (the same function the scan route calls).
const { notifySubscriptionExpiry } = await import('../src/server/notifications.ts');
const subSent = await notifySubscriptionExpiry();
const scan3 = { body: { subscriptions: subSent } };
ok('subscription warning sent', (scan3.body.subscriptions || 0) > 0, String(scan3.body.subscriptions));
const subN = db.getNotifications({ app: 'merchant' }).find((n: any) => n.kind === 'subscription');
ok('merchant warned about expiry', !!subN, subN?.title);
ok('message mentions the days left', !!subN && subN.title.includes('3'), subN?.title);

// expired tenant -> admin follow-up (re-fetch in case the request cycle reloaded rows)
const expiredTenant = db.getSchema().tenants.find((t: any) => t.id === TENANT);
expiredTenant.subscriptionExpiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
db.commit();
const { notifySubscriptionExpiry: expireScan } = await import('../src/server/notifications.ts');
await expireScan();
const adminNotifs = db.getNotifications({ app: 'admin' });
ok('admin notified of expired tenant', adminNotifs.some((n: any) => n.kind === 'subscription' && n.title.includes('منتهٍ')), JSON.stringify(adminNotifs.map((n: any) => n.title).slice(0, 4)));

console.log('\n=== order status -> customer ===');
// shopper places an order with their device token
const storeSlug = db.getSchema().tenants.find((t: any) => t.id === TENANT).slug;
const order = await call(`/api/storefront/${storeSlug}/order`, json({
  customerName: 'زبون الاختبار', customerPhone: '0912000111',
  items: [{ productId: product.id, quantity: 1 }],
}, { 'x-owner-token': 'shopper-device-123' }));
ok('order placed', order.code === 200, JSON.stringify(order.body).slice(0, 80));

const PUT = (p: string, b: any) => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const upd = await call(`/api/storefront-orders/${order.body.order.id}/status`, PUT(`/api/storefront-orders/${order.body.order.id}/status`, { status: 'out_for_delivery' }));
ok('status updated', upd.code === 200, String(upd.code));

const shopperFeed = await call('/api/notifications?app=client', { headers: { 'x-owner-token': 'shopper-device-123' } });
const statusN = shopperFeed.body.notifications.find((n: any) => n.kind === 'order_status' && n.title.includes('الطريق'));
ok('customer notified', !!statusN, JSON.stringify(shopperFeed.body.notifications.map((n: any) => n.title).slice(0, 4)));
ok('links to order tracking', statusN?.linkTab === 'track_order', statusN?.linkTab);

const otherShopper = await call('/api/notifications?app=client', { headers: { 'x-owner-token': 'another-device-999' } });
ok('other devices do not get this order update', !otherShopper.body.notifications.some((n: any) => n.kind === 'order_status' && n.body.includes(order.body.order.orderNumber)));

console.log('\n=== lazy scan throttle ===');
const lazy1 = await call('/api/notifications/scan-lazy', json({}));
const lazy2 = await call('/api/notifications/scan-lazy', json({}));
ok('first lazy scan runs', lazy1.body.success === true);
ok('second is throttled', lazy2.body.skipped === true, JSON.stringify(lazy2.body));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
server.close(); process.exit(fail ? 1 : 0);
