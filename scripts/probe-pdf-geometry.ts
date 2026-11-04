/** قياس هندسة مستند الفاتورة وPDF الناتج — تشخيص القصّ والعرض. */
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

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 851 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [console]', m.text().slice(0, 160)); });
  await page.goto(`http://127.0.0.1:${(server.address() as any).port}/`);
  await page.waitForFunction(() => !!(window as any).Inv);

  const geom = await page.evaluate(async () => {
    const I = (window as any).Inv;
    const model = I.buildOrderInvoice({
      id: 'ord1', orderNumber: 'PO-20261104-3043', invoiceNumber: 'PUR-2026-00001',
      status: 'accepted', createdAt: '2026-11-04T18:23:00.000Z',
      sellerName: 'متجر سبتين', sellerPhone: '0114556141', sellerAddress: 'الدامر',
      buyerName: 'بقاله الرحمه', buyerPhone: '0100246761',
      paymentMethod: 'bankak', paymentCurrency: 'SDG',
      items: [{ productName: 'دقيق ابيض للخبز', quantity: 50, unit: 'حبة', unitPriceSdg: 143780, totalSdg: 7189000 }],
      totalSdg: 7189000,
    }, { sellerStoreName: 'متجر سبتين', sellerPhone: '0114556141', sellerAddress: 'الدامر' });
    const frame = await I.mountInvoiceFrame(model, 'pdf');
    const t = frame.target as HTMLElement;
    const r = t.getBoundingClientRect();
    const cs = frame.win.getComputedStyle(t);
    const out = {
      iframeWidth: frame.iframe.getBoundingClientRect().width,
      docScrollWidth: frame.doc.documentElement.scrollWidth,
      bodyScrollWidth: frame.doc.body.scrollWidth,
      targetWidth: r.width,
      targetHeight: r.height,
      targetScrollWidth: t.scrollWidth,
      padding: cs.padding,
      boxSizing: cs.boxSizing,
      innerViewport: frame.win.innerWidth,
    };
    frame.remove();
    return out;
  });
  console.log('\n=== PDF-mode document geometry ===');
  console.log(JSON.stringify(geom, null, 2));
  console.log('\nA4 portrait @96dpi = 794px wide. Target must fit inside that.');
  console.log('overflow beyond 794 =', geom.targetScrollWidth - 794);
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
}