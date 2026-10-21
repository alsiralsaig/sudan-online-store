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

console.log('\n=== impressions + CTR ===');
await call('/api/market-banners/bnr_appliances/impression', { method: 'POST' });
const imp2 = await call('/api/market-banners/bnr_appliances/impression', { method: 'POST' });
ok('single impression increments', imp2.body.impressions === 2, JSON.stringify(imp2.body));
ok('impression on unknown banner 404', (await call('/api/market-banners/nope/impression', { method: 'POST' })).code === 404);

const batch = await call('/api/market-banners/impressions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: ['bnr_cars', 'bnr_groceries'] }),
});
ok('batch counts both', batch.code === 200 && batch.body.counted === 2, JSON.stringify(batch.body));
ok('batch rejects empty list', (await call('/api/market-banners/impressions', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [] }),
})).code === 400);
ok('batch ignores junk ids', (await call('/api/market-banners/impressions', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [123, null, 'ghost'] }),
})).body.counted === 0);

const appl = (await call('/api/admin/market-banners')).body.banners.find((b: any) => b.id === 'bnr_appliances');
ok('impressions stored', appl.impressions === 2, String(appl.impressions));
ok('lastImpressionAt saved', !!appl.lastImpressionAt);

// 4 views + 1 tap on a fresh banner => 25.0% CTR
const measured = (await call('/api/admin/market-banners', json({
  title: 'بانر قياس CTR', imageUrl: '/assets/images/sanad_pos_hero_1792173270140.jpg',
}))).body.banner;
for (let i = 0; i < 4; i++) await call(`/api/market-banners/${measured.id}/impression`, { method: 'POST' });
await call(`/api/market-banners/${measured.id}/click`, { method: 'POST' });
const m = (await call('/api/admin/market-banners')).body.banners.find((b: any) => b.id === measured.id);
const ctr = ((m.clicks || 0) / (m.impressions || 1)) * 100;
ok('CTR = clicks / views', m.clicks === 1 && m.impressions === 4 && ctr.toFixed(1) === '25.0', `${m.clicks}/${m.impressions} = ${ctr.toFixed(1)}%`);
await call(`/api/admin/market-banners/${measured.id}`, { method: 'DELETE' });

const resetAll = await call('/api/admin/market-banners/bnr_appliances/reset-clicks', { method: 'POST' });
ok('reset clears clicks AND views', resetAll.body.banner.clicks === 0 && resetAll.body.banner.impressions === 0);

console.log('\n=== advertiser report ===');
const today = new Date().toISOString().slice(0, 10);
const dayAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const rb = (await call('/api/admin/market-banners', json({
  title: 'بانر تقرير', imageUrl: '/assets/images/sanad_pos_hero_1792173270140.jpg', advertiserName: 'محل التجربة',
}))).body.banner;
for (let i = 0; i < 5; i++) await call(`/api/market-banners/${rb.id}/impression`, { method: 'POST' });
await call(`/api/market-banners/${rb.id}/click`, { method: 'POST' });
await call(`/api/market-banners/${rb.id}/click`, { method: 'POST' });

const rep = await call(`/api/admin/market-banners/${rb.id}/report?from=${dayAgo(6)}&to=${today}`);
ok('report loads', rep.code === 200, JSON.stringify(rep.body).slice(0, 80));
ok('7-day window has 7 rows', rep.body.days.length === 7, String(rep.body.days.length));
ok('totals match counters', rep.body.totals.impressions === 5 && rep.body.totals.clicks === 2,
  `${rep.body.totals.impressions}/${rep.body.totals.clicks}`);
ok('today CTR = 40%', rep.body.days[6].ctr === 40, String(rep.body.days[6].ctr));
ok('empty days filled with zero', rep.body.days[0].impressions === 0 && rep.body.days[0].ctr === 0);
ok('banner meta in report', rep.body.banner.advertiserName === 'محل التجربة');
ok('default range starts at first data day',
  (await call(`/api/admin/market-banners/${rb.id}/report`)).body.from === today);
ok('report for unknown banner 404',
  (await call('/api/admin/market-banners/nope/report')).code === 404);
ok('junk from/to falls back', (await call(`/api/admin/market-banners/${rb.id}/report?from=xx&to=1900-01-01`)).code === 200);

const longRange = await call(`/api/admin/market-banners/${rb.id}/report?from=2020-01-01&to=${today}`);
ok('absurd range is capped (<=400 rows)', longRange.body.days.length <= 400, String(longRange.body.days.length));

const afterReset = await call(`/api/admin/market-banners/${rb.id}/reset-clicks`, { method: 'POST' });
const repAfter = await call(`/api/admin/market-banners/${rb.id}/report?from=${dayAgo(6)}&to=${today}`);
ok('reset wipes report history', afterReset.body.banner.clicks === 0 && repAfter.body.totals.impressions === 0);
await call(`/api/admin/market-banners/${rb.id}`, { method: 'DELETE' });

console.log('\n=== delete ===');
ok('deleted', (await call(`/api/admin/market-banners/${id}`, { method: 'DELETE' })).code === 200);
ok('gone from public feed', !(await call('/api/market-banners')).body.banners.some((b: any) => b.id === id));
ok('unknown id 404', (await call('/api/admin/market-banners/does_not_exist', { method: 'DELETE' })).code === 404);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
server.close(); process.exit(fail ? 1 : 0);
