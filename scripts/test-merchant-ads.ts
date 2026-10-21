/** «إعلاناتي» — a merchant must only ever see its own banners and reports. */
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';
const pglite = new PGlite();
setSqlClient({ query: async (t: string, p?: any[]) => { const r = await pglite.query(t, p); return { rows: r.rows as any[], rowCount: r.affectedRows ?? null }; } });
const { createApp } = await import('../server.ts');
const app = createApp(); const server = app.listen(0); const port = (server.address() as any).port;
const B = `http://127.0.0.1:${port}`;
const TENANT_A = 'tenant_alrowad';
const TENANT_B = 'tenant_alsunbula';
const call = async (p: string, i: any = {}, tenant = TENANT_A) => {
  const r = await fetch(B + p, { ...i, headers: { 'x-tenant-id': tenant, 'Content-Type': 'application/json', ...(i.headers || {}) } });
  return { code: r.status, body: await r.json().catch(() => null) };
};
const json = (b: any) => ({ method: 'POST', body: JSON.stringify(b) });
let pass = 0, fail = 0; const ok = (n: string, c: boolean, d = '') => { c ? (pass++, console.log('  ✅ ' + n)) : (fail++, console.log('  ❌ ' + n + ' ' + d)); };

console.log('\n=== tenants exist ===');
const tenants = (await call('/api/admin/tenants')).body.tenants;
ok('two demo tenants', tenants.length >= 2, String(tenants.length));
const a = tenants.find((t: any) => t.id === TENANT_A) || tenants[0];
const bTenant = tenants.find((t: any) => t.id !== a.id)!;

console.log('\n=== admin links a banner to store A ===');
const mine = (await call('/api/admin/market-banners', json({
  title: 'بانر متجر الرواد', imageUrl: '/assets/images/sanad_pos_hero_1792173270140.jpg',
  advertiserName: a.tradeName || a.name, advertiserTenantId: a.id, sortOrder: 1,
}))).body.banner;
ok('created with tenant link', mine.advertiserTenantId === a.id, JSON.stringify(mine.advertiserTenantId));

const other = (await call('/api/admin/market-banners', json({
  title: 'بانر متجر تاني', imageUrl: '/assets/images/sanad_pos_hero_1792173270140.jpg',
  advertiserName: bTenant.tradeName || bTenant.name, advertiserTenantId: bTenant.id, sortOrder: 2,
}))).body.banner;

console.log('\n=== isolation ===');
const listA = (await call('/api/merchant/market-banners', {}, a.id)).body.banners;
const listB = (await call('/api/merchant/market-banners', {}, bTenant.id)).body.banners;
ok('A sees only its banner', listA.length === 1 && listA[0].id === mine.id, JSON.stringify(listA.map((x: any) => x.id)));
ok('B sees only its banner', listB.length === 1 && listB[0].id === other.id);
ok("A can't read B's report", (await call(`/api/merchant/market-banners/${other.id}/report`, {}, a.id)).code === 404);
ok('A can read its own report', (await call(`/api/merchant/market-banners/${mine.id}/report`, {}, a.id)).code === 200);
ok('unknown banner 404', (await call('/api/merchant/market-banners/ghost/report', {}, a.id)).code === 404);

console.log('\n=== merchant sees the very same numbers as the admin ===');
for (let i = 0; i < 3; i++) await call(`/api/market-banners/${mine.id}/impression`, { method: 'POST' });
await call(`/api/market-banners/${mine.id}/click`, { method: 'POST' });
const adminRep = (await call(`/api/admin/market-banners/${mine.id}/report`)).body;
const myRep = (await call(`/api/merchant/market-banners/${mine.id}/report`, {}, a.id)).body;
ok('same totals', adminRep.totals.impressions === myRep.totals.impressions && adminRep.totals.clicks === myRep.totals.clicks,
  `${JSON.stringify(adminRep.totals)} vs ${JSON.stringify(myRep.totals)}`);
ok('same day rows', JSON.stringify(adminRep.days) === JSON.stringify(myRep.days));
ok('CTR ≈ 33.3%', myRep.totals.ctr === 33.3, String(myRep.totals.ctr));

console.log('\n=== unlinking + fallback by advertiser name ===');
await call(`/api/admin/market-banners/${mine.id}`, { method: 'PUT', body: JSON.stringify({ advertiserTenantId: undefined }) });
const afterUnlink = (await call('/api/merchant/market-banners', {}, a.id)).body.banners;
ok('still visible via advertiser name match', afterUnlink.some((x: any) => x.id === mine.id), JSON.stringify(afterUnlink.length));
const switched = (await call('/api/admin/market-banners', json({
  title: 'بانر منقول', imageUrl: '/assets/images/sanad_pos_hero_1792173270140.jpg',
  advertiserName: 'اسم مختلف تماماً', advertiserTenantId: bTenant.id,
}))).body.banner;
ok('unrelated store not affected', (await call('/api/merchant/market-banners', {}, a.id)).body.banners.every((x: any) => x.id !== switched.id));

console.log('\n=== public feed unaffected ===');
const pub = (await call('/api/market-banners')).body.banners;
ok('shoppers still get banners', pub.length >= 3, String(pub.length));
ok('merchant link is not a security boundary on admin routes', (await call('/api/admin/market-banners')).code === 200);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
server.close(); process.exit(fail ? 1 : 0);
