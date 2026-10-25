/**
 * Object storage for ad media (photos + short videos).
 *
 * Why this exists — the outage that motivated it:
 * media used to live inside Postgres as one base64 column. A single 27 MB ad
 * video became ~38 MB of base64 in the database, and every playback re-read it.
 * The Neon free plan ran out of quota, the whole store went down (adverts gone,
 * pages timing out), and there was no way to fix it without a paid plan.
 *
 * Sudan has no Visa/Mastercard, so the whole stack has to stay on genuinely
 * free tiers. Vercel Blob's Hobby allowance (1 GB storage, 10 GB transfer, no
 * card required) fits, and Cloudflare R2's free tier needs a payment method to
 * activate — so Blob is the default here.
 *
 * The database keeps only the URL. Nothing about playing a video touches
 * Postgres any more, so one big clip can never take the store down again.
 *
 * Everything degrades: with no token configured the old in-database path still
 * works, so local development and older deployments keep functioning.
 */
import { put } from '@vercel/blob';

/** True when Blob is configured (a store was created and linked in Vercel). */
export function blobEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** Human-readable status for /api/media and /api/health. */
export function storageMode(): 'blob' | 'database' {
  return blobEnabled() ? 'blob' : 'database';
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

export function extensionFor(mime: string): string {
  return EXTENSIONS[mime] || 'bin';
}

/**
 * Uploads bytes to Blob and returns the public URL.
 * Throws on failure so the caller can fall back to the database instead of
 * losing the user's upload.
 */
export async function putMedia(
  id: string,
  data: Buffer,
  mime: string,
  kind: 'image' | 'video'
): Promise<string> {
  const path = `sanad/${kind}/${id}.${extensionFor(mime)}`;
  const result = await put(path, data, {
    access: 'public',
    contentType: mime,
    // Immutable ids: a re-upload always gets a new id, so caching is safe.
    addRandomSuffix: false,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
  return result.url;
}
