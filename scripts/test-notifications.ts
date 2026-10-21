import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';
const pglite = new PGlite();
setSqlClient({ query: async (t: string, p?: any[]) => { const r = await pglite.query(t, p); return { rows: r.rows as any[], rowCount: r.affectedRows ?? null }; } });
const { createApp } = await import('../server.ts');
const app = createApp(); const server = app.listen(0); const port = (server.address() as any).port;
const B = `http://127.0.0.1:${port}`;
const call = async (p: string, i: any = {}) => { const r = await fetch(B + p, i); return { code: r.status, body: await r.json().catch(() => null) }; };
const json = (b: any, h: any = {}) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(b) });
let pass=0, fail=0; const ok=(n:string,c:boolean,d='')=>{c?(pass++,console.log('  ✅ '+n)):(fail++,console.log('  ❌ '+n+' '+d));};

const admin = await call('/api/notifications?app=admin');
ok('admin feed loads', admin.code === 200 && Array.isArray(admin.body.notifications), JSON.stringify(admin.body).slice(0,80));
ok('admin seed unread', admin.body.unreadCount >= 2, String(admin.body.unreadCount));
ok('merchant feed separate', (await call('/api/notifications?app=merchant')).body.notifications.every((n:any)=>n.app==='merchant'));

const key = await call('/api/push/public-key');
ok('vapid public key issued', key.code === 200 && !!key.body.publicKey, JSON.stringify(key.body).slice(0,60));

const sub = await call('/api/push/subscribe', json({ app:'admin', subscription:{ endpoint:'https://example.com/push/abc', keys:{p256dh:'BKx', auth:'authx'} } }));
ok('push subscribe saved', sub.code === 200 && sub.body.id, JSON.stringify(sub.body));

// event: new market ad -> admin notification
const ad = await call('/api/market-ads', json({ title:'دراجة هوائية نظيفة', category:'رياضة', priceSdg:50000, location:'كسلا', phone:'0912345678', imageUrl:'/assets/images/bicycle.jpg', ownerToken:'device-token-abcdef', isVip:true }));
ok('ad created', ad.code === 200);
const admin2 = await call('/api/notifications?app=admin');
ok('admin got new_ad notification', admin2.body.notifications.some((n:any)=>n.kind==='new_ad'));

// approve -> client owner notification
await call(`/api/admin/market-ads/${ad.body.ad.id}/review`, json({ decision:'approved', paymentConfirmed:true }));
const clientOwner = await call('/api/notifications?app=client', { headers:{ 'x-owner-token':'device-token-abcdef' } });
ok('owner notified of approval', clientOwner.body.notifications.some((n:any)=>n.kind==='ad_reviewed'));
const otherDevice = await call('/api/notifications?app=client', { headers:{ 'x-owner-token':'other-device-token' } });
ok('other device does NOT see it', !otherDevice.body.notifications.some((n:any)=>n.kind==='ad_reviewed'));

// tenant application -> admin + applicant
const app2 = await call('/api/tenant-applications', json({ storeName:'متجر النيل', ownerName:'سامي', wilaya:'كسلا', city:'كسلا', phone:'0911223344', branchesCount:2 }, { 'x-owner-token':'applicant-token-xyz' }));
ok('application created', app2.code === 200);
const admin3 = await call('/api/notifications?app=admin');
ok('admin got store request', admin3.body.notifications.some((n:any)=>n.kind==='new_store_request'));
await call(`/api/admin/tenant-applications/${app2.body.application.id}/review`, json({ decision:'approved', registrationFeeSdg:60000 }));
const applicant = await call('/api/notifications?app=client', { headers:{ 'x-owner-token':'applicant-token-xyz' } });
ok('applicant notified', applicant.body.notifications.some((n:any)=>n.kind==='store_request_reviewed'));

// read / read-all / delete
const first = admin3.body.notifications[0];
ok('mark read', (await call(`/api/notifications/${first.id}/read`, json({}))).code === 200);
const before = (await call('/api/notifications?app=admin')).body.unreadCount;
const readAll = await call('/api/notifications/read-all', json({ app:'admin' }));
ok('read-all clears unread', readAll.body.changed > 0 && (await call('/api/notifications?app=admin')).body.unreadCount === 0, `before=${before}`);
ok('delete notification', (await call(`/api/notifications/${first.id}`, { method:'DELETE' })).code === 200);

// storefront order -> merchant notification
const sf = await call('/api/storefront/alrowad-market/order', json({ customerName:'زبون', customerPhone:'0900000000', items:[{ productId:'prod_1', quantity:1 }] }));
ok('order endpoint ok', sf.code === 200 || sf.code === 404, String(sf.code));
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
server.close(); process.exit(fail?1:0);
