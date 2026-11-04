import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Printer, FileText, Download, MessageCircle, Store, Check, Loader2, AlertTriangle, Copy,
} from 'lucide-react';
import type { OrderInvoiceModel } from '../../lib/orderInvoice.ts';
import {
  orderInvoiceText, orderInvoiceWhatsAppUrl, orderInvoiceWhatsAppShareUrl, money, invoiceForeignTotal, invoiceCurrencyLabel,
} from '../../lib/orderInvoice.ts';
import { downloadOrderInvoicePdf } from '../../lib/orderInvoicePdf.ts';
import { isSanadAndroidShell } from '../../lib/nativeShell.ts';

interface Props {
  invoice: OrderInvoiceModel;
  orderId: string;
  ownerPhone?: string;
  onClose: () => void;
  onSendToStoreOwner: () => Promise<void> | void;
  onSendToBuyer: () => void;
  onPrint: () => Promise<{ ok: boolean; error?: string }>;
  canSendToOwner: boolean;
}

/** نافذة واحدة: المستند أولاً، ثم إجراءاته. لا تغلق نفسها عند الطباعة. */
export const OrderInvoiceModal: React.FC<Props> = ({
  invoice, orderId, ownerPhone, onClose, onPrint, onSendToBuyer, onSendToStoreOwner, canSendToOwner,
}) => {
  const [busy, setBusy] = useState<'pdf' | 'owner' | 'print' | null>(null);
  const [done, setDone] = useState('');
  const [err, setErr] = useState('');
  const [manualCopy, setManualCopy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const copyRef = useRef<HTMLTextAreaElement>(null);
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  busyRef.current = busy;
  onCloseRef.current = onClose;
  const waUrl = useMemo(() => orderInvoiceWhatsAppUrl(invoice), [invoice]);
  const ownerWaUrl = useMemo(() => orderInvoiceWhatsAppShareUrl(invoice, ownerPhone ?? invoice.sellerPhone, isSanadAndroidShell()), [invoice, ownerPhone]);
  const text = useMemo(() => orderInvoiceText(invoice), [invoice]);
  const foreign = invoiceForeignTotal(invoice);

  // Trap focus once per open. Re-running on every busy/parent render used to
  // steal focus back to the close button while PDF/owner-copy was running.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onCloseRef.current();
      if (e.key !== 'Tab') return;
      const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],textarea:not([disabled]),[tabindex="0"]',
      ) || []).filter((el) => el.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    if (manualCopy) { copyRef.current?.focus(); copyRef.current?.select(); }
  }, [manualCopy]);

  const copyText = async () => {
    setErr(''); setDone('');
    try {
      await navigator.clipboard.writeText(text);
      setDone('تم نسخ نص الفاتورة — الصقه في أي تطبيق.');
    } catch {
      setManualCopy(true);
      setErr('المتصفح منع النسخ التلقائي. النص محدد أدناه؛ انسخه من قائمة التحديد.');
    }
  };

  const doPrint = async () => {
    setBusy('print'); setErr(''); setDone('');
    try {
      const res = await onPrint();
      if (!res.ok) setErr(res.error || 'تعذّر فتح الطباعة. نزّل PDF ثم اطبعه من تطبيق الملفات.');
    } catch {
      setErr('تعذّر فتح الطباعة. نزّل PDF ثم اطبعه من تطبيق الملفات.');
    } finally { setBusy(null); }
  };

  const doPdf = async () => {
    setBusy('pdf'); setErr(''); setDone('');
    try {
      const res = await downloadOrderInvoicePdf(invoice, { orderId });
      if (!res.ok) setErr(res.error || 'تعذّر توليد PDF');
      else setDone(`تم تنزيل ${res.fileName}`);
    } catch {
      setErr('تعذّر توليد PDF. جرّب زر الطباعة.');
    } finally { setBusy(null); }
  };

  /** نسخة المالك: نسخ النص + حفظ إشعار كامل + فتح واتساب المالك فعلياً. */
  const doOwner = async () => {
    setBusy('owner'); setErr(''); setDone('');
    // لا نمنع انتقال الرابط: واتساب يفتح مباشرة بينما يكتمل النسخ/الحفظ في الخلفية.
    const copy = navigator.clipboard?.writeText(text).catch(() => { setManualCopy(true); });
    try {
      await Promise.all([copy, Promise.resolve(onSendToStoreOwner())]);
      setDone((ownerPhone ?? invoice.sellerPhone)
        ? 'تم نسخ النص وحفظ نسخة في الإشعارات، وفتح واتساب صاحب المتجر لإرسالها.'
        : 'تم نسخ النص وحفظ نسخة في الإشعارات. اختر جهة اتصال صاحب المتجر في واتساب ثم أرسل النص.');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'تعذّر حفظ نسخة صاحب المتجر');
    } finally { setBusy(null); }
  };

  const action = 'min-h-[44px] rounded-lg py-2 px-2 text-[12px] font-black flex items-center justify-center gap-1.5 disabled:opacity-50';
  return (
    <div className="fixed inset-0 z-[110] bg-black/60 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto overflow-x-hidden" dir="rtl">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="order-invoice-title"
        className="w-full max-w-md sm:max-w-2xl bg-white rounded-2xl shadow-2xl my-2 sm:my-0 max-h-[96dvh] flex flex-col overflow-hidden">
        <div className="bg-slate-900 text-white px-3 py-2.5 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3 id="order-invoice-title" className="text-[13px] font-black truncate flex items-center gap-1.5">
              <FileText className="w-4 h-4 shrink-0" /> {invoice.title}
            </h3>
            <p className="text-[10px] text-slate-300 font-mono truncate" dir="ltr">
              {invoice.invoiceNumber} • {invoice.orderNumber}
            </p>
          </div>
          <button ref={closeRef} onClick={onClose} disabled={!!busy} className="text-slate-300 hover:text-white shrink-0 min-w-11 min-h-11 flex items-center justify-center" aria-label="إغلاق الفاتورة">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 space-y-2.5 overflow-y-auto overflow-x-hidden text-slate-800 min-h-0" data-testid="invoice-body">
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-1.5 text-[11.5px]">
            <div className="rounded-lg border border-slate-200 p-2 min-w-0">
              <span className="block text-[10px] font-black text-sky-700">المورد</span>
              <span className="font-bold break-words">{invoice.seller}</span>
              {invoice.sellerPhone && <span className="block font-mono text-[10px] text-slate-500" dir="ltr">{invoice.sellerPhone}</span>}
            </div>
            <div className="rounded-lg border border-slate-200 p-2 min-w-0">
              <span className="block text-[10px] font-black text-sky-700">المشتري</span>
              <span className="font-bold break-words">{invoice.buyer}</span>
              {invoice.buyerPhone && <span className="block font-mono text-[10px] text-slate-500" dir="ltr">{invoice.buyerPhone}</span>}
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 grid grid-cols-1 min-[380px]:grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <div>رقم الفاتورة: <b className="font-mono" dir="ltr">{invoice.invoiceNumber}</b></div>
            <div>رقم الطلب: <b className="font-mono" dir="ltr">{invoice.orderNumber}</b></div>
            <div>التاريخ: {invoice.issuedAt}</div>
            <div>الحالة: <b>{invoice.status}</b></div>
            <div>الدفع: {invoice.payment}</div>
            <div>العملة: <b>{invoiceCurrencyLabel(invoice)}</b></div>
            {invoice.sellerReference && <div className="col-span-full">مرجع المورد: {invoice.sellerReference}</div>}
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 max-w-full">
            <table className="w-full min-w-[300px] table-fixed text-right text-[10px] min-[380px]:text-[11px]">
              <colgroup><col className="w-[7%]" /><col className="w-[33%]" /><col className="w-[18%]" /><col className="w-[21%]" /><col className="w-[21%]" /></colgroup>
              <thead className="bg-slate-100 text-slate-600">
                <tr><th className="px-1 py-1.5">#</th><th className="px-1 py-1.5">الصنف</th><th className="px-1 py-1.5">الكمية</th><th className="px-1 py-1.5">السعر (ج.س)</th><th className="px-1 py-1.5">الإجمالي (ج.س)</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.lines.map((l, i) => (
                  <tr key={`${l.name}-${i}`}>
                    <td className="px-1 py-1.5 text-slate-400">{i + 1}</td>
                    <td className="px-1 py-1.5 font-bold break-words">{l.name}</td>
                    <td className="px-1 py-1.5 font-mono break-words">{l.quantity} {l.unit}</td>
                    <td className="px-1 py-1.5 font-mono whitespace-nowrap">{money(l.unitPriceSdg)}</td>
                    <td className="px-1 py-1.5 font-mono font-bold whitespace-nowrap">{money(l.totalSdg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border-2 border-slate-900 p-2 space-y-1">
            {invoice.subtotalSdg !== invoice.totalSdg && <p className="text-[10px] text-slate-500">مجموع البنود: {money(invoice.subtotalSdg)} ج.س — الإجمالي أدناه هو المعتمد في الطلب.</p>}
            <div className="flex items-center justify-between gap-2 text-[14px] font-black">
              <span>الإجمالي المعتمد</span><span className="font-mono whitespace-nowrap">{money(invoice.totalSdg)} ج.س</span>
            </div>
            {foreign !== null && (
              <div className="flex items-center justify-between gap-2 text-[12px] text-emerald-800 font-black">
                <span>المطلوب بـ {invoice.currency}</span>
                <span className="font-mono whitespace-nowrap" data-testid="foreign-total">{money(foreign)} {invoice.currency}</span>
              </div>
            )}
            {invoice.currency !== 'SDG' && foreign === null && <p className="text-[11px] text-rose-700 font-bold">سعر الصرف غير صالح — لا يمكن حساب المطلوب بالعملة الأجنبية.</p>}
          </div>

          {invoice.note && <p className="text-[11px] text-slate-600 whitespace-pre-wrap">ملاحظة الطالب: {invoice.note}</p>}
          {invoice.sellerNote && <p className="text-[11px] text-slate-600 whitespace-pre-wrap">ملاحظة المورد: {invoice.sellerNote}</p>}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg border border-dashed border-slate-400 p-2 min-h-[64px]">
              <span className="block text-[10px] text-slate-500 mb-3">ختم المورد</span>
              <b className="text-[11px] text-sky-800 break-words">{invoice.stampText || invoice.seller}</b>
            </div>
            <div className="rounded-lg border border-dashed border-slate-400 p-2 min-h-[64px]">
              <span className="block text-[10px] text-slate-500 mb-3">توقيع المستلم</span>
            </div>
          </div>
          <p className="text-center text-[10px] text-slate-400">
            {[invoice.seller, invoice.sellerPhone, invoice.sellerAddress].filter(Boolean).join(' · ')}{invoice.sellerPhone || invoice.sellerAddress ? ' · ' : ''}منصة سند
          </p>
          {done && <p role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-2 text-[11px] font-bold text-emerald-800 flex items-start gap-1"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {done}</p>}
          {err && <p role="alert" className="rounded-lg bg-rose-50 border border-rose-200 px-2 py-2 text-[11px] font-bold text-rose-800 flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {err}</p>}
          {manualCopy && <textarea ref={copyRef} readOnly value={text} aria-label="نص الفاتورة للنسخ اليدوي" className="w-full h-40 rounded-lg border border-slate-300 p-2 text-[11px] font-mono" dir="rtl" />}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-2 space-y-1.5 max-h-[45dvh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={doPrint} disabled={!!busy} className={`${action} bg-white border border-slate-300 text-slate-800`}>{busy === 'print' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} طباعة</button>
            <button onClick={doPdf} disabled={!!busy} className={`${action} bg-sky-700 text-white`}>{busy === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF</button>
            <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={() => { setDone(''); setErr(''); onSendToBuyer(); if (!invoice.buyerPhone) setDone('لا يوجد رقم للمشتري — اختر جهة الاتصال في واتساب ثم أرسل النص.'); }} className={`${action} bg-emerald-600 text-white`}><MessageCircle className="w-4 h-4" /> إرسال للمشتري</a>
            <a href={canSendToOwner ? ownerWaUrl : undefined} target={canSendToOwner ? '_blank' : undefined} rel="noopener noreferrer" onClick={canSendToOwner ? () => { void doOwner(); } : (e) => e.preventDefault()} aria-disabled={!canSendToOwner} title={canSendToOwner ? 'نسخ نص الفاتورة وحفظ نسخة في الإشعارات وفتح واتساب صاحب المتجر' : 'متاح للمورد فقط'} className={`${action} bg-slate-900 text-white ${!canSendToOwner ? 'opacity-50 pointer-events-none' : ''}`}>{busy === 'owner' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />} نسخة لصاحب المتجر</a>
          </div>
          <button onClick={copyText} className={`${action} w-full bg-white border border-slate-300 text-slate-700`}><Copy className="w-3.5 h-3.5" /> نسخ نص الفاتورة</button>
          <p className="text-center text-[9.5px] text-slate-500 leading-relaxed">كل الخيارات تستخدم نفس المستند: <span dir="ltr">{invoice.invoiceNumber}</span> · {money(invoice.totalSdg)} ج.س</p>
        </div>
      </div>
    </div>
  );
};
