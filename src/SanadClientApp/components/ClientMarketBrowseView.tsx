import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Car,
  Crown,
  Home,
  Loader2,
  MapPin,
  Package,
  Phone,
  Search,
  Shirt,
  Smartphone,
  Stethoscope,
  Store,
  Wheat,
  Wrench,
  MessageCircle,
  BadgeCheck,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import type { AlbandarListing, AlbandarShowroom } from '../../types/index.ts';

/**
 * شاشة استعراض سوق البندر — الأقسام والمعارض والإعلانات الحقيقية.
 *
 * ليه وُجدت: كل أزرار الأقسام في الصفحة الرئيسية (سيارات، عقارات، هواتف…)
 * كانت تنقل إلى «كتالوج منتجات المتجر» — وهو منتجات تاجر واحد (زيت وسكر)،
 * فتفتح أي قسم فتجد نفس البضائع. الشاشة هذه تعرض إعلانات السوق الحقيقية
 * مفلترة بالقسم المختار، وتشرح بصدق لو القسم فاضي.
 */

export type BrowseMode = 'listings' | 'showrooms' | 'merchant-ads' | 'directory';

interface Props {
  mode: BrowseMode;
  initialCategory?: string;
  onBack: () => void;
  onCreateAd: () => void;
  onOpenShowroomListings?: (showroomName: string) => void;
}

/** الأقسام المعروضة كبلاطات — المفاتيح تطابق تصنيفات قاعدة البيانات */
const CATEGORIES: { id: string; name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'cars', name: 'سيارات', icon: Car },
  { id: 'real_estate', name: 'عقارات', icon: Home },
  { id: 'electronics', name: 'هواتف وإلكترونيات', icon: Smartphone },
  { id: 'fashion', name: 'ملابس', icon: Shirt },
  { id: 'groceries', name: 'مواد غذائية', icon: Wheat },
  { id: 'services', name: 'خدمات', icon: Wrench },
  { id: 'furniture_home', name: 'أجهزة منزلية', icon: Package },
  { id: 'livestock_crops', name: 'ثروة حيوانية وزراعية', icon: Wheat },
];

const CATEGORY_NAME = (id: string): string =>
  CATEGORIES.find((c) => c.id === id)?.name || 'قسم آخر';

const money = (n: number): string => `${(n || 0).toLocaleString('en-US')} ج.س`;

