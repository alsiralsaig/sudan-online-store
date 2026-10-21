/**
 * End-to-end check for the moderated market-ads flow:
 * submit → pending (invisible publicly) → admin review → public → delete.
 */
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';

const pglite = new PGlite();
setSqlClient({
  query: async (t: string, p?: any[]) => {
    const r = await pglite.query(t, p);
    return { rows: r.rows as any[], rowCount: r.affectedRows ?? null };
  },
});

const { createApp } = await import('../server.ts');
const app = createApp();
const server = app.listen(0);
const port = (server.address() as any).port;
const BASE = `http://127.0.0.1:${port}`;

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✅ ${n}`)) : (fail++, console.log(`  ❌ ${n} ${d}`)); };

const call = async (p: string, init: any = {}) => {
  const r = await fetch(BASE + p, init);
  return { code: r.status, body: await r.json().catch(() => null) };
};
const json = (b: any, headers: any = {}) => ({
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(b),
});

const TOKEN = 'owner-test-token-12345';

console.log('\n=== pricing ===');
const pricing = await call('/api/market-ads/pricing');
ok('pricing endpoint', pricing.code === 200 && typeof pricing.body.pricing.vipFeeSdg === 'number', JSON.stringify(pricing.body));

console.log('\n=== seeded ads are public ===');
const before = await call('/api/market-ads');
ok('public feed loads', before.code === 200 && Array.isArray(before.body.ads));
ok('pending seed ad NOT public', !before.body.ads.some((a: any) => a.id === 'mkt_ad_laptop'));
ok('approved seed ad public', before.body.ads.some((a: any) => a.id === 'mkt_ad_aircon'));

console.log('\n=== validation ===');
const bad = await call('/api/market-ads', json({ title: 'ab' }, { 'x-owner-token': TOKEN }));
ok('short title rejected', bad.code === 400, `${bad.code}`);

console.log('\n=== submit (pending) ===');
const created = await call('/api/market-ads', json({
  title: 'مكيف سبليت ٢ طن نظيف',
  category: 'أجهزة منزلية',
  priceSdg: 185000,
  location: 'كاسلا - السوق الكبير',
  phone: '0912345678',
  imageUrl: '/assets/images/air-conditioner.jpg',
  isVip: true,
  description: 'استخدام سنة، مع ضمان.',
  publisherName: 'عوض محمد',
  ownerToken: TOKEN,
}));
ok('created 201', created.code === 201 || created.code === 200, `${created.code}`);
const ad = created.body?.ad;
ok('status pending', ad?.status === 'pending', ad?.status);
ok('vip fee applied', ad?.feeSdg === 5000, String(ad?.feeSdg));

const pubAfter = await call('/api/market-ads');
ok('pending ad hidden from public', !pubAfter.body.ads.some((a: any) => a.id === ad.id));

const mine = await call('/api/market-ads', { headers: { 'x-owner-token': TOKEN } });
ok('owner sees own pending ad', mine.body.mine.some((a: any) => a.id === ad.id));

console.log('\n=== preview leak protection ===');
const foreign = await call('/api/market-ads', { headers: { 'x-owner-token': 'someone-else-token' } });
ok('other owner cannot see it', !foreign.body.mine.some((a: any) => a.id === ad.id));

console.log('\n=== admin queue ===');
const queue = await call('/api/admin/market-ads?status=pending');
ok('admin pending queue', queue.code === 200 && queue.body.ads.some((a: any) => a.id === ad.id));
ok('fee visible to admin', queue.body.ads.find((a: any) => a.id === ad.id)?.feeSdg === 5000);
ok('counts expose fees due', queue.body.counts.feesDueSdg >= 5000, JSON.stringify(queue.body.counts));

console.log('\n=== approve ===');
const appr = await call(`/api/admin/market-ads/${ad.id}/review`, json({ decision: 'approved', paymentConfirmed: true }));
ok('review approved', appr.code === 200 && appr.body.ad.status === 'approved');
const pubFinal = await call('/api/market-ads');
ok('now public', pubFinal.body.ads.some((a: any) => a.id === ad.id));
const after = await call('/api/admin/market-ads');
ok('feesCollectedSdg counted', after.body.counts.feesCollectedSdg >= 5000, JSON.stringify(after.body.counts));

console.log('\n=== reject path ===');
const second = await call('/api/market-ads', json({
  title: 'دراجة هوائية للبيع', category: 'رياضة', priceSdg: 40000,
  location: 'كاسلا', phone: '0923456789',
  imageUrl: '/assets/images/bicycle.jpg', publisherName: 'سارة', ownerToken: TOKEN,
}));
const rej = await call(`/api/admin/market-ads/${second.body.ad.id}/review`, json({ decision: 'rejected', note: 'الصورة غير واضحة' }));
ok('rejected with note', rej.body.ad.status === 'rejected' && rej.body.ad.rejectionReason === 'الصورة غير واضحة');
const pubRej = await call('/api/market-ads');
ok('rejected not public', !pubRej.body.ads.some((a: any) => a.id === second.body.ad.id));

console.log('\n=== deletion ===');
const wrongTok = await call(`/api/market-ads/${ad.id}`, { method: 'DELETE', headers: { 'x-owner-token': 'bad-token-xxxx' } });
ok('owner delete blocked w/ wrong token', wrongTok.code === 403 || wrongTok.code === 404, `${wrongTok.code}`);
const ownerDel = await call(`/api/market-ads/${ad.id}`, { method: 'DELETE', headers: { 'x-owner-token': TOKEN } });
ok('owner delete works', ownerDel.code === 200);
const adminDel = await call(`/api/admin/market-ads/${second.body.ad.id}`, { method: 'DELETE' });
ok('admin delete works', adminDel.code === 200);
const gone = await call('/api/market-ads');
ok('deleted ad gone', !gone.body.ads.some((a: any) => a.id === ad.id) && !gone.body.mine?.some((a: any) => a.id === ad.id));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
server.close();
process.exit(fail ? 1 : 0);
