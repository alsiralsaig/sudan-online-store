/**
 * Browser regression for the merchant invoice flow (isolated PGlite + real API).
 *   npm run build && npm run test:order-invoice-ui
 */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
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
try {
  for (const width of [360, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, acceptDownloads: true });
    await page.addInitScript(([t, tenant]) => {
      localStorage.setItem('sanad_merchant_token', t as string);
      localStorage.setItem('sanad_tenant_id', tenant as string);
      localStorage.setItem('sanad.pushHint.hidden.v1', '1');
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
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await dialog.getByRole('button', { name: 'PDF', exact: true }).click();
    const download = await downloadPromise;
    console.log('PDF filename:', download.suggestedFilename(), 'url:', download.url());
    ok(`${width}px: PDF downloads`, download.suggestedFilename().toLowerCase().endsWith('.pdf'));
    await download.saveAs(`/tmp/sanad-invoice-${width}.pdf`);
    await page.evaluate(() => { (window as any).open = () => null; (window as any).print = () => { (window as any).__printed = true; }; });
    await dialog.getByRole('button', { name: 'طباعة', exact: true }).click();
    ok(`${width}px: blocked popup keeps modal`, await dialog.isVisible());
    await dialog.getByRole('button', { name: 'اطبع من هذه الصفحة' }).click();
    await page.waitForFunction(() => (window as any).__printed === true);
    ok(`${width}px: inline print fallback`, await page.locator('#sanad-inline-print').count() === 1);
    await dialog.getByRole('button', { name: 'نسخة لصاحب المتجر' }).click();
    await dialog.getByRole('status').filter({ hasText: 'تم حفظ نسخة كاملة' }).waitFor();
    ok(`${width}px: owner copy feedback`, true);
    ok(`${width}px: alert banner does not cover the invoice`, await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="إغلاق الفاتورة"]') as HTMLElement;
      const r = btn.getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!el && (btn === el || btn.contains(el));
    }));
    await page.screenshot({ path: `/tmp/sanad-invoice-${width}.png`, fullPage: false });
    await page.keyboard.press('Escape');
    ok(`${width}px: Escape closes dialog`, await page.getByRole('dialog').count() === 0);
    await page.close();
  }
  console.log(`\nPASS: ${passed} browser invoice checks`);
} finally {
  await browser.close(); server.close(); await pglite.close();
}
