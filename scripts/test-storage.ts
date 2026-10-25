/**
 * اختبار فصل الميديا عن قاعدة البيانات.
 * السبب: فيديو واحد خزّن ٣٨ ميجا base64 جوّه القاعدة ووقف المتجر كله.
 * التشغيل: npx tsx scripts/test-storage.ts
 */
import assert from 'node:assert/strict';
import { mediaRowFor } from '../src/server/media.ts';
import { storageMode, extensionFor } from '../src/server/storage.ts';

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log('✓', name);
};

check('بدون Blob: الملف يتخزن في القاعدة (سلوك قديم محفوظ)', () => {
  const row = mediaRowFor('AAAA', null);
  assert.equal(row.data, 'AAAA');
  assert.equal(row.url, null);
});

check('مع Blob: القاعدة تخزن الرابط فقط ولا بايتات', () => {
  const row = mediaRowFor('AAAA', 'https://x.public.blob.vercel-storage.com/sanad/video/a.mp4');
  assert.equal(row.data, '');
  assert.equal(row.url?.startsWith('https://'), true);
});

check('بدون توكن: الوضع database (ما ينكسر شيء)', () => {
  delete process.env.BLOB_READ_WRITE_TOKEN;
  assert.equal(storageMode(), 'database');
});

check('مع توكن: الوضع blob', () => {
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test';
  assert.equal(storageMode(), 'blob');
});

check('امتدادات الملفات حسب النوع', () => {
  assert.equal(extensionFor('video/mp4'), 'mp4');
  assert.equal(extensionFor('image/jpeg'), 'jpg');
  assert.equal(extensionFor('application/x-weird'), 'bin');
});

console.log(`\n✅ ${passed} اختبارات نجحت`);
