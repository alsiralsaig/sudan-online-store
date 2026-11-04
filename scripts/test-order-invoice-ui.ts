/**
 * Browser regression for the merchant invoice flow (isolated PGlite + real API).
 *   npm run build && npm run test:order-invoice-ui
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import jpeg from 'jpeg-js';
import { setSqlClient } from '../src/server/pg.ts';

process.env.SANAD_AUTH_SECRET = 'order-invoice-ui-test-secret-not-for-production';
process.env.NODE_ENV = 'test';
const pglite = new PGlite();
setSqlClient({ query: async (text: string, params?: any[]) => {
  const r = await pglite.query(text, params);
  return { rows: r.rows as any[], rowCount: r.affectedRows ?? null };
} });
const { createApp } = await import('../server.ts');
const { db } = await import('../src/server/db.ts');
const { newMerchantCode, merchantCodeHash } = await import('../src/server/securitySessions.ts');
await db.init();
const schema = db.getSchema() as any;
const sellerId = 'tenant_alrowad', buyerId = 'tenant_nile_boutique';
schema.tenants.find((t: any) => t.id === sellerId).accountSegment = 'supplier';
const buyer = schema.tenants.find((t: any) => t.id === buyerId);
buyer.accountSegment = 'retailer'; buyer.isVip = true;
const product = schema.products.find((p: any) => p.tenantId === sellerId);
product.sellingPriceSdg = 125000; product.minOrderQty = 0;
const code = newMerchantCode();
db.setMerchantCode(sellerId, merchantCodeHash(code)!);
const order: any = {
  id: 'po_ui_test', orderNumber: 'PO-20261103-6116',
  buyerTenantId: buyerId, buyerName: buyer.tradeName, buyerPhone: '0928887777',
  sellerTenantId: sellerId, sellerName: schema.tenants.find((t: any) => t.id === sellerId).tradeName,
  sellerSegment: 'supplier',
  items: [{ productId: product.id, productName: 'سكر كنانة 10 كجم', unit: 'كيس', quantity: 5, unitPriceSdg: 125000, totalSdg: 625000 }],
  totalSdg: 625000, status: 'accepted', paymentMethod: 'bankak', paymentCurrency: 'USD', paymentExchangeRate: 10500,
  note: 'تسليم قبل المغرب', createdAt: '2026-11-03T10:00:00.000Z', updatedAt: '2026-11-03T10:30:00.000Z',
};
schema.supplyOrders.unshift(order);
db.commit(); await db.flush();
const server = createApp().listen(0, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const login = await fetch(base + '/api/auth/merchant/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
const { token } = await login.json() as any;
const browser = await chromium.launch({ headless: true });
let passed = 0;
const ok = (name: string, c: unknown) => { assert.ok(c, name); passed++; console.log(`  ✅ ${name}`); };

/** يفك أول صورة JPEG مضمّنة في PDF ويتأكد أنها ورقة بيضاء عليها حبر، لا صفحة سوداء. */
function assertPdfHasVisibleInvoice(pdfPath: string) {
  const buf = fs.readFileSync(pdfPath);
  assert.ok(buf.subarray(0, 5).toString() === '%PDF-', 'PDF header');
  const start = buf.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
  const end = buf.indexOf(Buffer.from([0xff, 0xd9]), start);
  assert.ok(start >= 0 && end > start, 'PDF contains a JPEG page image');
  const img = jpeg.decode(buf.subarray(start, end + 2), { useTArray: true, maxMemoryUsageInMB: 512 });
  assert.ok(img.width > 500 && img.height > 500, 'PDF page image is A4-sized');
  let dark = 0, ink = 0, white = 0, samples = 0;
  for (let y = 0; y < img.height; y += 6) {
    for (let x = 0; x < img.width; x += 6) {
      const i = (y * img.width + x) * 4;
      const luma = 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
      samples++;
      if (luma < 80) dark++;
      if (luma < 245) ink++;
      if (luma > 245) white++;
    }
  }
  assert.ok(white / samples > 0.55, `PDF page is mostly white (white=${(white / samples).toFixed(2)})`);
  assert.ok(dark / samples < 0.35, `PDF page is not black (dark=${(dark / samples).toFixed(2)})`);
  assert.ok(ink / samples > 0.01, `PDF page has invoice ink (ink=${(ink / samples).toFixed(2)})`);
}

