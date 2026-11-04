/**
 * يولّد PDF فاتورة حقيقياً في متصفح ويحفظه للفحص.
 * يتحقق أن الصفحة A4 طولية وأن يمين الفاتورة غير مقصوص.
 *   npx tsx scripts/test-invoice-pdf.ts
 */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import esbuild from 'esbuild';
import http from 'node:http';
import fs from 'node:fs';

const built = await esbuild.build({
  stdin: {
    contents: `
      export { mountInvoiceFrame } from './src/lib/orderInvoiceDocument.ts';
      export { buildOrderInvoice } from './src/lib/orderInvoice.ts';
      export { downloadOrderInvoicePdf } from './src/lib/orderInvoicePdf.ts';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'Inv',
  define: { 'import.meta.env': '{}' },
});
const js = built.outputFiles[0].text;
const server = http.createServer((req, res) => {
  if (req.url === '/b.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); return; }
  res.setHeader('content-type', 'text/html');
  res.end('<!doctype html><html><body><script src="/b.js"></script></body></html>');
});
server.listen(0, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));

let passed = 0;
const ok = (name: string, cond: unknown, detail?: unknown) => {
  assert.ok(cond, `${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  passed++;
  console.log(`  ✅ ${name}`);
};

const ORDER = {
  id: 'ord1', orderNumber: 'PO-20261104-3043', invoiceNumber: 'PUR-2026-00001',
  status: 'accepted', createdAt: '2026-11-04T18:23:00.000Z',
  sellerName: 'متجر سبتين', sellerPhone: '0114556141', sellerAddress: 'الدامر',
  buyerName: 'بقاله الرحمه', buyerPhone: '0100246761',
  paymentMethod: 'bankak', paymentCurrency: 'SDG',
  items: [{ productName: 'دقيق ابيض للخبز', quantity: 50, unit: 'حبة', unitPriceSdg: 143780, totalSdg: 7189000 }],
  totalSdg: 7189000,
};

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 851 }, acceptDownloads: true });
  await page.goto(`http://127.0.0.1:${(server.address() as any).port}/`);
  await page.waitForFunction(() => !!(window as any).Inv);

  console.log('\n١. المستند يدخل عرض A4 بلا فيض');
  const geom = await page.evaluate(async (order: any) => {
    const I = (window as any).Inv;
    const model = I.buildOrderInvoice(order, { sellerStoreName: order.sellerName });
    const frame = await I.mountInvoiceFrame(model, 'pdf');
    const t = frame.target as HTMLElement;
    const r = t.getBoundingClientRect();
    const out = {
      width: r.width, scrollWidth: t.scrollWidth,
      docScrollWidth: frame.doc.documentElement.scrollWidth,
      boxSizing: frame.win.getComputedStyle(t).boxSizing,
    };
    frame.remove();
    return out;
  }, ORDER);
  ok('عرض المستند 794px بالضبط', geom.width === 794, geom);
  ok('لا فيض أفقي في المستند', geom.scrollWidth <= 794 && geom.docScrollWidth <= 794, geom);
  ok('box-sizing border-box على الجذر', geom.boxSizing === 'border-box', geom.boxSizing);

  console.log('\n٢. توليد PDF حقيقي');
  const downloaded = page.waitForEvent('download', { timeout: 60000 });
  const result = await page.evaluate(async (order: any) => {
    const I = (window as any).Inv;
    const model = I.buildOrderInvoice(order, { sellerStoreName: order.sellerName });
    return await I.downloadOrderInvoicePdf(model);
  }, ORDER);
  ok('التوليد نجح', result.ok === true, result);
  const dl = await downloaded;
  ok('اسم الملف ASCII واضح', /^Sanad-PUR-2026-00001\.pdf$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  fs.mkdirSync('/tmp/pdf-check', { recursive: true });
  await dl.saveAs('/tmp/pdf-check/invoice.pdf');
  ok('الملف محفوظ للفحص', fs.statSync('/tmp/pdf-check/invoice.pdf').size > 5000, fs.statSync('/tmp/pdf-check/invoice.pdf').size);

  console.log('\n٣. صفحة PDF نفسها A4 طولية بلا قصّ');
  const { execFileSync } = await import('node:child_process');
  const probe = execFileSync('python3', ['-c', `
import pymupdf, json
d = pymupdf.open('/tmp/pdf-check/invoice.pdf')
p = d[0]
w, h = p.rect.width, p.rect.height
pm = p.get_pixmap(dpi=72, colorspace=pymupdf.csGRAY)
W, H, s = pm.width, pm.height, pm.samples
minx, maxx = W, -1
for y in range(0, H, 2):
    row = y * W
    for x in range(W):
        if s[row + x] < 245:
            minx = min(minx, x); maxx = max(maxx, x)
print(json.dumps({"pages": len(d), "wmm": w/72*25.4, "hmm": h/72*25.4,
                  "left": minx, "right": W-1-maxx, "W": W}))
`], { encoding: 'utf8' });
  const pg = JSON.parse(probe.trim());
  ok('صفحة واحدة', pg.pages === 1, pg.pages);
  ok('A4 طولي 210×297مم', Math.abs(pg.wmm - 210) < 1 && Math.abs(pg.hmm - 297) < 1, pg);
  ok('الطول أكبر من العرض (طولية)', pg.hmm > pg.wmm, pg);
  ok('هامش يمين ويسار متوازن — لا قصّ', Math.abs(pg.left - pg.right) <= 6 && pg.left > 10 && pg.right > 10, pg);

  console.log(`\n🎉 نجحت ${passed} التحققات كلها.`);
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
}