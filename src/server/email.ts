/**
 * قناة التنبيه بالبريد — البديل المجاني اللي ما يحتاج تليجرام ولا كارت.
 *
 * ليه البريد: صاحب المتجر ما عنده تليجرام، والواتساب المجاني محدود جداً
 * وممكن يتوقف بدون إشعار. Resend بيدي ٣٠٠٠ رسالة شهرياً مجاناً بلا كارت،
 * وبلا دومين كمان: ترسل من onboarding@resend.dev لإيميلك المسجّل نفسه.
 *
 * الإعداد (Vercel → Environment Variables):
 *   RESEND_API_KEY     مفتاح من resend.com/api-keys
 *   ALERT_EMAIL_TO     الإيميل اللي توصله التنبيهات
 *   ALERT_EMAIL_FROM   اختياري، افتراضياً "Sanad Alerts <onboarding@resend.dev>"
 *
 * ما بيرمي أخطاء أبداً: لو البريد فشل، باقي النظام يشتغل عادي.
 */

const API_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 8000;

export interface EmailVerdict {
  sent: number;
  skipped: string;
}

const apiKey = () => String(process.env.RESEND_API_KEY || '').trim();
const recipients = () =>
  String(process.env.ALERT_EMAIL_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.includes('@'));
const sender = () =>
  String(process.env.ALERT_EMAIL_FROM || 'Sanad Alerts <onboarding@resend.dev>').trim();

export const emailConfigured = (): boolean => !!apiKey() && recipients().length > 0;

/** يحوّل نص التقرير (اللي بيُكتب للـtelegram بـmarkdown) لبريد مقروء. */
export function toEmailBody(report: string): string {
  return report
    .replace(/\*/g, '')
    .replace(/^✅ /gm, '[سليم] ')
    .replace(/^❌ /gm, '[مشكلة] ')
    .replace(/^🚨 /gm, '[تنبيه] ')
    .replace(/^🕒 /gm, 'الوقت: ');
}

export function emailSubject(report: string): string {
  return report.includes('🚨') || report.includes('❌')
    ? 'تنبيه سند: في مشكلة محتاجة نظرة'
    : 'سند: كل الفحوصات سليمة';
}

export async function sendEmail(subject: string, report: string): Promise<EmailVerdict> {
  const key = apiKey();
  const to = recipients();
  if (!key) return { sent: 0, skipped: 'NOT_CONFIGURED' };
  if (to.length === 0) return { sent: 0, skipped: 'NO_RECIPIENT' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: sender(), to, subject, text: toEmailBody(report) }),
      signal: controller.signal,
    });
    const payload: any = await res.json().catch(() => null);
    if (res.ok && payload?.id) return { sent: to.length, skipped: '' };
    return { sent: 0, skipped: `API_${payload?.statusCode ?? res.status}` };
  } catch (err) {
    return { sent: 0, skipped: (err as Error).name === 'AbortError' ? 'TIMEOUT' : 'NETWORK' };
  } finally {
    clearTimeout(timer);
  }
}