try {
  for (const width of [360, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
    await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>WhatsApp</title>' }));
    const page = await context.newPage();
    await page.addInitScript(([t, tenant]) => {
      localStorage.setItem('sanad_merchant_token', t as string);
      localStorage.setItem('sanad_tenant_id', tenant as string);
      localStorage.setItem('sanad.pushHint.hidden.v1', '1');
      localStorage.setItem('sanad_theme', 'dark');
      // سجّل استدعاء الطباعة في كل إطار (الرئيسي ومستند الفاتورة المعزول).
      (window as any).print = () => {
        (window as any).__printed = true;
        (window.top as any).__invoicePrinted = ((window.top as any).__invoicePrinted || 0) + 1;
      };
    }, [token, sellerId]);
    await page.goto(base + '/?app=merchant&tab=links', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /إصدار الفاتورة/ }).waitFor({ timeout: 30000 });
    ok(`${width}px: one invoice button on card`, await page.getByRole('button', { name: /إصدار الفاتورة/ }).count() === 1);
    ok(`${width}px: no page horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.getByRole('button', { name: /إصدار الفاتورة/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    ok(`${width}px: server invoice number`, (await dialog.textContent()).includes('PUR-2026-'));
    ok(`${width}px: foreign total`, await dialog.getByTestId('foreign-total').textContent() === '59.52 USD');
    ok(`${width}px: invoice table fits without inner scroll`, await page.evaluate(() => {
      const body = document.querySelector('[data-testid="invoice-body"]') as HTMLElement;
      const table = body.querySelector('table') as HTMLElement;
      return table.scrollWidth <= table.clientWidth + 1 && body.scrollWidth <= body.clientWidth + 1;
    }));
    ok(`${width}px: actions are below the invoice body`, await page.evaluate(() => {
      const body = document.querySelector('[data-testid="invoice-body"]') as HTMLElement;
      const footer = body.nextElementSibling as HTMLElement;
      return footer.getBoundingClientRect().top >= body.getBoundingClientRect().bottom - 1;
    }));
    ok(`${width}px: no prompt`, await page.evaluate(() => !document.body.innerText.includes('رقم فاتورتي')));
    ok(`${width}px: exactly one print button`, await dialog.getByRole('button', { name: /طباعة/ }).count() === 1);
    ok(`${width}px: no second inline-print button`, await dialog.getByRole('button', { name: 'اطبع من هذه الصفحة' }).count() === 0);

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await dialog.getByRole('button', { name: 'PDF', exact: true }).click();
    const download = await downloadPromise;
    ok(`${width}px: PDF downloads`, download.suggestedFilename().toLowerCase().endsWith('.pdf'));
    const pdfPath = `/tmp/sanad-invoice-${width}.pdf`;
    await download.saveAs(pdfPath);
    assertPdfHasVisibleInvoice(pdfPath);
    ok(`${width}px: PDF pixels are a white invoice, not a black page`, true);

    await dialog.getByRole('button', { name: 'طباعة', exact: true }).click();
    await page.waitForFunction(() => (window as any).__invoicePrinted >= 1, { timeout: 15000 });
    ok(`${width}px: single print button opens isolated A4 print document`, await page.evaluate(() => {
      const f = document.querySelector('iframe[data-testid="invoice-print-frame"]') as HTMLIFrameElement;
      const doc = f.contentDocument!;
      const bg = getComputedStyle(doc.body).backgroundColor;
      return doc.body.innerText.includes('PUR-2026-') && (bg === 'rgb(255, 255, 255)' || bg === 'rgba(0, 0, 0, 0)');
    }));
    ok(`${width}px: print keeps modal open`, await dialog.isVisible());

    const popupPromise = page.waitForEvent('popup', { timeout: 15000 });
    await dialog.getByRole('link', { name: 'نسخة لصاحب المتجر' }).click();
    const popup = await popupPromise;
    await popup.waitForURL('https://wa.me/**', { timeout: 15000 }).catch(() => {});
    ok(`${width}px: owner copy opens WhatsApp send`, popup.url().startsWith('https://wa.me/'));
    await popup.close().catch(() => {});
    await dialog.getByRole('status').filter({ hasText: 'تم نسخ النص وحفظ نسخة' }).waitFor({ timeout: 15000 });
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    ok(`${width}px: owner copy copies full invoice text`, copied.includes('PUR-2026-') && copied.includes('625,000'));
    const feed = await fetch(base + '/api/notifications?app=merchant', { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()) as any;
    ok(`${width}px: owner copy saved in server notifications`, (feed.notifications || feed || []).some((n: any) => n.kind === 'invoice_copy' && n.body.includes('PUR-2026-')));

    ok(`${width}px: alert banner does not cover the invoice`, await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="إغلاق الفاتورة"]') as HTMLElement;
      const r = btn.getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!el && (btn === el || btn.contains(el));
    }));
    await page.screenshot({ path: `/tmp/sanad-invoice-${width}.png`, fullPage: false });
    await page.waitForFunction(() => {
      const close = document.querySelector('[aria-label="إغلاق الفاتورة"]') as HTMLButtonElement | null;
      return !!close && !close.disabled;
    }, { timeout: 15000 });
    await page.bringToFront();
    await page.keyboard.press('Escape');
    ok(`${width}px: Escape closes dialog`, await page.getByRole('dialog').count() === 0);
    await context.close();
  }

  // Forced fallback: iframe print unavailable -> same-page A4 print, still one button.
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  await page.addInitScript(([t, tenant]) => {
    localStorage.setItem('sanad_merchant_token', t as string);
    localStorage.setItem('sanad_tenant_id', tenant as string);
    localStorage.setItem('sanad.pushHint.hidden.v1', '1');
    (window as any).print = () => {
      if (window !== window.top) throw new Error('iframe print blocked');
      (window as any).__printed = true;
    };
  }, [token, sellerId]);
  await page.goto(base + '/?app=merchant&tab=links', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /إصدار الفاتورة/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'طباعة', exact: true }).click();
  await page.waitForFunction(() => (window as any).__printed === true, { timeout: 15000 });
  ok('fallback: one button still prints via same-page A4 host', await page.evaluate(() => {
    const host = document.getElementById('sanad-inline-print');
    return !!host && document.body.classList.contains('sanad-invoice-printing') && host.innerText.includes('PUR-2026-');
  }));
  await context.close();
  // Android wrapper/TWA: print uses AndroidApp.print, PDF uses HTTPS open, owner uses WhatsApp.
  const androidContext = await browser.newContext({
    viewport: { width: 360, height: 800 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 SanadMerchant/1.0.8',
  });
  await androidContext.route('**/api/supply-orders/*/invoice-pdf', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, url: 'https://files.example/sanad-invoice.pdf', fileName: 'Sanad-PUR.pdf' }),
  }));
  const androidPage = await androidContext.newPage();
  await androidPage.addInitScript({ content: `
    localStorage.setItem('sanad_merchant_token', ${JSON.stringify(token)});
    localStorage.setItem('sanad_tenant_id', ${JSON.stringify(sellerId)});
    localStorage.setItem('sanad.pushHint.hidden.v1', '1');
    window.AndroidApp = {
      print: function () { window.__androidPrinted = true; },
      openUrl: function (url) { window.__openedUrl = url; }
    };
  ` });
  await androidPage.goto(base + '/?app=merchant&tab=links', { waitUntil: 'domcontentloaded' });
  await androidPage.getByRole('button', { name: /إصدار الفاتورة/ }).click();
  const androidDialog = androidPage.getByRole('dialog');
  await androidDialog.waitFor();
  await androidDialog.getByRole('button', { name: 'طباعة', exact: true }).click();
  await androidPage.waitForFunction(() => (window as any).__androidPrinted === true, { timeout: 15000 });
  ok('android: print button calls AndroidApp.print with visible A4 invoice', await androidPage.evaluate(() => {
    const host = document.getElementById('sanad-inline-print');
    return !!host && document.body.classList.contains('sanad-invoice-printing') && host.innerText.includes('PUR-2026-');
  }));
  await androidDialog.getByRole('button', { name: 'PDF', exact: true }).click();
  await androidPage.waitForFunction(() => typeof (window as any).__openedUrl === 'string', { timeout: 30000 });
  ok('android: PDF opens HTTPS file instead of blob', await androidPage.evaluate(() => (window as any).__openedUrl.startsWith('https://')));
  const ownerHref = await androidDialog.getByRole('link', { name: 'نسخة لصاحب المتجر' }).getAttribute('href');
  ok('android: owner button is a WhatsApp link', !!ownerHref && (ownerHref.startsWith('https://wa.me/') || ownerHref.startsWith('whatsapp://send')));
  await androidContext.close();

  console.log(`\nPASS: ${passed} browser invoice checks`);
} finally {
  await browser.close(); server.close(); await pglite.close();
}
