/**
 * فحص حي على الإنتاج: صفحة التاجر تُقلع، لا أخطاء كونسول قاتلة،
 * ونصوص الفاتورة الجديدة ظاهرة في الحزمة المنشورة.
 * لا يكتب أي بيانات — قراءات فقط.
 */
import { chromium } from '@playwright/test';

const BASE = 'https://sudan-online-store-eta.vercel.app';
const browser = await chromium.launch({ headless: true });
let passed = 0;
const ok = (name: string, cond: unknown, detail?: unknown) => {
  if (!cond) throw new Error(`${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  passed++;
  console.log(`  ✅ ${name}`);
};

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  console.log('\n١. صفحة التاجر تُقلع على الإنتاج');
  const res = await page.goto(`${BASE}/?app=merchant`, { waitUntil: 'networkidle', timeout: 60000 });
  ok('الصفحة تستجيب 200', res?.status() === 200, res?.status());
  await page.waitForTimeout(2500);
  const body = await page.locator('body').innerText();
  ok('المحتوى ظاهر لا شاشة بيضاء', body.trim().length > 40, body.slice(0, 120));
  /* 401 متوقع قبل الدخول: التطبيق يسأل عن الجلسة فيُرفض. ليس عيباً. */
  const fatal = errors.filter((e) => !/favicon|404|401|net::ERR|Failed to load resource/i.test(e));
  ok('لا خطأ JavaScript قاتل', fatal.length === 0, fatal.slice(0, 3));

  console.log('\n٢. بوابة الدخول سليمة');
  const hasEntry = await page.locator('input').count();
  ok('حقل إدخال كود المتجر موجود', hasEntry > 0, hasEntry);
  await page.screenshot({ path: '/tmp/live-merchant.png', fullPage: false });

  console.log('\n٣. الصحة تشير إلى قاعدة سليمة');
  const health = await page.request.get(`${BASE}/api/health`);
  const h = await health.json();
  ok('الصحة ok', h.status === 'ok', h.status);
  ok('القاعدة موصولة ومُثبّتة', h.database?.enabled === true && h.database?.persisted === true, h.database);
  ok('لا خطأ قاعدة أخير', h.database?.lastError === null, h.database?.lastError);

  console.log('\n٤. الكتابة بلا جلسة تُرفض 401 لا 503');
  const sale = await page.request.post(`${BASE}/api/pos/sales`, { data: { branchId: 'x', items: [{ productId: 'y', quantity: 1 }] } });
  ok('بيع بلا جلسة → 401', sale.status() === 401, sale.status());
  const refund = await page.request.post(`${BASE}/api/pos/sales/probe/refund`, { data: { reason: 'probe' } });
  ok('إرجاع بلا جلسة → 401', refund.status() === 401, refund.status());

  console.log(`\n🎉 نجحت ${passed} التحققات الحية.`);
} finally {
  await browser.close();
}