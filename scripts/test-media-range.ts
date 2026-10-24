/**
 * اختبار دعم Range لخدمة الملفات.
 * السبب: مشغّل الفيديو في الجوال ما يشتغل بدون 206 Partial Content.
 * التشغيل: npx tsx scripts/test-media-range.ts
 */
import assert from 'node:assert/strict';
import { buildMediaResponse } from '../src/server/media.ts';

const data = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));
const MP4 = 'video/mp4';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log('✓', name);
}

check('بلا Range: الملف كامل 200 ويعلن دعم التجزئة', () => {
  const r = buildMediaResponse(data, MP4);
  assert.equal(r.status, 200);
  assert.equal(r.headers['Accept-Ranges'], 'bytes');
  assert.equal(r.headers['Content-Length'], '1000');
  assert.equal(r.body?.length, 1000);
  assert.equal(r.headers['Content-Disposition'], 'inline');
});

check('bytes=0- (أول طلب من المشغّل) ⟹ 206 بالملف كامل', () => {
  const r = buildMediaResponse(data, MP4, 'bytes=0-');
  assert.equal(r.status, 206);
  assert.equal(r.headers['Content-Range'], 'bytes 0-999/1000');
  assert.equal(r.body?.length, 1000);
});

check('bytes=100-199 ⟹ 100 بايت فقط', () => {
  const r = buildMediaResponse(data, MP4, 'bytes=100-199');
  assert.equal(r.status, 206);
  assert.equal(r.headers['Content-Range'], 'bytes 100-199/1000');
  assert.equal(r.headers['Content-Length'], '100');
  assert.equal(r.body?.length, 100);
  assert.deepEqual([...(r.body as Buffer).subarray(0, 3)], [100, 101, 102]);
});

check('bytes=900- (من 900 لآخر الملف)', () => {
  const r = buildMediaResponse(data, MP4, 'bytes=900-');
  assert.equal(r.headers['Content-Range'], 'bytes 900-999/1000');
  assert.equal(r.body?.length, 100);
});

check('bytes=-50 (آخر ٥٠ بايت)', () => {
  const r = buildMediaResponse(data, MP4, 'bytes=-50');
  assert.equal(r.headers['Content-Range'], 'bytes 950-999/1000');
  assert.equal(r.body?.length, 50);
});

check('نهاية أكبر من حجم الملف تُقصّ', () => {
  const r = buildMediaResponse(data, MP4, 'bytes=990-5000');
  assert.equal(r.headers['Content-Range'], 'bytes 990-999/1000');
});

check('بداية خارج الملف ⟹ 416', () => {
  const r = buildMediaResponse(data, MP4, 'bytes=1000-');
  assert.equal(r.status, 416);
  assert.equal(r.headers['Content-Range'], 'bytes */1000');
  assert.equal(r.body, null);
});

check('ترويسة تالفة ⟹ 416 لا انهيار', () => {
  for (const bad of ['bytes=abc', 'items=0-10', 'bytes=-', 'bytes=500-100']) {
    assert.equal(buildMediaResponse(data, MP4, bad).status, 416, bad);
  }
});

check('الصور لا تُعلن inline (لتُعرض كملف عادي بلا تنزيل)', () => {
  const r = buildMediaResponse(Buffer.from([1, 2, 3]), 'image/jpeg');
  assert.equal(r.headers['Content-Disposition'], undefined);
  assert.equal(r.status, 200);
});

console.log(`\n✅ ${passed} اختبارات نجحت`);
