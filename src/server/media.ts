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

/** Vercel caps serverless request bodies at ~4.5 MB, and base64 adds 33%. */
export const MAX_RAW_BYTES = 3 * 1024 * 1024; // 3 MB

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
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > MAX_RAW_BYTES) {
    throw new HttpError(
      413,
      'TOO_LARGE',
      `حجم الملف ${(bytes / 1024 / 1024).toFixed(1)} ميجا، والحد الأقصى ${MAX_RAW_BYTES / 1024 / 1024} ميجا.`
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

export async function getMedia(
  id: string
): Promise<{ mime: string; data: Buffer; bytes: number } | null> {
  await ensureMediaTable();

  const { rows } = await query(
    `SELECT mime, data, bytes FROM ${TABLE} WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;

  return {
    mime: row.mime,
    bytes: Number(row.bytes) || 0,
    data: Buffer.from(row.data, 'base64'),
  };
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
