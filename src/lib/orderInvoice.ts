/**
 * فاتورة طلب التوريد — تُرسل من المورد إلى التاجر (المشتري).
 *
 * لماذا ملف مستقل؟
 *  • المنطق نقي (بلا React) ⇒ مُختبر، ونفس الفاتورة تُستخدم في المعاينة/الطباعة
 *    وفي نص واتساب، فلا يختلف الرقم أو التنسيق بين القناتين.
 *  • طلب التوريد كان له «أزرار حالة» فقط (قبول/تسليم) بلا مستند يُسلَّم للعميل.
 *    الآن بمجرد القبول (أو التسليم) تتوفر فاتورة كاملة بالبنود والسعر والصرف.
 *
 * كل الأرقام تُحسب من بيانات الطلب نفسها (items / totalSdg) — لا حساب جديد.
 */
import type { SupplyOrder } from '../types';

const money = (n: number) => Number(n || 0).toLocaleString('en-US');

const paymentLabel = (m?: string) =>
  m === 'cash' ? 'كاش'
    : m === 'bankak' ? 'بنكك'
    : m === 'bank_transfer' ? 'حوالة بنكية'
    : m === 'credit' ? 'آجل (على الحساب)'
    : 'كاش';

const statusLabel = (s?: string) =>
  s === 'pending' ? 'بانتظار الرد'
    : s === 'accepted' ? 'مقبول — جارٍ التحضير'
    : s === 'rejected' ? 'مرفوض'
    : s === 'fulfilled' ? 'تم التسليم'
    : 'ملغي';

const fmtDate = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
};

/** هل يستحق الطلب فاتورة؟ (بعد القبول أو التسليم) */
export function orderHasInvoice(order: Pick<SupplyOrder, 'status'>): boolean {
  return order.status === 'accepted' || order.status === 'fulfilled';
}

export interface OrderInvoiceContext {
  /** اسم متجر المورد كما يظهر في الترويسة */
  sellerStoreName?: string;
  /** اسم فرع/عنوان المورد إن وجد */
  sellerBranch?: string;
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
}

/** يبني نموذج الفاتورة من الطلب (كل المبالغ من بيانات الطلب) */
export function buildOrderInvoice(order: SupplyOrder, ctx: OrderInvoiceContext = {}): OrderInvoiceModel {
  const rate = Number(order.paymentExchangeRate) || 1;
  const lines = (order.items || []).map((it) => ({
    name: it.productName,
    unit: it.unit || 'حبة',
    quantity: Number(it.quantity) || 0,
    unitPriceSdg: Number(it.unitPriceSdg) || 0,
    totalSdg: Number(it.totalSdg) || (Number(it.unitPriceSdg) || 0) * (Number(it.quantity) || 0),
  }));
  const subtotalSdg = lines.reduce((s, l) => s + l.totalSdg, 0);

  return {
    title: order.status === 'fulfilled' ? 'فاتورة توريد' : 'فاتورة طلب توريد (مبدئية)',
    orderNumber: order.orderNumber,
    invoiceNumber: order.sellerInvoiceNumber || order.invoiceNumber || order.orderNumber,
    issuedAt: fmtDate(order.deliveredAt || order.updatedAt || order.createdAt),
    status: statusLabel(order.status),
    seller: ctx.sellerStoreName || order.sellerName,
    buyer: order.buyerName,
    buyerPhone: order.buyerPhone,
    payment: paymentLabel(order.paymentMethod),
    currency: order.paymentCurrency || 'SDG',
    exchangeRate: rate,
    lines,
    // الإجمالي المعتمد هو مجموع الطلب نفسه (مصدر الحقيقة) — لا نعيد حسابه بسعر مختلف
    subtotalSdg: Number(order.totalSdg) || subtotalSdg,
    totalSdg: Number(order.totalSdg) || subtotalSdg,
    note: order.note,
    sellerNote: order.sellerNote,
  };
}

/**
 * نص الفاتورة كما يُرسل في واتساب/رسالة — مختصر لكنه كامل:
 * رقم الفاتورة، الطرفان، البنود، الإجمالي، الدفع والعملة.
 */
