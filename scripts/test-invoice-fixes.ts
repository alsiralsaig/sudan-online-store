/**
 * اختبارات إصلاحات إصدار الفواتير: الحسابات، الاسترداد، رمز QR، وفاتورة التوريد.
 * التشغيل: npm run test:invoice-fixes
 */
import assert from 'node:assert/strict';
import { computeInvoiceTotals, createRefundAllocator, round2, validateInvoiceLine } from '../src/lib/invoiceMath.ts';
import { generateQrSvg, generateZatcaTlvBase64, qrMatrix } from '../src/lib/zatcaQr.ts';
import { buildOrderInvoice, normalizeWhatsAppPhone, orderInvoiceText } from '../src/lib/orderInvoice.ts';

let passed = 0;
const t = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

console.log('الحسابات');
t('الفاصلة العائمة: 3 × 0.1 = 0.3 بالضبط', () => {
  const r = computeInvoiceTotals([{ quantity: 3, unitPrice: 0.1 }]);
  assert.equal(r.subtotal, 0.3);
  assert.equal(r.grandTotal, 0.3);
});
t('الضريبة تُحسب بعد خصم الفاتورة (غير شاملة)', () => {
  const r = computeInvoiceTotals([{ quantity: 2, unitPrice: 1000, taxRate: 15 }], { invoiceDiscount: 200 });
  assert.equal(r.taxTotal, 270);
  assert.equal(r.grandTotal, 2070); // قبل الإصلاح: 2100
});
t('الأسعار الشاملة للضريبة', () => {
  const r = computeInvoiceTotals([{ quantity: 1, unitPrice: 1150, taxRate: 15 }], { pricesIncludeVat: true });
  assert.equal(r.taxTotal, 150);
  assert.equal(r.grandTotal, 1150);
});
t('خصم أكبر من المجموع يُقصّ إلى صفر', () => {
  const r = computeInvoiceTotals([{ quantity: 1, unitPrice: 100, taxRate: 15 }], { invoiceDiscount: 999 });
  assert.equal(r.grandTotal, 0);
  assert.equal(r.taxTotal, 0);
});
t('مجموع ضرائب البنود = ضريبة الفاتورة', () => {
  const r = computeInvoiceTotals(
    [{ quantity: 3, unitPrice: 33.33, taxRate: 15 }, { quantity: 7, unitPrice: 12.5, taxRate: 15 }, { quantity: 1, unitPrice: 99, taxRate: 0 }],
    { invoiceDiscount: 17 },
  );
  assert.equal(round2(r.lines.reduce((n, l) => n + l.taxAmount, 0)), r.taxTotal);
});
t('التحقق من البنود: كمية سالبة / NaN / خصم أكبر من القيمة', () => {
  assert.ok(validateInvoiceLine({ quantity: -1 }, 10));
  assert.ok(validateInvoiceLine({ quantity: NaN }, 10));
  assert.ok(validateInvoiceLine({ quantity: 0 }, 10));
  assert.ok(validateInvoiceLine({ quantity: 1, discountSdg: 50 }, 10));
  assert.ok(validateInvoiceLine({ quantity: 1 }, -5));
  assert.equal(validateInvoiceLine({ quantity: 1.5 }, 10), null); // كمية كسرية (كيلو) مسموحة
});

console.log('الاسترداد');
t('استرداد كل البنود = ما دفعه العميل (شامل الضريبة والخصم)', () => {
  const tot = computeInvoiceTotals(
    [{ quantity: 2, unitPrice: 1000, taxRate: 15 }, { quantity: 4, unitPrice: 250, taxRate: 0 }],
    { invoiceDiscount: 300 },
  );
  const items = [
    { totalSdg: tot.lines[0].total, taxAmountSdg: tot.lines[0].taxAmount, quantity: 2 },
    { totalSdg: tot.lines[1].total, taxAmountSdg: tot.lines[1].taxAmount, quantity: 4 },
  ];
  const al = createRefundAllocator({ grandTotalSdg: tot.grandTotal, subtotalSdg: tot.subtotal, discountTotalSdg: tot.discountTotal, taxTotalSdg: tot.taxTotal, items });
  const sum = al.forQty(items[0], 2) + al.forQty(items[1], 4);
  assert.ok(Math.abs(sum - tot.grandTotal) <= 0.02);
  assert.ok(al.forQty(items[0], 1) > 1000); // الاسترداد القديم كان 1000 فقط (بلا ضريبة)
});

