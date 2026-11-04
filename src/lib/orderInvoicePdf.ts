/** PDF عربي A4 من نفس مستند المعاينة/الطباعة، مع تقسيم عند حدود الصفوف. */
import type { OrderInvoiceModel } from './orderInvoice';
import { assertInvoiceCanvasReadable, mountInvoiceFrame, type InvoiceFrame } from './orderInvoiceDocument';

export interface PdfResult {
  ok: boolean;
  fileName?: string;
  error?: string;
}

export async function downloadOrderInvoicePdf(model: OrderInvoiceModel): Promise<PdfResult> {
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
    const url = URL.createObjectURL(pdf.output('blob'));
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
