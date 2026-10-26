import React, { useEffect, useMemo, useState } from 'react';
import {
  Megaphone,
  RefreshCw,
  Eye,
  MousePointerClick,
  TrendingUp,
  FileBarChart,
  Loader2,
  AlertCircle,
  Power,
  Plus,
  Info,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { MarketBannerReportModal } from '../Admin/MarketBannerReportModal.tsx';
import { MerchantCreateAdModal, merchantAdOwnerToken } from './MerchantCreateAdModal.tsx';

interface MyBanner {
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
  impressions?: number;
  lastClickedAt?: string;
  lastImpressionAt?: string;
  statsSince?: string;
}

const ctrOf = (b: { clicks?: number; impressions?: number }): string => {
  const views = b.impressions || 0;
  if (!views) return '—';
  return `${(((b.clicks || 0) / views) * 100).toFixed(1)}%`;
};

/** Merchant view: my market banners and how they actually performed. */
export const MerchantAdsView: React.FC = () => {
  const [banners, setBanners] = useState<MyBanner[]>([]);
  const [myAds, setMyAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportFor, setReportFor] = useState<MyBanner | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [storeName, setStoreName] = useState('متجر سند');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [ban, ads, ten] = await Promise.all([
        api.getMyMarketBanners().catch(() => ({ banners: [] as MyBanner[] })),
        api.getMarketAds(merchantAdOwnerToken()).catch(() => ({ mine: [] as any[] })),
        api.getCurrentTenant().catch(() => null),
      ]);
      setBanners(ban.banners || []);
      setMyAds((ads as any).mine || []);
      const t = (ten as any)?.tenant;
      if (t?.name || t?.tradeName) setStoreName(t.tradeName || t.name);
    } catch (err) {
      setError((err as Error).message || 'تعذر تحميل إعلاناتك.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const impressions = banners.reduce((a, b) => a + (b.impressions || 0), 0);
    const clicks = banners.reduce((a, b) => a + (b.clicks || 0), 0);
    return {
      impressions,
      clicks,
      ctr: impressions ? `${((clicks / impressions) * 100).toFixed(1)}%` : '—',
      active: banners.filter((b) => b.active).length,
    };
  }, [banners]);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-emerald-600" />
              إعلاناتي في السوق
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              بانراتك المعروضة على صفحة سوق سند، وكم واحد شافها وضغط عليها.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreateOpen(true)}
              className="px-3 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> إضافة إعلان
            </button>
            <button
              onClick={load}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> تحديث
            </button>
          </div>
        </div>

        {/* totals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <Power className="w-3 h-3 text-emerald-600" /> بانرات نشطة
            </p>
            <p className="text-xl font-black text-slate-900 mt-1">{totals.active}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <Eye className="w-3 h-3 text-sky-600" /> مرات الظهور
            </p>
            <p className="text-xl font-black text-slate-900 mt-1">
              {totals.impressions.toLocaleString('en-US')}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <MousePointerClick className="w-3 h-3 text-emerald-600" /> النقرات
            </p>
            <p className="text-xl font-black text-slate-900 mt-1">
              {totals.clicks.toLocaleString('en-US')}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-amber-600" /> نسبة التفاعل
            </p>
            <p className="text-xl font-black text-emerald-700 mt-1">{totals.ctr}</p>
          </div>
        </div>
      </div>

      {/* إعلانات السوق اللي التاجر نشرها */}
      {!loading && myAds.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <h3 className="text-sm font-black text-slate-900">إعلانات متجرك في السوق</h3>
          {myAds.map((ad) => (
            <div key={ad.id} className="flex gap-3 items-center border border-slate-100 rounded-xl p-2">
              <div className="w-16 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                {ad.imageUrl ? <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">{ad.title}</p>
                <p className="text-[10px] text-slate-500">
                  {ad.category} • {ad.location}
                </p>
              </div>
              <span
                className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${
                  ad.status === 'approved'
                    ? 'bg-emerald-50 text-emerald-700'
                    : ad.status === 'rejected'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                {ad.status === 'approved' ? 'ظاهر' : ad.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* list */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-16 flex items-center justify-center gap-2 text-slate-500 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" /> جاري تحميل إعلاناتك…
        </div>
      ) : error ? (
        <div className="bg-white border border-red-200 rounded-2xl py-12 flex flex-col items-center gap-2 text-red-600 text-xs">
          <AlertCircle className="w-5 h-5" />
          {error}
          <button onClick={load} className="mt-1 px-3 py-1 rounded-lg bg-red-50 text-red-700 font-bold">
            إعادة المحاولة
          </button>
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Megaphone className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-slate-900">
            {myAds.length ? 'ما عندك بانرات في أعلى الصفحة' : 'ما عندك إعلانات بعد'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            أضف إعلان لمتجرك يظهر في سوق سند بعد موافقة الإدارة. البانر العلوي بتربطه الإدارة لو حابب مكان أكبر.
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black"
          >
            <Plus className="w-4 h-4" /> إضافة إعلان
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row gap-3"
            >
              <div className="w-full sm:w-40 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                <img src={banner.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{banner.title}</h3>
                    {banner.subtitle && (
                      <p className="text-[11px] text-slate-500 truncate">{banner.subtitle}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {banner.badge ? `${banner.badge} • ` : ''}
                      ترتيب الظهور {banner.sortOrder}
                      {banner.linkUrl ? ' • مرتبط برابط' : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      banner.active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {banner.active ? 'ظاهر للسوق' : 'موقوف مؤقتاً'}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap text-[11px]">
                  <span className="px-2 py-1 rounded-lg bg-sky-50 text-sky-700 font-bold flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {(banner.impressions || 0).toLocaleString('en-US')} ظهور
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold flex items-center gap-1">
                    <MousePointerClick className="w-3 h-3" />{' '}
                    {(banner.clicks || 0).toLocaleString('en-US')} نقرة
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> {ctrOf(banner)}
                  </span>
                  <button
                    onClick={() => setReportFor(banner)}
                    className="ms-auto px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold flex items-center gap-1.5 hover:bg-slate-800"
                  >
                    <FileBarChart className="w-3.5 h-3.5" /> تقريري
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 leading-relaxed">
              الظهور يُحسب عندما يبقى البانر نصف ظاهر على الشاشة لمدة ثانية على الأقل، والنقرة عند ضغط
              الزائر. لو محتاج تغيير الصورة أو العنوان أو إيقاف البانر — كلّم إدارة سند.
            </p>
          </div>
        </div>
      )}

      {reportFor && (
        <MarketBannerReportModal
          banner={reportFor}
          onClose={() => setReportFor(null)}
          fetcher={api.getMyMarketBannerReport}
        />
      )}

      <MerchantCreateAdModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
        publisherName={storeName}
      />
    </div>
  );
};

export default MerchantAdsView;
