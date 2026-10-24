/**
 * Faststart (moov-first) rewriting for MP4 files.
 *
 * Why this exists: phones record MP4 with the index (`moov`) **after** the
 * media data (`mdat`). A player cannot show even the first frame until it has
 * read the index at the very end of the file, so a 28 MB clip means downloading
 * 28 MB before anything moves — on a mobile network that looks exactly like
 * «الفيديو مابفتح خالص».
 *
 * `fastStart` rebuilds the file as: ftyp … moov … mdat, and shifts every chunk
 * offset (`stco` / `co64`) by the same delta. This is the same transformation
 * `qt-faststart` / `ffmpeg -movflags +faststart` performs, written here so an
 * upload (or an already-stored old video) is fixed on the server with no
 * external binary.
 *
 * Safety: anything the parser does not fully understand returns `null` and the
 * caller keeps the original bytes untouched. A broken rewrite would corrupt a
 * user's video, which is far worse than a slow first frame.
 */

interface Box {
  type: string;
  /** offset of the box header (size word) */
  start: number;
  /** total size including the header */
  size: number;
  /** 8 for a normal box, 16 when a 64-bit size is used */
  headerSize: number;
}

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'mvex']);

function readBoxes(buf: Buffer, start: number, end: number): Box[] | null {
  const boxes: Box[] = [];
  let i = start;
  while (i + 8 <= end) {
    let size = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    let headerSize = 8;
    if (size === 1) {
      if (i + 16 > end) return null;
      const big = buf.readBigUInt64BE(i + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(big);
      headerSize = 16;
    } else if (size === 0) {
      size = end - i;
    }
    if (size < headerSize || i + size > end) return null;
    boxes.push({ type, start: i, size, headerSize });
    i += size;
  }
  // Leftover bytes mean we do not understand the layout — refuse to touch it.
  if (i !== end) return null;
  return boxes;
}

function findBox(boxes: Box[], type: string): Box | undefined {
  return boxes.find((b) => b.type === type);
}

/** Walks a container path like ['moov','trak','mdia'] and returns the child list */
function descend(buf: Buffer, boxes: Box[], path: string[]): { boxes: Box[]; parent: Box } | null {
  let current = boxes;
  let parent: Box | null = null;
  for (const name of path) {
    const box = findBox(current, name);
    if (!box) return null;
    parent = box;
    const children = readBoxes(buf, box.start + box.headerSize, box.start + box.size);
    if (!children) return null;
    current = children;
  }
  return parent ? { boxes: current, parent } : null;
}

/** True when `moov` already sits before the media data (nothing to do). */
export function isFastStart(buf: Buffer): boolean {
  if (buf.length < 16) return false;
  const top = readBoxes(buf, 0, buf.length);
  if (!top) return false;
  const moov = findBox(top, 'moov');
  const mdat = findBox(top, 'mdat');
  if (!moov) return false;
  if (!mdat) return true; // no media data — nothing to reorder
  return moov.start < mdat.start;
}

export function looksLikeMp4(buf: Buffer): boolean {
  return buf.length >= 12 && buf.toString('latin1', 4, 8) === 'ftyp';
}

/**
 * Rebuilds an MP4 so the index comes first.
 * Returns `null` when the file cannot be rewritten safely.
 */
export function fastStart(buf: Buffer): Buffer | null {
  if (!looksLikeMp4(buf)) return null;
  const top = readBoxes(buf, 0, buf.length);
  if (!top) return null;

  const moov = findBox(top, 'moov');
  const mdats = top.filter((b) => b.type === 'mdat');
  if (!moov) return null;
  // Multiple media chunks would need per-chunk offsets — out of scope, refuse.
  if (mdats.length > 1) return null;
  const mdat = mdats[0];
  if (!mdat) return null;
  if (moov.start < mdat.start) return buf; // already fine

  // New layout: keep everything as it was, but lift `moov` out and drop it in
  // right before `mdat` (instead of after it).
  const newMoovStart = top
    .filter((b) => b !== moov && b !== mdat && b.start < mdat.start)
    .reduce((sum, b) => sum + b.size, 0);
  const delta = newMoovStart + moov.size - mdat.start;
  if (delta === 0) return buf;

  // Copy moov and patch every chunk offset inside it.
  const moovCopy = Buffer.from(buf.subarray(moov.start, moov.start + moov.size));
  const patched = patchChunkOffsets(moovCopy, delta);
  if (!patched) return null;

  const parts: Buffer[] = [];
  for (const box of top) {
    if (box === moov) continue;
    if (box === mdat) parts.push(patched);
    parts.push(buf.subarray(box.start, box.start + box.size));
  }
  const out = Buffer.concat(parts);

  if (out.length !== buf.length) return null;
  return out;
}

/**
 * Adds `delta` to every entry of every `stco` / `co64` box inside `moov`.
 * Returns the patched moov, or `null` if an offset would overflow.
 */
function patchChunkOffsets(moov: Buffer, delta: number): Buffer | null {
  let ok = true;

  const walk = (start: number, end: number): void => {
    const boxes = readBoxes(moov, start, end);
    if (!boxes) {
      ok = false;
      return;
    }
    for (const box of boxes) {
      const bodyStart = box.start + box.headerSize;
      const bodyEnd = box.start + box.size;

      if (box.type === 'stco' || box.type === 'co64') {
        const entrySize = box.type === 'stco' ? 4 : 8;
        if (bodyStart + 8 > bodyEnd) {
          ok = false;
          return;
        }
        const count = moov.readUInt32BE(bodyStart + 4);
        const entriesStart = bodyStart + 8;
        if (entriesStart + count * entrySize > bodyEnd) {
          ok = false;
          return;
        }
        for (let i = 0; i < count; i++) {
          const at = entriesStart + i * entrySize;
          if (entrySize === 4) {
            const value = moov.readUInt32BE(at) + delta;
            if (value < 0 || value > 0xffffffff) {
              ok = false;
              return;
            }
            moov.writeUInt32BE(value, at);
          } else {
            const value = moov.readBigUInt64BE(at);
            const next = value + BigInt(delta);
            if (next < 0n || next > BigInt('18446744073709551615')) {
              ok = false;
              return;
            }
            moov.writeBigUInt64BE(next, at);
          }
        }
      } else if (CONTAINERS.has(box.type)) {
        walk(bodyStart, bodyEnd);
        if (!ok) return;
      }
    }
  };

  walk(0, moov.length);
  return ok ? moov : null;
}
