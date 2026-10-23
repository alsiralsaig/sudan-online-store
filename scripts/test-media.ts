/** Verifies media upload/read/delete against PGlite. */
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';

const pglite = new PGlite();
setSqlClient({
  query: async (t: string, p?: any[]) => {
    const r = await pglite.query(t, p);
    return { rows: r.rows as any[], rowCount: r.affectedRows ?? null };
  },
});

const { createApp } = await import('../server.ts');
const app = createApp();
const server = app.listen(0);
const port = (server.address() as any).port;
const BASE = `http://127.0.0.1:${port}`;

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✅ ${n}`)) : (fail++, console.log(`  ❌ ${n} ${d}`)); };

const post = async (path: string, body: any) => {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

// 1x1 red PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

console.log('\n=== رفع صورة ===');
const up = await fetch(`${BASE}/api/media`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dataUrl: PNG, kind: 'image' }),
});
const upBody: any = await up.json();
ok('رفع صورة → 200', up.status === 200, `(${up.status})`);
ok('يُرجع رابطاً', typeof upBody.url === 'string' && upBody.url.startsWith('/api/media/'), upBody.url);
ok('نوع الملف صحيح', upBody.mime === 'image/png', upBody.mime);

console.log('\n=== قراءة الصورة ===');
const img = await fetch(BASE + upBody.url);
const buf = Buffer.from(await img.arrayBuffer());
ok('قراءة → 200', img.status === 200, `(${img.status})`);
ok('Content-Type محفوظ', img.headers.get('content-type') === 'image/png', img.headers.get('content-type') || '');
ok('البايتات مطابقة', buf.equals(Buffer.from(PNG.split(',')[1], 'base64')));

console.log('\n=== رفض الصيغ غير المدعومة ===');
const bad = await fetch(`${BASE}/api/media`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dataUrl: 'data:application/pdf;base64,AAAA', kind: 'image' }),
});
ok('يرفض PDF كصورة → 415', bad.status === 415, `(${bad.status})`);

const bad2 = await fetch(`${BASE}/api/media`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dataUrl: 'not-a-data-url', kind: 'image' }),
});
ok('يرفض صيغة خاطئة → 400', bad2.status === 400, `(${bad2.status})`);

console.log('\n=== رفض الحجم الزائد ===');
const big = 'data:image/jpeg;base64,' + 'A'.repeat(4_500_000);
const tooBig = await fetch(`${BASE}/api/media`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dataUrl: big, kind: 'image' }),
});
ok('يرفض >3 ميجا → 413', tooBig.status === 413, `(${tooBig.status})`);

console.log('\n=== فيديو ===');
const vid = await fetch(`${BASE}/api/media`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dataUrl: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t', kind: 'video' }),
});
const vidBody: any = await vid.json();
ok('رفع فيديو → 200', vid.status === 200, `(${vid.status})`);
const vidGet = await fetch(BASE + vidBody.url);
ok('قراءة الفيديو → 200', vidGet.status === 200);
ok('Content-Type فيديو', (vidGet.headers.get('content-type') || '').includes('video'), vidGet.headers.get('content-type') || '');

console.log('\n=== الحذف ===');
const del = await fetch(`${BASE}/api/media/${upBody.id}`, { method: 'DELETE' });
ok('حذف → 200', del.status === 200);
const gone = await fetch(BASE + upBody.url);
ok('بعد الحذف → 404', gone.status === 404, `(${gone.status})`);

console.log('\n=== رفع فيديو كبير على أجزاء (chunked) ===');
/**
 * A 6 MB "video" split exactly like the browser does it (2,100,000-byte slices,
 * a multiple of 3 so the base64 pieces join cleanly). This proves the 40 MB
 * ceiling works even though one request may only carry ~3 MB.
 */
const CHUNK = 2_100_000;
const bigBytes = 6 * 1024 * 1024;
const bigPayload = Buffer.alloc(bigBytes, 7); // 6 MB of 0x07
const uploadId = 'uptest' + Date.now().toString(36);
const totalChunks = Math.ceil(bigBytes / CHUNK);
let chunkOk = 0;
for (let i = 0; i < totalChunks; i++) {
  const slice = bigPayload.subarray(i * CHUNK, Math.min(bigBytes, (i + 1) * CHUNK));
  const r = await post('/api/media/chunk', {
    uploadId,
    index: i,
    mime: 'video/mp4',
    kind: 'video',
    dataUrl: `data:video/mp4;base64,${slice.toString('base64')}`,
  });
  if (r.status === 200) chunkOk++;
}
ok(`كل الأجزاء اتقبلت (${chunkOk}/${totalChunks})`, chunkOk === totalChunks);

const incomplete = await post('/api/media/complete', { uploadId: 'missing-upload-1', totalChunks: 3, kind: 'video' });
ok('تجميع بدون أجزاء → 404', incomplete.status === 404, `(${incomplete.status})`);

const done = await post('/api/media/complete', { uploadId, totalChunks, kind: 'video' });
ok('تجميع الفيديو → 200', done.status === 200, `(${done.status}) ${JSON.stringify(done.body).slice(0, 80)}`);
ok('الحجم الكامل محفوظ (6 ميجا)', done.body?.bytes === bigBytes, String(done.body?.bytes));
ok('يُرجع رابط الفيديو', typeof done.body?.url === 'string' && done.body.url.startsWith('/api/media/'), done.body?.url);

const streamed = await fetch(BASE + done.body.url);
const streamedBuf = Buffer.from(await streamed.arrayBuffer());
ok('الفيديو يُقرأ كامل ومطابق', streamedBuf.length === bigBytes && streamedBuf[0] === 7 && streamedBuf[bigBytes - 1] === 7, `${streamedBuf.length}`);

const replay = await post('/api/media/complete', { uploadId, totalChunks, kind: 'video' });
ok('إعادة التجميع بعد الحذف → 404', replay.status === 404, `(${replay.status})`);

console.log('\n=== سقف 40 ميجا بالظبط ===');
/**
 * The publisher may send exactly 40 MiB. The naive base64 size estimate
 * overshoots by a byte or two, so this guards the tolerance.
 */
const CEIL = 40 * 1024 * 1024;
const ceilId = 'upceil' + Date.now().toString(36);
const ceilPayload = Buffer.alloc(CEIL, 9);
const ceilChunks = Math.ceil(CEIL / CHUNK);
for (let i = 0; i < ceilChunks; i++) {
  const slice = ceilPayload.subarray(i * CHUNK, Math.min(CEIL, (i + 1) * CHUNK));
  await post('/api/media/chunk', {
    uploadId: ceilId, index: i, mime: 'video/mp4', kind: 'video',
    dataUrl: `data:video/mp4;base64,${slice.toString('base64')}`,
  });
}
const ceilDone = await post('/api/media/complete', { uploadId: ceilId, totalChunks: ceilChunks, kind: 'video' });
ok('40 ميجا بالظبط يُقبل', ceilDone.status === 200, `(${ceilDone.status}) ${ceilDone.body?.message || ''}`);
ok('الحجم = 40 ميجا تماماً', ceilDone.body?.bytes === CEIL, String(ceilDone.body?.bytes));

console.log('\n=== أكثر من 40 ميجا يُرفض برسالة واضحة ===');
const overId = 'upover' + Date.now().toString(36);
const overPayload = Buffer.alloc(CEIL + 3 * 1024 * 1024, 5);
const overChunks = Math.ceil(overPayload.length / CHUNK);
for (let i = 0; i < overChunks; i++) {
  const slice = overPayload.subarray(i * CHUNK, Math.min(overPayload.length, (i + 1) * CHUNK));
  await post('/api/media/chunk', {
    uploadId: overId, index: i, mime: 'video/mp4', kind: 'video',
    dataUrl: `data:video/mp4;base64,${slice.toString('base64')}`,
  });
}
const overDone = await post('/api/media/complete', { uploadId: overId, totalChunks: overChunks, kind: 'video' });
ok('43 ميجا يُرفض → 413', overDone.status === 413, `(${overDone.status})`);
ok('رسالة الرفض تشرح الحد', String(overDone.body?.message || '').includes('الحد الأقصى 40'), overDone.body?.message);

console.log('\n=== الكاش ===');
ok('Cache-Control immutable', (img.headers.get('cache-control') || '').includes('immutable'), img.headers.get('cache-control') || '');

console.log(`\n${'='.repeat(46)}\nالنتيجة: ${pass} نجح، ${fail} فشل\n${'='.repeat(46)}`);
server.close();
process.exit(fail === 0 ? 0 : 1);
