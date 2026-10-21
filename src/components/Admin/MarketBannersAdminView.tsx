import React, { useEffect, useRef, useState } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Upload,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  X,
  Loader2,
  AlertCircle,
  MousePointerClick,
  RotateCcw,
  Eye as EyeIcon,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../lib/api.ts';

/** CTR as a one-decimal percentage string. */
const ctrOf = (b: { clicks?: number; impressions?: number }): string => {
  const views = b.impressions || 0;
  if (!views) return '—';
  return `${(((b.clicks || 0) / views) * 100).toFixed(1)}%`;
};

interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  imageUrl: string;
  linkUrl?: string;
  active: boolean;
  sortOrder: number;
  advertiserName?: string;
  clicks?: number;
  lastClickedAt?: string;
  impressions?: number;
  lastImpressionAt?: string;
  createdAt: string;
}

/** Shrink big photos before upload so the 4.5 MB Vercel body limit is never hit. */
const compressImage = (file: File, maxWidth = 1280, quality = 0.82): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة الملف.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('الملف ليس صورة صحيحة.'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('المتصفح لا يدعم معالجة الصور.'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

/** Admin: manage the rotating banners on the shopper landing page. */
export const MarketBannersAdminView: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    badge: '',
    linkUrl: '',
    advertiserName: '',
    imageUrl: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminMarketBanners();
      setBanners(res.banners);
    } catch (err) {
      console.error('[banners] load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pickImage = async (file?: File | null) => {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('الملف المختار ليس صورة.');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      const res = await api.uploadMedia(dataUrl, 'image');
      setForm((f) => ({ ...f, imageUrl: res.url }));
    } catch (err) {
      setError((err as Error).message || 'تعذر رفع الصورة.');
    } finally {
      setUploading(false);
    }
  };

  const create = async () => {
    setError('');
    if (form.title.trim().length < 3) return setError('اكتب عنوان البانر.');
    if (!form.imageUrl) return setError('اختر صورة للبانر.');

    setBusyId('new');
    try {
      await api.createMarketBanner({ ...form, active: true });
      setForm({ title: '', subtitle: '', badge: '', linkUrl: '', advertiserName: '', imageUrl: '' });
      setIsAdding(false);
      await load();
    } catch (err) {
      setError((err as Error).message || 'تعذر إضافة البانر.');
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (banner: Banner) => {
    setBusyId(banner.id);
    try {
      await api.updateMarketBanner(banner.id, { active: !banner.active });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const move = async (banner: Banner, direction: -1 | 1) => {
    const sorted = [...banners].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = sorted.findIndex((b) => b.id === banner.id);
    const swapWith = sorted[index + direction];
    if (!swapWith) return;

    setBusyId(banner.id);
    try {
      await api.updateMarketBanner(banner.id, { sortOrder: swapWith.sortOrder });
      await api.updateMarketBanner(swapWith.id, { sortOrder: banner.sortOrder });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const resetClicks = async (banner: Banner) => {
    if (!confirm(`تصفير نقرات وظهور «${banner.title}»؟`)) return;
    setBusyId(banner.id);
    try {
      await api.resetMarketBannerClicks(banner.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (banner: Banner) => {
    if (!confirm(`حذف بانر «${banner.title}»؟`)) return;
    setBusyId(banner.id);
    try {
      await api.deleteMarketBanner(banner.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const totalClicks = banners.reduce((sum, b) => sum + (b.clicks || 0), 0);
  const totalImpressions = banners.reduce((sum, b) => sum + (b.impressions || 0), 0);
  const overallCtr = totalImpressions ? `${((totalClicks / totalImpressions) * 100).toFixed(1)}%` : '—';
  const topBanner = banners.reduce<Banner | null>(
    (best, b) => ((b.clicks || 0) > (best?.clicks || 0) ? b : best),
    null
  );
  /** Highest CTR among banners that actually ran (min 1 view). */
  const bestCtrBanner = banners
    .filter((b) => (b.impressions || 0) > 0)
    .reduce<Banner | null>((best, b) => {
      const ctr = (b.clicks || 0) / (b.impressions || 1);
      const bestCtr = best ? (best.clicks || 0) / (best.impressions || 1) : -1;
      return ctr > bestCtr ? b : best;
    }, null);

  const field =
    'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500';

  const sorted = [...banners].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            بانرات السوق
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            الصور التي تظهر متغيّرة في أعلى صفحة السوق. {sorted.filter((b) => b.active).length} مفعّل من {sorted.length}.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> تحديث
          </button>
          <button
            onClick={() => setIsAdding((v) => !v)}
            className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
          >
            {isAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {isAdding ? 'إلغاء' : 'بانر جديد'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
          <p className="text-[10px] text-slate-400 flex items-center gap-1">
            <EyeIcon className="w-3 h-3 text-sky-400" /> مرات الظهور
          </p>
          <p className="text-lg font-black text-white mt-1">
            {totalImpressions.toLocaleString('en-US')}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
          <p className="text-[10px] text-slate-400 flex items-center gap-1">
            <MousePointerClick className="w-3 h-3 text-emerald-400" /> إجمالي النقرات
          </p>
          <p className="text-lg font-black text-white mt-1">{totalClicks.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
          <p className="text-[10px] text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-amber-400" /> نسبة التفاعل CTR
          </p>
          <p className="text-lg font-black text-emerald-400 mt-1">{overallCtr}</p>
          {bestCtrBanner && (
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              الأعلى: {bestCtrBanner.title} ({ctrOf(bestCtrBanner)})
            </p>
          )}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
          <p className="text-[10px] text-slate-400">أفضل بانر (نقرات)</p>
          <p className="text-xs font-bold text-white mt-1.5 truncate">
            {topBanner && (topBanner.clicks || 0) > 0 ? topBanner.title : 'لا نقرات بعد'}
          </p>
          {topBanner && (topBanner.clicks || 0) > 0 && (
            <p className="text-[10px] text-emerald-400 mt-0.5">
              {(topBanner.clicks || 0).toLocaleString('en-US')} نقرة من{' '}
              {(topBanner.impressions || 0).toLocaleString('en-US')} ظهور
            </p>
          )}
        </div>
      </div>

      {isAdding && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="عنوان البانر (مطلوب)"
              className={field}
            />
            <input
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              placeholder="سطر توضيحي (اختياري)"
              className={field}
            />
            <input
              value={form.badge}
              onChange={(e) => setForm({ ...form, badge: e.target.value })}
              placeholder="شارة صغيرة، مثل: ضمان معتمد"
              className={field}
            />
            <input
              value={form.advertiserName}
              onChange={(e) => setForm({ ...form, advertiserName: e.target.value })}
              placeholder="اسم المعلن (للإدارة فقط)"
              className={field}
            />
            <input
              value={form.linkUrl}
              onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
              placeholder="رابط عند الضغط (اختياري)"
              dir="ltr"
              className={field}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-3 py-2 rounded-xl text-[11px] font-bold bg-slate-800 text-slate-200 hover:text-white flex items-center gap-1.5 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'جارٍ الرفع…' : 'اختر صورة'}
            </button>

            {form.imageUrl && (
              <div className="flex items-center gap-2">
                <img src={form.imageUrl} alt="" className="w-20 h-12 object-cover rounded-lg border border-slate-700" />
                <button onClick={() => setForm({ ...form, imageUrl: '' })} className="text-[10px] text-red-400 hover:text-red-300">
                  إزالة
                </button>
              </div>
            )}
          </div>

          {error && (
            <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </p>
          )}

          <button
            onClick={create}
            disabled={busyId === 'new'}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black disabled:opacity-60"
          >
            {busyId === 'new' ? 'جارٍ الحفظ…' : 'حفظ البانر ونشره'}
          </button>
        </div>
      )}

      {loading && sorted.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-xs">جارٍ التحميل…</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-xs">لا توجد بانرات. أضف أول بانر.</div>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((banner) => (
            <div key={banner.id} className="bg-slate-900 rounded-2xl border border-slate-800 p-3 flex gap-3">
              <div className="w-28 h-20 rounded-xl overflow-hidden bg-slate-800 shrink-0">
                <img src={banner.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{banner.title}</h4>
                    {banner.subtitle && <p className="text-[11px] text-slate-400 truncate">{banner.subtitle}</p>}
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {banner.badge && <span className="text-amber-400">{banner.badge} • </span>}
                      {banner.advertiserName || 'بدون معلن'} • ترتيب {banner.sortOrder}
                    </p>
                  </div>
                  <span
                    title={banner.lastClickedAt ? `آخر نقرة: ${new Date(banner.lastClickedAt).toLocaleString('ar-EG')}` : 'لا نقرات بعد'}
                    className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800 text-sky-300 border-slate-700 flex items-center gap-1"
                  >
                    <MousePointerClick className="w-2.5 h-2.5" />
                    {(banner.clicks || 0).toLocaleString('en-US')}
                  </span>
                  <span
                    title="مرات الظهور ثم نسبة التفاعل"
                    className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800 text-amber-300 border-slate-700 flex items-center gap-1"
                  >
                    <EyeIcon className="w-2.5 h-2.5" />
                    {(banner.impressions || 0).toLocaleString('en-US')} · {ctrOf(banner)}
                  </span>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      banner.active
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-700/40 text-slate-400 border-slate-600'
                    }`}
                  >
                    {banner.active ? 'ظاهر' : 'موقوف'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <button
                    onClick={() => toggle(banner)}
                    disabled={busyId === banner.id}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-200 hover:text-white flex items-center gap-1 disabled:opacity-50"
                  >
                    {banner.active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {banner.active ? 'إيقاف' : 'تشغيل'}
                  </button>
                  <button
                    onClick={() => move(banner, -1)}
                    disabled={busyId === banner.id}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-200 hover:text-white flex items-center gap-1 disabled:opacity-50"
                  >
                    <ArrowUp className="w-3 h-3" /> قدّم
                  </button>
                  <button
                    onClick={() => move(banner, 1)}
                    disabled={busyId === banner.id}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-200 hover:text-white flex items-center gap-1 disabled:opacity-50"
                  >
                    <ArrowDown className="w-3 h-3" /> أخّر
                  </button>
                  <button
                    onClick={() => resetClicks(banner)}
                    disabled={busyId === banner.id || (!banner.clicks && !banner.impressions)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1 disabled:opacity-40"
                  >
                    <RotateCcw className="w-3 h-3" /> تصفير
                  </button>
                  <button
                    onClick={() => remove(banner)}
                    disabled={busyId === banner.id}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-red-400 hover:bg-red-500/20 flex items-center gap-1 disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" /> حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
