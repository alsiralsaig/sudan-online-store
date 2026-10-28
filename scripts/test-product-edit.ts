/** Isolated, real HTTP and Postgres-compatible persistence test. Never touches production. */
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';

process.env.SANAD_AUTH_SECRET = 'test-secret-not-production-secret-long-enough-1234567890';
process.env.SANAD_ADMIN_PASSWORD = 'test-admin-password-very-long-enough-12345';

const pg = new PGlite();
setSqlClient({ query: async (sql, params) => {
  const result = await pg.query(sql, params);
  return { rows: result.rows as any[], rowCount: result.affectedRows ?? null };
} });
const { createApp } = await import('../server.ts');
const { db } = await import('../src/server/db.ts');
const { newMerchantCode, merchantCodeHash } = await import('../src/server/securitySessions.ts');

const server = createApp().listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
const tenant = 'tenant_alrowad';
const branch = 'branch_kht_main';

// helpers
async function rawRequest(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() as any, headers: response.headers };
}

async function loginMerchant(code: string) {
  const res = await rawRequest('/auth/merchant/login', 'POST', { code });
  assert.equal(res.status, 200, `merchant login failed: ${JSON.stringify(res.body)}`);
  return res.body.token as string;
}

function authHeaders(token: string, extra: Record<string,string> = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

try {
  // Seed merchant codes for test tenants before login
  const codeAlrowad = newMerchantCode();
  const hashAlrowad = merchantCodeHash(codeAlrowad)!;
  db.setMerchantCode(tenant, hashAlrowad);
  // Ensure other tenant also has a code for cross-tenant test
  const other = db.getSchema().tenants.find((t) => t.id !== tenant);
  let otherCode: string | null = null;
  let otherHash: string | null = null;
  let otherTenantId: string | null = null;
  if (other) {
    otherCode = newMerchantCode();
    otherHash = merchantCodeHash(otherCode)!;
    db.setMerchantCode(other.id, otherHash);
    otherTenantId = other.id;
  }
  db.commit();
  await db.refresh();

  const token = await loginMerchant(codeAlrowad);
  const otherToken = otherCode ? await loginMerchant(otherCode) : null;

  async function request(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
    const response = await fetch(base + path, { method, headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...headers,
    }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  }

  // Unauthenticated should be 401
  let unauth = await rawRequest('/products', 'GET');
  assert.equal(unauth.status, 401, 'unauthenticated should be 401');

  // Admin tenants list should be admin-only (merchant token should get 401)
  let adminListAsMerchant = await request('/tenants/list', 'GET');
  assert.equal(adminListAsMerchant.status, 401, 'merchant should not list all tenants');

  // Merchant flow: create product
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
  res = await request(`/products/${id}`, 'PUT', { sellingPriceSdg: 150 }, { Authorization: `Bearer ${token}`, 'x-actor-role': 'cashier', 'x-actor-id': 'emp_cashier_kht' });
  assert.equal(res.status, 403);
  if (other && otherToken) {
    // Cross-tenant delete should be 404, not leak
    let cross = await fetch(base + `/products/${id}`, { method: 'DELETE', headers: { 'content-type': 'application/json', Authorization: `Bearer ${otherToken}` } });
    assert.equal(cross.status, 404);
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
  // Storefront order remains public (no auth)
  let pub = await rawRequest(`/storefront/${slug}/order`, 'POST', { customerName: 'تجربة', customerPhone: '0900000000', items: [{ productId: id, quantity: 1 }] });
  assert.equal(pub.status, 409);
  db.syncInventoryAlerts(tenant);
  assert(!db.getSchema().inventoryAlerts.some((a) => a.productId === id && a.status !== 'dismissed'));
  console.log('PASS: persisted edits, stock ledger, conflict handling, role and tenant checks, and safe archive');
} finally {
  server.close();
  await pg.close();
}
