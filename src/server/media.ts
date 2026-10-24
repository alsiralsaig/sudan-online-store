/**
 * Media storage for marketplace ads (photos + short videos).
 *
 * Files are kept in their own table rather than the in-memory snapshot:
 * the rest of the app loads every collection on each request, and pulling
 * hundreds of kilobytes of image data into that snapshot would be wasteful.
 * Here we only ever read the single row being requested.
 */
import { query, transaction } from './pg.ts';
import { newId } from './ids.ts';

const TABLE = 'sanad_media';

/**
 * Vercel caps a single serverless request body at ~4.5 MB, and base64 adds 33%,
 * so one shot tops out around 3 MB. Bigger videos travel in slices and are
 * stitched back together here — the ceiling below is what a publisher can send.
 */
export const MAX_RAW_BYTES = 3 * 1024 * 1024; // 3 MB in one request
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024; // 40 MB through chunked upload
export const MAX_IMAGE_MAX_BYTES = 6 * 1024 * 1024;
/** Chunk size the client uses: a multiple of 3 keeps base64 slices joinable. */
export const CHUNK_BYTES = 2_100_000;

const CHUNK_TABLE = 'sanad_media_chunks';

/**
 * Exact size of a base64 payload. The naive `len * 3 / 4` overshoots by up to
 * two bytes because of the tail padding, which would wrongly reject a file that
 * sits exactly on the ceiling.
 */
function base64Bytes(b64: string): number {
  let padding = 0;
  if (b64.endsWith('==')) padding = 2;
  else if (b64.endsWith('=')) padding = 1;
  return Math.floor((b64.length * 3) / 4) - padding;
}

let ready: Promise<void> | null = null;

export function ensureMediaTable(): Promise<void> {
  if (!ready) {
    ready = transaction(async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${TABLE} (
          id          text PRIMARY KEY,
          kind        text NOT NULL,
          mime        text NOT NULL,
          bytes       integer NOT NULL,
          owner_phone text,
          data        text NOT NULL,
          created_at  timestamptz NOT NULL DEFAULT now()
        )
      `);
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_${TABLE}_created ON ${TABLE} (created_at)`
      );
      // Slices of a video that is still uploading. Rows are deleted as soon as
      // the upload is stitched together (or swept after a day).
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${CHUNK_TABLE} (
          upload_id  text NOT NULL,
          idx        integer NOT NULL,
          mime       text NOT NULL,
          owner_phone text,
          data       text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (upload_id, idx)
        )
      `);
    }).catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

export interface SaveMediaInput {
  dataUrl: string;
  kind: 'image' | 'video';
  ownerPhone?: string;
}

export interface SavedMedia {
  id: string;
  url: string;
  mime: string;
  bytes: number;
  kind: string;
}

const ALLOWED_PREFIXES: Record<string, string[]> = {
  image: ['data:image/jpeg', 'data:image/png', 'data:image/webp', 'data:image/gif'],
  video: ['data:video/mp4', 'data:video/webm', 'data:video/quicktime'],
};

export async function saveMedia(input: SaveMediaInput): Promise<SavedMedia> {
  await ensureMediaTable();

  const { dataUrl, kind } = input;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new HttpError(400, 'BAD_DATA_URL', 'صيغة الملف غير صحيحة.');
  }

  const comma = dataUrl.indexOf(',');
  if (comma === -1) {
    throw new HttpError(400, 'BAD_DATA_URL', 'صيغة الملف غير صحيحة.');
  }

  const header = dataUrl.slice(5, comma); // e.g. image/jpeg;base64
  const isBase64 = header.includes(';base64');
  if (!isBase64) {
    throw new HttpError(400, 'BAD_DATA_URL', 'يجب إرسال الملف بترميز base64.');
  }

  const mime = header.split(';')[0].toLowerCase();
  const allowed = ALLOWED_PREFIXES[kind] || [];
  if (!allowed.some((prefix) => dataUrl.toLowerCase().startsWith(prefix))) {
    throw new HttpError(
      415,
      'UNSUPPORTED_TYPE',
      kind === 'video'
        ? 'صيغة الفيديو غير مدعومة. استخدم MP4 أو WebM.'
        : 'صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP.'
    );
  }

  const base64 = dataUrl.slice(comma + 1);
  const bytes = base64Bytes(base64);
  if (bytes > MAX_RAW_BYTES) {
    throw new HttpError(
      413,
      'TOO_LARGE',
      `حجم الملف ${(bytes / 1024 / 1024).toFixed(1)} ميجا، والحد الأقصى للطلب الواحد ${MAX_RAW_BYTES / 1024 / 1024} ميجا. الفيديوهات الكبيرة تُرفع على أجزاء.`
    );
  }

  const id = newId(kind === 'video' ? 'vid' : 'img');

  await query(
    `INSERT INTO ${TABLE} (id, kind, mime, bytes, owner_phone, data)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, kind, mime, bytes, input.ownerPhone || null, base64]
  );

  return { id, url: `/api/media/${id}`, mime, bytes, kind };
}

