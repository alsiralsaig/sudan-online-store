/**
 * اختبار إعادة ترتيب MP4 (moov قبل mdat).
 * التشغيل: npx tsx scripts/test-mp4-faststart.ts [ملف.mp4]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fastStart, isFastStart, looksLikeMp4 } from '../src/server/mp4.ts';

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log('✓', name);
};

function box(type: string, payload: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(payload.length + 8, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, payload]);
}

function readChunkOffsets(mp4: Buffer): { offsets: number[]; mdatStart: number } {
  // search stco inside moov
  const idx = mp4.indexOf(Buffer.from('stco', 'latin1'));
  const count = mp4.readUInt32BE(idx + 8);
  const offsets: number[] = [];
  for (let i = 0; i < count; i++) offsets.push(mp4.readUInt32BE(idx + 12 + i * 4));
  const mdatStart = mp4.indexOf(Buffer.from('mdat', 'latin1')) - 4;
  return { offsets, mdatStart };
}

// ملف صناعي: ftyp + mdat + moov(stco يشير لداخل mdat) — نفس ترتيب آيفون
const media = Buffer.alloc(400, 7);
media[0] = 42;
const mdat = box('mdat', media);
const ftyp = box('ftyp', Buffer.from('isomiso2avc1', 'latin1'));

function makeMoov(chunkOffset: number): Buffer {
  const stcoBody = Buffer.alloc(8 + 4);
  stcoBody.writeUInt32BE(0, 0);
  stcoBody.writeUInt32BE(1, 4); // entry count
  stcoBody.writeUInt32BE(chunkOffset, 8);
  const stbl = box('stbl', box('stco', stcoBody));
  const minf = box('minf', stbl);
  const mdia = box('mdia', minf);
  const trak = box('trak', mdia);
  return box('moov', trak);
}

const mdatStart = ftyp.length; // mdat begins right after ftyp
const chunkAbs = mdatStart + 8; // first byte of media payload
const original = Buffer.concat([ftyp, mdat, makeMoov(chunkAbs)]);

check('يتعرّف على MP4 صحيح', () => {
  assert.equal(looksLikeMp4(original), true);
});

check('الملف الأصلي ليس faststart (moov في الآخر)', () => {
  assert.equal(isFastStart(original), false);
});

check('بعد الإصلاح: moov قبل mdat', () => {
  const fixed = fastStart(original);
  assert.ok(fixed);
  assert.equal(fixed!.toString('latin1', 4, 8), 'ftyp');
  const moovAt = fixed!.indexOf(Buffer.from('moov', 'latin1'));
  const mdatAt = fixed!.indexOf(Buffer.from('mdat', 'latin1'));
  assert.ok(moovAt > 0 && moovAt < mdatAt, 'moov يجب أن يسبق mdat');
  assert.equal(isFastStart(fixed!), true);
});

check('الحجم لا يتغيّر والبايتات لا تُفقد', () => {
  const fixed = fastStart(original)!;
  assert.equal(fixed.length, original.length);
  const dataInFixed = fixed.subarray(fixed.indexOf(Buffer.from('mdat', 'latin1')) + 4);
  assert.equal(dataInFixed[0], 42);
});

check('إزاحات المقاطع تُصحّح لتشير لنفس البيانات', () => {
  const fixed = fastStart(original)!;
  const before = readChunkOffsets(original);
  const after = readChunkOffsets(fixed);
  // البيانات نفسها: البايت عند الإزاحة القديمة في الأصل = البايت عند الجديدة في الجديد
  const fromOriginal = original.subarray(before.offsets[0], before.offsets[0] + 8);
  const fromFixed = fixed.subarray(after.offsets[0], after.offsets[0] + 8);
  assert.deepEqual([...fromOriginal], [...fromFixed]);
});

check('ملف faststart أصلاً يُرجَع كما هو', () => {
  const fixed = fastStart(original)!;
  const again = fastStart(fixed);
  assert.equal(again, fixed);
});

check('ملف تالف يُرجِع null بدل تخريبه', () => {
  assert.equal(fastStart(Buffer.from('not an mp4 at all')), null);
  const broken = Buffer.from(original);
  broken.writeUInt32BE(0x7fffffff, 0); // حجم مستحيل
  assert.equal(fastStart(broken), null);
});

// الفيديو الحقيقي إن وُجد
const real = process.argv[2];
if (real && fs.existsSync(real)) {
  const buf = fs.readFileSync(real);
  console.log(`\n— فيديو حقيقي: ${real} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
  console.log('  faststart قبل؟', isFastStart(buf));
  const fixed = fastStart(buf);
  assert.ok(fixed, 'يجب أن ينجح على الفيديو الحقيقي');
  console.log('  faststart بعد؟', isFastStart(fixed!));
  assert.equal(fixed!.length, buf.length);
  assert.equal(isFastStart(fixed!), true);
  const moovAt = fixed!.indexOf(Buffer.from('moov', 'latin1'));
  console.log(`  moov صار عند ${(moovAt / 1024).toFixed(0)} KB بدل ${(
    buf.indexOf(Buffer.from('moov', 'latin1')) / 1024 / 1024
  ).toFixed(1)} MB`);
  fs.writeFileSync('/tmp/vid-fast.mp4', fixed!);
  console.log('  كُتب /tmp/vid-fast.mp4');
}

console.log(`\n✅ ${passed} اختبارات نجحت`);
