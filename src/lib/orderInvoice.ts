/**
 * النموذج الموحّد لفاتورة طلب التوريد.
 * المعاينة وPDF والطباعة والنص والإشعار تستخدم نفس البيانات والتنسيقات.
 * لا تُقرأ أسعار السوق الحية هنا: سعر الصرف المثبّت على الطلب هو المعتمد.
 */
import type { SupplyOrder } from '../types';

export const money = (n: number) =>
  Number(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const quantity = (n: number) => Number(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });

const paymentLabel = (m?: string) =>
  m === 'cash' ? 'كاش'
    : m === 'bankak' ? 'بنكك'
      : m === 'bank_transfer' ? 'حوالة بنكية'
      : m === 'credit' ? 'آجل (على الحساب)'
        : 'غير محدد';

const statusLabel = (s?: string) =>
  s === 'pending' ? 'بانتظار الرد'
    : s === 'accepted' ? 'مقبول — جارٍ التحضير'
      : s === 'rejected' ? 'مرفوض'
        : s === 'fulfilled' ? 'تم التسليم'
          : 'ملغي';

const fmtDate = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return '—';
  // تقويم لاتيني ثابت للهواتف والكمبيوتر؛ النص عربي والأرقام قابلة للمطابقة.
  return d.toLocaleString('ar-EG-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' });
};

export function orderHasInvoice(order: Pick<SupplyOrder, 'status'>): boolean {
  return order.status === 'accepted' || order.status === 'fulfilled';
}

/** يحوّل الرقم السوداني المحلي إلى صيغة wa.me الدولية، ولا يخمّن دولة لرقم مجهول. */
export function normalizeWhatsAppPhone(value?: string): string | undefined {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 10) digits = `249${digits.slice(1)}`;
  if (digits.startsWith('2490') && digits.length === 12) digits = `249${digits.slice(4)}`;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : undefined;
}

export interface OrderInvoiceContext {
  sellerStoreName?: string;
  stampText?: string;
  sellerPhone?: string;
  sellerAddress?: string;
}

export interface OrderInvoiceModel {
  title: string;
  orderNumber: string;
  invoiceNumber: string;
  issuedAt: string;
  status: string;
  seller: string;
  buyer: string;
  buyerPhone?: string;
  payment: string;
  currency: string;
  exchangeRate: number;
  lines: { name: string; unit: string; quantity: number; unitPriceSdg: number; totalSdg: number }[];
  subtotalSdg: number;
  totalSdg: number;
  note?: string;
  sellerNote?: string;
  stampText?: string;
  sellerPhone?: string;
  sellerAddress?: string;
  purchaseNumber?: string;
  sellerReference?: string;
}

