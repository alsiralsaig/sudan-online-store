/**
 * End-to-end database test.
 *
 * Boots the real Express app on top of PGlite (Postgres 18 compiled to WASM)
 * and exercises the API the way the frontend does — including a simulated
 * cold start, which is exactly the failure mode of the old JSON-file store.
 */
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';

const pglite = new PGlite();
setSqlClient({
  query: async (text: string, params?: any[]) => {
    const res = await pglite.query(text, params);
    return { rows: res.rows as any[], rowCount: res.affectedRows ?? null };
  },
});

const { db } = await import('../src/server/db.ts');

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name} ${detail}`);
  }
}

console.log('\n=== 1. Schema creation + seeding ===');
await db.init();
const schema = db.getSchema() as any;
check('tenants seeded', schema.tenants.length > 0, `(${schema.tenants?.length})`);
check('products seeded', schema.products.length > 0, `(${schema.products?.length})`);
check('branches seeded', schema.branches.length > 0, `(${schema.branches?.length})`);

console.log('\n=== 2. Tables really exist in Postgres ===');
const tables = await pglite.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
);
const tableNames = tables.rows.map((r: any) => r.table_name);
check('27 tables created', tableNames.length === 27, `(got ${tableNames.length})`);
check('products table present', tableNames.includes('sanad_products'));
check('sales table present', tableNames.includes('sanad_sales'));

console.log('\n=== 3. Row-level persistence ===');
const countBefore = (await pglite.query('SELECT COUNT(*)::int AS n FROM sanad_products')).rows[0] as any;
check('seed rows written to sanad_products', countBefore.n > 0, `(${countBefore.n})`);

console.log('\n=== 4. Write through the app layer, then cold start ===');
const tenantId = schema.tenants[0].id;
schema.products.push({
  id: 'prod_persist_test',
  tenantId,
  name: 'منتج اختبار الحفظ',
  sku: 'SKU-TEST-1',
  barcode: '1234567890',
  category: 'اختبار',
  unit: 'قطعة',
  purchaseCost: 1000,
  costCurrency: 'SDG',
  sellingPriceSdg: 1500,
  minStockAlert: 2,
  isActive: true,
  createdAt: new Date().toISOString(),
});
db.commit();
await db.flush();

const inDb = (await pglite.query(
  `SELECT * FROM sanad_products WHERE id = $1`, ['prod_persist_test']
)).rows[0] as any;
check('row reached Postgres', !!inDb, '(not found)');
check('Arabic text round-trips', inDb?.name === 'منتج اختبار الحفظ', `(got "${inDb?.name}")`);
check('numbers keep their type', inDb?.sellingPriceSdg === 1500, `(got ${typeof inDb?.sellingPriceSdg})`);

// Simulate a fresh lambda: brand-new in-memory instance, same database.
const fresh = new (Object.getPrototypeOf(db).constructor as any)();
await fresh.init();
const freshSchema = fresh.getSchema() as any;
const found = freshSchema.products.find((p: any) => p.id === 'prod_persist_test');
check('survives a cold start', !!found, '(row lost)');
check('surviving row is intact', found?.name === 'منتج اختبار الحفظ');

console.log('\n=== 5. Deletes propagate ===');
freshSchema.products = freshSchema.products.filter((p: any) => p.id !== 'prod_persist_test');
fresh.commit();
await fresh.flush();
const gone = (await pglite.query(
  `SELECT * FROM sanad_products WHERE id = $1`, ['prod_persist_test']
)).rows[0];
check('deleted row is removed from Postgres', !gone);

console.log('\n=== 6. Nested objects survive jsonb columns ===');
const tenantRow = (await pglite.query('SELECT * FROM sanad_tenants LIMIT 1')).rows[0] as any;
check('tenant settings stored as object', typeof tenantRow.settings === 'object' && tenantRow.settings !== null);

const saleRow = (await pglite.query('SELECT * FROM sanad_sales LIMIT 1')).rows[0] as any;
check('sale items array preserved', Array.isArray(saleRow?.items), `(got ${typeof saleRow?.items})`);

console.log('\n=== 7. Unknown/new fields are not lost ===');
const t2 = fresh.getSchema() as any;
const targetTenantId = t2.tenants[0].id;
t2.tenants[0].brandNewField = { hello: 'world' };
fresh.commit();
await fresh.flush();
const again = new (Object.getPrototypeOf(db).constructor as any)();
await again.init();
const reloaded = (again.getSchema() as any).tenants.find((t: any) => t.id === targetTenantId);
check('new field persisted via __extra', reloaded?.brandNewField?.hello === 'world', `(got ${JSON.stringify(reloaded?.brandNewField)})`);

console.log(`\n${'='.repeat(50)}`);
console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
console.log('='.repeat(50));

process.exit(failed === 0 ? 0 : 1);
