import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowRightLeft, BadgeDollarSign, BarChart3, Boxes,
  Building2, ChefHat, Check, ChevronDown, ChevronLeft, ChevronRight, Coins,
  Home, Megaphone, Package, Receipt, ScanSearch, ShoppingBag, ShoppingCart,
  Truck, Users, Wallet, X,
} from 'lucide-react';
import type { Product } from '../../types/index.ts';

type MerchantTab =
  | 'welcome' | 'pos' | 'inventory' | 'sales' | 'reports' | 'shifts'
  | 'purchases_expenses' | 'links' | 'inventory_audit' | 'transfers'
  | 'branches_employees' | 'currencies' | 'store_orders' | 'my_ads'
  | 'kitchen' | 'subscription';

interface Props {
  tenantName?: string;
  branchName?: string;
  products: Product[];
  featuredProductIds: string[];
  canManageFeatured: boolean;
  onSaveFeatured: (ids: string[]) => Promise<void>;
  onNavigateTab: (tab: MerchantTab) => void;
}

const services: { id: MerchantTab; title: string; hint: string; Icon: React.ElementType }[] = [
  { id: 'pos', title: 'بيع للزبون', hint: 'بيع سريع وسهل', Icon: ShoppingCart },
  { id: 'inventory', title: 'بضاعتي ومنتجاتي', hint: 'شوف الأصناف والكميات', Icon: Boxes },
  { id: 'sales', title: 'المبيعات والفواتير', hint: 'راجع البيع والفواتير', Icon: Receipt },
  { id: 'purchases_expenses', title: 'المشتريات والمصروفات', hint: 'سجّل بضاعة أو مصروفًا', Icon: Truck },
  { id: 'shifts', title: 'الورديات والخزينة', hint: 'فتح وردية ومراجعة النقد', Icon: Wallet },
  { id: 'reports', title: 'التقارير والأرباح', hint: 'ملخص حركة متجرك', Icon: BarChart3 },
  { id: 'links', title: 'الموردون والربط', hint: 'تواصل مع الموردين', Icon: Users },
  { id: 'inventory_audit', title: 'جرد البضاعة', hint: 'طابق الكميات بالمحل', Icon: ScanSearch },
  { id: 'transfers', title: 'نقل بضاعة بين الفروع', hint: 'للمتاجر متعددة الفروع', Icon: ArrowRightLeft },
  { id: 'branches_employees', title: 'الفروع والعاملون', hint: 'إدارة فريقك وفروعك', Icon: Building2 },
  { id: 'currencies', title: 'العملات وأسعار الصرف', hint: 'إعداد العملات', Icon: Coins },
  { id: 'store_orders', title: 'طلبات المتجر الإلكتروني', hint: 'تابع طلبات الزبائن', Icon: ShoppingBag },
  { id: 'my_ads', title: 'إعلانات متجري', hint: 'إدارة إعلاناتك', Icon: Megaphone },
  { id: 'kitchen', title: 'شاشة المطبخ', hint: 'للمطاعم والمقاهي', Icon: ChefHat },
  { id: 'subscription', title: 'الاشتراك والباقات', hint: 'تفاصيل اشتراكك', Icon: BadgeDollarSign },
  { id: 'welcome', title: 'الرئيسية', hint: 'الرجوع للصفحة الرئيسية', Icon: Home },
];
const quickIds: MerchantTab[] = ['pos', 'inventory', 'sales', 'purchases_expenses', 'shifts', 'reports'];
const MAX_FEATURED = 6;