console.log('رمز QR');
const parseTlv = (b64: string) => {
  const bytes = Buffer.from(b64, 'base64');
  const out: Record<number, string> = {};
  for (let i = 0; i < bytes.length; ) {
    const tag = bytes[i];
    const len = bytes[i + 1];
    out[tag] = bytes.subarray(i + 2, i + 2 + len).toString('utf8');
    i += 2 + len;
  }
  return out;
};
t('TLV يُفكّ بدقة مع اسم عربي (الطول بالبايت لا بالحروف)', () => {
  const tlv = parseTlv(generateZatcaTlvBase64({ sellerName: 'شركة الرواد للتجارة', taxNumber: '300012345600003', timestamp: '2026-11-04T10:15:00.000Z', totalWithVat: '2070.00', vatTotal: '270.00' }));
  assert.equal(tlv[1], 'شركة الرواد للتجارة');
  assert.equal(tlv[4], '2070.00');
  assert.equal(tlv[5], '270.00');
});
t('قيمة أطول من 255 بايت تُقصّ دون كسر حرف ولا تفسد بقية الحقول', () => {
  const tlv = parseTlv(generateZatcaTlvBase64({ sellerName: 'م'.repeat(300), taxNumber: '1', timestamp: 't', totalWithVat: '9', vatTotal: '8' }));
  assert.ok(Buffer.byteLength(tlv[1]) <= 255);
  assert.ok(!tlv[1].includes('\uFFFD'));
  assert.equal(tlv[2], '1');
  assert.equal(tlv[5], '8');
});
t('المصفوفة: مقاس صحيح وأنماط الباحث في الزوايا الثلاث', () => {
  const m = qrMatrix(generateZatcaTlvBase64({ sellerName: 'متجر', taxNumber: '123456789012345', timestamp: '2026-11-04T10:00:00Z', totalWithVat: '115.00', vatTotal: '15.00' }));
  const n = m.length;
  assert.equal((n - 17) % 4, 0);
  for (const [ox, oy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    for (let i = 0; i < 7; i++) {
      assert.ok(m[oy][ox + i] && m[oy + 6][ox + i] && m[oy + i][ox] && m[oy + i][ox + 6]); // الإطار الخارجي
    }
    assert.ok(m[oy + 3][ox + 3]); // مركز الباحث
    assert.ok(!m[oy + 1][ox + 1]); // الحلقة الفاتحة
  }
});
t('SVG حقيقي: حتمي، ويختلف بحسب المحتوى', () => {
  const a = generateQrSvg('abc', 96);
  assert.equal(a, generateQrSvg('abc', 96));
  assert.notEqual(a, generateQrSvg('abd', 96));
  assert.ok(a.startsWith('<svg') && a.includes('<path'));
});

console.log('فاتورة التوريد');
const baseOrder: any = {
  orderNumber: 'ORD-1', status: 'accepted', sellerName: 'المورد', buyerName: 'المشتري',
  paymentCurrency: 'SDG', createdAt: '2026-11-04T10:00:00Z',
  items: [{ productName: 'أ', unit: 'حبة', quantity: 1, unitPriceSdg: 0.1, totalSdg: 0.1 }, { productName: 'ب', unit: 'حبة', quantity: 1, unitPriceSdg: 0.2, totalSdg: 0.2 }],
  totalSdg: 0.3,
};
t('فروق الفاصلة العائمة لا تُظهر سطر «مجموع البنود»', () => {
  assert.ok(!orderInvoiceText(buildOrderInvoice(baseOrder)).includes('مجموع البنود'));
});
t('حالة غير معروفة لا تظهر «ملغي»', () => {
  assert.ok(!buildOrderInvoice({ ...baseOrder, status: undefined }).status.includes('ملغي'));
  assert.equal(buildOrderInvoice({ ...baseOrder, status: 'cancelled' }).status, 'ملغي');
});
t('بند إجماليه صفر صراحةً لا يُعاد حسابه من السعر', () => {
  const m = buildOrderInvoice({ ...baseOrder, items: [{ productName: 'هدية', unit: 'حبة', quantity: 2, unitPriceSdg: 50, totalSdg: 0 }], totalSdg: 0 });
  assert.equal(m.lines[0].totalSdg, 0);
});
t('أرقام واتساب: 0912345678 / +249 0912345678 / 00249912345678', () => {
  assert.equal(normalizeWhatsAppPhone('0912345678'), '249912345678');
  assert.equal(normalizeWhatsAppPhone('+249 0912345678'), '249912345678');
  assert.equal(normalizeWhatsAppPhone('00249912345678'), '249912345678');
  assert.equal(normalizeWhatsAppPhone('abc'), undefined);
});

console.log(`\n${passed} اختباراً نجحت ✓`);
