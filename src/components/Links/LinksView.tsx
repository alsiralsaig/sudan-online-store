import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Link2, Search, Store, Percent, RefreshCw, Trash2, Pencil, CheckCircle2,
  AlertTriangle, Loader2, PackageSearch, ShieldCheck, ArrowRight, X, Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api.ts';

/**
 * «الربط والموردون»
 * ---------------------------------------------------------------------------
 * الطبقات: مورد ← جملة ← قطاعي.
 *   • المورد: يرى هنا من يمكنه الربط به (لا أحد) + تنبيه أن بضاعته تظهر للجملة.
 *   • الجملة: يشتري من المورد (يربط أصنافه) وتباع أصنافه للقطاعي.
 *   • القطاعي: يربط أصنافه بأصناف الجملة، ولو كان VIP يرى المورد أيضاً.
 * السعر يُحسب: سعر المصدر + الهامش %، ويتحدث تلقائياً عند أي تغيير من المصدر.
 */
export const LinksView: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sources, setSources] = useState<any[]>([]);
  const [viewer, setViewer] = useState<{ accountSegment: string; isVip: boolean }>({ accountSegment: 'retailer', isVip: false });
  const [links, setLinks] = useState<any[]>([]);

  /* البحث والربط */
  const [openSource, setOpenSource] = useState<any | null>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<any | null>(null);
  const [margin, setMargin] = useState('15');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [editPriceFor, setEditPriceFor] = useState<any | null>(null);
  const [priceInput, setPriceInput] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [src, lnk] = await Promise.all([api.getLinkSources(), api.getItemLinks()]);
      setSources(src.sources || []);
      setViewer(src.viewer);
      setLinks(lnk.links || []);
    } catch (e: any) {
      setError(e.message || 'تعذّر تحميل بيانات الربط.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    /* المزامنة «على مدار الساعة»: إعادة الجلب كل ساعة أثناء فتح الشاشة */
    const timer = setInterval(() => { api.getItemLinks().then((r) => setLinks(r.links || [])).catch(() => {}); }, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [loadAll]);

  const openCatalog = async (src: any) => {
    setOpenSource(src);
    setPicked(null);
    setQuery('');
    setCatalogLoading(true);
    try {
      const res = await api.getLinkCatalog(src.id);
      setCatalog(res.products || []);
    } catch (e: any) {
      setNote(e.message || 'تعذّر فتح كتالوج المتجر.');
      setCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  const searchCatalog = async () => {
    if (!openSource) return;
    setCatalogLoading(true);
    try {
      const res = await api.getLinkCatalog(openSource.id, query.trim());
      setCatalog(res.products || []);
    } catch (e: any) {
      setNote(e.message || 'تعذّر البحث.');
    } finally {
      setCatalogLoading(false);
    }
  };

  const doLink = async () => {
    if (!picked) return;
    const pct = Number(margin);
    if (!Number.isFinite(pct) || pct < 0) { setNote('اكتب نسبة ربح صحيحة (0 أو أكثر).'); return; }
    setBusy(true);
    setNote('');
    try {
      const res: any = await api.linkItem({ sourceItemId: picked.id, marginPercent: pct });
      setNote(res.message || 'تم الربط.');
      setPicked(null);
      await loadAll();
      onRefresh?.();
    } catch (e: any) {
      setNote(e.message || 'تعذّر الربط.');
    } finally {
      setBusy(false);
    }
  };

  const saveMargin = async (link: any, value: string) => {
    const pct = Number(value);
    if (!Number.isFinite(pct) || pct < 0) { setNote('نسبة غير صحيحة.'); return; }
    try {
      const res: any = await api.updateLinkMargin(link.id, pct);
      setNote(res.message || 'تم تحديث الهامش.');
      await loadAll();
      onRefresh?.();
    } catch (e: any) {
      setNote(e.message || 'تعذّر تحديث الهامش.');
    }
  };

  const savePrice = async () => {
    if (!editPriceFor) return;
    try {
      const res: any = await api.setLinkPrice(editPriceFor.id, Number(priceInput));
      setNote(res.message || 'تم حفظ سعرك.');
      setEditPriceFor(null);
      await loadAll();
      onRefresh?.();
    } catch (e: any) {
      setNote(e.message || 'تعذّر حفظ السعر.');
    }
  };

  const resetPrice = async (link: any) => {
    try {
      const res: any = await api.resetLinkPrice(link.id);
      setNote(res.message || 'رجع السعر تلقائياً.');
      await loadAll();
      onRefresh?.();
    } catch (e: any) {
      setNote(e.message || 'تعذّر إرجاع السعر.');
    }
  };

  const unlink = async (link: any) => {
    if (!confirm(`فك ربط «${link.myItemName}»؟\nالصنف يبقى في متجرك بسعره الحالي ولن يتحدث بعدها.`)) return;
    try {
      const res = await api.unlinkItem(link.id);
      setNote(res.message || 'تم فك الربط.');
      await loadAll();
    } catch (e: any) {
      setNote(e.message || 'تعذّر فك الربط.');
    }
  };

  const segmentLabel = (s?: string) =>
    s === 'supplier' ? 'مورد' : s === 'wholesaler' ? 'جملة' : 'قطاعي';

  const totals = useMemo(() => {
    const manual = links.filter((l) => l.priceMode === 'manual').length;
    return { count: links.length, manual };
  }, [links]);

  return (
    <div className="space-y-4" dir="rtl">
      {/* الرأس */}
      <div className="rounded-2xl bg-gradient-to-l from-sky-700 via-sky-800 to-slate-900 text-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-black flex items-center gap-2">
              <Link2 className="w-4 h-4" /> الربط والموردون
            </h2>
            <p className="text-[11px] text-sky-100/90 mt-1 leading-6">
              نوع حسابك: <b>{segmentLabel(viewer.accountSegment)}</b>
              {viewer.isVip ? ' • باقة VIP مفعّلة (يمكنك التعامل مع المورد مباشرة)' : ''}
              <br />
              تربط الصنف مرة واحدة، فيأخذ الاسم والوصف وتاريخ الصلاحية والسعر من المصدر، وتضيف هامش ربح نسبة %. أي تغيير عند المصدر يصل إليك تلقائياً.
            </p>
          </div>
          <button onClick={loadAll} className="shrink-0 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-[11px] font-bold flex items-center gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> تحديث
          </button>
        </div>
      </div>

      {note && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11.5px] font-bold px-3 py-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> {note}</span>
          <button onClick={() => setNote('')} className="text-emerald-700"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11.5px] font-bold px-3 py-2 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {/* المتاجر المتاحة للربط */}
      <div className="rounded-2xl bg-white border border-slate-200 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[12.5px] font-black text-slate-800 flex items-center gap-1.5">
            <Store className="w-4 h-4 text-sky-700" /> متاجر يمكنك الربط بها
          </h3>
          <span className="text-[10.5px] font-bold text-slate-500">{sources.length} متجر</span>
        </div>

        {viewer.accountSegment === 'supplier' ? (
          <p className="text-[11px] text-slate-600 leading-6 bg-sky-50 border border-sky-200 rounded-xl p-3">
            <ShieldCheck className="w-3.5 h-3.5 inline ml-1 text-sky-700" />
            أنت <b>مورد</b>: بضاعتك تظهر لتجار الجملة فقط، ولا تربط أنت بأحد. أي تاجر جملة يربط صنفه بصنفك سيتحدث سعره تلقائياً عندما تعدّل سعرك.
          </p>
        ) : sources.length === 0 ? (
          <p className="text-[11px] text-slate-500 leading-6">
            لا توجد متاجر في طبقتك الأعلى بعد.
            {viewer.accountSegment === 'retailer' && !viewer.isVip
              ? ' التعامل مع المورد يحتاج باقة VIP — رقِّ اشتراكك من تبويب «الاشتراك والباقات».'
              : ''}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {sources.map((s: any) => (
              <button
                key={s.id}
                onClick={() => openCatalog(s)}
                className="text-right rounded-xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 p-2.5 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-black text-slate-800 truncate">{s.name}</span>
                  <span className={`shrink-0 rounded-lg px-1.5 py-0.5 text-[10px] font-black ${s.accountSegment === 'supplier' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                    {segmentLabel(s.accountSegment)}
                  </span>
                </div>
                <div className="text-[10.5px] text-slate-500 mt-1 flex items-center gap-2">
                  <span>{s.city || '—'}</span>
                  <span>•</span>
                  <span>{s.productCount} صنف</span>
                  <ArrowRight className="w-3 h-3 mr-auto text-sky-700" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* كتالوج المتجر المفتوح */}
      {openSource && (
        <div className="rounded-2xl bg-white border-2 border-sky-300 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[12.5px] font-black text-slate-800">
              أصناف «{openSource.name}» — {segmentLabel(openSource.accountSegment)}
            </h3>
            <button onClick={() => { setOpenSource(null); setPicked(null); }} className="text-slate-500"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchCatalog()}
                placeholder="ابحث باسم الصنف أو الباركود…"
                className="w-full rounded-xl border border-slate-300 pr-9 pl-3 py-2.5 text-[12px] focus:outline-none focus:border-sky-500"
              />
            </div>
            <button onClick={searchCatalog} className="rounded-xl bg-sky-700 text-white px-3 py-2 text-[11.5px] font-black">بحث</button>
          </div>

          {catalogLoading ? (
            <div className="py-6 text-center text-slate-500 text-[11.5px]"><Loader2 className="w-4 h-4 animate-spin inline" /> جارٍ التحميل…</div>
          ) : catalog.length === 0 ? (
            <p className="py-4 text-center text-[11.5px] text-slate-500 flex items-center justify-center gap-1.5">
              <PackageSearch className="w-4 h-4" /> لا أصناف ظاهرة في هذا المتجر.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {catalog.map((p: any) => (
                <div key={p.id} className={`rounded-xl border p-2 flex items-center gap-2 ${picked?.id === p.id ? 'border-sky-500 bg-sky-50' : 'border-slate-200'}`}>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center text-slate-400 text-[10px]">صنف</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-bold text-slate-800 truncate">{p.name}</div>
                    <div className="text-[10.5px] text-slate-500 font-mono">
                      {Number(p.sellingPriceSdg).toLocaleString('en-US')} ج.س
                      {p.expiryDate ? ` • صلاحية ${String(p.expiryDate).slice(0, 10)}` : ''}
                    </div>
                  </div>
                  {p.linked ? (
                    <span className="shrink-0 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-1">مربوط</span>
                  ) : (
                    <button
                      onClick={() => { setPicked(p); setNote(''); }}
                      className="shrink-0 rounded-lg bg-slate-900 text-white text-[10.5px] font-black px-2.5 py-1.5"
                    >
                      ربط السلعة
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {picked && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
              <div className="text-[11.5px] font-black text-slate-800">ربط «{picked.name}» بهامش ربح</div>
              <div className="flex items-center gap-2">
                <Percent className="w-3.5 h-3.5 text-slate-500" />
                <input
                  value={margin}
                  onChange={(e) => setMargin(e.target.value.replace(/[^\d.]/g, ''))}
                  inputMode="decimal"
                  className="w-20 rounded-xl border border-slate-300 px-2 py-2 text-[12px] font-mono text-center focus:outline-none focus:border-sky-500"
                />
                <span className="text-[11px] font-bold text-slate-600">%</span>
                <div className="mr-auto text-[11.5px] font-black text-emerald-700">
                  سعرك: {Math.round(Number(picked.sellingPriceSdg) * (1 + (Number(margin) || 0) / 100)).toLocaleString('en-US')} ج.س
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={doLink}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-emerald-700 text-white py-2.5 text-[12px] font-black disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} تأكيد الربط
                </button>
                <button onClick={() => setPicked(null)} className="rounded-xl bg-slate-200 text-slate-700 px-3 text-[11.5px] font-bold">إلغاء</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* روابطي */}
      <div className="rounded-2xl bg-white border border-slate-200 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[12.5px] font-black text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-700" /> الأصناف المربوطة
          </h3>
          <span className="text-[10.5px] font-bold text-slate-500">
            {totals.count} صنف{totals.manual ? ` • ${totals.manual} معدّل يدوياً` : ''}
          </span>
        </div>

        {loading ? (
          <div className="py-6 text-center text-[11.5px] text-slate-500"><Loader2 className="w-4 h-4 animate-spin inline" /> جارٍ التحميل…</div>
        ) : links.length === 0 ? (
          <p className="py-4 text-center text-[11.5px] text-slate-500">
            لا توجد أصناف مربوطة بعد — اختر متجراً من الأعلى واربط أول سلعة.
          </p>
        ) : (
          <div className="space-y-2">
            {links.map((l: any) => (
              <div key={l.id} className="rounded-xl border border-slate-200 p-2.5 space-y-1.5">
                <div className="flex items-start gap-2">
                  {l.imageUrl ? (
                    <img src={l.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center text-slate-400 text-[10px]">صنف</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-black text-slate-800 truncate">{l.myItemName}</div>
                    <div className="text-[10.5px] text-slate-500">
                      من <b>{l.sourceStoreName}</b> ({segmentLabel(l.sourceStoreSegment)})
                      {l.expiryDate ? ` • صلاحية ${String(l.expiryDate).slice(0, 10)}` : ''}
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-[12px] font-black text-emerald-700">{Number(l.myPriceSdg).toLocaleString('en-US')} ج.س</div>
                    <div className="text-[10px] text-slate-500 font-mono">المصدر {Number(l.sourcePriceSdg).toLocaleString('en-US')}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px] font-bold text-slate-600 flex items-center gap-1">
                    <Percent className="w-3 h-3" /> هامشي
                  </span>
                  <input
                    defaultValue={l.marginPercent}
                    onBlur={(e) => Number(e.target.value) !== l.marginPercent && saveMargin(l, e.target.value)}
                    inputMode="decimal"
                    className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-mono text-center focus:outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={() => { setEditPriceFor(l); setPriceInput(String(l.myPriceSdg)); }}
                    className="rounded-lg bg-slate-900 text-white px-2 py-1 text-[10.5px] font-black flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" /> سعري
                  </button>
                  {l.priceMode === 'manual' && (
                    <>
                      <span className="rounded-lg bg-amber-100 text-amber-900 px-1.5 py-0.5 text-[10px] font-black">معدّل يدوياً</span>
                      <button onClick={() => resetPrice(l)} className="rounded-lg bg-sky-100 text-sky-900 px-2 py-0.5 text-[10px] font-black">إرجاع للتلقائي</button>
                    </>
                  )}
                  <button onClick={() => unlink(l)} className="mr-auto rounded-lg bg-rose-50 text-rose-700 px-2 py-1 text-[10.5px] font-black flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> فك الربط
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* نافذة تعديل السعر اليدوي */}
      {editPriceFor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-black text-slate-900">سعري لـ «{editPriceFor.myItemName}»</h4>
              <button onClick={() => setEditPriceFor(null)}><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <p className="text-[10.5px] text-slate-600 leading-5">
              السعر التلقائي الآن: <b>{Number(editPriceFor.autoPriceSdg).toLocaleString('en-US')} ج.س</b>
              — سعرك اليدوي يبقى كما هو حتى يغيّر المصدر سعره.
            </p>
            <input
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[14px] font-mono text-center focus:outline-none focus:border-sky-500"
            />
            <div className="flex gap-2">
              <button onClick={savePrice} className="flex-1 rounded-xl bg-emerald-700 text-white py-2.5 text-[12px] font-black">حفظ السعر</button>
              <button onClick={() => setEditPriceFor(null)} className="rounded-xl bg-slate-200 text-slate-700 px-3 text-[11.5px] font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
