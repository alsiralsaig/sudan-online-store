/**
 * Isolated A4 document helpers for merchant supply invoices.
 * Printing and PDF both render inside a same-origin iframe so the merchant
 * shell (dark theme, thermal-receipt @media print rules, fixed overlays) can
 * never leak into the paper output.
 */
import { ORDER_INVOICE_CSS, escapeHtml, orderInvoiceMarkup, type OrderInvoiceModel } from './orderInvoice';

export function orderInvoicePaperHtml(model: OrderInvoiceModel, mode: 'print' | 'pdf'): string {
  const page = mode === 'print'
    ? 'html,body{margin:0;padding:0;background:#fff!important;color:#0f172a!important}body{padding:8mm}@page{size:A4;margin:8mm}'
    : 'html,body{margin:0;padding:0;background:#fff!important;color:#0f172a!important}.sanad-invoice-document{width:794px;padding:24px}';
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(model.title)} — ${escapeHtml(model.invoiceNumber)}</title>
  <style>${ORDER_INVOICE_CSS}\n${page}\n*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>
  </head><body>${orderInvoiceMarkup(model)}</body></html>`;
}

export interface InvoiceFrame {
  iframe: HTMLIFrameElement;
  doc: Document;
  win: Window;
  target: HTMLElement;
  remove: () => void;
}

/** Mount a white, isolated invoice document and wait until it is laid out. */
export async function mountInvoiceFrame(model: OrderInvoiceModel, mode: 'print' | 'pdf'): Promise<InvoiceFrame> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  iframe.title = `مستند الفاتورة ${model.invoiceNumber}`;
  iframe.dataset.testid = mode === 'print' ? 'invoice-print-frame' : 'invoice-pdf-frame';
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1200px;border:0;pointer-events:none;background:#fff';
  const loaded = new Promise<void>((resolve, reject) => {
    iframe.onload = () => resolve();
    iframe.onerror = () => reject(new Error('تعذّر تحميل مستند الفاتورة'));
  });
  iframe.srcdoc = orderInvoicePaperHtml(model, mode);
  document.body.appendChild(iframe);
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('انتهت مهلة تجهيز مستند الفاتورة')), 10_000));
  await Promise.race([loaded, timeout]);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  const target = doc?.querySelector<HTMLElement>('.sanad-invoice-document');
  if (!doc || !win || !target) {
    iframe.remove();
    throw new Error('مستند الفاتورة غير متاح');
  }
  if (doc.fonts?.ready) await doc.fonts.ready;
  await new Promise<void>((r) => win.requestAnimationFrame(() => win.requestAnimationFrame(() => r())));
  const height = Math.max(1, Math.ceil(target.getBoundingClientRect().height));
  iframe.style.height = `${height}px`;
  return { iframe, doc, win, target, remove: () => iframe.remove() };
}

/** One print button: isolated iframe first, same-page A4 fallback second. */
export async function printOrderInvoiceDocument(model: OrderInvoiceModel): Promise<{ ok: boolean; method: 'iframe' | 'inline'; error?: string }> {
  let frame: InvoiceFrame | null = null;
  try {
    frame = await mountInvoiceFrame(model, 'print');
    const { win, iframe } = frame;
    if (typeof win.print !== 'function') throw new Error('الطباعة غير مدعومة في هذا الإطار');
    const cleanup = () => iframe.remove();
    win.addEventListener('afterprint', cleanup, { once: true });
    win.focus();
    win.print();
    setTimeout(cleanup, 60_000);
    return { ok: true, method: 'iframe' };
  } catch (err) {
    frame?.remove();
    return printInlineInvoiceDocument(model, err);
  }
}

function printInlineInvoiceDocument(model: OrderInvoiceModel, cause: unknown): { ok: boolean; method: 'inline'; error?: string } {
  document.getElementById('sanad-inline-print')?.remove();
  const host = document.createElement('div');
  host.id = 'sanad-inline-print';
  const style = document.createElement('style');
  style.textContent = ORDER_INVOICE_CSS;
  const content = document.createElement('div');
  content.innerHTML = orderInvoiceMarkup(model);
  host.append(style, content);
  document.body.appendChild(host);
  document.body.classList.add('sanad-invoice-printing');
  const cleanup = () => {
    host.remove();
    document.body.classList.remove('sanad-invoice-printing');
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  try {
    window.print();
    setTimeout(cleanup, 60_000);
    return { ok: true, method: 'inline' };
  } catch (err) {
    cleanup();
    const message = err instanceof Error ? err.message : cause instanceof Error ? cause.message : '';
    return { ok: false, method: 'inline', error: message ? `تعذّر فتح الطباعة: ${message}` : 'تعذّر فتح الطباعة. نزّل PDF ثم اطبعه من تطبيق الملفات.' };
  }
}

/** Reject blank/black captures before they become a downloadable PDF. */
export function assertInvoiceCanvasReadable(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width < 100 || canvas.height < 100) throw new Error('صفحة PDF فارغة');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let dark = 0;
  let ink = 0;
  let samples = 0;
  const step = Math.max(4, Math.floor(canvas.width / 160)) * 4;
  for (let y = 0; y < canvas.height; y += Math.max(4, Math.floor(canvas.height / 200))) {
    for (let x = 0; x < canvas.width; x += step / 4) {
      const i = (y * canvas.width + x) * 4;
      const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      samples++;
      if (luma < 80) dark++;
      if (luma < 245) ink++;
    }
  }
  if (!samples) throw new Error('صفحة PDF فارغة');
  if (dark / samples > 0.35) throw new Error('تم منع تنزيل صفحة سوداء — أعد المحاولة');
  if (ink / samples < 0.002) throw new Error('صفحة PDF بيضاء بلا محتوى — أعد المحاولة');
}