export const MerchantHomeDashboard: React.FC<Props> = ({
  tenantName, branchName, products, featuredProductIds, canManageFeatured,
  onSaveFeatured, onNavigateTab,
}) => {
  const [showAll, setShowAll] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>(featuredProductIds);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [slide, setSlide] = useState(0);
  const [failedImages, setFailedImages] = useState<string[]>([]);

  useEffect(() => setDraftIds(featuredProductIds), [featuredProductIds]);
  const featured = useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    return featuredProductIds.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  }, [products, featuredProductIds]);

  useEffect(() => {
    if (featured.length < 2) { setSlide(0); return; }
    const timer = window.setInterval(() => setSlide((n) => (n + 1) % featured.length), 4500);
    return () => window.clearInterval(timer);
  }, [featured.length]);

  const shownServices = showAll ? services : services.filter((service) => quickIds.includes(service.id));
  const toggleProduct = (id: string) => {
    setDraftIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length >= MAX_FEATURED ? current : [...current, id]);
  };
  const saveSelection = async () => {
    setSaving(true); setSaveError('');
    try { await onSaveFeatured(draftIds); setPickerOpen(false); }
    catch { setSaveError('ما قدرنا نحفظ الاختيار. جرّب مرة تانية.'); }
    finally { setSaving(false); }
  };

  return (
    <main dir="rtl" className="min-h-full bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-6xl">
        <section className="mb-5" aria-label="منتجات يختارها صاحب المتجر">
            <div className="mb-2 flex items-center justify-between gap-2 px-1"><div><h2 className="text-lg font-extrabold text-slate-900">منتجات اخترتها ✨</h2><p className="text-xs text-slate-500">عرض جمالي فقط · ما يوضح حالة المخزون</p></div>{canManageFeatured && <button type="button" onClick={() => { setDraftIds(featuredProductIds); setPickerOpen(true); }} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm">اختيار المنتجات</button>}</div>
            {featured.length ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="grid min-h-[150px] grid-cols-[42%_1fr] transition-all duration-500 sm:min-h-[190px]" key={featured[slide % featured.length].id}>
                  <div className="relative min-h-[150px] overflow-hidden bg-gradient-to-br from-emerald-50 to-sky-100 sm:min-h-[190px]">
                    {featured[slide % featured.length].imageUrl && !failedImages.includes(featured[slide % featured.length].id) ? <img src={featured[slide % featured.length].imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailedImages((old) => [...old, featured[slide % featured.length].id])}/> : <div className="grid h-full place-items-center text-4xl text-emerald-700"><Package size={44}/></div>}
                  </div>
                  <div className="flex flex-col justify-center p-4 sm:p-6"><span className="text-[11px] font-bold text-emerald-700">اختيار صاحب المتجر</span><h3 className="mt-1 line-clamp-2 text-base font-extrabold text-slate-900 sm:text-xl">{featured[slide % featured.length].name}</h3><p className="mt-1 text-xs text-slate-500">{featured[slide % featured.length].category || 'من منتجات المتجر'}</p><div className="mt-4 flex items-center gap-2"><button type="button" aria-label="المنتج السابق" onClick={() => setSlide((n) => (n - 1 + featured.length) % featured.length)} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-700"><ChevronRight size={18}/></button><span className="text-xs text-slate-500">{slide + 1} / {featured.length}</span><button type="button" aria-label="المنتج التالي" onClick={() => setSlide((n) => (n + 1) % featured.length)} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-700"><ChevronLeft size={18}/></button></div></div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[120px] items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4"><div><b className="text-sm text-slate-800">ما اخترت منتجات للعرض بعد</b><p className="mt-1 text-xs text-slate-500">اختر صور منتجاتك المفضلة لتظهر هنا بشكل متحرك.</p></div>{canManageFeatured && <button type="button" onClick={() => setPickerOpen(true)} className="shrink-0 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white">اختيار</button>}</div>
            )}
          </section>
        <div className="mb-2 flex items-center justify-between px-1">
          <div><h2 className="text-lg font-extrabold text-slate-900">{showAll ? 'كل خدمات متجرك' : 'خدمات متجرك'}</h2><p className="mt-0.5 text-xs text-slate-500">{showAll ? 'اختار الخدمة المطلوبة' : 'أهم خدماتك في مكان واحد'}</p></div>
          <button type="button" onClick={() => setShowAll((value) => !value)} className="inline-flex h-9 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-100" aria-expanded={showAll}>
            {showAll ? <><ArrowRight size={15}/> الرئيسية</> : <>عرض الكل <ArrowLeft size={15}/></>}
          </button>
        </div>

        <section aria-label={showAll ? 'كل خدمات التاجر' : 'الخدمات الأكثر استخدامًا'} className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3">
          {shownServices.map(({ id, title, hint, Icon }, index) => (
            <button key={id} type="button" onClick={() => onNavigateTab(id)} className="flex min-h-[102px] items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 text-right shadow-sm transition hover:border-sky-200 hover:shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky-200 sm:min-h-[112px] sm:gap-3 sm:p-4">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${index < 6 ? 'bg-sky-100 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}><Icon size={21} strokeWidth={2.2}/></span>
              <span className="min-w-0 flex-1"><b className="block text-sm leading-snug text-slate-900 sm:text-base">{title}</b><small className="mt-1 block text-[11px] leading-snug text-slate-500 sm:text-xs">{hint}</small></span>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-50 text-sky-700"><ChevronLeft size={17}/></span>
            </button>
          ))}
        </section>

        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-950">محتاج مساعدة؟ تواصل مع الدعم من زر المساعدة أعلى الصفحة.</p>
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="featured-title" dir="rtl">
          <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-5">
            <div className="mb-3 flex items-center justify-between"><div><h2 id="featured-title" className="text-lg font-extrabold">اختار منتجات للعرض</h2><p className="text-xs text-slate-500">حد أقصى {MAX_FEATURED} منتجات · اختيارك يُحفظ لكل المتجر</p></div><button type="button" onClick={() => setPickerOpen(false)} aria-label="إغلاق" className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><X size={18}/></button></div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {products.filter((p) => p.isActive !== false).map((product) => { const checked = draftIds.includes(product.id); const disabled = !checked && draftIds.length >= MAX_FEATURED; return <button key={product.id} type="button" disabled={disabled} onClick={() => toggleProduct(product.id)} className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-right ${checked ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'} ${disabled ? 'opacity-45' : ''}`}><span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover"/> : <span className="grid h-full place-items-center text-slate-400"><Package size={21}/></span>}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{product.name}</b><small className="text-xs text-slate-500">{product.category || 'بدون تصنيف'}</small></span><span className={`grid h-6 w-6 place-items-center rounded-full border ${checked ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 text-transparent'}`}><Check size={15}/></span></button>; })}
              {!products.length && <p className="p-6 text-center text-sm text-slate-500">ما في منتجات مسجلة في المتجر بعد.</p>}
            </div>
            {saveError && <p className="mt-2 text-sm text-rose-700">{saveError}</p>}
            <div className="mt-4 flex gap-2"><button type="button" disabled={saving} onClick={saveSelection} className="flex-1 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? 'جارٍ الحفظ…' : 'حفظ الاختيار'}</button><button type="button" disabled={saving} onClick={() => setPickerOpen(false)} className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">إلغاء</button></div>
          </div>
        </div>
      )}
    </main>
  );
};
