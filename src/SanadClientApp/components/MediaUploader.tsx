import React, { useRef, useState } from 'react';
import { Camera, Video, X, Loader2, ImageOff } from 'lucide-react';

/** A single request is capped at ~4.5 MB by Vercel, so big videos go in slices. */
const SINGLE_SHOT_BYTES = 2.8 * 1024 * 1024;
/** What a publisher may send in total (stitched on the server). */
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const MAX_IMAGE_SOURCE_BYTES = 15 * 1024 * 1024;
/** Multiple of 3 bytes, so every base64 slice joins cleanly on the server. */
const CHUNK_BYTES = 2_100_000;
const CHUNK_RETRIES = 3;

const MAX_PHOTO_EDGE = 1280;
const PHOTO_QUALITY = 0.82;

export interface UploadedMedia {
  url: string;
  kind: 'image' | 'video';
  /** Blob URL for instant local preview before/while the server copy loads. */
  previewUrl?: string;
  /**
   * Cover photo grabbed from the first frames of the video, uploaded as a real
   * image. Ads show it in the grid and the VIP strip instead of a blank box.
   */
  posterUrl?: string;
}

interface MediaUploaderProps {
  value: UploadedMedia | null;
  onChange: (media: UploadedMedia | null) => void;
  disabled?: boolean;
}

/**
 * Compress an image in the browser before upload.
 * A 4 MB phone photo becomes ~180 KB, which keeps the ad list responsive and
 * stays well inside the serverless body limit.
 */
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذر تجهيز الصورة');

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  return canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Grab a still frame from a video so the ad has a cover photo. Uses a canvas
 * capture at ~0.5 s (past any black intro frame); returns null if the browser
 * refuses to decode the file, in which case the card falls back to <video>.
 */
async function extractPoster(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      video.onloadeddata = done;
      video.onerror = done;
      setTimeout(done, 8000);
    });

    if (!video.videoWidth) return null;

    // Nudge forward a touch: the very first frame of many clips is black.
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      video.onseeked = done;
      try {
        video.currentTime = Math.min(0.5, (video.duration || 1) / 3);
      } catch {
        done();
      }
      setTimeout(done, 3000);
    });

    const source = video.videoWidth ? video : null;
    const w = source?.videoWidth || 1280;
    const h = source?.videoHeight || 720;
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(w, h));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
    return dataUrl.length > 5000 ? dataUrl : null;
  } catch {
    return null;
  } finally {
    video.src = '';
    URL.revokeObjectURL(url);
  }
}

/** Upload a small poster image and return its public URL. */
async function uploadPoster(dataUrl: string): Promise<string | null> {
  try {
    const res = await fetch('/api/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl, kind: 'image' }),
    });
    const body = await res.json().catch(() => ({}));
    return res.ok ? body.url : null;
  } catch {
    return null;
  }
}

