/**
 * قناة التنبيه الموحّدة — بتحاول كل القنوات المضبوطة.
 *
 * الفكرة: الكود ما يعرفش ولا يهتم إذا التنبيه رايح تليجرام ولا إيميل.
 * أي قناة متفعّلة بتتنادى، ولو واحدة فشلت الثانية بتكمّل.
 */
import { sendTelegram, telegramConfigured } from './telegram.ts';
import { sendEmail, emailSubject, emailConfigured } from './email.ts';

export interface AlertVerdict {
  sent: number;
  skipped: string;
  channels: string[];
}

export const channelsConfigured = (): string[] => {
  const list: string[] = [];
  if (telegramConfigured()) list.push('telegram');
  if (emailConfigured()) list.push('email');
  return list;
};

export const anyChannelConfigured = (): boolean => channelsConfigured().length > 0;

/** يبعت على كل القنوات المتاحة. ما بيرمي أخطاء. */
export async function notifyAll(text: string): Promise<AlertVerdict> {
  const channels = channelsConfigured();
  if (channels.length === 0) return { sent: 0, skipped: 'NOT_CONFIGURED', channels };

  let sent = 0;
  let skipped = '';

  if (channels.includes('telegram')) {
    try {
      const v = await sendTelegram(text);
      sent += v.sent;
      if (v.sent === 0 && !skipped) skipped = `telegram:${v.skipped}`;
    } catch (err) {
      if (!skipped) skipped = `telegram:THREW:${(err as Error).message.slice(0, 30)}`;
    }
  }

  if (channels.includes('email')) {
    try {
      const v = await sendEmail(emailSubject(text), text);
      sent += v.sent;
      if (v.sent === 0 && !skipped) skipped = `email:${v.skipped}`;
    } catch (err) {
      if (!skipped) skipped = `email:THREW:${(err as Error).message.slice(0, 30)}`;
    }
  }

  return { sent, skipped, channels };
}