export const ClientMarketBrowseView: React.FC<Props> = ({
  mode,
  initialCategory,
  onBack,
  onCreateAd,
}) => {
  const [listings, setListings] = useState<AlbandarListing[]>([]);
  const [showrooms, setShowrooms] = useState<AlbandarShowroom[]>([]);
  const [category, setCategory] = useState<string>(initialCategory || 'all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setCategory(initialCategory || 'all');
  }, [initialCategory, mode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const [l, s] = await Promise.all([
          api.getAlbandarListings({}),
          mode === 'showrooms' ? api.getAlbandarShowrooms() : Promise.resolve({ showrooms: [] }),
        ]);
        if (cancelled) return;
        setListings(l.listings || []);
        setShowrooms(s.showrooms || []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'تعذّر تحميل السوق.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const visible = useMemo(() => {
    let rows = listings;
    if (mode === 'merchant-ads') {
      rows = rows.filter((r) => r.sellerType === 'merchant' || r.sellerType === 'showroom' || r.isVerifiedMerchant);
    }
    if (category !== 'all') rows = rows.filter((r) => r.category === category);
    const q = query.trim();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.title.includes(q) ||
          (r.description || '').includes(q) ||
          (r.city || '').includes(q) ||
          (r.sellerName || '').includes(q)
      );
    }
    return rows;
  }, [listings, mode, category, query]);

  const countsByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of listings) map[r.category] = (map[r.category] || 0) + 1;
    return map;
  }, [listings]);

  const title =
    mode === 'showrooms'
      ? 'المعارض والمحلات'
      : mode === 'merchant-ads'
      ? 'متاجر السوق'
      : mode === 'directory'
      ? 'الدليل التجاري'
      : category === 'all'
      ? 'كل إعلانات السوق'
      : CATEGORY_NAME(category);

  const subtitle =
    mode === 'showrooms'
      ? `${showrooms.length} معرضاً ومحلاً مسجّلاً في سند`
      : mode === 'merchant-ads'
      ? 'إعلانات المتاجر والمعارض الموثّقة'
      : `${visible.length} إعلاناً في هذا القسم`;

  const waLink = (phone: string, text: string): string =>
    `https://wa.me/${(phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

  return (
    <div className="pb-24 bg-slate-50 min-h-screen" dir="rtl">
      {/* رأس الشاشة */}
      <div className="bg-white sticky top-0 z-30 border-b border-slate-100">
        <div className="max-w-md md:max-w-4xl mx-auto px-2.5 py-2 flex items-center gap-2">
          <button
            onClick={onBack}
            className="rounded-xl bg-slate-100 p-2 text-slate-700 active:scale-95"
            aria-label="رجوع"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-black text-slate-900 truncate">{title}</h2>
            <p className="text-[10px] text-slate-500 truncate">{subtitle}</p>
          </div>
          {mode !== 'showrooms' && (
            <button
              onClick={onCreateAd}
              className="rounded-xl bg-emerald-700 px-3 py-2 text-[11px] font-black text-white active:scale-95"
            >
              + أضف إعلان
            </button>
          )}
        </div>

        {/* بحث داخل القسم */}
        {mode !== 'showrooms' && (
          <div className="max-w-md md:max-w-4xl mx-auto px-2.5 pb-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث داخل القسم…"
                className="w-full bg-transparent text-[12px] outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        )}
      </div>

      <div className="max-w-md md:max-w-4xl mx-auto px-2.5 pt-3 space-y-3">
        {/* اختيار القسم */}
        {mode !== 'showrooms' && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setCategory('all')}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold border ${
                category === 'all'
                  ? 'bg-emerald-800 text-white border-emerald-800'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              الكل
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold border ${
                  category === c.id
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-bold">جارٍ تحميل السوق…</span>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-[11px] font-bold text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* المعارض */}
        {!loading && !error && mode === 'showrooms' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {showrooms.map((s) => (
              <div key={s.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="h-24 bg-slate-100 overflow-hidden">
                  {s.bannerImage || s.logo ? (
                    <img src={s.bannerImage || s.logo} alt={s.name} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center gap-1">
                    <h3 className="text-[12px] font-black text-slate-900 truncate">{s.name}</h3>
                    {s.verified && <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {s.category} • {s.city}
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <a
                      href={waLink(s.whatsapp || s.phone, `السلام عليكم، وصلت لمعرضكم عبر منصة سند: ${s.name}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-center text-[11px] font-bold text-white"
                    >
                      واتساب
                    </a>
                    <a
                      href={`tel:${s.phone}`}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-slate-700"
                      aria-label="اتصال"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
            {showrooms.length === 0 && (
              <p className="col-span-full rounded-2xl border border-slate-200 bg-white p-4 text-center text-[11px] text-slate-500">
                ما في معارض مسجّلة بعد.
              </p>
            )}
          </div>
        )}

        {/* الدليل التجاري: بلاطات الأقسام مع العدد */}
        {!loading && !error && mode === 'directory' && (
          <div className="grid grid-cols-2 gap-2.5">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const n = countsByCategory[c.id] || 0;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-2 text-right active:scale-[0.98]"
                >
                  <span className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-emerald-800 shrink-0">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11.5px] font-bold text-slate-900 truncate">{c.name}</span>
                    <span className="block text-[10px] text-slate-500">{n} إعلان</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* إعلانات */}
        {!loading && !error && mode !== 'showrooms' && mode !== 'directory' && (
          <>
            {visible.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center space-y-2">
                <Store className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="text-[12px] font-bold text-slate-700">
                  {category === 'all' ? 'ما في إعلانات هنا بعد' : `ما في إعلانات في «${CATEGORY_NAME(category)}» بعد`}
                </p>
                <p className="text-[10.5px] text-slate-500">
                  كن أول من ينشر — الإعلان يظهر للسوق بعد موافقة الإدارة.
                </p>
                <button
                  onClick={onCreateAd}
                  className="mt-1 rounded-xl bg-emerald-700 px-4 py-2 text-[11px] font-black text-white"
                >
                  أضف إعلانك الآن
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {visible.map((l) => (
                  <div key={l.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col">
                    <div className="h-28 bg-slate-100 overflow-hidden">
                      {l.imageUrl ? (
                        <img src={l.imageUrl} alt={l.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : null}
                    </div>
                    <div className="p-2.5 flex-1 flex flex-col gap-1">
                      <h3 className="text-[11.5px] font-bold text-slate-900 line-clamp-2 leading-snug">{l.title}</h3>
                      <p className="text-[12px] font-black text-emerald-800">{money(l.priceSdg)}</p>
                      <p className="text-[9.5px] text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {l.city}
                        <span className="mx-1">•</span>
                        <span className="truncate">{l.sellerName}</span>
                      </p>
                      <a
                        href={waLink(
                          l.sellerWhatsapp || l.sellerPhone,
                          `السلام عليكم، استفسار بخصوص إعلانك في سند: «${l.title}» بسعر ${money(l.priceSdg)} في ${l.city}.`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-auto rounded-lg bg-emerald-600 py-1.5 text-center text-[10.5px] font-bold text-white flex items-center justify-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3" /> واتساب
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* اختصارات سفلية */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => setCategory('all')}
            className="rounded-xl border border-slate-200 bg-white py-2 text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1"
          >
            <Crown className="w-3.5 h-3.5 text-amber-500" /> كل الإعلانات
          </button>
          <button
            onClick={() => setCategory('cars')}
            className="rounded-xl border border-slate-200 bg-white py-2 text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1"
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-700" /> سيارات ومعارض
          </button>
        </div>
      </div>
    </div>
  );
};
