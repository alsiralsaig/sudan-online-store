import React, { useEffect, useState } from 'react';
import { ArrowRight, Loader2, MessageCircle, Package, MapPin, Phone, Store, Sparkles } from 'lucide-react';
import { api } from '../../lib/api.ts';
import { telHref, waHref } from '../../lib/contact.ts';

interface StoreProduct {
  id: string;
  name: string;
  category?: string;
  unit?: string;
  sellingPriceSdg: number;
  imageUrl?: string;
}

interface Props {
  slug: string;
  fallbackName?: string;
  onBack: () => void;
}

export const ClientMerchantStoreView: React.FC<Props> = ({ slug, fallbackName, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getStorefront(slug)
      .then((res) => {
        if (cancelled) return;
        setStore(res.store);
        setProducts(res.products || []);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message || 'المتجر غير متاح حالياً.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const name = store?.tradeName || store?.name || fallbackName || 'المتجر';
  const phone = store?.phone || '';

  return (
    <div className="min-h-screen bg-slate-50 pb-24" dir="rtl">
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100">
        <div className="max-w-md md:max-w-4xl mx-auto px-3 py-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl bg-slate-100 p-2 text-slate-700"
            aria-label="رجوع"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-emerald-700 font-bold">متجر سند</p>
            <h1 className="text-sm font-black text-slate-900 truncate">{name}</h1>
          </div>
          {phone ? (
            <a
              href={waHref(phone, `السلام عليكم، وصلت لمتجركم «${name}» عبر سند.`)}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-xl bg-emerald-600 text-white px-2.5 py-2 text-[11px] font-black flex items-center gap-1"
            >
              <MessageCircle className="w-3.5 h-3.5" /> واتساب
            </a>
          ) : null}
        </div>
      </div>

      <div className="max-w-md md:max-w-4xl mx-auto px-3 py-3 space-y-3">
        {store && (
          <div className="rounded-2xl bg-white border border-slate-200 p-3 flex items-start gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900">{name}</p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />
                {[store.city, store.address].filter(Boolean).join(' — ') || 'السودان'}
              </p>
              {phone ? (
                <a href={telHref(phone)} className="text-[11px] text-emerald-800 font-bold flex items-center gap-1 mt-1">
                  <Phone className="w-3 h-3" /> {phone}
                </a>
              ) : null}
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-slate-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> جاري تحميل بضاعة المتجر…
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-gradient-to-b from-sky-50 to-white border border-sky-200 p-5 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-sky-100 mx-auto flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-sky-700" />
            </div>
            <p className="text-[14px] font-black text-sky-900">
              {/VIP|جملة|التوريد/.test(error) ? 'هذا المتجر للمتاجر فقط' : 'المعروضات متاحة لعملاء VIP'}
            </p>
            <p className="text-[11.5px] text-slate-700 leading-6">
              عروض هذا المتجر تُفتح لحسابات <b>VIP</b>. رقِّ حسابك إلى VIP لتتمكن من مشاهدة المعروضات وإرسال الطلبات مباشرة.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="mt-1 rounded-xl bg-sky-700 text-white px-4 py-2 text-[12px] font-black"
            >
              رجوع للرئيسية
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center space-y-2">
            <Package className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-black text-slate-800">ما في بضاعة معروضة بعد</p>
            <p className="text-[11px] text-slate-500">تواصل مع المحل مباشرة عبر واتساب.</p>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-bold text-slate-600">{products.length} صنفاً في المتجر</p>
            <div className="grid grid-cols-2 gap-2.5">
              {products.map((p) => (
                <div key={p.id} className="rounded-2xl bg-white border border-slate-200 overflow-hidden flex flex-col">
                  <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover"  referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 flex-1 flex flex-col gap-1">
                    <h3 className="text-[12px] font-bold text-slate-900 line-clamp-2 leading-snug">{p.name}</h3>
                    {p.category ? <p className="text-[10px] text-slate-400">{p.category}</p> : null}
                    <p className="text-[13px] font-black text-emerald-800">
                      {(p.sellingPriceSdg || 0).toLocaleString('en-US')} ج.س
                    </p>
                    {phone ? (
                      <a
                        href={waHref(
                          phone,
                          `السلام عليكم، أريد «${p.name}» من متجر «${name}» عبر سند.`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-auto rounded-lg bg-emerald-600 py-1.5 text-center text-[10.5px] font-bold text-white"
                      >
                        اطلب واتساب
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClientMerchantStoreView;
