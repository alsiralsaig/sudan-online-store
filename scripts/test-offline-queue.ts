/**
 * سلوك طابور «دون اتصال» في متصفح حقيقي.
 * المطلوب: رفض الخادم (4xx) يظهر للتاجر كخطأ ولا يُحفظ كنجاح،
 * وانقطاع الشبكة أو 5xx فقط يُصفّ بأرقام فواتير ثابتة لا تتكرر.
 *   npm run test:offline-queue
 */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import esbuild from 'esbuild';
import http from 'node:http';

const built = await esbuild.build({
  stdin: {
    contents:
      "export { api, ApiError, isQueueableFailure } from './src/lib/api.ts'; export { getPendingOfflineSales, clearSyncedSales, nextOfflineInvoiceNumber } from './src/lib/indexedDb.ts';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'SanadApi',
  define: { 'import.meta.env': '{}' },
});
const js = built.outputFiles[0].text;

const server = http.createServer((req, res) => {
  if (req.url === '/bundle.js') {
    res.setHeader('content-type', 'text/javascript');
    res.end(js);
    return;
  }
  res.setHeader('content-type', 'text/html');
  res.end('<!doctype html><html lang="ar"><body><script src="/bundle.js"></script></body></html>');
});
server.listen(0, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));

let passed = 0;
function ok(name: string, condition: unknown, detail?: unknown) {
  assert.ok(condition, `${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  passed++;
  console.log(`  ✅ ${name}`);
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
try {
  const page = await browser.newPage();
  const seen: number[] = [];
  let mode: 'reject' | 'fail5xx' | 'abort' | 'ok' = 'reject';

  await page.route('**/api/pos/sales', async (route) => {
    if (mode === 'reject') {
      const status = [409, 400, 401, 403, 422][seen.length] ?? 409;
      seen.push(status);
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({
          error: status === 409 ? 'INSUFFICIENT_STOCK' : 'REJECTED',
          message: status === 409 ? 'الرصيد غير كافٍ' : status === 401 ? 'يلزم تسجيل الدخول' : 'طلب مرفوض',
        }),
      });
      return;
    }
    if (mode === 'fail5xx') {
      seen.push(503);
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'DB_BUSY', message: 'الخادم مشغول' }) });
      return;
    }
    if (mode === 'abort') {
      seen.push(0);
      await route.abort('internetdisconnected');
      return;
    }
    seen.push(200);
    const body = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, sale: body }) });
  });

  await page.goto(`http://127.0.0.1:${(server.address() as any).port}/`);
  await page.waitForFunction(() => !!(window as any).SanadApi);

  const payload = (id: string) => ({
    id, branchId: 'branch',
    items: [{ productId: 'p', productName: 'صنف', quantity: 1, unitPriceSdg: 100, discountSdg: 0, totalSdg: 100, taxRate: 0 }],
    subtotalSdg: 100, grandTotalSdg: 100, taxTotalSdg: 0, discountTotalSdg: 0, paymentMethod: 'cash',
  });

  console.log('\n١. رفض الخادم لا يُعرض كنجاح');
  const rejected = await page.evaluate(async (items: any[]) => {
    const a = (window as any).SanadApi;
    const out: any[] = [];
    for (const p of items) {
      try {
        const r = await a.api.recordSale(p);
        out.push({ id: p.id, threw: false, success: r.success, isOffline: r.isOffline });
      } catch (e: any) {
        out.push({ id: p.id, threw: true, status: e.status, code: e.code, message: e.message, isApiError: e instanceof a.ApiError });
      }
    }
    return { results: out, pending: (await a.getPendingOfflineSales()).length };
  }, ['rej_409', 'rej_400', 'rej_401', 'rej_403', 'rej_422'].map(payload));

  ok('كل أخطاء 4xx تُرمى للتاجر', rejected.results.every((r: any) => r.threw), rejected.results);
  ok('رمز الحالة محفوظ في الخطأ', JSON.stringify(rejected.results.map((r: any) => r.status)) === JSON.stringify([409, 400, 401, 403, 422]), rejected.results);
  ok('نوع الخطأ ApiError', rejected.results.every((r: any) => r.isApiError), rejected.results);
  ok('رسالة الخادم العربية ظاهرة', rejected.results[0].message === 'الرصيد غير كافٍ', rejected.results[0]);
  ok('لا شيء في طابور الانتظار', rejected.pending === 0, rejected.pending);

  console.log('\n٢. عطل الخادم (5xx) يُصفّ لإعادة المحاولة');
  mode = 'fail5xx';
  const queued5 = await page.evaluate(async (p: any) => {
    const a = (window as any).SanadApi;
    const r = await a.api.recordSale(p);
    const pending = await a.getPendingOfflineSales();
    return { success: r.success, isOffline: r.isOffline, number: r.sale.invoiceNumber, pending: pending.length };
  }, payload('queue_503'));
  ok('503 يُحفظ في الطابور', queued5.isOffline === true && queued5.pending === 1, queued5);

  console.log('\n٣. انقطاع الشبكة يُصفّ كذلك');
  mode = 'abort';
  const queuedNet = await page.evaluate(async (p: any) => {
    const a = (window as any).SanadApi;
    const r = await a.api.recordSale(p);
    return { isOffline: r.isOffline, number: r.sale.invoiceNumber, pending: (await a.getPendingOfflineSales()).length };
  }, payload('queue_net'));
  ok('انقطاع الشبكة يُحفظ في الطابور', queuedNet.isOffline === true && queuedNet.pending === 2, queuedNet);

  console.log('\n٤. أرقام الفواتير دون اتصال ثابتة ولا تتكرر');
  const numbers = await page.evaluate(async () => {
    const a = (window as any).SanadApi;
    const list: string[] = [];
    for (let i = 0; i < 250; i++) list.push(await a.nextOfflineInvoiceNumber());
    return list;
  });
  ok('٢٥٠ رقماً بلا تكرار', new Set(numbers).size === 250, new Set(numbers).size);
  ok('الرقم بصيغة مقروءة ثابتة', /^INV-OFF-[A-Z0-9]{7}-\d{8}-\d{4,}$/.test(numbers[0]), numbers[0]);
  const seqOf = (n: string) => Number(n.split('-').pop());
  ok('الأرقام متسلسلة بلا فجوات', seqOf(numbers[249]) - seqOf(numbers[0]) === 249, [numbers[0], numbers[249]]);
  ok('الرفض المتصل لم يستهلك أرقاماً', seqOf(numbers[0]) === 3, numbers[0]);
  const reloaded = await page.evaluate(async () => {
    const a = (window as any).SanadApi;
    return await a.nextOfflineInvoiceNumber();
  });
  ok('العدّاد يستمر بعد الرقم الأخير', Number(reloaded.split('-').pop()) === seqOf(numbers[249]) + 1, reloaded);

  console.log('\n٥. المصنّف يفرّق الرفض من الانقطاع');
  const classify = await page.evaluate(() => {
    const a = (window as any).SanadApi;
    const E = a.ApiError;
    return {
      e400: a.isQueueableFailure(new E('x', 400)),
      e401: a.isQueueableFailure(new E('x', 401)),
      e409: a.isQueueableFailure(new E('x', 409)),
      e408: a.isQueueableFailure(new E('x', 408)),
      e429: a.isQueueableFailure(new E('x', 429)),
      e500: a.isQueueableFailure(new E('x', 500)),
      e503: a.isQueueableFailure(new E('x', 503)),
      net: a.isQueueableFailure(new TypeError('Failed to fetch')),
      offline: a.isQueueableFailure(new Error('OFFLINE_MODE')),
    };
  });
  ok('4xx الموضوعي لا يُصفّ', classify.e400 === false && classify.e401 === false && classify.e409 === false, classify);
  ok('408 و429 يُصفّان', classify.e408 === true && classify.e429 === true, classify);
  ok('5xx والشبكة تُصفّ', classify.e500 && classify.e503 && classify.net && classify.offline, classify);

  console.log('\n٦. البيع المتصل العادي لم يتأثر');
  mode = 'ok';
  const online = await page.evaluate(async (p: any) => {
    const a = (window as any).SanadApi;
    const r = await a.api.recordSale(p);
    return { success: r.success, isOffline: r.isOffline, number: r.sale.invoiceNumber };
  }, payload('online_ok'));
  ok('البيع المتصل يُرجع نتيجة مباشرة', online.success === true && online.isOffline === false, online);

  console.log(`\n🎉 نجحت ${passed} التحققّات كلها.`);
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
}