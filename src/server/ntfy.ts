/**
 * قناة ntfy — تنبيه على الجوال بلا اشتراك ولا بطاقة ولا حساب.
 *
 * ليه: تليجرام صار يطلب «رسوم رسائل نصية» على بعض الدول (السودان منها) عند
 * تسجيل الدخول، والدفع غير متاح بلا فيزا/ماستركارد. وntfy لا يحتاج أي تسجيل:
 * اسم قناة فقط، وتطبيق على الجوال يشترك في الاسم، فيوصل التنبيه في ثانية.
 *
 * الضبط (اختياري — القيمة الافتراضية تعمل بلا أي إعداد):
 *   NTFY_TOPIC    اسم القناة (افتراضياً قناة سند الخاصة)
 *   NTFY_SERVER   خادم آخر عند الحاجة (افتراضياً https://ntfy.sh)
 *   NTFY_KINDS    أنواع التنبيهات المرسلة، مفصولة بفواصل (افتراضياً all)
 *
 * قاعدة أمان: القناة الداخلية مكشوفة لمن يعرف اسمها، فالرسائل هنا لا تحتوي
 * على كلمات مرور ولا بيانات دفع. مُعرّف القناة لا يُعاد للعميل إلا مقنّعاً.
 */

/** قناة سند — منفصلة عن قناة منصة الطالب السوداني حتى لا تختلط التنبيهات */
const DEFAULT_TOPIC = 'sanad-alerts-x7k2m9';

const topic = () => String(process.env.NTFY_TOPIC || DEFAULT_TOPIC).trim();
const server = () => String(process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/+$/, '');
const kindList = () =>
  String(process.env.NTFY_KINDS || 'all')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export interface NtfyVerdict {
  sent: number;
  skipped: string;
}

export const ntfyConfigured = (): boolean => !!topic();

export const ntfyEnabledFor = (kind?: string): boolean => {
  if (!ntfyConfigured()) return false;
  const kinds = kindList();
  if (kinds.includes('all')) return true;
  return !!kind && kinds.includes(String(kind).toLowerCase());
};

/** إرسال تنبيه واحد. لا يرمي استثناءً أبداً. */
export async function sendNtfy(
  title: string,
  body: string,
  opts: { priority?: 1 | 2 | 3 | 4 | 5; tags?: string } = {}
): Promise<NtfyVerdict> {
  const t = topic();
  if (!t) return { sent: 0, skipped: 'NOT_CONFIGURED' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    /*
     * النشر عبر JSON لا عبر الترويسات: fetch في Node يرفض أي حرف عربي
     * داخل قيمة ترويسة، وتشفيره بـencodeURIComponent يجعل العنوان يظهر
     * للمستخدم رموزاً (%D8%AA…). الـJSON يقبل UTF-8 كما هو.
     */
    const res = await fetch(`${server()}/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        topic: t,
        title: title.slice(0, 120),
        message: body.slice(0, 1500),
        priority: opts.priority ?? 3,
        ...(opts.tags ? { tags: opts.tags.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
      }),
      signal: controller.signal,
    });
    if (res.ok) return { sent: 1, skipped: '' };
    return { sent: 0, skipped: `API_${res.status}` };
  } catch (err) {
    return { sent: 0, skipped: (err as Error).name === 'AbortError' ? 'TIMEOUT' : 'NETWORK' };
  } finally {
    clearTimeout(timer);
  }
}

/** وصف مقنّع لحالة القناة — آمن لعرضه في الواجهة */
export const ntfyStatus = () => {
  const t = topic();
  const masked = t ? `${t.slice(0, 4)}…${t.slice(-3)}` : '';
  return { configured: ntfyConfigured(), topic: masked, kinds: kindList() };
};
