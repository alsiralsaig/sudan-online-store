import React, { useRef, useState } from 'react';
import { Camera, Video, X, Loader2, ImageOff } from 'lucide-react';

/** Vercel rejects serverless request bodies over ~4.5 MB, base64 adds 33%. */
const MAX_VIDEO_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_SOURCE_BYTES = 15 * 1024 * 1024;

const MAX_PHOTO_EDGE = 1280;
const PHOTO_QUALITY = 0.82;

export interface UploadedMedia {
  url: string;
  kind: 'image' | 'video';
  /** Blob URL for instant local preview before/while the server copy loads. */
  previewUrl?: string;
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

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'image' | 'video'>(null);
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

    try {
      const dataUrl =
        kind === 'image' ? await compressImage(file) : await readAsDataUrl(file);

      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, kind }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.message || 'تعذر رفع الملف.');
      }

      onChange({
        url: body.url,
        kind,
        previewUrl: kind === 'image' ? dataUrl : URL.createObjectURL(file),
      });
    } catch (err) {
      setError((err as Error).message || 'تعذر رفع الملف.');
    } finally {
      setBusy(null);
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
              {busy === 'video' ? 'جارٍ الرفع…' : 'فيديو قصير'}
            </span>
            <span className="text-[9px] text-slate-500">حتى 3 ميجا</span>
          </button>
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
