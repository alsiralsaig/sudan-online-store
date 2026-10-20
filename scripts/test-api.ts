/**
 * Boots the real Express app against PGlite and drives it over HTTP,
 * proving the middleware persists mutations before the response is sent.
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

const get = async (p: string) => { const r = await fetch(BASE + p); return { code: r.status, body: await r.json().catch(() => null) }; };
const post = async (p: string, b: any) => { const r = await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { code: r.status, body: await r.json().catch(() => null) }; };

console.log('\n=== GET endpoints ===');
for (const [name, path] of [
  ['health', '/api/health'], ['tenants', '/api/tenants/current'], ['products', '/api/products'],
  ['branches', '/api/branches'], ['currencies', '/api/currencies'], ['customers', '/api/pos/customers'],
  ['sales', '/api/pos/sales'], ['employees', '/api/employees'], ['promotions', '/api/promotions'],
  ['admin tenants', '/api/admin/tenants'], ['inventory', '/api/inventory'], ['transfers', '/api/transfers'],
  ['storefront orders', '/api/storefront-orders'], ['expenses', '/api/expenses'], ['audit logs', '/api/audit-logs'],
]) {
  const r = await get(path);
  ok(`${name} → 200`, r.code === 200, `(got ${r.code})`);
}

console.log('\n=== POST: create product ===');
const created = await post('/api/products', { name: 'منتج اختبار API', category: 'اختبار', unit: 'قطعة', sellingPriceSdg: 999, purchaseCost: 700, initialStock: 3 });
ok('create → 200', created.code === 200, `(${created.code})`);
const newId = created.body?.product?.id;

console.log('\n=== Persisted BEFORE response reached us? ===');
const row = (await pglite.query('SELECT * FROM sanad_products WHERE id=$1', [newId])).rows[0] as any;
ok('row already in Postgres', !!row, '(missing — flush did not happen)');
ok('correct name stored', row?.name === 'منتج اختبار API', `(got "${row?.name}")`);

console.log('\n=== Read back through the API ===');
const list = await get('/api/products');
const visible = (list.body?.products || []).some((p: any) => p.id === newId);
ok('visible in GET /api/products', visible);

console.log('\n=== Cold start: brand-new instance, same DB ===');
const { db } = await import('../src/server/db.ts');
await (db as any).refresh();
const afterRefresh = ((db as any).data.products || []).some((p: any) => p.id === newId);
ok('survives instance restart', afterRefresh);

console.log('\n=== Concurrency: 5 parallel writes, no lost updates ===');
await Promise.all([1, 2, 3, 4, 5].map((i) =>
  post('/api/products', { name: `متوازي ${i}`, sellingPriceSdg: 100 + i })
));
const parallel = (await pglite.query(`SELECT COUNT(*)::int AS n FROM sanad_products WHERE name LIKE 'متوازي%'`)).rows[0] as any;
ok('all 5 parallel writes stored', parallel.n === 5, `(got ${parallel.n})`);

console.log(`\n${'='.repeat(46)}\nالنتيجة: ${pass} نجح، ${fail} فشل\n${'='.repeat(46)}`);
server.close();
process.exit(fail === 0 ? 0 : 1);
