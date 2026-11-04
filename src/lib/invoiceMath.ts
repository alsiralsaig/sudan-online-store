/**
 * حسابات الفاتورة المشتركة بين الواجهة (PosView) والسيرفر (routes.ts).
 * مصدر واحد للحقيقة حتى لا يختلف الإجمالي المعروض عن المحفوظ.
 *
 * القواعد:
 *  - كل مبلغ يُقرَّب إلى خانتين عشريتين (يمنع أخطاء الفاصلة العائمة مثل 0.1×3).
 *  - الخصم على مستوى الفاتورة يُوزَّع على البنود بالتناسب، وتُحسب الضريبة بعده.
 *  - الأسعار شاملة الضريبة: الإجمالي = المجموع − الخصم (الضريبة مُستخرجة منه).
 *  - الأسعار غير شاملة: الإجمالي = المجموع − الخصم + الضريبة.
 */

export const round2 = (n: unknown): number => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
};

export interface InvoiceLineInput {
  quantity: number;
  unitPrice: number;
  /** خصم البند (مبلغ) */
  discount?: number;
  /** نسبة الضريبة % (0 للمعفى) */
  taxRate?: number;
}

export interface InvoiceLineResult {
  /** إجمالي البند بعد خصم البند وقبل خصم الفاتورة */
  total: number;
  /** ضريبة البند بعد توزيع خصم الفاتورة */
  taxAmount: number;
}

export interface InvoiceTotals {
  lines: InvoiceLineResult[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

export function computeInvoiceTotals(
  lines: InvoiceLineInput[],
  opts: { pricesIncludeVat?: boolean; invoiceDiscount?: number } = {},
): InvoiceTotals {
  const inclusive = Boolean(opts.pricesIncludeVat);
  const totals = lines.map((l) => {
    const gross = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
    const disc = Math.min(Math.max(0, Number(l.discount) || 0), Math.max(0, gross));
    return round2(Math.max(0, gross - disc));
  });
  const subtotal = round2(totals.reduce((s, t) => s + t, 0));
  const discountTotal = round2(Math.min(Math.max(0, Number(opts.invoiceDiscount) || 0), subtotal));
  const ratio = subtotal > 0 ? (subtotal - discountTotal) / subtotal : 0;

  const resultLines: InvoiceLineResult[] = lines.map((l, i) => {
    const rate = Math.max(0, Number(l.taxRate) || 0);
    const base = totals[i] * ratio;
    let tax = 0;
    if (rate > 0) tax = inclusive ? base - base / (1 + rate / 100) : base * (rate / 100);
    return { total: totals[i], taxAmount: round2(tax) };
  });

  const taxTotal = round2(resultLines.reduce((s, l) => s + l.taxAmount, 0));
  const net = subtotal - discountTotal;
  const grandTotal = round2(inclusive ? net : net + taxTotal);
  return { lines: resultLines, subtotal, discountTotal, taxTotal, grandTotal };
}

/** يتحقق من بند فاتورة قبل الحساب. يعيد رسالة الخطأ أو null. */
export function validateInvoiceLine(item: { quantity?: unknown; unitPriceSdg?: unknown; discountSdg?: unknown }, unitPrice: number): string | null {
  const qty = Number(item.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return 'كمية الصنف يجب أن تكون رقماً أكبر من صفر.';
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return 'سعر الصنف غير صالح.';
  const disc = Number(item.discountSdg ?? 0);
  if (!Number.isFinite(disc) || disc < 0) return 'خصم الصنف غير صالح.';
  if (disc > qty * unitPrice + 0.005) return 'خصم الصنف أكبر من قيمته.';
  return null;
}

/**
 * موزّع المبلغ المسترد: حصة كل بند مما دفعه العميل فعلاً (بعد خصم الفاتورة ومع الضريبة).
 * الأسعار غير الشاملة: وزن البند = صافيه + ضريبته. الشاملة: وزنه = صافيه.
 */
export function createRefundAllocator(sale: {
  grandTotalSdg: number;
  subtotalSdg: number;
  discountTotalSdg: number;
  taxTotalSdg: number;
  items: Array<{ totalSdg: number; taxAmountSdg?: number; quantity: number }>;
}) {
  const grand = Number(sale.grandTotalSdg) || 0;
  const taxExclusive =
    (Number(sale.taxTotalSdg) || 0) > 0 &&
    Math.abs(grand - ((Number(sale.subtotalSdg) || 0) - (Number(sale.discountTotalSdg) || 0) + (Number(sale.taxTotalSdg) || 0))) < 0.01;
  const weight = (i: { totalSdg: number; taxAmountSdg?: number }) =>
    (Number(i.totalSdg) || 0) + (taxExclusive ? Number(i.taxAmountSdg) || 0 : 0);
  const totalWeight = sale.items.reduce((n, i) => n + weight(i), 0);
  const totalTax = round2(Number(sale.taxTotalSdg) || 0);
  const taxWeightSum = sale.items.reduce((n, i) => n + (Number(i.taxAmountSdg) || 0), 0);
  return {
    grand,
    taxTotal: totalTax,
    forQty: (item: { totalSdg: number; taxAmountSdg?: number; quantity: number }, qty: number): number =>
      totalWeight > 0 && item.quantity > 0 ? round2(grand * (weight(item) / totalWeight) * (qty / item.quantity)) : 0,
    /**
     * ضريبة البند المرتجع = حصة البند من ضريبة الفاتورة، لا نسبة من الإجمالي.
     * هكذا يبقى إرجاع صنف معفى ضريبته صفر حتى لو كانت الفاتورة تحوي ضريبة.
     */
    taxForQty: (item: { taxAmountSdg?: number; quantity: number }, qty: number): number =>
      taxWeightSum > 0 && item.quantity > 0
        ? round2(totalTax * ((Number(item.taxAmountSdg) || 0) / taxWeightSum) * (qty / item.quantity))
        : 0,
  };
}
