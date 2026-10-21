import { db } from './db.ts';
import { notify } from './notifications.ts';

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

export const THRESHOLD_PERCENT = 3;

const PHONE = (process.env.WHATSAPP_ALERT_PHONE || '').replace(/[^\d]/g, '');
const CALLMEBOT_KEY = process.env.WHATSAPP_CALLMEBOT_KEY || '';

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
}

/** Sends one WhatsApp text. Returns true when the provider accepted it. */
const sendWhatsApp = async (text: string): Promise<boolean> => {
  if (!PHONE || !CALLMEBOT_KEY) return false;
  try {
    const url =
      `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(PHONE)}` +
      `&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(CALLMEBOT_KEY)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
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
    whatsapp: { sent: 0, skipped: !PHONE || !CALLMEBOT_KEY ? 'NOT_CONFIGURED' : '' },
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
      });
      await notify({
        app: 'admin',
        kind: 'system',
        title,
        body,
        linkTab: 'currencies',
        dedupeKey: `rate_move_admin_${move.code}_${today}`,
      });
      result.inApp += 2;
    } catch (err) {
      console.warn('[rate-alert] in-app failed:', (err as Error).message);
    }

    if (PHONE && CALLMEBOT_KEY) {
      const ok = await sendWhatsApp(`📉 *منصة سند* — تنبيه سعر\n\n${body}`);
      if (ok) result.whatsapp.sent += 1;
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

export const whatsappConfigured = (): boolean => !!PHONE && !!CALLMEBOT_KEY;
