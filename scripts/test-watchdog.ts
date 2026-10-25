/**
 * اختبار المراقبة والنسخ الاحتياطي.
 * التشغيل: npx tsx scripts/test-watchdog.ts
 */
import assert from 'node:assert/strict';
import { buildReport, shouldSendAlert, resetAlertState, runWatch } from '../src/server/watchdog.ts';
import { buildBackupPayload, backupName } from '../src/server/backup.ts';

let passed = 0;
const check = async (name: string, fn: () => void | Promise<void>) => {
  await fn();
  passed++;
  console.log('✓', name);
};

const ok = { name: 'قاعدة البيانات', ok: true, detail: '12ms' };
const bad = { name: 'قاعدة البيانات', ok: false, detail: 'quota exceeded' };

await check('كل الفحوصات سليمة ⟹ تقرير بخير', () => {
  const r = buildReport([ok, { name: 'تخزين الملفات', ok: true, detail: 'Blob' }]);
  assert.equal(r.ok, true);
  assert.equal(r.problems.length, 0);
  assert.match(r.text, /سند بخير/);
});

await check('فحص فاشل ⟹ التقرير يسمّي المشكلة والأثر', () => {
  const r = buildReport([bad, { name: 'تخزين الملفات', ok: true, detail: 'Blob' }]);
  assert.equal(r.ok, false);
  assert.equal(r.problems[0].name, 'قاعدة البيانات');
  assert.match(r.text, /🚨/);
  assert.match(r.text, /quota exceeded/);
});

await check('نفس المشكلة ما تتبعتش مرتين ورا بعض', () => {
  resetAlertState();
  assert.equal(shouldSendAlert('قاعدة البيانات', 1_000), true);
  assert.equal(shouldSendAlert('قاعدة البيانات', 2_000), false, 'لازم يتكتم');
  assert.equal(shouldSendAlert('قاعدة البيانات', 1_000 + 31 * 60 * 1000), true, 'بعد نص ساعة يبعت تاني');
});

await check('مشكلة مختلفة بتتبعت فوراً', () => {
  resetAlertState();
  assert.equal(shouldSendAlert('قاعدة البيانات', 1_000), true);
  assert.equal(shouldSendAlert('تخزين الملفات', 2_000), true);
});

await check('المشكلة تبعت مرة واحدة والرجوع يبعت طمأنة', async () => {
  resetAlertState();
  const sent: string[] = [];
  const notify = async (text: string) => {
    sent.push(text);
    return { sent: 1, skipped: '' };
  };
  const deps = {
    checkDb: async () => bad,
    checkStorage: () => ({ name: 'تخزين الملفات', ok: true, detail: 'Blob' }),
    notify,
  };
  const first = await runWatch(deps);
  const second = await runWatch(deps);
  assert.equal(first.notified, 'SENT');
  assert.equal(second.notified, 'THROTTLED', 'ما نزعج المستخدم بنفس الرسالة');

  const healthy = { ...deps, checkDb: async () => ok };
  const third = await runWatch(healthy);
  assert.equal(third.ok, true);
  assert.equal(third.notified, 'RECOVERY_SENT');
  assert.equal(sent.length, 2);
  assert.match(sent[1], /رجع تمام/);
});

await check('فشل الإرسال ما بيكسر الفحص', async () => {
  resetAlertState();
  const r = await runWatch({
    checkDb: async () => bad,
    checkStorage: () => ok,
    notify: async () => {
      throw new Error('telegram down');
    },
  });
  assert.equal(r.ok, false);
});

await check('لو فحص نفسه رمى استثناء، التقرير يوضح كده', async () => {
  resetAlertState();
  const r = await runWatch({
    checkDb: async () => {
      throw new Error('boom');
    },
    checkStorage: () => ok,
    notify: async () => ({ sent: 0, skipped: 'NOT_CONFIGURED' }),
  });
  assert.equal(r.ok, false);
  assert.match(r.checks[0].detail, /boom/);
});

await check('النسخة الاحتياطية: محتواها وعدد الصفوف', () => {
  const at = new Date('2026-10-25T09:30:00.000Z');
  const payload = buildBackupPayload(
    {
      sanad_market_ads: [{ id: 'a' }, { id: 'b' }],
      sanad_tenants: [{ id: 't' }],
    },
    at
  );
  assert.equal(payload.rows, 3);
  const parsed = JSON.parse(payload.json);
  assert.equal(parsed.tool, 'sanad-backup');
  assert.equal(parsed.tables.sanad_market_ads.length, 2);
  assert.equal(parsed.createdAt, at.toISOString());
});

await check('اسم ملف النسخة منظّم حسب التاريخ', () => {
  const name = backupName(new Date('2026-10-25T09:30:00.000Z'));
  assert.equal(name, 'backups/sanad-2026-10-25-09-30.json.gz');
});

console.log(`\n✅ ${passed} اختبارات نجحت`);
