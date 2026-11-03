/**
 * توليد الفاتورة كملف PDF — مشاركة/تنزيل مباشر بلا طباعة.
 *
 * لماذا html2canvas + jsPDF؟
 *  • jsPDF وحده لا يدعم العربية (يحتاج ملف خط مضمَّن ~200KB عبر VFS).
 *  • الحل: نرسم الفاتورة بـ HTML (نفس تنسيق الطباعة، خطوط النظام العربية)
 *    ← نحوّلها صورة ← نضعها في صفحة A4 داخل PDF. النتيجة عربية صحيحة 100%.
 *
 * الملف يُنزَّل باسم فاتورة-<رقم>.pdf ويجهز للمشاركة على واتساب مباشرة.
 * (html2canvas و jsPDF يُحمّلان عند الاستخدام فقط — لا يزيدان حجم التطبيق الأساسي)
 */
import { orderInvoiceHtml, type OrderInvoiceModel } from './orderInvoice';

/** يبني عنصر DOM مخفي بالفاتورة، جاهزاً للرسم */
function mountInvoiceElement(html: string): { wrapper: HTMLDivElement; target: HTMLElement } {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.top = '-10000px';
  wrapper.style.left = '0';
  wrapper.style.width = '820px';
  wrapper.style.background = '#ffffff';
  wrapper.style.zIndex = '-1';
  wrapper.innerHTML = html;

  // نستخرج body فقط (بدون سكربت الطباعة) ونعيد بناءه داخل الحاوية
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.querySelectorAll('script').forEach((s) => s.remove());
  const target = document.createElement('div');
  target.setAttribute('dir', 'rtl');
  target.style.width = '820px';
  target.style.padding = '18px';
  target.style.background = '#ffffff';
  target.innerHTML = (parsed.body?.innerHTML || '').trim();

  wrapper.innerHTML = '';
  wrapper.appendChild(target);
  document.body.appendChild(wrapper);
  return { wrapper, target };
}

export interface PdfResult {
  ok: boolean;
  /** اسم الملف عند النجاح */
  fileName?: string;
  /** رسالة خطأ مقروءة عند الفشل */
  error?: string;
}

/**
 * ينزّل الفاتورة PDF. يرجّع نتيجة صريحة بدل رمي استثناء،
 * عشان الواجهة تقدر تقول للمستخدم إيه اللي حصل.
 */
export async function downloadOrderInvoicePdf(model: OrderInvoiceModel): Promise<PdfResult> {
  if (typeof document === 'undefined') return { ok: false, error: 'التوليد متاح في المتصفح فقط.' };

  let wrapper: HTMLDivElement | null = null;
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const mounted = mountInvoiceElement(orderInvoiceHtml(model));
    wrapper = mounted.wrapper;

    // انتظار الخطوط والصور قبل الرسم (وإلا يطلع نص مبتور)
    if (document.fonts?.ready) await document.fonts.ready;

    const canvas = await html2canvas(mounted.target, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height * imgW) / canvas.width;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    if (imgH <= pageH - margin * 2) {
      pdf.addImage(dataUrl, 'JPEG', margin, margin, imgW, imgH);
    } else {
      // الفاتورة أطول من صفحة: نقسّمها بمقدار الصفحة عبر إزاحة سلبية
      let remaining = imgH;
      let offset = 0;
      while (remaining > 0) {
        pdf.addImage(dataUrl, 'JPEG', margin, margin - offset, imgW, imgH);
        remaining -= pageH - margin * 2;
        offset += pageH - margin * 2;
        if (remaining > 0) pdf.addPage();
      }
    }

    const safe = String(model.invoiceNumber || model.orderNumber || 'invoice').replace(/[^\w\u0600-\u06FF\-]/g, '_');
    const fileName = `فاتورة-${safe}.pdf`;
    pdf.save(fileName);
    return { ok: true, fileName };
  } catch (err: any) {
    return { ok: false, error: err?.message ? `تعذّر توليد PDF: ${err.message}` : 'تعذّر توليد PDF' };
  } finally {
    wrapper?.remove();
  }
}