function makeUploadId(): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now()}${Math.random().toString(36).slice(2)}`;
  return `up${rnd}`.slice(0, 40);
}

/**
 * Upload a file in small slices so a 20–30 MB video still works over a server
 * that refuses big request bodies. Each slice is retried on a network hiccup.
 */
async function uploadInChunks(
  file: File,
  kind: 'image' | 'video',
  onProgress: (percent: number) => void
): Promise<{ url: string; kind: 'image' | 'video' }> {
  const uploadId = makeUploadId();
  const totalChunks = Math.ceil(file.size / CHUNK_BYTES);

  for (let i = 0; i < totalChunks; i++) {
    const slice = file.slice(i * CHUNK_BYTES, Math.min(file.size, (i + 1) * CHUNK_BYTES));
    const dataUrl = await readAsDataUrl(slice);

    let lastError: Error | null = null;
    let done = false;
    for (let attempt = 0; attempt < CHUNK_RETRIES && !done; attempt++) {
      try {
        const res = await fetch('/api/media/chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId, index: i, dataUrl, mime: file.type || 'video/mp4', kind }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || 'تعذر رفع جزء من الملف.');
        done = true;
      } catch (err) {
        lastError = err as Error;
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    if (!done) throw lastError || new Error('تعذر رفع الملف.');

    onProgress(Math.round(((i + 1) / (totalChunks + 1)) * 100));
  }

  const res = await fetch('/api/media/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId, totalChunks, kind }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || 'تعذر تجميع الملف بعد الرفع.');

  onProgress(100);
  return { url: body.url, kind };
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'image' | 'video'>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File, kind: 'image' | 'video') => {
    setError(null);

    if (kind === 'image') {
      if (!file.type.startsWith('image/')) {
        setError('الملف المختار ليس صورة.');
        return;
      }
      if (file.size > MAX_IMAGE_SOURCE_BYTES) {
        setError('حجم الصورة كبير جداً (الحد 15 ميجا).');
        return;
      }
    } else {
      if (!file.type.startsWith('video/')) {
        setError('الملف المختار ليس فيديو.');
        return;
      }
      if (file.size > MAX_VIDEO_BYTES) {
        setError(
          `حجم الفيديو ${(file.size / 1024 / 1024).toFixed(1)} ميجا، والحد الأقصى ${MAX_VIDEO_BYTES / 1024 / 1024} ميجا. اختر مقطعاً أقصر.`
        );
        return;
      }
    }

    setBusy(kind);
    setProgress(0);

    try {
      let url = '';
      let previewUrl: string;

      if (kind === 'image' || file.size <= SINGLE_SHOT_BYTES) {
        // Photos are compressed; small videos go in one request.
        const dataUrl = kind === 'image' ? await compressImage(file) : await readAsDataUrl(file);
        setProgress(45);

        const res = await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl, kind }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || 'تعذر رفع الملف.');
        url = body.url;
        previewUrl = kind === 'image' ? dataUrl : URL.createObjectURL(file);
      } else {
        // Big video: slice it up so no request hits the body limit, and grab a
        // cover frame in parallel so the card never looks empty.
        const posterPromise = extractPoster(file);
        const uploaded = await uploadInChunks(file, kind, setProgress);
        url = uploaded.url;
        previewUrl = URL.createObjectURL(file);

        const posterData = await posterPromise;
        const posterUrl = posterData ? await uploadPoster(posterData) : null;
        onChange({ url, kind, previewUrl, posterUrl: posterUrl || undefined });
        return;
      }

      onChange({ url, kind, previewUrl });
    } catch (err) {
      setError((err as Error).message || 'تعذر رفع الملف.');
    } finally {
      setBusy(null);
      setProgress(0);
      if (photoInput.current) photoInput.current.value = '';
      if (videoInput.current) videoInput.current.value = '';
    }
  };

  const preview = value?.previewUrl || value?.url || null;

  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
        <span>صورة أو فيديو الإعلان:</span>
        <span className="text-[10px] text-slate-400">من جهازك أو الكاميرا</span>
      </label>

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-emerald-600 aspect-video bg-slate-900">
          {value?.kind === 'video' ? (
            <video src={preview} className="w-full h-full object-cover" controls playsInline />
          ) : (
            <img src={preview} alt="معاينة الإعلان" className="w-full h-full object-cover" />
          )}

          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="absolute top-2 left-2 bg-black/70 hover:bg-black/85 text-white rounded-full p-1.5 transition-colors"
            aria-label="إزالة الملف"
          >
            <X className="w-4 h-4" />
          </button>

          <span className="absolute bottom-2 right-2 bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full">
            {value?.kind === 'video' ? 'فيديو جاهز' : 'صورة جاهزة'}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => photoInput.current?.click()}
            disabled={disabled || busy !== null}
            className="flex flex-col items-center justify-center gap-1.5 aspect-video rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 hover:bg-emerald-50 active:scale-[0.99] transition-all text-emerald-800 disabled:opacity-50"
          >
            {busy === 'image' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Camera className="w-5 h-5" />
            )}
            <span className="text-[11px] font-bold">
              {busy === 'image' ? 'جارٍ الرفع…' : 'إضافة صورة'}
            </span>
            <span className="text-[9px] text-emerald-700/70">من المعرض أو الكاميرا</span>
          </button>

          <button
            type="button"
            onClick={() => videoInput.current?.click()}
            disabled={disabled || busy !== null}
            className="flex flex-col items-center justify-center gap-1.5 aspect-video rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 active:scale-[0.99] transition-all text-slate-700 disabled:opacity-50"
          >
            {busy === 'video' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Video className="w-5 h-5" />
            )}
            <span className="text-[11px] font-bold">
              {busy === 'video' ? `جارٍ الرفع… ${progress}%` : 'فيديو الإعلان'}
            </span>
            <span className="text-[9px] text-slate-500">حتى 40 ميجا</span>
          </button>
        </div>
      )}

      {busy === 'video' && progress > 0 && (
        <div className="mt-2">
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1 text-center">
            رفع الفيديو… {progress}% (لا تسكّر الصفحة)
          </p>
        </div>
      )}

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file, 'image');
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file, 'video');
        }}
      />

      {error && (
        <p className="mt-1.5 text-[11px] text-red-600 flex items-center gap-1">
          <ImageOff className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
};
