/** Market banners: public feed, admin CRUD, ordering, activation, validation. */
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';
const pglite = new PGlite();
setSqlClient({ query: async (t: string, p?: any[]) => { const r = await pglite.query(t, p); return { rows: r.rows as any[], rowCount: r.affectedRows ?? null }; } });
const { createApp } = await import('../server.ts');
const app = createApp(); const server = app.listen(0); const port = (server.address() as any).port;
const B = `http://127.0.0.1:${port}`;
const call = async (p: string, i: any = {}) => { const r = await fetch(B + p, i); return { code: r.status, body: await r.json().catch(() => null) }; };
const json = (b: any) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const put = (b: any) => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
let pass = 0, fail = 0; const ok = (n: string, c: boolean, d = '') => { c ? (pass++, console.log('  ✅ ' + n)) : (fail++, console.log('  ❌ ' + n + ' ' + d)); };

console.log('\n=== seeded banners ===');
const pub = await call('/api/market-banners');
ok('public feed loads', pub.code === 200 && pub.body.banners.length === 3, String(pub.body?.banners?.length));
ok('sorted by order', pub.body.banners[0].sortOrder <= pub.body.banners[1].sortOrder);

console.log('\n=== create ===');
ok('title required', (await call('/api/admin/market-banners', json({ imageUrl: '/x.jpg' }))).code === 400);
ok('image required', (await call('/api/admin/market-banners', json({ title: 'بانر تجريبي' }))).code === 400);

const created = await call('/api/admin/market-banners', json({
  title: 'محل الجودة جلابية',
  subtitle: 'أحدث أنواع التفصيل',
  badge: 'جديد',
  imageUrl: '/assets/images/sanad_pos_hero_1792173270140.jpg',
  advertiserName: 'محل الجودة',
  sortOrder: 0,
}));
ok('created', created.code === 200 && !!created.body.banner.id, JSON.stringify(created.body).slice(0, 80));
const id = created.body.banner.id;

const pub2 = await call('/api/market-banners');
ok('new banner is first (sortOrder 0)', pub2.body.banners[0].id === id);
ok('public count grew', pub2.body.banners.length === 4);

console.log('\n=== update / activate / deactivate ===');
const off = await call(`/api/admin/market-banners/${id}`, put({ active: false }));
ok('deactivated', off.code === 200 && off.body.banner.active === false);
const pub3 = await call('/api/market-banners');
ok('hidden from shoppers', !pub3.body.banners.some((b: any) => b.id === id));
ok('still visible to admin', (await call('/api/admin/market-banners')).body.banners.some((b: any) => b.id === id));

const renamed = await call(`/api/admin/market-banners/${id}`, put({ title: 'عنوان محدّث', active: true }));
ok('title updated', renamed.body.banner.title === 'عنوان محدّث');

console.log('\n=== click tracking ===');
const fresh = (await call('/api/admin/market-banners')).body.banners[0];
ok('new banner starts at 0 clicks', (fresh.clicks ?? 0) === 0);

const c1 = await call(`/api/market-banners/${fresh.id}/click`, { method: 'POST' });
ok('tap increments', c1.code === 200 && c1.body.clicks === 1, JSON.stringify(c1.body));
const c2 = await call(`/api/market-banners/${fresh.id}/click`, { method: 'POST' });
const c3 = await call(`/api/market-banners/${fresh.id}/click`, { method: 'POST' });
ok('increments again', c3.body.clicks === 3, String(c3.body?.clicks));

const adminAfter = (await call('/api/admin/market-banners')).body.banners.find((b: any) => b.id === fresh.id);
ok('admin sees the count', adminAfter.clicks === 3, String(adminAfter.clicks));
ok('last tap timestamp saved', !!adminAfter.lastClickedAt);

const other = (await call('/api/admin/market-banners')).body.banners.find((b: any) => b.id !== fresh.id);
ok('other banners untouched', (other.clicks ?? 0) === 0);

ok('unknown banner click 404', (await call('/api/market-banners/nope/click', { method: 'POST' })).code === 404);

const reset = await call(`/api/admin/market-banners/${fresh.id}/reset-clicks`, { method: 'POST' });
ok('reset zeroes the counter', reset.code === 200 && reset.body.banner.clicks === 0);
ok('paused banner still counts taps', (await call('/api/market-banners/bnr_cars/click', { method: 'POST' })).code === 200);

console.log('\n=== delete ===');
ok('deleted', (await call(`/api/admin/market-banners/${id}`, { method: 'DELETE' })).code === 200);
ok('gone from public feed', !(await call('/api/market-banners')).body.banners.some((b: any) => b.id === id));
ok('unknown id 404', (await call('/api/admin/market-banners/does_not_exist', { method: 'DELETE' })).code === 404);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
server.close(); process.exit(fail ? 1 : 0);
