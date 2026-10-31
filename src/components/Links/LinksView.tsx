import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Link2, Search, Store, Percent, RefreshCw, Trash2, Pencil, CheckCircle2,
  AlertTriangle, Loader2, PackageSearch, ShieldCheck, ArrowRight, X, Sparkles,
  ShoppingCart, ClipboardList, Minus, Plus, Truck, Check, Ban,
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
  const [platform, setPlatform] = useState<{ wholesalers: number; suppliers: number; retailers: number }>({ wholesalers: 0, suppliers: 0, retailers: 0 });
  const [links, setLinks] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<{ buyers: any[]; totals: { buyers: number; links: number; itemsLinked: number } }>({ buyers: [], totals: { buyers: 0, links: 0, itemsLinked: 0 } });

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

  /* طلب توريد: سلة الكميات ثم إرسال الطلب + متابعة الوارد/الصادر */
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderNote, setOrderNote] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'bankak' | 'bank_transfer' | 'credit'>('cash');
  const [payCurrency, setPayCurrency] = useState('SDG');
  const [payRate, setPayRate] = useState('1');
  const [orders, setOrders] = useState<{ incoming: any[]; outgoing: any[]; totals: { incomingPending: number; outgoingPending: number } }>({
    incoming: [], outgoing: [], totals: { incomingPending: 0, outgoingPending: 0 },
  });
  const isupplierSide = viewer.accountSegment === 'supplier' || viewer.accountSegment === 'wholesaler';

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [src, lnk, inc] = await Promise.all([
        api.getLinkSources(),
        api.getItemLinks(),
        api.getIncomingLinks().catch(() => ({ buyers: [], totals: { buyers: 0, links: 0, itemsLinked: 0 } })),
      ]);
      setSources(src.sources || []);
      setViewer(src.viewer);
      setPlatform((src as any).platform || { wholesalers: 0, suppliers: 0, retailers: 0 });
      setLinks(lnk.links || []);
      setIncoming(inc as any);
      const ord = await api.getSupplyOrders().catch(() => null);
      if (ord) setOrders(ord as any);
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

  /* ---------------- سلة طلب التوريد ---------------- */
  const setQty = (productId: string, qty: number) =>
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = Math.min(qty, 100000);
      return next;
    });

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .map(([productId, quantity]) => {
          const product = catalog.find((p: any) => p.id === productId);
          if (!product) return null;
          const unitPriceSdg = Number(product.sellingPriceSdg) || 0;
          return { product, quantity, unitPriceSdg, totalSdg: unitPriceSdg * quantity };
        })
        .filter(Boolean) as any[],
    [cart, catalog],
  );
  const cartTotal = cartLines.reduce((sum, l) => sum + l.totalSdg, 0);

  const clearCart = () => { setCart({}); setOrderNote(''); };

  const sendOrder = async () => {
    if (!openSource || cartLines.length === 0) return;
    setBusy(true);
    try {
      const res: any = await api.sendSupplyOrder({
        sellerTenantId: openSource.id,
        items: cartLines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        note: orderNote.trim() || undefined,
        paymentMethod: payMethod,
        paymentCurrency: payCurrency,
        paymentExchangeRate: Number(payRate) || 1,
      } as any);
      setNote(res.message || 'تم إرسال الطلب.');
      clearCart();
      const ord = await api.getSupplyOrders().catch(() => null);
      if (ord) setOrders(ord as any);
    } catch (err: any) {
      setError(err.message || 'تعذّر إرسال الطلب');
    } finally {
      setBusy(false);
    }
  };

  const respondOrder = async (order: any, status: string) => {
    setBusy(true);
    try {
      await api.setSupplyOrderStatus(order.id, status);
      const ord = await api.getSupplyOrders().catch(() => null);
      if (ord) setOrders(ord as any);
      setNote(`تم تحديث الطلب ${order.orderNumber}.`);
    } catch (err: any) {
      setError(err.message || 'تعذّر تحديث الطلب');
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (st: string) =>
    st === 'pending' ? 'بانتظار الرد'
      : st === 'accepted' ? 'مقبول — جارٍ التحضير'
      : st === 'rejected' ? 'مرفوض'
      : st === 'fulfilled' ? 'تم التسليم'
      : 'ملغي';
  const statusClass = (st: string) =>
    st === 'pending' ? 'bg-amber-100 text-amber-900'
      : st === 'accepted' ? 'bg-sky-100 text-sky-900'
      : st === 'rejected' ? 'bg-rose-100 text-rose-900'
      : st === 'fulfilled' ? 'bg-emerald-100 text-emerald-900'
      : 'bg-slate-200 text-slate-700';

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
          <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 space-y-2">
            <p className="text-[11px] text-slate-700 leading-6">
              <ShieldCheck className="w-3.5 h-3.5 inline ml-1 text-sky-700" />
              أنت <b>مورد</b>: بضاعتك تظهر لتجار الجملة فقط، ولا تربط أنت بأحد. كل تاجر جملة يربط صنفه بصنفك يظهر في «من ربط بأصنافي» بالأسفل.
            </p>
          </div>
        ) : sources.length === 0 ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1">
            <p className="text-[11.5px] font-black text-amber-900">لا يوجد متجر يمكنك الربط به الآن</p>
            <p className="text-[11px] text-amber-900/90 leading-6">
              السبب: في المنصة الآن <b>{platform.wholesalers}</b> متجر جملة و<b>{platform.suppliers}</b> مورد و<b>{platform.retailers}</b> قطاعي
              {viewer.accountSegment === 'retailer' && !viewer.isVip ? ' — والتعامل مع المورد يحتاج باقة VIP' : ''}.
              المتاجر التي لم يُحدَّد نوعها لا تظهر هنا.
              <br />الحل: خلّي المورد يضيف أصنافه، ثم من <b>لوحة المنصة ← المنشآت</b> صنّف متجره
              <b> جملة</b> — وسيظهر لك هنا فوراً بعد «تحديث».
              {viewer.accountSegment === 'retailer' && !viewer.isVip ? ' ولو تريد المورد مباشرة رقِّ حسابك إلى VIP من «الاشتراك والباقات».' : ''}
            </p>
          </div>
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
                <div className="text-[10.5px] text-slate-500 mt-0.5">
                  {/* بخط صغير تحت اسم المتجر: نوع النشاط */}
                  <span className="font-bold text-slate-600">{s.businessType || 'نشاط غير محدد'}</span>
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
                  <button
                    type="button"
                    onClick={() => { if (!p.linked) { setPicked(p); setNote(''); } }}
                    className="flex items-center gap-2 min-w-0 flex-1 text-right active:opacity-70"
                    title={p.linked ? 'مربوط بالفعل' : 'اضغط للربط'}
                  >
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center text-slate-400 text-[10px]">صنف</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-bold text-slate-800 truncate">{p.name}</div>
                      <div className="text-[10.5px] text-slate-500 font-mono">
                        {Number(p.sellingPriceSdg).toLocaleString('en-US')} ج.س
                        {p.expiryDate ? ` • صلاحية ${String(p.expiryDate).slice(0, 10)}` : ''}
                      </div>
                    </div>
                  </button>
                  <div className="shrink-0 flex items-center gap-1">
                    {cart[p.id] ? (
                      <div className="flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-1">
                        <button onClick={() => setQty(p.id, (cart[p.id] || 0) - 1)} className="p-1 text-sky-800"><Minus className="w-3 h-3" /></button>
                        <input
                          value={cart[p.id]}
                          onChange={(e) => setQty(p.id, Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
                          inputMode="numeric"
                          className="w-10 bg-transparent text-center text-[11px] font-mono font-black text-sky-900 focus:outline-none"
                        />
                        <button onClick={() => setQty(p.id, (cart[p.id] || 0) + 1)} className="p-1 text-sky-800"><Plus className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setQty(p.id, 1)}
                        title="أضف للطلب"
                        className="rounded-lg border border-sky-400 bg-sky-50 text-sky-800 px-2 py-1.5 text-[10px] font-black flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> طلب
                      </button>
                    )}
                    {p.linked ? (
                      <span className="rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-1">مربوط</span>
                    ) : (
                      <button
                        onClick={() => { setPicked(p); setNote(''); }}
                        className="rounded-lg bg-slate-900 text-white text-[10.5px] font-black px-2.5 py-1.5"
                      >
                        ربط السلعة
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* سلة الطلب من هذا المورد */}
              {cartLines.length > 0 && (
                <div className="rounded-xl border border-sky-300 bg-sky-50 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] font-black text-sky-900 flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5" /> طلب توريد: {cartLines.length} صنف
                    </span>
                    <span className="text-[12px] font-black text-sky-900">{cartTotal.toLocaleString('en-US')} ج.س</span>
                  </div>
                  <div className="space-y-1">
                    {cartLines.map((l) => (
                      <div key={l.product.id} className="flex items-center justify-between gap-2 text-[10.5px] text-sky-900">
                        <span className="truncate">{l.product.name} × {l.quantity}</span>
                        <span className="font-mono shrink-0">{l.totalSdg.toLocaleString('en-US')}</span>
                      </div>
                    ))}
                  </div>
                  {/* طريقة الدفع والعملة */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="text-[10px] font-black text-sky-900">
                      طريقة الدفع
                      <select
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value as any)}
                        className="mt-0.5 w-full rounded-lg border border-sky-300 bg-white px-1.5 py-1 text-[11px] font-bold text-slate-800"
                      >
                        <option value="cash">كاش</option>
                        <option value="bankak">بنكك</option>
                        <option value="bank_transfer">حوالة بنكية</option>
                        <option value="credit">آجل</option>
                      </select>
                    </label>
                    <label className="text-[10px] font-black text-sky-900">
                      عملة الدفع
                      <select
                        value={payCurrency}
                        onChange={(e) => setPayCurrency(e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-sky-300 bg-white px-1.5 py-1 text-[11px] font-bold text-slate-800"
                      >
                        <option value="SDG">جنيه سوداني (SDG)</option>
                        <option value="USD">دولار (USD)</option>
                        <option value="SAR">ريال سعودي (SAR)</option>
                        <option value="AED">درهم (AED)</option>
                        <option value="CNY">يوان (CNY)</option>
                      </select>
                    </label>
                    {payCurrency !== 'SDG' && (
                      <label className="text-[10px] font-black text-sky-900 col-span-2">
                        سعر الصرف للجنيه السوداني
                        <input
                          value={payRate}
                          onChange={(e) => setPayRate(e.target.value.replace(/[^\d.]/g, ''))}
                          inputMode="decimal"
                          placeholder="مثال: 2500"
                          className="mt-0.5 w-full rounded-lg border border-sky-300 px-2 py-1 text-[11px] font-mono"
                        />
                      </label>
                    )}
                  </div>
                  <textarea
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    rows={2}
                    placeholder="ملاحظة للمورد (اختياري): مكان التسليم، موعد التسليم…"
                    className="w-full rounded-lg border border-sky-300 px-2 py-1.5 text-[11px] focus:outline-none focus:border-sky-600"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={sendOrder}
                      disabled={busy}
                      className="flex-1 rounded-lg bg-sky-700 text-white py-2 text-[11.5px] font-black disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                      إرسال الطلب إلى {openSource?.name}
                    </button>
                    <button onClick={clearCart} className="rounded-lg bg-white border border-sky-300 text-sky-800 px-2.5 text-[11px] font-bold">تفريغ</button>
                  </div>
                </div>
              )}
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

      {/* من ربط بأصنافي — للطبقة الأعلى (مورد/جملة) */}
      {(viewer.accountSegment === 'supplier' || viewer.accountSegment === 'wholesaler') && (
        <div className="rounded-2xl bg-white border border-slate-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[12.5px] font-black text-slate-800 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-emerald-700" /> من ربط بأصنافي
            </h3>
            <span className="text-[10.5px] font-bold text-slate-500">
              {incoming.totals.buyers} تاجر • {incoming.totals.itemsLinked} صنف
            </span>
          </div>

          {incoming.buyers.length === 0 ? (
            <p className="py-4 text-center text-[11.5px] text-slate-500 leading-6">
              لا أحد ربط بأصنافك بعد. عندما يربط تاجر صنفه بصنفك سيظهر هنا مع سعره وهامشه.
            </p>
          ) : (
            <div className="space-y-2">
              {incoming.buyers.map((b: any) => (
                <div key={b.tenantId} className="rounded-xl border border-slate-200 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-black text-slate-800 truncate">{b.name}</span>
                    <span className={`shrink-0 rounded-lg px-1.5 py-0.5 text-[10px] font-black ${b.accountSegment === 'wholesaler' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {segmentLabel(b.accountSegment)}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-slate-500">
                    {b.city || '—'} • {b.items.length} صنف مربوط
                    {b.phone ? ` • ${b.phone}` : ''}
                  </div>
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    {b.items.map((it: any) => (
                      <div key={it.linkId} className="flex items-center justify-between gap-2 text-[10.5px]">
                        <span className="text-slate-700 truncate">{it.myItemName} <span className="text-slate-500">← عندهم: {it.theirItemName}</span></span>
                        <span className="font-mono text-slate-500 shrink-0">
                          {Number(it.myPriceSdg).toLocaleString('en-US')} → <b className="text-emerald-700">{Number(it.theirPriceSdg).toLocaleString('en-US')}</b> (+{it.marginPercent}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* روابطي */}
      <div className="rounded-2xl bg-white border border-slate-200 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[12.5px] font-black text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-700" /> الأصناف المربوطة بي (مصادرها)
          </h3>
          <span className="text-[10.5px] font-bold text-slate-500">
            {totals.count} صنف{totals.manual ? ` • ${totals.manual} معدّل يدوياً` : ''}
          </span>
        </div>

        {loading ? (
          <div className="py-6 text-center text-[11.5px] text-slate-500"><Loader2 className="w-4 h-4 animate-spin inline" /> جارٍ التحميل…</div>
        ) : links.length === 0 ? (
          <p className="py-4 text-center text-[11.5px] text-slate-500">
            {viewer.accountSegment === 'supplier' || viewer.accountSegment === 'wholesaler'
              ? 'هذا القسم يعرض الأصناف التي ربطتها أنت بمتجر أعلى. أنت الطبقة الأعلى: تابع من ربط ببضاعتك في قسم «من ربط بأصنافي».'
              : 'لا توجد أصناف مربوطة بعد — اختر متجراً من الأعلى واربط أول سلعة.'}
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

      {/* طلبات التوريد: الصادرة (أنا طالب) والواردة (أنا المورد) */}
      <div className="rounded-2xl bg-white border border-slate-200 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[12.5px] font-black text-slate-800 flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-sky-700" /> طلبات التوريد
          </h3>
          <span className="text-[10.5px] font-bold text-slate-500">
            واردة {orders.incoming.length} • صادرة {orders.outgoing.length}
            {orders.totals.incomingPending > 0 ? ` • ${orders.totals.incomingPending} بانتظار ردّك` : ''}
          </span>
        </div>

        {orders.incoming.length === 0 && orders.outgoing.length === 0 ? (
          <p className="py-4 text-center text-[11.5px] text-slate-500 leading-6">
            لا توجد طلبات بعد. {isupplierSide
              ? 'عندما يطلب منك تاجر توريداً سيظهر هنا للقبول أو الرفض.'
              : sources.length > 0
                ? 'افتح متجر الجملة من الأعلى، اضغط «طلب» بجانب كل صنف تريده، ثم «إرسال الطلب».'
                : 'أول ما يظهر متجر جملة يمكنك الربط به، ستقدر تطلب منه من هنا.'}
          </p>
        ) : (
          <div className="space-y-2">
            {[...orders.incoming.map((o) => ({ ...o, side: 'in' })), ...orders.outgoing.map((o) => ({ ...o, side: 'out' }))]
              .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
              .map((o: any) => (
                <div key={o.id} className="rounded-xl border border-slate-200 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] font-black text-slate-800 truncate">
                      {o.side === 'in' ? `من ${o.buyerName}` : `إلى ${o.sellerName}`}
                      <span className="text-slate-500 font-mono text-[10px]"> • {o.orderNumber}</span>
                    </span>
                    <span className={`shrink-0 rounded-lg px-1.5 py-0.5 text-[10px] font-black ${statusClass(o.status)}`}>
                      {statusLabel(o.status)}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-slate-600">
                    {o.items.map((it: any) => `${it.productName} × ${it.quantity}`).join(' • ')}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] font-black text-emerald-700">{Number(o.totalSdg).toLocaleString('en-US')} ج.س</span>
                    <div className="flex items-center gap-1">
                      {o.side === 'in' && o.status === 'pending' && (
                        <>
                          <button onClick={() => respondOrder(o, 'accepted')} disabled={busy} className="rounded-lg bg-sky-700 text-white px-2 py-1 text-[10.5px] font-black flex items-center gap-1 disabled:opacity-60">
                            <Check className="w-3 h-3" /> قبول
                          </button>
                          <button onClick={() => respondOrder(o, 'rejected')} disabled={busy} className="rounded-lg bg-rose-50 text-rose-700 px-2 py-1 text-[10.5px] font-black flex items-center gap-1 disabled:opacity-60">
                            <Ban className="w-3 h-3" /> رفض
                          </button>
                        </>
                      )}
                      {o.side === 'in' && o.status === 'accepted' && (
                        <button onClick={() => respondOrder(o, 'fulfilled')} disabled={busy} className="rounded-lg bg-emerald-700 text-white px-2 py-1 text-[10.5px] font-black flex items-center gap-1 disabled:opacity-60">
                          <Truck className="w-3 h-3" /> تم التسليم
                        </button>
                      )}
                      {o.side === 'out' && (o.status === 'pending' || o.status === 'accepted') && (
                        <button onClick={() => respondOrder(o, 'cancelled')} disabled={busy} className="rounded-lg bg-slate-100 text-slate-700 px-2 py-1 text-[10.5px] font-bold disabled:opacity-60">
                          إلغاء طلبي
                        </button>
                      )}
                      {o.buyerPhone && o.side === 'in' && (
                        <a href={`tel:${o.buyerPhone}`} className="rounded-lg bg-slate-900 text-white px-2 py-1 text-[10.5px] font-black">اتصال</a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 text-[10px]">
                    <span className="rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 font-bold">
                      الدفع: {o.paymentMethod === 'cash' ? 'كاش' : o.paymentMethod === 'bankak' ? 'بنكك' : o.paymentMethod === 'bank_transfer' ? 'حوالة بنكية' : 'آجل'}
                    </span>
                    <span className="rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 font-bold">
                      العملة: {o.paymentCurrency || 'SDG'}
                    </span>
                    {Number(o.paymentExchangeRate) > 1 && (
                      <span className="rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 font-mono">
                        صرف: {Number(o.paymentExchangeRate).toLocaleString('en-US')}
                      </span>
                    )}
                    {o.invoiceNumber && (
                      <span className="rounded-md bg-emerald-100 text-emerald-900 px-1.5 py-0.5 font-black">
                        فاتورة مشتريات: {o.invoiceNumber}
                      </span>
                    )}
                    {o.status === 'fulfilled' && !o.invoiceNumber && o.side === 'in' && (
                      <span className="text-rose-700 font-bold">لم تُنشأ فاتورة (المشتري بلا فرع نشط)</span>
                    )}
                  </div>
                  {o.note ? <div className="text-[10px] text-slate-500">ملاحظة الطالب: {o.note}</div> : null}
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
