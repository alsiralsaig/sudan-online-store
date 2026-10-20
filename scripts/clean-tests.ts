/**
 * Removes the products created while verifying the database layer.
 * Uses the same API the app uses, so no direct database access is needed.
 *
 *   BASE_URL=https://sudan-online-store-eta.vercel.app npm run db:clean-tests
 */
const BASE = process.env.BASE_URL || 'https://sudan-online-store-eta.vercel.app';

const TEST_NAME = /^(فحص|منتج اختبار|توازي|Neon|اختبار نهائي|جولة|دقيقA|تأكيد|نهائي|قياس زمن|سرعة|فحص بعد الترحيل)/;

const res = await fetch(`${BASE}/api/products`);
const { products = [] } = (await res.json()) as { products: any[] };
const tests = products.filter((p) => TEST_NAME.test(p.name));

console.log(`إجمالي المنتجات: ${products.length}`);
console.log(`منتجات اختبار: ${tests.length}`);

if (tests.length === 0) {
  console.log('لا شيء لحذفه.');
  process.exit(0);
}

console.log('\nلا توجد نقطة DELETE للمنتجات في الـ API، لذلك الحذف يتم عبر SQL.');
console.log('شغّل scripts/db-clean-tests.sql في Neon SQL Editor، أو:');
console.log('  psql "$DATABASE_URL" -f scripts/db-clean-tests.sql');
process.exit(0);
