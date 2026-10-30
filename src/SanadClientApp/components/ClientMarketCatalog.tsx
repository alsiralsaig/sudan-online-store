import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Package, Megaphone, MapPin, Store, Play, RefreshCw, X,
} from 'lucide-react';
import { api } from '../../lib/api.ts';

/**
 * «تصفح المنتجات» — كل ما هو معروض في المنصة من شاشة واحدة.
 * ------------------------------------------------------------------
 * كان الزر يفتح كتالوج متجر واحد عبر /products المحمي، فيرجع 401 وتظهر
 * «لا توجد منتجات مطابقة». الآن يقرأ /market/catalog العام الذي يجمع:
 *   • منتجات كل المتاجر النشطة
 *   • إعلانات السوق الفردية المعتمدة
 * مع بحث وتصفية فئة، وبطاقة تُظهر اسم المحل والمدينة والسعر.
 */
interface CatalogItem {
  kind: 'product' | 'ad';
  id: string;
  title: string;
  category: string;
  priceSdg: number;
  unit?: string;
  imageUrl?: string;
  videoUrl?: string;
  storeId?: string;
  storeName?: string;
  storeSlug?: string;
  city?: string;
  phone?: string;
  whatsapp?: string;
  isVip?: boolean;
  isPreOrder?: boolean;
  inStock?: boolean;
}

interface Props {
  onOpenStore?: (slugOrId: string) => void;
  onOpenAd?: (id: string) => void;
  initialSearch?: string;
}

const CATEGORIES = [
  { id: '', label: 'الكل' },
  { id: 'fashion', label: 'ملابس' },
  { id: 'electronics', label: 'هواتف' },
  { id: 'groceries', label: 'مواد غذائية' },
  { id: 'real_estate', label: 'عقارات' },
  { id: 'cars', label: 'سيارات' },
  { id: 'furniture_home', label: 'أجهزة منزلية' },
  { id: 'services', label: 'خدمات' },
];

export const ClientMarketCatalog: React.FC<Props> = ({ onOpenStore, onOpenAd, initialSearch = '' }) => {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [counts, setCounts] = useState({ products: 0, ads: 0, stores: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(initialSearch);
  const [category, setCategory] = useState('');
  const [filter, setFilter] = useState<'all' | 'product' | 'ad'>('all');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getMarketCatalog({ limit: 300 });
      setItems((res.items || []) as CatalogItem[]);
      setCounts(res.counts || { products: 0, ads: 0, stores: 0 });
    } catch (e) {
      setError((e as Error).message || 'تعذّر تحميل المنتجات — تحقّق من الاتصال.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== 'all' && it.kind !== filter) return false;
      if (category && it.category !== category) return false;
      if (q && !`${it.title} ${it.storeName || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, category, filter]);

  return (
    <div className="max-w-4xl mx-auto px-3 py-3 space-y-3" dir="rtl">
      {/* العنوان والعدّاد */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-black text-slate-900">تصفّح منتجات السوق</h2>
          <p className="text-[11px] text-slate-600">
            {counts.products} منتج من {counts.stores} متجر · {counts.ads} إعلان فردي
          </p>
        </div>
        <button
          onClick={load}
          className="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-[11px] font-bold flex items-center gap-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> تحديث
        </button>
      </div>

      {/* البحث */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث في كل المتاجر والإعلانات…"
          className="w-full pr-9 pl-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-500"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 p-1"
            aria-label="مسح البحث"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* تصفية */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {([['all', 'الكل'], ['product', 'منتجات المتاجر'], ['ad', 'إعلانات فردية']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border ${
              filter === id
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id || 'all-cat'}
            onClick={() => setCategory(c.id)}
            className={`shrink-0 px-3 py-1 rounded-lg text-[11px] font-bold border ${
              category === c.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[12px] font-bold text-rose-800">
          {error}
        </div>
      )}

      {/* الشبكة */}
      {loading && !items.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="aspect-square bg-slate-100 animate-pulse" />
              <div className="p-2 space-y-1.5">
                <div className="h-3 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-300 bg-white">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-black text-slate-800">
            {items.length === 0 ? 'لا يوجد شيء معروض في السوق الآن' : 'لا نتائج مطابقة للبحث'}
          </h3>
          <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">
            {items.length === 0
              ? 'بمجرد أن يضيف أي متجر منتجات أو ينشر إعلاناً، ستظهر هنا تلقائياً.'
              : 'جرّب كلمة أخرى أو غيّر التصنيف.'}
          </p>
          {items.length > 0 && (
            <button
              onClick={() => {
                setQuery('');
                setCategory('');
                setFilter('all');
              }}
              className="mt-3 px-4 py-2 rounded-xl bg-sky-600 text-white text-[12px] font-bold"
            >
              إعادة تعيين الفلاتر
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {visible.map((it) => (
            <button
              key={`${it.kind}-${it.id}`}
              onClick={() =>
                it.kind === 'ad'
                  ? onOpenAd?.(it.id)
                  : onOpenStore?.(it.storeSlug || it.storeId || '')
              }
              className="text-right rounded-2xl border border-slate-200 bg-white overflow-hidden active:scale-[0.99] transition-transform"
            >
              <div className="relative aspect-square bg-slate-100">
                {it.imageUrl ? (
                  <img
                    src={it.imageUrl}
                    alt={it.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Package className="w-8 h-8" />
                  </div>
                )}
                {it.videoUrl && (
                  <span className="absolute bottom-1 left-1 bg-slate-900/80 text-white rounded-full p-1">
                    <Play className="w-3 h-3" />
                  </span>
                )}
                <span
                  className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-black ${
                    it.kind === 'ad' ? 'bg-amber-400 text-slate-950' : 'bg-sky-600 text-white'
                  }`}
                >
                  {it.kind === 'ad' ? (
                    <span className="flex items-center gap-0.5"><Megaphone className="w-2.5 h-2.5" /> إعلان</span>
                  ) : (
                    'متجر'
                  )}
                </span>
              </div>
              <div className="p-2 space-y-1">
                <p className="text-[12px] font-black text-slate-900 leading-tight line-clamp-2">{it.title}</p>
                <p className="text-[13px] font-black text-sky-700 font-mono">
                  {Number(it.priceSdg || 0).toLocaleString('en-US')} ج.س
                </p>
                <p className="text-[10px] text-slate-600 flex items-center gap-0.5 truncate">
                  <Store className="w-2.5 h-2.5 shrink-0" />
                  {it.storeName}
                </p>
                {it.city && (
                  <p className="text-[10px] text-slate-600 flex items-center gap-0.5 truncate">
                    <MapPin className="w-2.5 h-2.5 shrink-0" /> {it.city}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
