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

console.log('\n=== الكاش ===');
ok('Cache-Control immutable', (img.headers.get('cache-control') || '').includes('immutable'), img.headers.get('cache-control') || '');

console.log(`\n${'='.repeat(46)}\nالنتيجة: ${pass} نجح، ${fail} فشل\n${'='.repeat(46)}`);
server.close();
process.exit(fail === 0 ? 0 : 1);
