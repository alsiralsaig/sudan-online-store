// خادم اختبار محلي يستخدم نفس منطق buildMediaResponse لخدمة ملف حقيقي،
// للتأكد من أن المتصفح يشغّل الفيديو ويستطيع التقديم/الإرجاع (seek).
import express from 'express';
import fs from 'node:fs';

const file = process.env.FILE || '/tmp/sample.webm';
const mime = process.env.MIME || 'video/webm';
const data = fs.readFileSync(file);
const app = express();

function buildMediaResponse(data, mime, rangeHeader) {
  const total = data.length;
  const headers = { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  if (!rangeHeader) return { status: 200, headers: { ...headers, 'Content-Length': String(total) }, body: data };
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
  const un = () => ({ status: 416, headers: { ...headers, 'Content-Range': `bytes */${total}` }, body: null });
  if (!m) return un();
  let start = m[1] === '' ? NaN : Number(m[1]);
  let end = m[2] === '' ? NaN : Number(m[2]);
  if (Number.isNaN(start) && Number.isNaN(end)) return un();
  if (Number.isNaN(start)) { start = Math.max(0, total - end); end = total - 1; }
  else if (Number.isNaN(end) || end >= total) end = total - 1;
  if (start > end || start >= total) return un();
  return { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': String(end - start + 1) }, body: data.subarray(start, end + 1) };
}

app.get('/video', (req, res) => {
  const a = buildMediaResponse(data, mime, req.headers.range);
  res.status(a.status);
  Object.entries(a.headers).forEach(([k, v]) => res.setHeader(k, v));
  res.end(a.body ?? undefined);
});
app.get('/', (_req, res) => res.send('<html><body style="margin:0;background:#000"><video id="v" src="/video" controls playsinline muted style="width:100%"></video></body></html>'));
app.listen(5099, '0.0.0.0', () => console.log(`range test server on 5099 serving ${file} (${(data.length / 1024).toFixed(0)} KB)`));