export function invoiceExchangeRate(model: Pick<OrderInvoiceModel, 'currency' | 'exchangeRate'>): number {
  if (model.currency === 'SDG') return 1;
  const rate = Number(model.exchangeRate);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

/** مبلغ العملة الأجنبية محسوب مرة واحدة لجميع القنوات. */
export function invoiceForeignTotal(model: Pick<OrderInvoiceModel, 'currency' | 'exchangeRate' | 'totalSdg'>): number | null {
  const rate = invoiceExchangeRate(model);
  return model.currency !== 'SDG' && rate > 0 ? Number(model.totalSdg) / rate : null;
}

export function invoiceCurrencyLabel(model: Pick<OrderInvoiceModel, 'currency' | 'exchangeRate'>): string {
  const rate = invoiceExchangeRate(model);
  if (model.currency === 'SDG') return 'SDG (عملة أساسية)';
  return rate > 0 ? `${model.currency} (1 = ${money(rate)} ج.س)` : `${model.currency} (سعر الصرف غير صالح)`;
}

export function buildOrderInvoice(order: SupplyOrder, ctx: OrderInvoiceContext = {}): OrderInvoiceModel {
  const currency = String(order.paymentCurrency || 'SDG').trim().toUpperCase() || 'SDG';
  const lines = (order.items || []).map((it) => ({
    name: it.productName,
    unit: it.unit || 'حبة',
    quantity: Number(it.quantity) || 0,
    unitPriceSdg: Number(it.unitPriceSdg) || 0,
    totalSdg: Number(it.totalSdg) || (Number(it.unitPriceSdg) || 0) * (Number(it.quantity) || 0),
  }));
  const subtotalSdg = lines.reduce((s, l) => s + l.totalSdg, 0);
  const totalSdg = Number(order.totalSdg) || subtotalSdg;
  const purchaseNumber = order.invoiceNumber || undefined;
  return {
    title: order.status === 'fulfilled' ? 'فاتورة توريد' : 'فاتورة طلب توريد (مبدئية)',
    orderNumber: order.orderNumber,
    // الرقم المصدر من السيرفر؛ رقم المورد القديم مرجع فقط ولا يستبدل رقم سند.
    invoiceNumber: purchaseNumber || order.orderNumber,
    issuedAt: fmtDate(order.invoiceIssuedAt || order.createdAt),
    status: statusLabel(order.status),
    seller: ctx.sellerStoreName || order.sellerName,
    buyer: order.buyerName,
    buyerPhone: order.buyerPhone,
    payment: paymentLabel(order.paymentMethod),
    currency,
    exchangeRate: currency === 'SDG' ? 1 : Number(order.paymentExchangeRate) || 0,
    lines,
    subtotalSdg,
    totalSdg,
    note: order.note,
    sellerNote: order.sellerNote,
    stampText: ctx.stampText,
    sellerPhone: ctx.sellerPhone || order.sellerPhone,
    sellerAddress: ctx.sellerAddress || order.sellerAddress,
    purchaseNumber: order.status === 'fulfilled' ? purchaseNumber : undefined,
    sellerReference: order.sellerInvoiceNumber,
  };
}

export function orderInvoiceText(model: OrderInvoiceModel): string {
  const lines = model.lines
    .map((l, i) => `${i + 1}) ${l.name} — ${quantity(l.quantity)} ${l.unit} × ${money(l.unitPriceSdg)} = ${money(l.totalSdg)} ج.س`)
    .join('\n');
  const foreign = invoiceForeignTotal(model);
  return [
    `*${model.title}*`,
    `رقم الفاتورة: ${model.invoiceNumber}`,
    `رقم الطلب: ${model.orderNumber}`,
    `من: ${model.seller}`,
    `إلى: ${model.buyer}${model.buyerPhone ? ` — ${model.buyerPhone}` : ''}`,
    `التاريخ: ${model.issuedAt}`,
    `الحالة: ${model.status}`,
    '',
    '*البنود:*',
    lines || '—',
    '',
    ...(model.subtotalSdg !== model.totalSdg ? [`مجموع البنود: ${money(model.subtotalSdg)} ج.س`] : []),
    `*الإجمالي المعتمد: ${money(model.totalSdg)} ج.س*`,
    `الدفع: ${model.payment}`,
    `العملة: ${invoiceCurrencyLabel(model)}`,
    ...(foreign !== null ? [`*المطلوب بـ ${model.currency}: ${money(foreign)} ${model.currency}*`] : []),
    model.sellerReference ? `مرجع المورد: ${model.sellerReference}` : '',
    model.note ? `ملاحظة الطالب: ${model.note}` : '',
    model.sellerNote ? `ملاحظة المورد: ${model.sellerNote}` : '',
    `الختم: ${model.stampText || model.seller}`,
    'توقيع المستلم: ____________________',
    '',
    [model.seller, model.sellerPhone, model.sellerAddress].filter(Boolean).join(' · ') || 'منصة سند',
  ].filter((l) => l !== '').join('\n');
}

export function orderInvoiceWhatsAppUrl(model: OrderInvoiceModel, recipientPhone?: string): string {
  // إذا مُرّر مستلم صراحةً (صاحب المتجر) لا نسقط إلى رقم المشتري عند غيابه.
  const phone = recipientPhone === undefined ? model.buyerPhone : recipientPhone;
  const digits = normalizeWhatsAppPhone(phone);
  return `https://wa.me/${digits || ''}?text=${encodeURIComponent(orderInvoiceText(model))}`;
}

/** داخل غلاف أندرويد: إذا لا يوجد رقم، نفتح واتساب نفسه عبر scheme مباشر. */
export function orderInvoiceWhatsAppShareUrl(model: OrderInvoiceModel, recipientPhone?: string, androidShell = false): string {
  const phone = recipientPhone === undefined ? model.buyerPhone : recipientPhone;
  const digits = normalizeWhatsAppPhone(phone);
  const text = encodeURIComponent(orderInvoiceText(model));
  if (!digits && androidShell) return `whatsapp://send?text=${text}`;
  return `https://wa.me/${digits || ''}?text=${text}`;
}

/** يمنع حقول المتجر/الأصناف من أن تتحول إلى HTML أو سكربت في مستند الطباعة. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** CSS محصور بالمستند حتى لا يغيّر تنسيق التطبيق عند الطباعة داخل الصفحة أو PDF. */
export const ORDER_INVOICE_CSS = `
  .sanad-invoice-document{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#0f172a;background:#fff;font-size:12px;line-height:1.6;overflow-wrap:anywhere}
  .sanad-invoice-document *{box-sizing:border-box}
  .sanad-invoice-document .invoice-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:2px solid #0ea5e9;padding-bottom:10px}
  .sanad-invoice-document h1{font-size:20px;margin:0;color:#0f172a}
  .sanad-invoice-document .muted{color:#64748b;font-size:11px;margin-top:3px}
  .sanad-invoice-document .invoice-meta{text-align:left;font-size:11.5px;flex-shrink:0}
  .sanad-invoice-document .parties{display:flex;gap:10px;margin:14px 0}
  .sanad-invoice-document .box{flex:1;min-width:0;border:1px solid #e2e8f0;border-radius:8px;padding:9px;font-size:11.5px}
  .sanad-invoice-document .box b{display:block;font-size:12.5px;margin-bottom:4px;color:#0369a1}
  .sanad-invoice-document table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:8px;table-layout:fixed}
  .sanad-invoice-document th,.sanad-invoice-document td{border:1px solid #cbd5e1;padding:6px;text-align:right;vertical-align:top}
  .sanad-invoice-document th{background:#f1f5f9}
  .sanad-invoice-document .num{font-variant-numeric:tabular-nums;white-space:nowrap}
  .sanad-invoice-document .totals{margin-top:12px;border-top:2px solid #0f172a;padding-top:8px}
  .sanad-invoice-document .total{display:flex;justify-content:space-between;gap:12px;font-size:14px;font-weight:800}
  .sanad-invoice-document .foreign{color:#047857;font-size:12px;margin-top:4px}
  .sanad-invoice-document .subtotal{font-size:11px;color:#475569;margin-bottom:4px}
  .sanad-invoice-document .badge{display:inline-block;background:#e0f2fe;color:#075985;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:800}
  .sanad-invoice-document .note{margin-top:8px;font-size:11px;color:#475569;white-space:pre-wrap}
  .sanad-invoice-document .sign{display:flex;justify-content:space-between;gap:12px;margin-top:18px;break-inside:avoid}
  .sanad-invoice-document .stampbox,.sanad-invoice-document .signbox{flex:1;border:1px dashed #94a3b8;border-radius:8px;padding:10px;min-height:74px;font-size:11px;color:#334155}
  .sanad-invoice-document .lbl{font-size:10px;color:#64748b;margin-bottom:24px}
  .sanad-invoice-document .stampbox b{color:#0369a1}
  .sanad-invoice-document .foot{margin-top:14px;font-size:10px;color:#64748b;display:flex;justify-content:space-between;gap:12px}
  .sanad-invoice-document tr,.sanad-invoice-document .totals{break-inside:avoid}
  .sanad-invoice-document thead{display:table-header-group}
  @media print{.sanad-invoice-document{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
`;

export function orderInvoiceMarkup(model: OrderInvoiceModel): string {
  const e = escapeHtml;
  const rows = model.lines.map((l, i) => `<tr>
    <td class="num">${i + 1}</td><td>${e(l.name)}</td><td class="num">${quantity(l.quantity)}</td>
    <td>${e(l.unit)}</td><td class="num">${money(l.unitPriceSdg)}</td><td class="num">${money(l.totalSdg)}</td>
  </tr>`).join('');
  const foreign = invoiceForeignTotal(model);
  const footer = [model.seller, model.sellerPhone, model.sellerAddress].filter(Boolean).map(e).join(' · ') || 'منصة سند';
  return `<main class="sanad-invoice-document" dir="rtl" lang="ar">
    <header class="invoice-head">
      <div><h1>${e(model.title)}</h1><div class="muted">${e(model.seller)}</div></div>
      <div class="invoice-meta">
        <div>رقم الفاتورة: <b dir="ltr">${e(model.invoiceNumber)}</b></div>
        <div>رقم الطلب: <span dir="ltr">${e(model.orderNumber)}</span></div>
        <div>التاريخ: ${e(model.issuedAt)}</div>
        <div><span class="badge">${e(model.status)}</span></div>
      </div>
    </header>
    <section class="parties">
      <div class="box"><b>المورد</b>${e(model.seller)}${model.sellerPhone ? `<div class="muted" dir="ltr">${e(model.sellerPhone)}</div>` : ''}</div>
      <div class="box"><b>المشتري</b>${e(model.buyer)}${model.buyerPhone ? `<div class="muted" dir="ltr">${e(model.buyerPhone)}</div>` : ''}</div>
      <div class="box"><b>الدفع والعملة</b>${e(model.payment)}<div class="muted">${e(invoiceCurrencyLabel(model))}</div></div>
    </section>
    <table>
      <colgroup><col style="width:6%"><col style="width:34%"><col style="width:12%"><col style="width:12%"><col style="width:18%"><col style="width:18%"></colgroup>
      <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>الوحدة</th><th>السعر (ج.س)</th><th>الإجمالي (ج.س)</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="text-align:center">لا بنود</td></tr>'}</tbody>
    </table>
    <section class="totals">
      ${model.subtotalSdg !== model.totalSdg ? `<div class="subtotal">مجموع البنود: ${money(model.subtotalSdg)} ج.س — الإجمالي أدناه هو المعتمد في الطلب.</div>` : ''}
      <div class="total"><span>الإجمالي المعتمد</span><span class="num">${money(model.totalSdg)} ج.س</span></div>
      ${foreign !== null ? `<div class="total foreign"><span>المطلوب بـ ${e(model.currency)}</span><span class="num">${money(foreign)} ${e(model.currency)}</span></div>` : ''}
    </section>
    ${model.sellerReference ? `<div class="note">مرجع المورد: ${e(model.sellerReference)}</div>` : ''}
    ${model.note ? `<div class="note">ملاحظة الطالب: ${e(model.note)}</div>` : ''}
    ${model.sellerNote ? `<div class="note">ملاحظة المورد: ${e(model.sellerNote)}</div>` : ''}
    <section class="sign">
      <div class="stampbox"><div class="lbl">ختم المورد</div><b>${e(model.stampText || model.seller)}</b></div>
      <div class="signbox"><div class="lbl">توقيع المستلم</div></div>
    </section>
    <footer class="foot"><span>${footer}</span><span>${model.lines.length} بند · منصة سند</span></footer>
  </main>`;
}

export function orderInvoiceHtml(model: OrderInvoiceModel): string {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(model.title)} — ${escapeHtml(model.invoiceNumber)}</title>
  <style>${ORDER_INVOICE_CSS}\nbody{margin:8mm;background:#fff}@page{size:A4;margin:8mm}</style>
  </head><body>${orderInvoiceMarkup(model)}</body></html>`;
}
