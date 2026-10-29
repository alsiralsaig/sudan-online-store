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
import { telHref, waHref } from '../../lib/contact.ts';
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

interface MarketStore {
  id: string;
  name: string;
  tradeName?: string;
  slug: string;
  city?: string;
  phone?: string;
  address?: string;
  logo?: string;
  status?: string;
}

interface Props {
  mode: BrowseMode;
  initialCategory?: string;
  onBack: () => void;
  onCreateAd: () => void;
  onOpenShowroomListings?: (showroomName: string) => void;
  onOpenStore?: (slug: string, name?: string) => void;
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

/** بذور البندر (alb_*) ما عندها سيد — للفت النظر فقط */
const isDemoListing = (l: AlbandarListing): boolean =>
  l.isDemo === true || String(l.id || '').startsWith('alb_');

const isDemoShowroom = (s: AlbandarShowroom): boolean => String(s.id || '').startsWith('shw_');

export const ClientMarketBrowseView: React.FC<Props> = ({
  mode,
  initialCategory,
  onBack,
  onCreateAd,
  onOpenStore,
}) => {
  const [listings, setListings] = useState<AlbandarListing[]>([]);
  const [showrooms, setShowrooms] = useState<AlbandarShowroom[]>([]);
  const [stores, setStores] = useState<MarketStore[]>([]);
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
        const wantStores = mode === 'showrooms' || mode === 'merchant-ads';
        const [l, s, t] = await Promise.all([
          api.getAlbandarListings({}),
          mode === 'showrooms' ? api.getAlbandarShowrooms() : Promise.resolve({ showrooms: [] as AlbandarShowroom[] }),
          wantStores ? api.getPublicStores() : Promise.resolve({ tenants: [] as MarketStore[] }),
        ]);
        if (cancelled) return;
        setListings(l.listings || []);
        setShowrooms(s.showrooms || []);
        setStores((t.tenants || []).filter((row) => row.slug && row.status !== 'suspended'));
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

  const visibleStores = useMemo(() => {
    const q = query.trim();
    if (!q) return stores;
    return stores.filter(
      (st) =>
        (st.tradeName || '').includes(q) ||
        (st.name || '').includes(q) ||
        (st.city || '').includes(q)
    );
  }, [stores, query]);

  const subtitle =
    mode === 'showrooms'
      ? `${stores.length} متجراً مسجّلاً في سند`
      : mode === 'merchant-ads'
      ? `${stores.length} متجراً على المنصة`
      : `${visible.length} إعلاناً في هذا القسم`;

  const waLink = (phone: string, text: string): string => waHref(phone, text);

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
        {mode !== 'directory' && (
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

        {/* متاجر المنصة الحقيقية */}
        {!loading && !error && (mode === 'showrooms' || mode === 'merchant-ads') && (
          <div className="space-y-2.5">
            {visibleStores.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-[11px] text-slate-500">
                ما في متاجر مسجّلة ظاهرة بعد.
              </p>
            ) : (
              visibleStores.map((st) => {
                const label = st.tradeName || st.name;
                return (
                  <div key={st.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="h-24 bg-emerald-50 overflow-hidden flex items-center justify-center">
                      {st.logo ? (
                        <img src={st.logo} alt={label} className="w-full h-full object-cover"  referrerPolicy="no-referrer" />
                      ) : (
                        <Store className="w-10 h-10 text-emerald-700" />
                      )}
                    </div>
                    <div className="p-3 space-y-1.5">
                      <div className="flex items-center gap-1">
                        <h3 className="text-[12px] font-black text-slate-900 truncate">{label}</h3>
                        <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      </div>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {[st.city, st.address].filter(Boolean).join(' • ') || 'السودان'}
                      </p>
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => onOpenStore?.(st.slug, label)}
                          className="flex-1 rounded-lg bg-emerald-700 py-1.5 text-center text-[11px] font-black text-white"
                        >
                          افتح المتجر
                        </button>
                        {st.phone ? (
                          <a
                            href={waLink(st.phone, `السلام عليكم، وصلت لمتجركم «${label}» عبر سند.`)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-white"
                            aria-label="واتساب"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        ) : null}
                        {st.phone ? (
                          <a
                            href={telHref(st.phone)}
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-slate-700"
                            aria-label="اتصال"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {mode === 'showrooms' &&
              showrooms.filter(isDemoShowroom).map((s) => (
                <div key={s.id} className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 overflow-hidden">
                  <div className="h-20 bg-slate-100 overflow-hidden">
                    {s.bannerImage || s.logo ? (
                      <img src={s.bannerImage || s.logo} alt="" className="w-full h-full object-cover opacity-80"  referrerPolicy="no-referrer" />
                    ) : null}
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="flex items-center gap-1">
                      <h3 className="text-[12px] font-bold text-slate-700 truncate">{s.name}</h3>
                      <span className="shrink-0 rounded-full bg-amber-100 text-amber-900 text-[9px] font-black px-1.5 py-0.5">
                        تجريبي
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">مساحة معرض — بلا بائع حقيقي</p>
                    <button
                      type="button"
                      onClick={onCreateAd}
                      className="w-full rounded-lg bg-slate-900 py-1.5 text-[11px] font-black text-white"
                    >
                      أعلن هنا
                    </button>
                  </div>
                </div>
              ))}
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

        {/* إعلانات الأقسام — مو قائمة المتاجر */}
        {!loading && !error && mode !== 'showrooms' && mode !== 'directory' && mode !== 'merchant-ads' && (
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
                        <img src={l.imageUrl} alt={l.title} className="w-full h-full object-cover" loading="lazy"  referrerPolicy="no-referrer" />
                      ) : null}
                    </div>
                    <div className="p-2.5 flex-1 flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="text-[11.5px] font-bold text-slate-900 line-clamp-2 leading-snug">{l.title}</h3>
                        {isDemoListing(l) && (
                          <span className="shrink-0 rounded-full bg-amber-100 text-amber-900 text-[9px] font-black px-1.5 py-0.5">
                            تجريبي
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] font-black text-emerald-800">{money(l.priceSdg)}</p>
                      <p className="text-[9.5px] text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {l.city}
                        <span className="mx-1">•</span>
                        <span className="truncate">
                          {isDemoListing(l) ? 'مساحة إعلانية — بلا بائع' : l.sellerName}
                        </span>
                      </p>
                      {isDemoListing(l) ? (
                        <button
                          type="button"
                          onClick={onCreateAd}
                          className="mt-auto rounded-lg bg-slate-900 py-1.5 text-center text-[10.5px] font-black text-white"
                        >
                          أعلن هنا
                        </button>
                      ) : (
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
                      )}
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
