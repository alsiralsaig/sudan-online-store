/**
 * مراقبة سند — تنبيهات تليجرام + فحص دوري.
 *
 * ليه موجود: مرة واحدة قعد المتجر واقف ساعات لأن حصة قاعدة البيانات خلصت،
 * وما حد عرف غير لما المستخدمين اشتكوا. الملف ده بيخلي النظام يقول بنفسه.
 *
 * القواعد:
 *  • الفحص ما بيرمي أخطاء أبداً — لو الفحص نفسه فشل، ده مش سبب يوقف أي حاجة.
 *  • الرسائل بتتبعت لتليجرام (القناة المجانية الوحيدة اللي ما تحتاج كارت).
 *  • ما بنكرر نفس الرسالة كل دقيقة: في كتم زمني لكل نوع مشكلة.
 *  • لما المشكلة تتحل، بنبعت رسالة «رجعت تمام» — عشان تعرف تقفل الموضوع.
 */
import { sendTelegram, telegramConfigured } from './telegram.ts';
import { isDbEnabled, dbTarget, lastDbError } from './pg.ts';
import { storageMode } from './storage.ts';

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export interface WatchReport {
  ok: boolean;
  checks: Check[];
  problems: Check[];
  text: string;
}

/** يبني التقرير من نتائج الفحوصات — مفصول عن التنفيذ عشان يُختبر بدون شبكة. */
export function buildReport(checks: Check[], at = new Date()): WatchReport {
  const problems = checks.filter((c) => !c.ok);
  const stamp = at.toISOString().slice(0, 16).replace('T', ' ');
  const lines: string[] = [];

  if (problems.length === 0) {
    lines.push('✅ *سند بخير*');
  } else {
    lines.push('🚨 *مشكلة في سند*');
  }
  lines.push(`🕒 ${stamp} UTC`);

  for (const c of checks) {
    lines.push(`${c.ok ? '✅' : '❌'} ${c.name}: ${c.detail}`);
  }

  if (problems.length > 0) {
    lines.push('');
    lines.push('الخطوة الأولى: افتح /api/health وشوف رد قاعدة البيانات.');
  }

  return { ok: problems.length === 0, checks, problems, text: lines.join('\n') };
}

/** كتم التنبيهات: نفس المشكلة ما تتبعتش مرتين في نص ساعة. */
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;
let lastAlertAt = 0;
let lastAlertKey = '';
let lastWasHealthy = true;

export function shouldSendAlert(key: string, now = Date.now()): boolean {
  if (key === lastAlertKey && now - lastAlertAt < ALERT_COOLDOWN_MS) return false;
  lastAlertKey = key;
  lastAlertAt = now;
  return true;
}

/** تصفير الحالة — للاختبارات فقط. */
export function resetAlertState(): void {
  lastAlertAt = 0;
  lastAlertKey = '';
  lastWasHealthy = true;
}

export interface WatchDeps {
  checkDb: () => Promise<Check>;
  checkStorage: () => Check;
  notify: (text: string) => Promise<{ sent: number; skipped: string }>;
}

/** التقرير الكامل مع إرسال التنبيه لو في مشكلة (أو لو رجعت لطبيعتها). */
export async function runWatch(deps: WatchDeps): Promise<WatchReport & { notified: string }> {
  const checks: Check[] = [];
  try {
    checks.push(await deps.checkDb());
  } catch (err) {
    checks.push({ name: 'قاعدة البيانات', ok: false, detail: `فشل الفحص: ${(err as Error).message.slice(0, 80)}` });
  }
  try {
    checks.push(deps.checkStorage());
  } catch (err) {
    checks.push({ name: 'تخزين الملفات', ok: false, detail: `فشل الفحص: ${(err as Error).message.slice(0, 80)}` });
  }

  const report = buildReport(checks);

  let notified = 'SKIPPED';
  /** فشل قناة التنبيه نفسه ما لازم يكسر الفحص ولا يرجّع استثناء. */
  const notifySafe = async (text: string) => {
    try {
      return await deps.notify(text);
    } catch (err) {
      return { sent: 0, skipped: `THREW:${(err as Error).message.slice(0, 40)}` };
    }
  };
  const key = report.problems.map((p) => p.name).sort().join('|');
  if (!report.ok) {
    if (shouldSendAlert(key)) {
      const verdict = await notifySafe(report.text);
      notified = verdict.sent > 0 ? 'SENT' : `FAILED:${verdict.skipped}`;
      lastWasHealthy = false;
    } else {
      notified = 'THROTTLED';
    }
  } else if (!lastWasHealthy) {
    // رجعت سليمة بعد مشكلة — أبعت طمأنة لمرة واحدة.
    const verdict = await notifySafe('✅ *سند رجع تمام*\nكل الفحوصات سليمة الآن.');
    notified = verdict.sent > 0 ? 'RECOVERY_SENT' : `FAILED:${verdict.skipped}`;
    lastWasHealthy = true;
  }

  return { ...report, notified };
}

/** الفحص الحقيقي: قاعدة البيانات + التخزين. */
export async function runWatchdog(): Promise<WatchReport & { notified: string; telegram: boolean }> {
  const { query } = await import('./pg.ts');

  const checkDb = async (): Promise<Check> => {
    if (!isDbEnabled()) {
      return { name: 'قاعدة البيانات', ok: false, detail: 'DATABASE_URL غير مضبوط' };
    }
    try {
      const t0 = Date.now();
      const { rows } = await query('SELECT 1 AS ok');
      const ms = Date.now() - t0;
      if (!rows[0]) return { name: 'قاعدة البيانات', ok: false, detail: 'ما رجعت نتيجة' };
      const tables = await query(
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'sanad%'"
      );
      return {
        name: 'قاعدة البيانات',
        ok: true,
        detail: `${ms}ms · ${tables.rows[0]?.n ?? 0} جدول · ${String(dbTarget()).split(' ')[0]}`,
      };
    } catch (err) {
      const msg = (err as Error).message || String(err);
      return { name: 'قاعدة البيانات', ok: false, detail: msg.slice(0, 120) };
    }
  };

  const checkStorage = (): Check => {
    const mode = storageMode();
    if (mode === 'blob') {
      return { name: 'تخزين الملفات', ok: true, detail: 'Blob مربوط' };
    }
    return {
      name: 'تخزين الملفات',
      ok: false,
      detail: 'غير مربوط — الملفات بتتخزن في القاعدة (خطر على الحصة)',
    };
  };

  return {
    ...(await runWatch({ checkDb, checkStorage, notify: sendTelegram })),
    telegram: telegramConfigured(),
  };
}

/**
 * تنبيه فوري عند فشل قاعدة البيانات جوه أي طلب عادي.
 *
 * الفحص الدوري على الخطة المجانية مرة واحدة في اليوم، وده مش كفاية. هنا
 * أول ما أي طلب يفشل، بنبعت تنبيه مرة واحدة (وبكتم نص ساعة لنفس الخطأ).
 */
export function alertDbFailure(err: unknown): void {
  const message = (err as Error)?.message || String(err);
  if (!shouldSendAlert(`db:${message.slice(0, 60)}`)) return;
  const text = [
    '🚨 *قاعدة بيانات سند فشلت*',
    `الخطأ: ${message.slice(0, 200)}`,
    lastDbError && lastDbError !== message ? `سابقاً: ${lastDbError.slice(0, 120)}` : '',
    '',
    'الفحص: /api/health',
  ]
    .filter(Boolean)
    .join('\n');
  // ما بننتظر الرد: الطلب الأصلي ما لازم يتأخر بسبب تليجرام.
  void sendTelegram(text).catch(() => {});
}
