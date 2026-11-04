/**
 * Isolated merchant invoice preview (PGlite, no production database).
 *   npm run build && npm run preview:order-invoice
 * Open http://localhost:3000/preview
 */
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';

process.env.SANAD_AUTH_SECRET = 'preview-order-invoice-secret-not-for-production';
process.env.NODE_ENV = 'test';
const pglite = new PGlite();
setSqlClient({ query: async (text: string, params?: any[]) => {
  const r = await pglite.query(text, params);
  return { rows: r.rows as any[], rowCount: r.affectedRows ?? null };
} });
const { createApp } = await import('../server.ts');
const { db } = await import('../src/server/db.ts');
const { merchantCodeHash } = await import('../src/server/securitySessions.ts');
await db.init();
const schema = db.getSchema() as any;
const sellerId = 'tenant_alrowad', buyerId = 'tenant_nile_boutique';
const seller = schema.tenants.find((t: any) => t.id === sellerId);
seller.accountSegment = 'supplier';
seller.phone = '+249 91 234 5678';
seller.address = 'السوق العربي — الخرطوم';
const buyer = schema.tenants.find((t: any) => t.id === buyerId);
buyer.accountSegment = 'retailer'; buyer.isVip = true;
const product = schema.products.find((p: any) => p.tenantId === sellerId);
product.sellingPriceSdg = 125000; product.minOrderQty = 0;
const code = 'SND-TEST-2345';
db.setMerchantCode(sellerId, merchantCodeHash(code)!);
schema.supplyOrders.unshift({
  id: 'po_preview', orderNumber: 'PO-20261103-6116',
  buyerTenantId: buyerId, buyerName: buyer.tradeName, buyerPhone: '0928887777',
  sellerTenantId: sellerId, sellerName: seller.tradeName, sellerSegment: 'supplier',
  sellerPhone: seller.phone, sellerAddress: seller.address,
  items: [{ productId: product.id, productName: 'سكر كنانة 10 كجم', unit: 'كيس', quantity: 5, unitPriceSdg: 125000, totalSdg: 625000 }],
  totalSdg: 625000, status: 'accepted', paymentMethod: 'bankak', paymentCurrency: 'USD', paymentExchangeRate: 10500,
  note: 'تسليم قبل المغرب', createdAt: '2026-11-03T10:00:00.000Z', updatedAt: '2026-11-03T10:30:00.000Z',
});
db.commit(); await db.flush();

const inner = createApp();
const app = express();
app.get('/', (req, res, next) => req.query.app ? next() : res.redirect('/preview'));
app.get('/preview', (_req, res) => {
  res.type('html').send(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>معاينة الفاتورة</title>
  <body style="font-family:Tahoma,sans-serif;padding:2rem">
  <h1>معاينة فاتورة طلب التوريد</h1><p>بيانات تجريبية معزولة — لا تلمس الإنتاج.</p>
  <script>
    fetch('/api/auth/merchant/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:${JSON.stringify(code)}})})
      .then(r=>r.json()).then(d=>{ if(!d.token) throw new Error(d.message||'login failed');
        localStorage.setItem('sanad_merchant_token',d.token); localStorage.setItem('sanad_tenant_id',${JSON.stringify(sellerId)});
        localStorage.setItem('sanad.pushHint.hidden.v1','1'); location.replace('/?app=merchant&tab=links'); })
      .catch(e=>{ document.body.insertAdjacentHTML('beforeend','<p style="color:red">'+e.message+'</p>'); });
  </script></body></html>`);
});
app.use(inner);
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '0.0.0.0', () => console.log(`Invoice preview: http://localhost:${port}/preview`));
const shutdown = () => { server.close(); void pglite.close(); process.exit(0); };
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