/** Upper bound for one upload session, by kind. */
function ceilingFor(kind: 'image' | 'video'): number {
  return kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_MAX_BYTES;
}

export interface ChunkInput {
  uploadId: string;
  index: number;
  dataUrl: string;
  mime?: string;
  kind?: 'image' | 'video';
  ownerPhone?: string;
}

/**
 * Store one slice of a large file. Each slice is sent as its own small request
 * (well under the serverless body limit) and addressed by `uploadId` + index.
 */
export async function saveChunk(input: ChunkInput): Promise<{ received: number; bytes: number }> {
  await ensureMediaTable();

  const uploadId = String(input.uploadId || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(uploadId)) {
    throw new HttpError(400, 'BAD_UPLOAD_ID', 'معرّف الرفع غير صحيح.');
  }
  const index = Number(input.index);
  if (!Number.isInteger(index) || index < 0 || index > 500) {
    throw new HttpError(400, 'BAD_CHUNK_INDEX', 'رقم الجزء غير صحيح.');
  }
  const dataUrl = String(input.dataUrl || '');
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || comma === -1) {
    throw new HttpError(400, 'BAD_DATA_URL', 'صيغة الجزء غير صحيحة.');
  }
  const base64 = dataUrl.slice(comma + 1);
  const bytes = base64Bytes(base64);
  if (bytes > CHUNK_BYTES * 1.1) {
    throw new HttpError(413, 'CHUNK_TOO_LARGE', 'الجزء المرسل أكبر من المسموح.');
  }

  const mime = (input.mime || dataUrl.slice(5, comma).split(';')[0] || 'video/mp4').toLowerCase();

  await query(
    `INSERT INTO ${CHUNK_TABLE} (upload_id, idx, mime, owner_phone, data)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (upload_id, idx) DO UPDATE SET data = EXCLUDED.data`,
    [uploadId, index, mime, input.ownerPhone || null, base64]
  );

  const { rows } = await query(
    `SELECT count(*)::int AS n FROM ${CHUNK_TABLE} WHERE upload_id = $1`,
    [uploadId]
  );

  return { received: Number(rows[0]?.n) || 0, bytes };
}

/**
 * Join the slices into one stored file. Base64 slices join cleanly because the
 * client cuts them on multiples of 3 bytes.
 */
