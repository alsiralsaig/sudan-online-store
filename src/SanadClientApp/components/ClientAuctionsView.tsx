import React, { useEffect, useRef, useState } from 'react';
import {
  Gavel, Plus, X, ImagePlus, Video, Camera, Trash2, Clock, Trophy, RefreshCw, Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api.ts';

/**
 * المزادات — قائمة حقيقية من السيرفر + إنشاء مزاد بصور متعددة وفيديو.
 * ------------------------------------------------------------------
 * قبل التعديل كانت الشاشة تعرض مزادين ثابتين في الكود («تويوتا فورتشنر»)،
 * والزر يفتح نافذة «إنشاء إعلان» لا علاقة لها بالمزادات. الآن:
 *   • المزادات تُقرأ وتُحفظ على الخادم (/market/auctions)
 *   • إنشاء مزاد: عنوان، وصف، سعر افتتاح، أقل زيادة، مدة، حتى 6 صور، فيديو
 *   • مزايدة فعلية مع تحقق من أقل مبلغ مسموح
 */
interface Auction {
  id: string;
  title: string;
  category: string;
  description?: string;
  startPriceSdg: number;
  minIncrementSdg: number;
  images: string[];
  videoUrl?: string;
  city?: string;
  phone?: string;
  whatsapp?: string;
  storeName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'closed';
  endsAt: string;
  createdAt: string;
  topBidSdg?: number;
  topBidder?: string;
  rejectionReason?: string;
}

interface Props {
  ownerToken: string;
  onRequirePhone?: (phone: string, whatsapp?: string) => void;
}

const OWNER_KEY = 'sanad.auction.owner.v1';

/** صورة → data URL مصغّرة (نفس أسلوب إنشاء الإعلانات) */
const fileToDataUrl = (file: File, maxSide = 900): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => reject(new Error('image'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });

/** فيديو → data URL (بحد أقصى ~8 ميجا) */
const fileToVideoDataUrl = (file: File, maxBytes = 8 * 1024 * 1024): Promise<string> =>
  new Promise((resolve, reject) => {
    if (file.size > maxBytes) return reject(new Error('الفيديو كبير — اختار أقل من 8 ميجا'));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });

/** صورة من عنصر فيديو (معاينة الكاميرا) → data URL مضغوطة */
const videoFrameToDataUrl = (video: HTMLVideoElement, maxSide = 900): string => {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth || 1, video.videoHeight || 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((video.videoWidth || 1) * scale));
  canvas.height = Math.max(1, Math.round((video.videoHeight || 1) * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
};

const timeLeft = (iso: string): string => {
  const diff = Date.parse(iso) - Date.now();
  if (Number.isNaN(diff)) return '';
  if (diff <= 0) return 'انتهى';
  const h = Math.floor(diff / 36e5);
  const m = Math.floor((diff % 36e5) / 6e4);
  if (h >= 24) return `${Math.floor(h / 24)} يوم و${h % 24} ساعة`;
  if (h > 0) return `${h} ساعة و${m} دقيقة`;
  return `${m} دقيقة`;
};

export const ClientAuctionsView: React.FC<Props> = ({ ownerToken }) => {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [bidFor, setBidFor] = useState<Auction | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getMarketAuctions(ownerToken);
      /*
       * السوق يرى المعتمد فقط، لكن صاحب المزاد يجب أن يرى مزاده المعلّق
       * والمرفوض (مع السبب) حتى يعرف ماذا حدث — بنفس أسلوب إعلانات السوق.
       */
      const live = (res.auctions || []) as Auction[];
      const mineOnly = ((res.mine || []) as Auction[]).filter(
        (m) => !live.some((l) => l.id === m.id)
      );
      setAuctions([...mineOnly, ...live]);
    } catch (e) {
      setError((e as Error).message || 'تعذّر تحميل المزادات.');
    } finally {
      setLoading(false);
    }
  }, [ownerToken]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-4xl mx-auto px-3 py-3 space-y-3" dir="rtl">
      <div className="rounded-2xl bg-gradient-to-l from-teal-900 to-slate-900 text-white p-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black flex items-center gap-1.5">
            <Gavel className="w-5 h-5 text-amber-400" /> مزادات سند
          </h2>
          <p className="text-[11px] text-slate-300 mt-0.5">
            أنشئ مزادك بصور متعددة وفيديو — أو شارك بمزايدتك الآن.
          </p>
        </div>
        <button
          onClick={() => setOpenCreate(true)}
          className="shrink-0 px-3 py-2 rounded-xl bg-amber-400 text-slate-950 text-[12px] font-black flex items-center gap-1 active:scale-95"
        >
          <Plus className="w-4 h-4" /> مزاد جديد
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-700">{auctions.length} مزاد</p>
        <button onClick={load} className="text-[11px] font-bold text-sky-700 flex items-center gap-1">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> تحديث
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[12px] font-bold text-rose-800">{error}</div>
      )}

      {loading && !auctions.length ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : auctions.length === 0 ? (
        <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-300 bg-white">
          <Gavel className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-black text-slate-800">لا مزادات بعد</h3>
          <p className="text-[12px] text-slate-600 mt-1">كن أول من ينشئ مزاداً — أضف صوراً وفيديو وحدّد سعر الافتتاح.</p>
          <button
            onClick={() => setOpenCreate(true)}
            className="mt-3 px-4 py-2 rounded-xl bg-sky-600 text-white text-[12px] font-bold inline-flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> إنشاء مزاد
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {auctions.map((a) => {
            const ended = a.status === 'closed' || Date.parse(a.endsAt) < Date.now();
            const top = a.topBidSdg ?? a.startPriceSdg;
            return (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex gap-2.5 p-2.5">
                  <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-slate-100">
                    {a.images?.[0] ? (
                      <img src={a.images[0]} alt={a.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Gavel className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-[13px] font-black text-slate-900 leading-tight line-clamp-2">{a.title}</h4>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black ${
                          a.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : a.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : ended
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {a.status === 'pending'
                          ? 'قيد المراجعة'
                          : a.status === 'rejected'
                            ? 'مرفوض'
                            : ended
                              ? 'انتهى'
                              : 'جارٍ'}
                      </span>
                    </div>
                    <p className="text-[13px] font-black text-sky-700 font-mono">
                      {Number(top).toLocaleString('en-US')} ج.س
                      <span className="text-[10px] font-bold text-slate-600"> {a.topBidSdg ? 'أعلى مزايدة' : 'سعر الافتتاح'}</span>
                    </p>
                    <p className="text-[10px] text-slate-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {ended ? 'انتهى المزاد' : `ينتهي بعد ${timeLeft(a.endsAt)}`}
                      {a.images?.length > 1 && <span className="ms-1">· {a.images.length} صور</span>}
                      {a.videoUrl && <span className="ms-1">· فيديو</span>}
                    </p>
                  </div>
                </div>
                {a.status === 'pending' && (
                  <p className="px-2.5 pb-1 text-[11px] font-bold text-amber-700">
                    مزادك قيد مراجعة الإدارة — سيظهر للسوق بعد الموافقة.
                  </p>
                )}
                {a.status === 'rejected' && (
                  <p className="px-2.5 pb-1 text-[11px] font-bold text-rose-700">
                    رُفض المزاد{a.rejectionReason ? `: ${a.rejectionReason}` : ''}
                  </p>
                )}
                <div className="px-2.5 pb-2.5 flex gap-1.5">
                  <button
                    disabled={ended || a.status !== 'approved'}
                    onClick={() => setBidFor(a)}
                    className="flex-1 py-2 rounded-xl bg-emerald-700 text-white text-[12px] font-black disabled:bg-slate-300 disabled:text-slate-500"
                  >
                    <Trophy className="w-3.5 h-3.5 inline me-1" /> زايد الآن
                  </button>
                  {a.whatsapp && (
                    <a
                      href={`https://wa.me/${(a.whatsapp || '').replace(/[^\d]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-xl bg-slate-100 text-slate-800 text-[12px] font-bold"
                    >
                      واتساب
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openCreate && (
        <CreateAuctionModal
          ownerToken={ownerToken}
          onClose={() => setOpenCreate(false)}
          onCreated={() => {
            setOpenCreate(false);
            load();
          }}
        />
      )}

      {bidFor && (
        <BidModal
          auction={bidFor}
          ownerToken={ownerToken}
          onClose={() => setBidFor(null)}
          onDone={() => {
            setBidFor(null);
            load();
          }}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* نموذج إنشاء مزاد                                                    */
/* ------------------------------------------------------------------ */
const CreateAuctionModal: React.FC<{
  ownerToken: string;
  onClose: () => void;
  onCreated: () => void;
}> = ({ ownerToken, onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [increment, setIncrement] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('24');
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  /* زر واحد يفتح اختيار: تصوير بالكاميرا أو اختيار من الاستوديو (صور أو فيديو) */
  const [mediaMenu, setMediaMenu] = useState(false);
  const cameraInput = useRef<HTMLInputElement | null>(null);
  const galleryInput = useRef<HTMLInputElement | null>(null);
  const videoInput = useRef<HTMLInputElement | null>(null);
  /* كاميرا حقيقية داخل الصفحة (In-app) — على أندرويد input capture يفتح الاستوديو */
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const liveVideo = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const startCamera = async (mode: 'environment' | 'user' = facing) => {
    setCameraError('');
    setMediaMenu(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: false,
      });
      streamRef.current = stream;
      setFacing(mode);
      setCameraOn(true);
      /* ربط الستريم بعد تركيب عنصر الفيديو */
      setTimeout(() => {
        if (liveVideo.current) {
          liveVideo.current.srcObject = stream;
          void liveVideo.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      /* لا كاميرا/مرفوض: نرجع لمنتقي الصور في الجهاز */
      setCameraOn(false);
      setMediaMenu(false);
      cameraInput.current?.click();
    }
  };

  const shootPhoto = async () => {
    if (!liveVideo.current || images.length >= 6) return;
    try {
      const shot = videoFrameToDataUrl(liveVideo.current);
      setImages((prev) => [...prev, shot].slice(0, 6));
    } catch {
      setCameraError('تعذّر التقاط الصورة — جرّب مرة أخرى.');
    }
  };

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  const addVideo = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const encoded = await fileToVideoDataUrl(file);
      setVideoUrl(encoded);
      setError('');
    } catch (err: any) {
      setError(err.message || 'تعذّر إضافة الفيديو');
    }
  };

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files).slice(0, 6 - images.length);
    try {
      const encoded = await Promise.all(picked.map((f) => fileToDataUrl(f)));
      setImages((prev) => [...prev, ...encoded].slice(0, 6));
    } catch {
      setError('تعذّر قراءة إحدى الصور — جرّب صورة أخرى.');
    }
  };

  const submit = async () => {
    setError('');
    if (title.trim().length < 4) return setError('اكتب عنواناً واضحاً للمزاد.');
    if (!Number(startPrice)) return setError('اكتب سعر الافتتاح.');
    if (!images.length) return setError('أضف صورة واحدة على الأقل.');

    setBusy(true);
    try {
      const endsAt = new Date(Date.now() + Math.max(1, Number(hours) || 24) * 36e5).toISOString();
      await api.createMarketAuction({
        title: title.trim(),
        description: description.trim(),
        startPriceSdg: Number(startPrice),
        minIncrementSdg: Number(increment) || undefined,
        images,
        videoUrl: videoUrl.trim() || undefined,
        city: city.trim(),
        phone: phone.trim(),
        storeName: 'مزاد فردي',
        ownerToken,
        endsAt,
      });
      onCreated();
    } catch (e) {
      setError((e as Error).message || 'تعذّر نشر المزاد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" /> إنشاء مزاد
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-500" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <Field label="عنوان المزاد">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: آيفون 15 برو — حالة ممتازة"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900"
            />
          </Field>

          <Field label="الوصف (اختياري)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="تفاصيل الحالة، الملحقات، سبب البيع…"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="سعر الافتتاح (ج.س)">
              <input
                value={startPrice}
                onChange={(e) => setStartPrice(e.target.value)}
                inputMode="numeric"
                placeholder="50000"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono text-slate-900"
              />
            </Field>
            <Field label="أقل زيادة (ج.س)">
              <input
                value={increment}
                onChange={(e) => setIncrement(e.target.value)}
                inputMode="numeric"
                placeholder="2000"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono text-slate-900"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="المدينة">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="بورتسودان"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900"
              />
            </Field>
            <Field label="مدة المزاد">
              <select
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white"
              >
                <option value="6">6 ساعات</option>
                <option value="24">يوم</option>
                <option value="72">3 أيام</option>
                <option value="168">أسبوع</option>
              </select>
            </Field>
          </div>

          <Field label="رقم الهاتف (اختياري)">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="+249…"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900"
            />
          </Field>

          {/* الصور والفيديو: زر واحد يفتح الخيارات */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-bold text-slate-700">
                صور المزاد ({images.length}/6) {videoUrl ? '• فيديو مرفق ✓' : ''}
              </p>
              <button
                type="button"
                onClick={() => setMediaMenu(true)}
                className="rounded-lg bg-sky-600 text-white px-2.5 py-1 text-[11px] font-black flex items-center gap-1"
              >
                <ImagePlus className="w-3.5 h-3.5" /> إضافة صورة/فيديو
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {images.map((src, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                  <img src={src} alt={`صورة ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0 left-0 bg-black/60 text-white p-0.5"
                    aria-label="حذف الصورة"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {videoUrl && (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-emerald-300 bg-slate-900 flex items-center justify-center">
                  <Video className="w-5 h-5 text-emerald-300" />
                  <button
                    onClick={() => setVideoUrl('')}
                    className="absolute top-0 left-0 bg-black/60 text-white p-0.5"
                    aria-label="حذف الفيديو"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* مدخلات مخفية: كاميرا / استوديو صور / استوديو فيديو */}
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { void addImages(e.target.files); setMediaMenu(false); }}
            />
            <input
              ref={galleryInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { void addImages(e.target.files); setMediaMenu(false); }}
            />
            <input
              ref={videoInput}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => { void addVideo(e.target.files?.[0]); setMediaMenu(false); }}
            />

            {cameraOn && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col" dir="rtl">
          <div className="flex items-center justify-between p-3 text-white">
            <span className="text-[13px] font-black">تصوير صورة للمزاد ({images.length}/6)</span>
            <button onClick={stopCamera} className="rounded-lg bg-white/15 p-1.5" aria-label="إغلاق الكاميرا">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative flex-1 overflow-hidden bg-black">
            <video ref={liveVideo} playsInline muted className="w-full h-full object-contain" />
            {cameraError && (
              <p className="absolute bottom-3 right-3 left-3 text-center text-[11.5px] font-bold text-rose-300">{cameraError}</p>
            )}
          </div>

          <div className="p-3 pb-6 flex items-center justify-around bg-black">
            <button
              onClick={() => { void startCamera(facing === 'environment' ? 'user' : 'environment'); }}
              className="rounded-full bg-white/15 text-white px-3 py-2 text-[11px] font-bold flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> تبديل الكاميرا
            </button>
            <button
              onClick={shootPhoto}
              disabled={images.length >= 6}
              className="w-16 h-16 rounded-full bg-white border-4 border-sky-400 active:scale-95 disabled:opacity-50"
              aria-label="التقاط صورة"
            />
            <button
              onClick={() => { stopCamera(); setMediaMenu(true); }}
              className="rounded-full bg-white/15 text-white px-3 py-2 text-[11px] font-bold"
            >
              تم
            </button>
          </div>
        </div>
      )}

      {mediaMenu && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-3" onClick={() => setMediaMenu(false)}>
                <div className="w-full max-w-sm rounded-2xl bg-white p-3 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                  <p className="text-[12.5px] font-black text-slate-900 px-1 pb-1">أضف صورة أو فيديو للمزاد</p>
                  <button
                    type="button"
                    onClick={() => { void startCamera('environment'); }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[11.5px] font-bold text-slate-800 flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4 text-sky-700" /> تصوير بالكاميرا
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInput.current?.click()}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[11.5px] font-bold text-slate-800 flex items-center gap-2"
                  >
                    <ImagePlus className="w-4 h-4 text-sky-700" /> اختيار صور من الاستوديو
                  </button>
                  <button
                    type="button"
                    onClick={() => videoInput.current?.click()}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[11.5px] font-bold text-slate-800 flex items-center gap-2"
                  >
                    <Video className="w-4 h-4 text-sky-700" /> اختيار فيديو من الاستوديو
                  </button>
                  {videoUrl && (
                    <button
                      type="button"
                      onClick={() => { setVideoUrl(''); setMediaMenu(false); }}
                      className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] font-bold text-rose-700"
                    >
                      حذف الفيديو المرفق
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMediaMenu(false)}
                    className="w-full rounded-xl bg-slate-100 px-3 py-2 text-[11.5px] font-bold text-slate-700"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-[12px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-emerald-700 text-white text-sm font-black disabled:bg-slate-300"
          >
            {busy ? 'جارٍ النشر…' : 'نشر المزاد'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* نموذج المزايدة                                                      */
/* ------------------------------------------------------------------ */
const BidModal: React.FC<{
  auction: Auction;
  ownerToken: string;
  onClose: () => void;
  onDone: () => void;
}> = ({ auction, ownerToken, onClose, onDone }) => {
  const floor = (auction.topBidSdg ?? auction.startPriceSdg) + auction.minIncrementSdg;
  const [amount, setAmount] = useState(String(floor));
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await api.placeAuctionBid(auction.id, Number(amount), name.trim() || 'زائر');
      onDone();
    } catch (e) {
      setError((e as Error).message || 'تعذّرت المزايدة.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">مزايدة — {auction.title.slice(0, 24)}</h3>
          <button onClick={onClose} className="p-1 text-slate-500" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[12px] text-slate-700">
          أعلى مزايدة: <b className="font-mono">{Number(auction.topBidSdg ?? auction.startPriceSdg).toLocaleString('en-US')}</b> ج.س
          · أقل مزايدة مسموحة: <b className="font-mono">{floor.toLocaleString('en-US')}</b> ج.س
        </p>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="numeric"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-center font-mono text-lg font-black text-slate-900"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسمك (اختياري)"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900"
        />
        {error && <p className="text-[12px] font-bold text-rose-700">{error}</p>}
        <button
          onClick={submit}
          disabled={busy}
          className="w-full py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-black disabled:bg-slate-300"
        >
          {busy ? 'جارٍ الإرسال…' : 'تأكيد المزايدة'}
        </button>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-[11px] font-bold text-slate-700 mb-1 block">{label}</span>
    {children}
  </label>
);
