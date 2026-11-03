import React, { useMemo, useState } from 'react';
import {
  X,
  Printer,
  FileText,
  Download,
  MessageCircle,
  Store,
  Check,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import type { OrderInvoiceModel } from '../../lib/orderInvoice.ts';
import { orderInvoiceText, orderInvoiceWhatsAppUrl } from '../../lib/orderInvoice.ts';
import { downloadOrderInvoicePdf } from '../../lib/orderInvoicePdf.ts';

interface Props {
  invoice: OrderInvoiceModel;
  /** إغلاق النافذة */
  onClose: () => void;
  /** إرسال نسخة لصاحب المتجر (المورد) — يُنفَّذ من الشاشة التي تعرف بياناته */
  onSendToStoreOwner: () => Promise<void> | void;
  /** إرسال الفاتورة للمشتري على واتساب */
  onSendToBuyer: () => void;
  /** الطباعة (نافذة المتصفح) */
  onPrint: () => void;
  /** هل أنا المورد؟ (إرسال «نسخة لصاحب المتجر» يظهر للمورد فقط) */
  canSendToOwner: boolean;
}

const money = (n: number) => Number(n || 0).toLocaleString('en-US');

/**
 * نافذة «الفاتورة الكاملة».
 * ---------------------------------------------------------------------------
 * لماذا نافذة بدل أزرار متناثرة على البطاقة؟
 *  • المستخدم طلب: بعد القبول يظهر **زر واحد** «إصدار الفاتورة»، تضغطه فتظهر
 *    فاتورة كاملة (بنود + رقم الفاتورة + رقم الطلب + العملة)، وتحتها كل
 *    الخيارات: طباعة · PDF · إرسال للمشتري · نسخة لصاحب المتجر.
 *  • النافذة تُحسب من نموذج الفاتورة نفسه المستخدم في الطباعة وواتساب، فلا
 *    تختلف الأرقام بين المعاينة والمستند المُرسل.
 */
export const OrderInvoiceModal: React.FC<Props> = ({
  invoice,
  onClose,
  onPrint,
  onSendToBuyer,
  onSendToStoreOwner,
  canSendToOwner,
}) => {
  const [busy, setBusy] = useState<'pdf' | 'owner' | null>(null);
  const [done, setDone] = useState<string>('');
  const [err, setErr] = useState('');

  const waUrl = useMemo(() => orderInvoiceWhatsAppUrl(invoice), [invoice]);
  const text = useMemo(() => orderInvoiceText(invoice), [invoice]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone('تم نسخ نص الفاتورة — الصقه في أي تطبيق.');
    } catch {
      setErr('المتصفح منع النسخ. يمكنك تحديد النص ونسخه يدوياً.');
    }
  };

  const doPdf = async () => {
    setBusy('pdf');
    setErr('');
    try {
      const res = await downloadOrderInvoicePdf(invoice);
      if (!res.ok) setErr(res.error || 'تعذّر توليد PDF');
      else setDone(`تم تنزيل ${res.fileName}`);
    } finally {
      setBusy(null);
    }
  };

  const doOwner = async () => {
    setBusy('owner');
    setErr('');
    try {
      await onSendToStoreOwner();
      setDone('تم إرسال نسخة إلى صاحب المتجر.');
    } catch (e: any) {
      setErr(e?.message || 'تعذّر إرسال النسخة لصاحب المتجر');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto overflow-x-hidden"
      dir="rtl"
    >
      <div className="w-full max-w-md sm:max-w-lg bg-white rounded-2xl shadow-2xl my-2 sm:my-0 max-h-[96dvh] flex flex-col overflow-hidden">
        {/* الترويسة */}
        <div className="bg-slate-900 text-white px-3 py-2.5 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3 className="text-[13px] font-black truncate flex items-center gap-1.5">
              <FileText className="w-4 h-4" /> {invoice.title}
            </h3>
            <p className="text-[10px] text-slate-300 font-mono truncate">
              {invoice.invoiceNumber} • طلب {invoice.orderNumber}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white shrink-0" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* جسم الفاتورة (قابل للتمرير) */}
        <div className="p-3 space-y-2.5 overflow-y-auto text-slate-800">
          {/* الطرفان */}
          <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
            <div className="rounded-lg border border-slate-200 p-1.5">
              <span className="block text-[9px] font-black text-sky-700">المورد</span>
              <span className="font-bold">{invoice.seller}</span>
            </div>
            <div className="rounded-lg border border-slate-200 p-1.5">
              <span className="block text-[9px] font-black text-sky-700">المشتري</span>
              <span className="font-bold">{invoice.buyer}</span>
              {invoice.buyerPhone ? (
                <span className="block font-mono text-[9.5px] text-slate-500">{invoice.buyerPhone}</span>
              ) : null}
            </div>
          </div>

          {/* بيانات الفاتورة */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10.5px]">
            <div>
              رقم الفاتورة: <b className="font-mono">{invoice.invoiceNumber}</b>
            </div>
            <div>
              رقم الطلب: <b className="font-mono">{invoice.orderNumber}</b>
            </div>
            <div>التاريخ: {invoice.issuedAt}</div>
            <div>
              الحالة: <b>{invoice.status}</b>
            </div>
            <div>الدفع: {invoice.payment}</div>
            <div>
              العملة:{' '}
              <b>
                {invoice.currency}
                {invoice.currency !== 'SDG' && invoice.exchangeRate > 1
                  ? ` (1 = ${money(invoice.exchangeRate)} ج.س)`
                  : ' (عملة أساسية)'}
              </b>
            </div>
          </div>

          {/* البنود */}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-right text-[10.5px]">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-1.5 py-1">#</th>
                  <th className="px-1.5 py-1">الصنف</th>
                  <th className="px-1.5 py-1">الكمية</th>
                  <th className="px-1.5 py-1 whitespace-nowrap">السعر</th>
                  <th className="px-1.5 py-1 whitespace-nowrap">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.lines.map((l, i) => (
                  <tr key={`${l.name}-${i}`}>
                    <td className="px-1.5 py-1 text-slate-400">{i + 1}</td>
                    <td className="px-1.5 py-1 font-bold">{l.name}</td>
                    <td className="px-1.5 py-1 font-mono whitespace-nowrap">
                      {l.quantity} {l.unit}
                    </td>
                    <td className="px-1.5 py-1 font-mono whitespace-nowrap">{money(l.unitPriceSdg)}</td>
                    <td className="px-1.5 py-1 font-mono font-bold whitespace-nowrap">{money(l.totalSdg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* الإجمالي — بالجنيه وبالعملة إن كانت أجنبية */}
          <div className="rounded-lg border-2 border-slate-900 p-2 space-y-1">
            <div className="flex items-center justify-between text-[13px] font-black">
              <span>الإجمالي</span>
              <span className="font-mono">{money(invoice.totalSdg)} ج.س</span>
            </div>
            {invoice.currency !== 'SDG' && invoice.exchangeRate > 1 && (
              <div className="flex items-center justify-between text-[11px] text-emerald-800 font-black">
                <span>المطلوب بـ {invoice.currency}</span>
                <span className="font-mono">
                  {(invoice.totalSdg / invoice.exchangeRate).toLocaleString('en-US', {
                    maximumFractionDigits: 2,
                  })}{' '}
                  {invoice.currency}
                </span>
              </div>
            )}
          </div>

          {invoice.note ? (
            <p className="text-[10px] text-slate-600">ملاحظة الطالب: {invoice.note}</p>
          ) : null}
          {invoice.sellerNote ? (
            <p className="text-[10px] text-slate-600">ملاحظة المورد: {invoice.sellerNote}</p>
          ) : null}

          {/* الختم والتوقيع */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg border border-dashed border-slate-400 p-2 min-h-[58px]">
              <span className="block text-[9px] text-slate-500 mb-3">ختم المورد</span>
              <b className="text-[11px] text-sky-800">{invoice.stampText || invoice.seller}</b>
            </div>
            <div className="rounded-lg border border-dashed border-slate-400 p-2 min-h-[58px]">
              <span className="block text-[9px] text-slate-500 mb-3">توقيع المستلم</span>
            </div>
          </div>

          <p className="text-center text-[9px] text-slate-400">
            {invoice.sellerPhone ? `${invoice.seller} · ${invoice.sellerPhone} · ` : ''}
            منصة سند
          </p>

          {done ? (
            <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1 text-[10.5px] font-bold text-emerald-800 flex items-center gap-1">
              <Check className="w-3 h-3" /> {done}
            </p>
          ) : null}
          {err ? (
            <p className="rounded-lg bg-rose-50 border border-rose-200 px-2 py-1 text-[10.5px] font-bold text-rose-800 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {err}
            </p>
          ) : null}
        </div>

        {/* الخيارات — كلها تحت الفاتورة */}
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-2 space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                setDone('');
                setErr('');
                onPrint();
              }}
              className="rounded-lg bg-white border border-slate-300 text-slate-800 py-2 text-[11.5px] font-black flex items-center justify-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" /> طباعة
            </button>
            <button
              onClick={doPdf}
              disabled={busy === 'pdf'}
              className="rounded-lg bg-sky-700 text-white py-2 text-[11.5px] font-black flex items-center justify-center gap-1 disabled:opacity-60"
            >
              {busy === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              PDF
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                onSendToBuyer();
                if (!invoice.buyerPhone) {
                  /* بلا رقم: نفتح واتساب ليختار جهة الاتصال، ونخبره بالسبب */
                  setDone('لا يوجد رقم للمشتري — اختر جهة الاتصال في واتساب وأرسل النص.');
                  e.preventDefault();
                  window.open(waUrl, '_blank');
                }
              }}
              className="rounded-lg bg-emerald-600 text-white py-2 text-[11.5px] font-black flex items-center justify-center gap-1"
            >
              <MessageCircle className="w-3.5 h-3.5" /> إرسال للمشتري
            </a>
            <button
              onClick={doOwner}
              disabled={!canSendToOwner || busy === 'owner'}
              title={canSendToOwner ? 'إرسال نسخة إلى بريد/إشعار صاحب المتجر' : 'متاح للمورد فقط'}
              className="rounded-lg bg-slate-900 text-white py-2 text-[11.5px] font-black flex items-center justify-center gap-1 disabled:opacity-40"
            >
              {busy === 'owner' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Store className="w-3.5 h-3.5" />}
              نسخة لصاحب المتجر
            </button>
          </div>
          <button
            onClick={copyText}
            className="w-full rounded-lg bg-white border border-slate-300 text-slate-700 py-1.5 text-[10.5px] font-bold flex items-center justify-center gap-1"
          >
            <FileText className="w-3 h-3" /> نسخ نص الفاتورة
          </button>
          <p className="text-center text-[9px] text-slate-400 leading-relaxed">
            كل الخيارات تُخرج نفس الأرقام: رقم الفاتورة {invoice.invoiceNumber} · طلب {invoice.orderNumber} ·{' '}
            {money(invoice.totalSdg)} ج.س
          </p>
        </div>
      </div>
    </div>
  );
};