export function orderInvoiceText(model: OrderInvoiceModel): string {
  const lines = model.lines
    .map((l, i) => `${i + 1}) ${l.name} — ${l.quantity} ${l.unit} × ${money(l.unitPriceSdg)} = ${money(l.totalSdg)} ج.س`)
    .join('\n');

  const rateLine =
    model.currency !== 'SDG' && model.exchangeRate > 1
      ? `\nالعملة: ${model.currency} • سعر الصرف: ${money(model.exchangeRate)}`
      : `\nالعملة: ${model.currency}`;

  return [
    `*${model.title}*`,
    `رقم الفاتورة: ${model.invoiceNumber}`,
    `رقم الطلب: ${model.orderNumber}`,
    `من: ${model.seller}`,
    `إلى: ${model.buyer}`,
    `التاريخ: ${model.issuedAt}`,
    `الحالة: ${model.status}`,
    '',
    '*البنود:*',
    lines || '—',
    '',
    `*الإجمالي: ${money(model.totalSdg)} ج.س*`,
    `الدفع: ${model.payment}${rateLine}`,
    model.note ? `ملاحظة: ${model.note}` : '',
    '',
    '— منصة سند',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

/** رابط واتساب جاهز للتاجر (المشتري) — لو ما عنده رقم، يفتح واتساب لاختيار جهة الاتصال */
export function orderInvoiceWhatsAppUrl(model: OrderInvoiceModel): string {
  const digits = String(model.buyerPhone || '').replace(/[^0-9]/g, '');
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(orderInvoiceText(model))}`;
}

/** فاتورة HTML للطباعة/PDF — مستقلة بتنسيقها، تُفتح في نافذة وتُطبع */
export function orderInvoiceHtml(model: OrderInvoiceModel): string {
  const rows = model.lines
    .map(
      (l, i) => `<tr>
        <td>${i + 1}</td>
        <td>${l.name}</td>
        <td>${l.quantity}</td>
        <td>${l.unit}</td>
        <td>${money(l.unitPriceSdg)}</td>
        <td>${money(l.totalSdg)}</td>
      </tr>`,
    )
    .join('');

  const rateBlock =
    model.currency !== 'SDG' && model.exchangeRate > 1
      ? `<div>سعر الصرف: <b>${money(model.exchangeRate)}</b></div>`
      : '';

  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8" />
<title>${model.title} — ${model.invoiceNumber}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;margin:16px;color:#0f172a}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0ea5e9;padding-bottom:8px}
  h1{font-size:18px;margin:0}
  .muted{color:#64748b;font-size:11px;margin-top:2px}
  .parties{display:flex;gap:10px;margin:12px 0}
  .box{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-size:11.5px}
  .box b{display:block;font-size:12.5px;margin-bottom:3px;color:#0369a1}
  table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:6px}
  th,td{border:1px solid #cbd5e1;padding:5px 6px;text-align:right}
  th{background:#f1f5f9}
  .total{margin-top:10px;display:flex;justify-content:space-between;font-size:13px;font-weight:800;border-top:2px solid #0f172a;padding-top:6px}
  .badge{display:inline-block;background:#e0f2fe;color:#075985;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:800}
  .note{margin-top:8px;font-size:11px;color:#475569}
  .foot{margin-top:14px;font-size:10px;color:#64748b;display:flex;justify-content:space-between}
  @media print{ body{margin:8mm} .noprint{display:none} }
</style></head><body>
<div class="head">
  <div>
    <h1>${model.title}</h1>
    <div class="muted">${model.seller}</div>
  </div>
  <div style="text-align:left;font-size:11.5px">
    <div>رقم الفاتورة: <b>${model.invoiceNumber}</b></div>
    <div>رقم الطلب: ${model.orderNumber}</div>
    <div>التاريخ: ${model.issuedAt}</div>
    <div style="margin-top:4px"><span class="badge">${model.status}</span></div>
  </div>
</div>

<div class="parties">
  <div class="box"><b>المورد</b>${model.seller}</div>
  <div class="box"><b>المشتري</b>${model.buyer}${model.buyerPhone ? `<div class="muted">${model.buyerPhone}</div>` : ''}</div>
  <div class="box"><b>الدفع</b>${model.payment}${rateBlock}</div>
</div>

<table>
  <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>الوحدة</th><th>السعر (ج.س)</th><th>الإجمالي (ج.س)</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="6" style="text-align:center">لا بنود</td></tr>'}</tbody>
</table>

<div class="total"><span>الإجمالي</span><span>${money(model.totalSdg)} ج.س</span></div>
${model.note ? `<div class="note">ملاحظة الطالب: ${model.note}</div>` : ''}
${model.sellerNote ? `<div class="note">ملاحظة المورد: ${model.sellerNote}</div>` : ''}
<div class="foot"><span>منصة سند — فاتورة طلب توريد</span><span>${model.lines.length} بند</span></div>
<script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
</body></html>`;
}
