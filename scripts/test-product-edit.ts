/** Isolated, real HTTP and Postgres-compatible persistence test. Never touches production. */
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';

const pg = new PGlite();
setSqlClient({ query: async (sql, params) => {
  const result = await pg.query(sql, params);
  return { rows: result.rows as any[], rowCount: result.affectedRows ?? null };
} });
const { createApp } = await import('../server.ts');
const { db } = await import('../src/server/db.ts');
const server = createApp().listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
const tenant = 'tenant_alrowad';
const branch = 'branch_kht_main';
async function request(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(base + path, { method, headers: {
    'content-type': 'application/json', 'x-tenant-id': tenant, 'x-actor-id': 'emp_owner_rowad', 'x-actor-role': 'owner', ...headers,
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() as any };
}
try {
  let res = await request('/products', 'POST', { name: 'صنف تجريبي', barcode: '1234567890123', unit: 'حبة', sellingPriceSdg: 90, purchaseCost: 50, minStockAlert: 2, initialStock: 7, branchId: branch });
  assert.equal(res.status, 200);
  const id = res.body.product.id;
  res = await request(`/products/${id}`, 'PUT', { name: 'اسم معدّل', sellingPriceSdg: 120, minStockAlert: 0, branchId: branch, expectedStock: 7, stockQuantity: 12, imageUrl: '/api/media/test' });
  assert.equal(res.status, 200);
  await db.refresh();
  let product = db.getSchema().products.find((p) => p.id === id);
  assert.equal(product?.name, 'اسم معدّل');
  assert.equal(product?.sellingPriceSdg, 120);
  assert.equal(product?.minimumStock, 0);
  assert.equal(db.getProductStock(tenant, branch, id), 12);
  assert(db.getSchema().stockMovements.some((m) => m.productId === id && m.quantityDelta === 5 && m.type === 'adjustment'));
  res = await request(`/products/${id}`, 'PUT', { name: 'يجب ألا يُحفظ', branchId: branch, expectedStock: 7, stockQuantity: 3 });
  assert.equal(res.status, 409);
  await db.refresh();
  assert.equal(db.getSchema().products.find((p) => p.id === id)?.name, 'اسم معدّل');
  res = await request(`/products/${id}`, 'PUT', { purchaseCost: null });
  assert.equal(res.status, 400);
  res = await request(`/products/${id}`, 'PUT', { sellingPriceSdg: 150 }, { 'x-actor-role': 'cashier', 'x-actor-id': 'emp_cashier_kht' });
  assert.equal(res.status, 403);
  const other = db.getSchema().tenants.find((t) => t.id !== tenant);
  if (other) {
    res = await request(`/products/${id}`, 'DELETE', undefined, { 'x-tenant-id': other.id, 'x-actor-id': 'missing' });
    assert.equal(res.status, 404);
  }
  res = await request(`/products/${id}`, 'DELETE');
  assert.equal(res.status, 200);
  res = await request('/products');
  assert(!res.body.products.some((p: any) => p.id === id));
  await db.refresh();
  product = db.getSchema().products.find((p) => p.id === id);
  assert.equal(product?.isActive, false);
  assert.equal(db.getProductStock(tenant, branch, id), 12);
  assert(db.getSchema().stockMovements.some((m) => m.productId === id));
  res = await request('/pos/sales', 'POST', { branchId: branch, items: [{ productId: id, quantity: 1, unitPriceSdg: 120 }] });
  assert.equal(res.status, 409);
  const slug = db.getTenant(tenant)?.slug;
  assert(slug);
  res = await request(`/storefront/${slug}/order`, 'POST', { customerName: 'تجربة', customerPhone: '0900000000', items: [{ productId: id, quantity: 1 }] });
  assert.equal(res.status, 409);
  db.syncInventoryAlerts(tenant);
  assert(!db.getSchema().inventoryAlerts.some((a) => a.productId === id && a.status !== 'dismissed'));
  console.log('PASS: persisted edits, stock ledger, conflict handling, role and tenant checks, and safe archive');
} finally {
  server.close();
  await pg.close();
}
