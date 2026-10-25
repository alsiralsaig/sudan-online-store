/**
 * Telegram delivery channel — the card-free outbound channel.
 *
 * Why Telegram: creating a bot with @BotFather is free forever, needs no
 * credit card, no subscription and no business verification, and the Bot API
 * has no per-message cost. That makes it the right fallback for Sudan, where
 * Visa/Mastercard are not available and paid SMS gateways are out of reach.
 *
 * Configure (Vercel → Environment Variables):
 *   TELEGRAM_BOT_TOKEN  token sent by @BotFather  (e.g. 123456:AA...)
 *   TELEGRAM_CHAT_IDS   one or more chat ids, comma separated (2499xxxxxxx)
 *   TELEGRAM_KINDS      optional, default "system" (use "all" for every kind)
 *
 * Nothing here ever throws: when Telegram is unreachable the in-app feed and
 * web push still deliver, and the reason is reported back to the caller.
 */

/**
 * المتغيّرات تُقرأ عند الاستخدام لا عند التحميل.
 * في الإنتاج الفرق ما بيظهر (البيئة ثابتة)، لكن القراءة المتأخرة تجعل
 * السلوك قابلاً للاختبار وتحمي من أي إعداد بيتغيّر بعد الإقلاع.
 */
const token = () => String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const chatIds = () =>
  String(process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const kindList = () =>
  String(process.env.TELEGRAM_KINDS || 'system')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export interface TelegramVerdict {
  sent: number;
  skipped: string;
}

export const telegramConfigured = (): boolean => !!token() && chatIds().length > 0;
export const telegramChatCount = (): number => chatIds().length;
export const telegramEnabledFor = (kind?: string): boolean => {
  if (!telegramConfigured()) return false;
  const kinds = kindList();
  if (kinds.includes('all')) return true;
  return !!kind && kinds.includes(String(kind).toLowerCase());
};

const api = (method: string) => `https://api.telegram.org/bot${token()}/${method}`;

const withTimeout = async (url: string, init?: RequestInit, ms = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

/** Sends one message to every configured chat. Never throws. */
export async function sendTelegram(
  text: string,
  opts: { markdown?: boolean } = {}
): Promise<TelegramVerdict> {
  if (!token()) return { sent: 0, skipped: 'NOT_CONFIGURED' };
  const ids = chatIds();
  if (ids.length === 0) return { sent: 0, skipped: 'NO_CHAT_ID' };

  let sent = 0;
  let skipped = '';
  for (const chatId of ids) {
    try {
      const res = await withTimeout(api('sendMessage'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
          ...(opts.markdown === false ? {} : { parse_mode: 'Markdown' }),
        }),
      });
      const payload: any = await res.json().catch(() => null);
      if (payload?.ok) sent += 1;
      else if (!skipped) skipped = `API_${payload?.error_code ?? res.status}`;
    } catch (err) {
      if (!skipped) skipped = (err as Error).name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
    }
  }
  return { sent, skipped };
}

/**
 * Reads `getUpdates` so the owner can discover their own chat id without
 * hunting through the app: create the bot, press /start, then open
 * /api/admin/telegram/discover and copy the id.
 */
export async function discoverChats(): Promise<{
  ok: boolean;
  hint: string;
  chats: { id: string; name: string; username?: string }[];
}> {
  if (!token()) {
    return { ok: false, hint: 'TELEGRAM_BOT_TOKEN غير مضبوط في إعدادات الخادم.', chats: [] };
  }
  try {
    const res = await withTimeout(api('getUpdates?timeout=0'));
    const payload: any = await res.json().catch(() => null);
    if (!payload?.ok) {
      return {
        ok: false,
        hint:
          payload?.description ||
          'تليجرام رفض الطلب — تأكد إن التوكن صحيح وإنك أرسلت /start للبوت.',
        chats: [],
      };
    }
    const seen = new Map<string, { id: string; name: string; username?: string }>();
    for (const update of payload.result || []) {
      const chat = update?.message?.chat || update?.channel_post?.chat || update?.my_chat_member?.chat;
      if (!chat?.id) continue;
      seen.set(String(chat.id), {
        id: String(chat.id),
        name: [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.title || chat.username || '—',
        username: chat.username,
      });
    }
    return {
      ok: true,
      hint: seen.size
        ? 'انسخ الـ id وحطّه في TELEGRAM_CHAT_IDS.'
        : 'ما في محادثات بعد — افتح البوت في تليجرام واضغط Start أو أرسل /start ثم أعد المحاولة.',
      chats: [...seen.values()],
    };
  } catch (err) {
    return {
      ok: false,
      hint: (err as Error).name === 'AbortError' ? 'انتهى وقت الاتصال بتليجرام.' : 'فشل الاتصال بتليجرام.',
      chats: [],
    };
  }
}

/** Masked description of the channel state, safe to expose to clients. */
export const telegramStatus = () => ({
  configured: telegramConfigured(),
  chats: telegramChatCount(),
  kinds: kindList(),
});