export async function completeChunked(
  uploadId: string,
  totalChunks: number,
  kind: 'image' | 'video'
): Promise<SavedMedia> {
  await ensureMediaTable();

  const { rows } = await query(
    `SELECT idx, mime, data FROM ${CHUNK_TABLE} WHERE upload_id = $1 ORDER BY idx ASC`,
    [uploadId]
  );

  if (rows.length === 0) {
    throw new HttpError(404, 'UPLOAD_NOT_FOUND', 'لم يصل أي جزء من الملف، أعد المحاولة.');
  }
  const expected = Number(totalChunks) || rows.length;
  if (rows.length !== expected) {
    throw new HttpError(409, 'UPLOAD_INCOMPLETE', `وصل ${rows.length} جزء من ${expected}، أعد المحاولة.`);
  }
  for (let i = 0; i < rows.length; i++) {
    if (Number(rows[i].idx) !== i) {
      throw new HttpError(409, 'UPLOAD_GAP', 'في جزء ناقص من الملف، أعد المحاولة.');
    }
  }

  const mime = String(rows[0].mime || (kind === 'video' ? 'video/mp4' : 'image/jpeg'));
  const base64 = rows.map((r) => String(r.data)).join('');
  const bytes = base64Bytes(base64);

  if (bytes > ceilingFor(kind)) {
    await query(`DELETE FROM ${CHUNK_TABLE} WHERE upload_id = $1`, [uploadId]);
    throw new HttpError(
      413,
      'TOO_LARGE',
      `حجم الملف ${(bytes / 1024 / 1024).toFixed(1)} ميجا، والحد الأقصى ${ceilingFor(kind) / 1024 / 1024} ميجا.`
    );
  }

  const id = newId(kind === 'video' ? 'vid' : 'img');
  await query(
    `INSERT INTO ${TABLE} (id, kind, mime, bytes, owner_phone, data)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, kind, mime, bytes, rows[0].owner_phone ?? null, base64]
  );
  await query(`DELETE FROM ${CHUNK_TABLE} WHERE upload_id = $1`, [uploadId]);
  // Housekeeping: drop slices abandoned more than a day ago.
  await query(`DELETE FROM ${CHUNK_TABLE} WHERE created_at < now() - interval '1 day'`).catch(() => {});

  return { id, url: `/api/media/${id}`, mime, bytes, kind };
}

/**
 * Small in-memory cache for the files being streamed.
 *
 * Why: a video is stored as one base64 column, so every range request would
 * otherwise pull and decode the whole clip again (a 28 MB video ≈ 38 MB of
 * base64). A player asks for a dozen ranges per playback, which means hundreds
 * of megabytes of unnecessary work — and the video stutters or times out.
 * The cache keeps the few clips being watched by this warm instance.
 */
const MEDIA_CACHE_MAX_BYTES = 120 * 1024 * 1024;
const MEDIA_CACHE_MAX_ITEM = 45 * 1024 * 1024;
const mediaCache = new Map<string, { mime: string; data: Buffer; bytes: number }>();
let mediaCacheBytes = 0;

function cacheGet(id: string) {
  const hit = mediaCache.get(id);
  if (!hit) return null;
  // Refresh recency so the clip being watched is not evicted first.
  mediaCache.delete(id);
  mediaCache.set(id, hit);
  return hit;
}

function cachePut(id: string, value: { mime: string; data: Buffer; bytes: number }) {
  if (value.data.length > MEDIA_CACHE_MAX_ITEM) return;
  const existing = mediaCache.get(id);
  if (existing) {
    mediaCacheBytes -= existing.data.length;
    mediaCache.delete(id);
  }
  mediaCache.set(id, value);
  mediaCacheBytes += value.data.length;
  while (mediaCacheBytes > MEDIA_CACHE_MAX_BYTES && mediaCache.size > 1) {
    const oldestKey = mediaCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    const oldest = mediaCache.get(oldestKey);
    mediaCache.delete(oldestKey);
    mediaCacheBytes -= oldest?.data.length ?? 0;
  }
}

export async function getMedia(
  id: string
): Promise<{ mime: string; data: Buffer; bytes: number } | null> {
  const cached = cacheGet(id);
  if (cached) return cached;

  await ensureMediaTable();

  const { rows } = await query(
    `SELECT mime, data, bytes FROM ${TABLE} WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;

  const value = {
    mime: row.mime as string,
    bytes: Number(row.bytes) || 0,
    data: Buffer.from(row.data, 'base64'),
  };
  cachePut(id, value);
  return value;
}


/**
 * Builds the HTTP answer for a stored file, honouring a `Range` header.
 *
 * Extracted from the route so it can be tested without a database: mobile
 * browsers only play video when the server answers `206 Partial Content`
 * (see the note in routes.ts). Every branch below is covered by
 * `scripts/test-media-range.ts`.
 */
export function buildMediaResponse(
  data: Buffer,
  mime: string,
  rangeHeader?: string
): { status: number; headers: Record<string, string>; body: Buffer | null } {
  const total = data.length;
  const headers: Record<string, string> = {
    'Content-Type': mime,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
  };
  if (!/^(image|text)\//.test(mime)) headers['Content-Disposition'] = 'inline';

  const partial = (start: number, end: number) => ({
    status: 206,
    headers: {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(end - start + 1),
    },
    body: data.subarray(start, end + 1),
  });
  const unsatisfiable = () => ({
    status: 416,
    headers: { ...headers, 'Content-Range': `bytes */${total}` },
    body: null,
  });

  if (!rangeHeader) {
    return { status: 200, headers: { ...headers, 'Content-Length': String(total) }, body: data };
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
  if (!match) return unsatisfiable();

  let start = match[1] === '' ? NaN : Number(match[1]);
  let end = match[2] === '' ? NaN : Number(match[2]);

  if (Number.isNaN(start) && Number.isNaN(end)) return unsatisfiable();
  if (Number.isNaN(start)) {
    // `bytes=-500` → the last 500 bytes
    start = Math.max(0, total - end);
    end = total - 1;
  } else if (Number.isNaN(end) || end >= total) {
    end = total - 1;
  }
  if (start > end || start >= total) return unsatisfiable();
  return partial(start, end);
}

export async function deleteMedia(id: string): Promise<boolean> {
  await ensureMediaTable();
  const { rowCount } = await query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}
