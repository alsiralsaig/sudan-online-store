import { db } from './db.ts';
import { notify } from './notifications.ts';
import { sendTelegram, telegramConfigured } from './telegram.ts';
import { sendNtfy, ntfyConfigured } from './ntfy.ts';

/**
 * Rate-move alerts.
 *
 * Whenever a fresh parallel-market snapshot is applied, any currency that moved
 * more than THRESHOLD percent gets:
 *   1. an in-app notification for merchants + platform admins (push included), and
 *   2. a WhatsApp message to the numbers in RATE_ALERT_WHATSAPP.
 *
 * WhatsApp delivery: there is no official free WhatsApp bot API, so this uses
 * CallMeBot (free, per-recipient API key). Configure:
 *   WHATSAPP_ALERT_PHONE   e.g. 249966704757          (recipient)
 *   WHATSAPP_CALLMEBOT_KEY the key CallMeBot sent you (sender authorisation)
 * The in-app notification always works; WhatsApp is skipped (and reported)
 * when the key is missing, so nothing silently fails.
 */

/*
 * عتبة التنبيه: 0.5% — أي تغيّر ملموس في سعر الصرف (10,500 ← 10,552) يستحق
 * إشعاراً فورياً؛ العتبة القديمة 3% كانت تُسكت تحركات السوق اليومية.
 */
export const THRESHOLD_PERCENT = 0.5;

/** عملات المنصة التي نراقبها فعلياً (الدولار أولاً — هو سعر التداول). */
const WATCHED = ['USD', 'SAR', 'AED', 'EUR', 'EGP'];

/**
 * مستقبلو التنبيه: يدعم أكثر من رقم — مفصولة بفاصلة، وكل رقم قد يحمل مفتاحه
 * الخاص بصيغة  phone:apikey  (لأن CallMeBot يصدر مفتاحاً لكل مستلم).
 * مثال:
 *   WHATSAPP_ALERT_PHONE=249966704757:123456,249912345678:654321
 *   WHATSAPP_CALLMEBOT_KEY=123456        (مفتاح افتراضي لو لم يُحدد للرقم)
 */
const RECIPIENTS: Array<{ phone: string; key: string }> = String(
  process.env.WHATSAPP_ALERT_PHONE || process.env.WHATSAPP_ALERT_RECIPIENTS || ''
)
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
  .map((item) => {
    const [rawPhone, rawKey] = item.split(':');
    return {
      phone: (rawPhone || '').replace(/[^\d]/g, ''),
      key: (rawKey || process.env.WHATSAPP_CALLMEBOT_KEY || '').trim(),
    };
  })
  .filter((r) => r.phone.length >= 9);

const CALLMEBOT_KEY = process.env.WHATSAPP_CALLMEBOT_KEY || '';
/**
 * Provider endpoint is configuration, never code: when the free bot changes
 * (new number / new gateway) only `WHATSAPP_API_URL` is replaced in the
 * hosting env and the next deploy is not required.
 */
const API_URL = process.env.WHATSAPP_API_URL || 'https://api.callmebot.com/whatsapp.php';
/** Text the provider returns when its free quota / user slots are exhausted. */
const QUOTA_MARKERS = ['full', 'limit', 'quota', 'not allowed', 'blocked', 'invalid apikey'];

export interface MoveAlert {
  code: string;
  name: string;
  previous: number;
  current: number;
  percent: number;
}

export interface AlertResult {
  triggered: MoveAlert[];
  inApp: number;
  whatsapp: { sent: number; skipped: string };
  telegram: { sent: number; skipped: string };
  ntfy: { sent: number; skipped: string };
}

