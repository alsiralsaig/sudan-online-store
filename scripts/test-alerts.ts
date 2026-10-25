/**
 * اختبار قنوات التنبيه (بريد + تليجرام).
 * التشغيل: npx tsx scripts/test-alerts.ts
 */
import assert from 'node:assert/strict';
import { toEmailBody, emailSubject, emailConfigured } from '../src/server/email.ts';
import { channelsConfigured, anyChannelConfigured, notifyAll } from '../src/server/alerts.ts';

let passed = 0;
const check = async (name: string, fn: () => void | Promise<void>) => {
  await fn();
  passed++;
  console.log('✓', name);
};

const clear = () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.ALERT_EMAIL_TO;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_IDS;
};

await check('بدون أي إعداد ⟹ مافي قناة (والتنبيه ما بيرمي خطأ)', async () => {
  clear();
  assert.equal(emailConfigured(), false);
  assert.equal(anyChannelConfigured(), false);
  assert.deepEqual(channelsConfigured(), []);
  const v = await notifyAll('اختبار');
  assert.equal(v.sent, 0);
  assert.equal(v.skipped, 'NOT_CONFIGURED');
});

await check('إيميل مضبوط ⟹ القناة ظاهرة', () => {
  clear();
  process.env.RESEND_API_KEY = 're_test';
  process.env.ALERT_EMAIL_TO = 'owner@example.com';
  assert.equal(emailConfigured(), true);
  assert.deepEqual(channelsConfigured(), ['email']);
});

await check('مفتاح بدون إيميل ⟹ ما تعتبرش قناة جاهزة', () => {
  clear();
  process.env.RESEND_API_KEY = 're_test';
  assert.equal(emailConfigured(), false);
});

await check('إيميل تالف في القائمة بيتجاهل', () => {
  clear();
  process.env.RESEND_API_KEY = 're_test';
  process.env.ALERT_EMAIL_TO = 'owner@example.com, not-an-email ,';
  assert.equal(emailConfigured(), true);
});

await check('تليجرام + إيميل ⟹ القناتين', () => {
  clear();
  process.env.RESEND_API_KEY = 're_test';
  process.env.ALERT_EMAIL_TO = 'owner@example.com';
  process.env.TELEGRAM_BOT_TOKEN = '123:abc';
  process.env.TELEGRAM_CHAT_IDS = '999';
  assert.deepEqual(channelsConfigured().sort(), ['email', 'telegram']);
});

await check('نص البريد مقروء (بلا رموز markdown)', () => {
  const report = '🚨 *مشكلة في سند*\n🕒 2026-10-25 09:30 UTC\n❌ قاعدة البيانات: quota\n✅ تخزين الملفات: Blob';
  const body = toEmailBody(report);
  assert.equal(body.includes('*'), false);
  assert.match(body, /\[تنبيه\]/);
  assert.match(body, /\[مشكلة\] قاعدة البيانات/);
  assert.match(body, /\[سليم\] تخزين/);
  assert.match(body, /الوقت: 2026/);
});

await check('عنوان الرسالة يوضح المشكلة ولا الطمأنة', () => {
  assert.match(emailSubject('❌ قاعدة البيانات'), /مشكلة/);
  assert.match(emailSubject('✅ سند بخير'), /سليمة/);
});

await check('فشل الإرسال ما بيرمي استثناء', async () => {
  clear();
  process.env.RESEND_API_KEY = 're_invalid';
  process.env.ALERT_EMAIL_TO = 'owner@example.com';
  const v = await notifyAll('اختبار');
  assert.equal(v.sent, 0);
  assert.ok(v.skipped.startsWith('email:'));
});

clear();
console.log(`\n✅ ${passed} اختبارات نجحت`);
