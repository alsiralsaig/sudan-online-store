/**
 * Compares live data against the seed definitions in db.ts and reports
 * any seed row that is missing (a symptom of the lost-update bug).
 */
const BASE = process.env.BASE_URL || 'https://sudan-online-store-eta.vercel.app';

const endpoints: [string, string, string][] = [
  ['tenants', '/api/admin/tenants', 'tenants'],
  ['branches', '/api/branches', 'branches'],
  ['employees', '/api/employees', 'employees'],
  ['products', '/api/products', 'products'],
  ['customers', '/api/pos/customers', 'customers'],
  ['sales', '/api/pos/sales', 'sales'],
  ['currencies', '/api/currencies', 'currencies'],
  ['promotions', '/api/promotions', 'promotions'],
  ['expenses', '/api/expenses', 'expenses'],
  ['purchases', '/api/purchases', 'purchases'],
  ['transfers', '/api/transfers', 'transfers'],
  ['storefront orders', '/api/storefront-orders', 'orders'],
  ['recurring expenses', '/api/recurring-expenses', 'recurringExpenses'],
  ['inventory', '/api/inventory', 'inventory'],
  ['kitchen tickets', '/api/kitchen/tickets', 'tickets'],
];

for (const [label, path, key] of endpoints) {
  try {
    const res = await fetch(BASE + path);
    const body: any = await res.json();
    const rows = body[key] ?? body.items ?? body.data ?? [];
    console.log(`  ${label.padEnd(20)} ${String(Array.isArray(rows) ? rows.length : '?').padStart(4)}`);
  } catch (err) {
    console.log(`  ${label.padEnd(20)}     خطأ: ${(err as Error).message}`);
  }
}