/** Sends one WhatsApp text. Returns the provider verdict, never throws. */
const sendWhatsAppTo = async (
  text: string,
  recipient: { phone: string; key: string }
): Promise<{ ok: boolean; reason: string }> => {
  if (!recipient.phone || !recipient.key) return { ok: false, reason: 'NOT_CONFIGURED' };
  try {
    const url =
      `${API_URL}?phone=${encodeURIComponent(recipient.phone)}` +
      `&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(recipient.key)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const body = (await res.text().catch(() => '')).toLowerCase();
    if (QUOTA_MARKERS.some((m) => body.includes(m))) return { ok: false, reason: 'PROVIDER_FULL' };
    if (!res.ok) return { ok: false, reason: `HTTP_${res.status}` };
    return { ok: true, reason: '' };
  } catch (err) {
    return { ok: false, reason: (err as Error).name === 'AbortError' ? 'TIMEOUT' : 'NETWORK' };
  }
};

/** يرسل لكل المستقبلين ويجمع النتيجة. */
const sendWhatsApp = async (text: string): Promise<{ ok: boolean; reason: string; sent: number }> => {
  if (!RECIPIENTS.length) return { ok: false, reason: 'NOT_CONFIGURED', sent: 0 };
  let sent = 0;
  let reason = '';
  for (const recipient of RECIPIENTS) {
    const verdict = await sendWhatsAppTo(text, recipient);
    if (verdict.ok) sent += 1;
    else if (!reason) reason = verdict.reason;
  }
  return { ok: sent > 0, reason, sent };
};

/** اختبار الإرسال الحقيقي (زر «جرّب واتساب» في الإعدادات). */
export const sendWhatsAppTest = async (
  text: string
): Promise<{ configured: boolean; recipients: number; sent: number; reason: string }> => {
  const verdict = await sendWhatsApp(text);
  return {
    configured: RECIPIENTS.length > 0,
    recipients: RECIPIENTS.length,
    sent: verdict.sent,
    reason: verdict.reason,
  };
};

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/**
 * Compares the freshly applied rates with the previous parallel prices and
 * fires the alerts. Called right after `db.applyLiveRates(...)`.
 */
export const checkRateMoves = async (
  moves: MoveAlert[] = detectMoves()
): Promise<AlertResult> => {
  const result: AlertResult = {
    triggered: [],
    inApp: 0,
    whatsapp: { sent: 0, skipped: RECIPIENTS.length ? '' : 'NOT_CONFIGURED' },
    telegram: { sent: 0, skipped: telegramConfigured() ? '' : 'NOT_CONFIGURED' },
    ntfy: { sent: 0, skipped: ntfyConfigured() ? '' : 'NOT_CONFIGURED' },
  };

  const today = new Date().toISOString().slice(0, 10);

  for (const move of moves) {
    const already = db
      .getRateAlertLog()
      .some((a) => a.code === move.code && a.day === today);
    if (already) continue;

    result.triggered.push(move);

    const direction = move.percent > 0 ? 'ارتفع' : 'انخفض';
    const title = `${move.name} ${direction} ${Math.abs(move.percent)}% في السوق الموازي`;
    const body =
      `سعر ${move.name} (${move.code}) ${direction} من ${fmt(move.previous)} إلى ` +
      `${fmt(move.current)} ج.س — تغيّر ${move.percent > 0 ? '+' : ''}${move.percent}%. ` +
      `راجع أسعار البيع والتكلفة قبل التعامل القادم.`;

    try {
      await notify({
        app: 'merchant',
        kind: 'system',
        title,
        body,
        linkTab: 'currencies',
        dedupeKey: `rate_move_${move.code}_${today}`,
        telegram: false,
      });
      await notify({
        app: 'admin',
        kind: 'system',
        title,
        body,
        linkTab: 'currencies',
        dedupeKey: `rate_move_admin_${move.code}_${today}`,
        telegram: false,
      });
      result.inApp += 2;
    } catch (err) {
      console.warn('[rate-alert] in-app failed:', (err as Error).message);
    }

    if (RECIPIENTS.length) {
      const verdict = await sendWhatsApp(`📉 *منصة سند* — تنبيه سعر\n\n${body}`);
      if (verdict.sent) result.whatsapp.sent += verdict.sent;
      else if (!result.whatsapp.skipped) result.whatsapp.skipped = verdict.reason;
    }

    /*
     * ntfy: قناة الجوال الفورية — لا تحتاج حساباً ولا مفتاحاً ولا انتظار مزوّد.
     * اشتغل عليها الزر «جرّب التنبيه» في الإعدادات، وهي البديل العملي حين
     * تكون حصة واتساب المجانية ممتلئة.
     */
    if (ntfyConfigured()) {
      const arrow = move.percent > 0 ? '📈' : '📉';
      const verdict = await sendNtfy(
        `${arrow} ${move.name}: ${fmt(move.current)} ج.س`,
        `${move.name} (${move.code}) ${move.percent > 0 ? 'ارتفع' : 'انخفض'} ${Math.abs(move.percent)}% — من ${fmt(move.previous)} إلى ${fmt(move.current)} ج.س. المصدر: السوق الموازي.`,
        { priority: 4, tags: 'moneybag', dedupe: false }
      );
      if (verdict.sent) result.ntfy.sent += verdict.sent;
      else if (!result.ntfy.skipped) result.ntfy.skipped = verdict.skipped;
    }

    // Telegram is the card-free channel: sent once per move (not per app).
    if (telegramConfigured()) {
      const arrow = move.percent > 0 ? '📈' : '📉';
      const verdict = await sendTelegram(
        `${arrow} *تنبيه سعر — منصة سند*\n\n` +
          `*${move.name}* (${move.code})\n` +
          `السوق الموازي: ${fmt(move.current)} ج.س\n` +
          `السابق: ${fmt(move.previous)} ج.س\n` +
          `التغيّر: ${move.percent > 0 ? '+' : ''}${move.percent}%`
      );
      if (verdict.sent) result.telegram.sent += verdict.sent;
      else if (!result.telegram.skipped) result.telegram.skipped = verdict.skipped;
    }

    db.markRateAlerted(move.code, move.percent, move.current);
  }

  return result;
};

/** Reads `lastMovePercent` written by db.applyLiveRates and keeps the big ones. */
export function detectMoves(): MoveAlert[] {
  const moves: MoveAlert[] = [];
  for (const c of db.getSchema().currencies) {
    if (c.isBase) continue;
    const pct = (c as any).lastMovePercent;
    if (typeof pct !== 'number' || !Number.isFinite(pct)) continue;
    if (Math.abs(pct) < THRESHOLD_PERCENT) continue;
    const previous = c.parallelRate ? c.parallelRate / (1 + pct / 100) : c.rateToSdg;
    moves.push({
      code: c.code,
      name: c.name,
      previous: Math.round(previous * 100) / 100,
      current: c.rateToSdg,
      percent: pct,
    });
  }
  return moves;
}

/**
 * فحص فوري: يقارن لقطة قديمة بلقطة جديدة ويُطلق التنبيهات مباشرة.
 * ------------------------------------------------------------------
 * كان الفحص يعتمد على `lastMovePercent` المحفوظ في جدول العملات، وهو يُحسب
 * مقابل السعر القديم المخزّن فقط — فأي مقارنة بين لقطتين لا تُطلق شيئاً.
 * بهذه الدالة يعمل «تحديث السعر» في التطبيق وكرون كل ساعة بتنbيه حقيقي.
 */
export const checkRateMovesBetween = async (
  previous: { rates?: Array<{ code: string; parallel?: number | null; official?: number | null }> } | null,
  current: { rates?: Array<{ code: string; parallel?: number | null; official?: number | null }> } | null
): Promise<AlertResult> => {
  const moves: MoveAlert[] = [];
  const pickRate = (snap: any, code: string) => {
    const r = (snap?.rates || []).find((x: any) => x.code === code);
    const v = r?.parallel ?? r?.official ?? null;
    return typeof v === 'number' && v > 0 ? v : null;
  };
  for (const code of WATCHED) {
    const before = pickRate(previous, code);
    const after = pickRate(current, code);
    if (before === null || after === null || before === after) continue;
    const pct = Number((((after - before) / before) * 100).toFixed(2));
    if (Math.abs(pct) < THRESHOLD_PERCENT) continue;
    const meta = db.getSchema().currencies.find((c) => c.code === code);
    moves.push({
      code,
      name: meta?.name || code,
      previous: before,
      current: after,
      percent: pct,
    });
  }
  if (!moves.length) {
    return {
      triggered: [],
      inApp: 0,
      whatsapp: { sent: 0, skipped: '' },
      telegram: { sent: 0, skipped: '' },
      ntfy: { sent: 0, skipped: '' },
    };
  }
  return checkRateMoves(moves);
};

export const whatsappConfigured = (): boolean => RECIPIENTS.length > 0;
export const whatsappRecipientCount = (): number => RECIPIENTS.length;

/** Host of the configured gateway, safe to expose (no key, no phone). */
export const whatsappProviderHost = (): string => {
  try {
    return new URL(API_URL).host;
  } catch {
    return 'invalid-url';
  }
};
