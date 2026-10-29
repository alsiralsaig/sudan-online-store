import { apiUrl } from './api';
/** رفع صورة أو فيديو قصير لصنف المخزون — نفس مسار /api/media. */

const SINGLE_SHOT = 2.8 * 1024 * 1024;
const CHUNK = 2_100_000;
const MAX_VIDEO = 12 * 1024 * 1024; // 12 ميجا — فيديو قصير جداً
const MAX_SECONDS = 12;

export const PRODUCT_VIDEO_MAX_SECONDS = MAX_SECONDS;

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsDataURL(blob);
  });
}

export async function compressProductImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('المتصفح لا يدعم ضغط الصورة');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.82);
}

export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const d = Number(video.duration) || 0;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('تعذر قراءة الفيديو'));
    };
    video.src = url;
  });
}

async function postMedia(dataUrl: string, kind: 'image' | 'video'): Promise<string> {
  const res = await fetch(apiUrl('/api/media'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl, kind }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.message || 'تعذر رفع الملف');
  return body.url as string;
}

async function uploadChunked(file: File, kind: 'image' | 'video'): Promise<string> {
  const uploadId = `up${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const totalChunks = Math.ceil(file.size / CHUNK);
  for (let i = 0; i < totalChunks; i++) {
    const slice = file.slice(i * CHUNK, Math.min(file.size, (i + 1) * CHUNK));
    const dataUrl = await readAsDataUrl(slice);
    const res = await fetch(apiUrl('/api/media/chunk'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId, index: i, dataUrl, mime: file.type || 'video/mp4', kind }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || 'تعذر رفع جزء من الفيديو');
  }
  const done = await fetch(apiUrl('/api/media/complete'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId, totalChunks, kind }),
  });
  const body = await done.json().catch(() => ({}));
  if (!done.ok) throw new Error(body.message || 'تعذر تجميع الفيديو');
  return body.url as string;
}

export async function uploadProductImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('الملف المختار ليس صورة');
  const dataUrl = await compressProductImage(file);
  return postMedia(dataUrl, 'image');
}

export async function uploadProductVideo(file: File): Promise<string> {
  if (!file.type.startsWith('video/')) throw new Error('الملف المختار ليس فيديو');
  if (file.size > MAX_VIDEO) {
    throw new Error('الفيديو كبير — الحد 12 ميجا لفيديو قصير جداً (حتى 12 ثانية)');
  }
  const seconds = await readVideoDuration(file);
  if (seconds > MAX_SECONDS + 0.4) {
    throw new Error(`الفيديو ${Math.round(seconds)} ثانية — الحد 12 ثانية فقط`);
  }
  if (file.size <= SINGLE_SHOT) {
    const dataUrl = await readAsDataUrl(file);
    return postMedia(dataUrl, 'video');
  }
  return uploadChunked(file, 'video');
}
