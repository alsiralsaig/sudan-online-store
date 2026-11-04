/** PDF عربي A4 من نفس مستند المعاينة/الطباعة، مع تقسيم عند حدود الصفوف. */
import type { OrderInvoiceModel } from './orderInvoice';
import { assertInvoiceCanvasReadable, mountInvoiceFrame, type InvoiceFrame } from './orderInvoiceDocument';
import { isSanadAndroidShell, openExternalFromApp, sanadAndroidBridge } from './nativeShell';
import { api } from './api';

export interface PdfResult {
  ok: boolean;
  fileName?: string;
  error?: string;
}

export async function downloadOrderInvoicePdf(model: OrderInvoiceModel, opts: { orderId?: string } = {}): Promise<PdfResult> {
  if (typeof document === 'undefined') return { ok: false, error: 'التوليد متاح في المتصفح فقط.' };
  let frame: InvoiceFrame | null = null;
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);
    // المستند يُركّب في iframe أبيض معزول: لا يرث الوضع الداكن ولا قواعد
    // طباعة الإيصال الحراري التي كانت تُنتج صفحة سوداء/فارغة على الجوال.
    frame = await mountInvoiceFrame(model, 'pdf');
    const target = frame.target;
    const canvas = await html2canvas(target, {
      backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false,
      windowWidth: 794, width: 794, scrollX: 0, scrollY: 0,
    });
    assertInvoiceCanvasReadable(canvas);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    pdf.setProperties({ title: `${model.title} ${model.invoiceNumber}`, subject: model.orderNumber, creator: 'Sanad' });
    const margin = 8;
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW - margin * 2;
    const pxPerMm = canvas.width / imgW;
    const pagePx = Math.floor((pageH - margin * 2) * pxPerMm);
    const targetTop = target.getBoundingClientRect().top;
    const scaleY = canvas.height / target.getBoundingClientRect().height;
    // لا نقطع صف بند أو مربع توقيع بين صفحتين عندما تتوفر مساحة كافية في الصفحة التالية.
    const breaks = Array.from(target.querySelectorAll('tbody tr,.totals,.sign,.note,.foot'))
      .map((el) => Math.ceil((el.getBoundingClientRect().bottom - targetTop) * scaleY))
      .filter((n) => n > 0 && n < canvas.height)
      .sort((a, b) => a - b);
    let offset = 0;
    let page = 0;
    while (offset < canvas.height) {
      const limit = Math.min(offset + pagePx, canvas.height);
      const safe = breaks.filter((n) => n > offset + 20 && n <= limit).pop();
      const end = limit === canvas.height ? limit : (safe ?? limit);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.max(1, end - offset);
      const ctx = slice.getContext('2d');
      if (!ctx) throw new Error('تعذّر تجهيز صفحة PDF');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, offset, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, imgW, slice.height / pxPerMm);
      offset = end;
      page += 1;
    }
    const safe = String(model.invoiceNumber || model.orderNumber || 'invoice').replace(/[^\w-]/g, '_');
    const fileName = `Sanad-${safe}.pdf`;
    // Explicit anchored blob download with an ASCII filename: some mobile
    // WebViews drop non-ASCII download names and save the file as "download".
    const blob = pdf.output('blob');
    // غلاف أندرويد لا يفتح blob: لذلك نرفع PDF إلى رابط HTTPS عام ثم نفتحه في النظام.
    if (isSanadAndroidShell()) {
      const bridge = sanadAndroidBridge();
      const base64 = await blobToBase64(blob);
      if (bridge?.savePdf) {
        bridge.savePdf(base64, fileName);
        return { ok: true, fileName };
      }
      if (!opts.orderId) throw new Error('معرّف الطلب غير متاح لحفظ PDF');
      const res = await api.uploadSupplyOrderInvoicePdf(opts.orderId, base64, fileName);
      if (!res?.url) throw new Error('لم يرجع السيرفر رابط PDF');
      /* ?download=1 يجعل التخزين يرد بـContent-Disposition: attachment
         فيحفظ النظام الملف بدل عرضه داخل تبويب المتصفح. نضمنه هنا أيضاً
         فلا نعتمد على إصدار الخادم وحده. */
      const downloadUrl = /[?&]download=1/.test(res.url)
        ? res.url
        : `${res.url}${res.url.includes('?') ? '&' : '?'}download=1`;
      openExternalFromApp(downloadUrl);
      return { ok: true, fileName };
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { ok: true, fileName };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '';
    return { ok: false, error: message ? `تعذّر توليد PDF: ${message}` : 'تعذّر توليد PDF. جرّب زر الطباعة.' };
  } finally {
    frame?.remove();
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('تعذّر قراءة PDF'));
    reader.readAsDataURL(blob);
  });
}
