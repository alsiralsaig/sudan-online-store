import React, { useState, useEffect } from 'react';
import type { PromotionRule, PromotionType, Product } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import {
  Tag,
  Plus,
  Trash2,
  CheckCircle,
  Percent,
  Gift,
  ShoppingBag,
  Sparkles,
  Calendar,
  X,
  AlertCircle,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface PromotionsSettingsViewProps {
  products: Product[];
}

export const PromotionsSettingsView: React.FC<PromotionsSettingsViewProps> = ({
  products,
}) => {
  const [promotions, setPromotions] = useState<PromotionRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<PromotionType>('buy_x_get_y');
  const [buyProductId, setBuyProductId] = useState(products[0]?.id || '');
  const [buyQuantity, setBuyQuantity] = useState('2');
  const [freeProductId, setFreeProductId] = useState(products[0]?.id || '');
  const [freeQuantity, setFreeQuantity] = useState('1');
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [minQuantity, setMinQuantity] = useState('5');
  const [discountPct, setDiscountPct] = useState('10');
  const [minCartTotalSdg, setMinCartTotalSdg] = useState('100000');
  const [discountAmountSdg, setDiscountAmountSdg] = useState('5000');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadPromotions = async () => {
    try {
      setIsLoading(true);
      const res = await api.getPromotions();
      setPromotions(res.promotions || []);
    } catch (err) {
      console.warn('Failed loading promotions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPromotions();
  }, []);

  const handleApplyPreset = (presetType: 'bogo' | 'qty_10' | 'cart_5k') => {
    if (presetType === 'bogo') {
      setType('buy_x_get_y');
      setTitle('اشترِ 2 واحصل على 1 مجاناً');
      setDescription('عرض خاص: اشترِ قطعتين واحصل على القطعة الثالثة مجاناً');
      setBuyQuantity('2');
      setFreeQuantity('1');
    } else if (presetType === 'qty_10') {
      setType('qty_discount_pct');
      setTitle('خصم 10% عند شراء أكثر من 5 قطع');
      setDescription('خصم فوري 10% لتشجيع شراء الجملة والكميات');
      setMinQuantity('5');
      setDiscountPct('10');
    } else {
      setType('cart_fixed_discount');
      setTitle('خصم 5,000 ج.س على السلة الكبيرة');
      setDescription('خصم مقطوع 5,000 ج.س عند تجاوز الفاتورة 100,000 ج.س');
      setMinCartTotalSdg('100000');
      setDiscountAmountSdg('5000');
    }
    setIsModalOpen(true);
  };

  const handleCreatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload: Partial<PromotionRule> = {
        title,
        description,
        type,
        isActive: true,
      };

      if (type === 'buy_x_get_y') {
        payload.buyProductId = buyProductId;
        payload.buyQuantity = Number(buyQuantity);
        payload.freeProductId = freeProductId || buyProductId;
        payload.freeQuantity = Number(freeQuantity);
      } else if (type === 'qty_discount_pct') {
        payload.productId = productId;
        payload.minQuantity = Number(minQuantity);
        payload.discountPct = Number(discountPct);
      } else if (type === 'cart_fixed_discount') {
        payload.minCartTotalSdg = Number(minCartTotalSdg);
        payload.discountAmountSdg = Number(discountAmountSdg);
      }

      const res = await api.createPromotion(payload);
      if (res.success) {
        showToast(`تم إنشاء العرض الترويجي «${title}» بنجاح ويتم تطبيقه آلياً في الكاشير`);
        setIsModalOpen(false);
        setTitle('');
        setDescription('');
        loadPromotions();
      }
    } catch (err: any) {
      alert(err.message || 'فشل حفظ العرض الترويجي');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (promo: PromotionRule) => {
    try {
      await api.updatePromotion(promo.id, { isActive: !promo.isActive });
      loadPromotions();
    } catch (err: any) {
      alert(err.message || 'فشل تعديل حالة العرض');
    }
  };

  const handleDelete = async (id: string, promoTitle: string) => {
    if (!confirm(`هل أنت متأكد من حذف العرض الترويجي «${promoTitle}»؟`)) return;
    try {
      await api.deletePromotion(id);
      showToast('تم حذف العرض الترويجي');
      loadPromotions();
    } catch (err: any) {
      alert(err.message || 'فشل حذف العرض');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <span>نظام إدارة العروض الترويجية والخصومات التلقائية</span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إنشاء قواعد الخصومات مثل «اشترِ 2 واحصل على 1 مجاناً» وخصومات الكميات وتطبيقها آلياً في شاشة نقاط البيع (POS)
          </p>
        </div>

        <button
          onClick={() => {
            setTitle('');
            setDescription('');
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء قاعدة عرض جديدة</span>
        </button>
      </div>

      {/* Success Notification */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Preset Templates */}
      <div className="bg-gradient-to-r from-orange-50/60 to-amber-50/60 p-4 rounded-xl border border-orange-200/80">
        <span className="text-xs font-bold text-slate-700 block mb-2">
          نماذج سريعة جاهزة للقواعد الأكثر طلباً:
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => handleApplyPreset('bogo')}
            className="p-3 bg-white hover:bg-orange-50/80 border border-orange-200 rounded-lg text-right transition-all flex items-start gap-3 shadow-2xs group"
          >
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-slate-900 group-hover:text-orange-700 transition-colors">
                اشترِ 2 واحصل على 1 مجاناً
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                (Buy 2 Get 1 Free - BOGO) للسلع السريعة
              </div>
            </div>
          </button>

          <button
            onClick={() => handleApplyPreset('qty_10')}
            className="p-3 bg-white hover:bg-orange-50/80 border border-orange-200 rounded-lg text-right transition-all flex items-start gap-3 shadow-2xs group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Percent className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-slate-900 group-hover:text-blue-700 transition-colors">
                خصم 10% عند شراء أكثر من 5 قطع
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                خصم كميات لتشجيع شراء الجملة
              </div>
            </div>
          </button>

          <button
            onClick={() => handleApplyPreset('cart_5k')}
            className="p-3 bg-white hover:bg-orange-50/80 border border-orange-200 rounded-lg text-right transition-all flex items-start gap-3 shadow-2xs group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 transition-colors">
                خصم 5,000 ج.س عند تجاوز 100,000 ج.س
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                مكافأة السلة الكبيرة والزبائن الكبار
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Active Promotions Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">
            جاري تحميل قواعد العروض الترويجية...
          </div>
        ) : promotions.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white border border-dashed border-slate-300 rounded-2xl">
            <Tag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="font-bold text-sm text-slate-700 mb-1">لا توجد عروض ترويجية نشطة</h4>
            <p className="text-xs text-slate-400 mb-3">
              أنشئ أول عرض ترويجي ليتم تطبيقه واحتسابه تلقائياً في فواتير الكاشير
            </p>
            <button
              onClick={() => handleApplyPreset('bogo')}
              className="text-xs text-orange-600 font-bold hover:underline"
            >
              استخدام نموذج «اشترِ 2 واحصل على 1 مجاناً»
            </button>
          </div>
        ) : (
          promotions.map((promo) => (
            <div
              key={promo.id}
              className={`bg-white rounded-xl border p-4 shadow-sm flex flex-col justify-between transition-all ${
                promo.isActive ? 'border-orange-200' : 'border-slate-200 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    {promo.type === 'buy_x_get_y' ? (
                      <span className="p-1.5 rounded-lg bg-orange-100 text-orange-700">
                        <Gift className="w-4 h-4" />
                      </span>
                    ) : promo.type === 'qty_discount_pct' ? (
                      <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                        <Percent className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                        <ShoppingBag className="w-4 h-4" />
                      </span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {promo.type === 'buy_x_get_y'
                        ? 'عرض مجاني (BOGO)'
                        : promo.type === 'qty_discount_pct'
                        ? 'خصم نسبة كمية'
                        : 'خصم سلة مشتريات'}
                    </span>
                  </div>

                  <button
                    onClick={() => handleToggleActive(promo)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${
                      promo.isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {promo.isActive ? 'مفعل بالكاشير' : 'متوقف'}
                  </button>
                </div>

                <h3 className="font-bold text-sm text-slate-900 leading-snug">{promo.title}</h3>
                {promo.description && (
                  <p className="text-xs text-slate-500 mt-1">{promo.description}</p>
                )}

                {/* Rule summary specs */}
                <div className="mt-3 p-2.5 bg-slate-50 rounded-lg text-xs space-y-1 font-mono">
                  {promo.type === 'buy_x_get_y' && (
                    <div className="text-orange-800 font-semibold">
                      اشترِ {promo.buyQuantity} قطعة من «{promo.buyProductName || 'الصنف'}» واحصل على{' '}
                      {promo.freeQuantity} قطعة مجاناً
                    </div>
                  )}
                  {promo.type === 'qty_discount_pct' && (
                    <div className="text-blue-800 font-semibold">
                      خصم {promo.discountPct}% عند شراء {promo.minQuantity} قطعة أو أكثر من «
                      {promo.productName || 'الصنف'}»
                    </div>
                  )}
                  {promo.type === 'cart_fixed_discount' && (
                    <div className="text-emerald-800 font-semibold">
                      خصم {promo.discountAmountSdg?.toLocaleString()} ج.س عند تجاوز إجمالي السلة{' '}
                      {promo.minCartTotalSdg?.toLocaleString()} ج.س
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  تاريخ الإنشاء: {new Date(promo.createdAt).toLocaleDateString('ar-SD')}
                </span>
                <button
                  onClick={() => handleDelete(promo.id, promo.title)}
                  className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                  title="حذف العرض"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* =========================================================================
          CREATE PROMOTION MODAL
          ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePromotion}
            className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-orange-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-200" />
                <h3 className="font-bold text-sm">إنشاء قاعدة عرض ترويجي جديدة</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  عنوان العرض الترويجي: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: اشترِ 2 واحصل على 1 مجاناً / خصم 10% جملة"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">وصف العرض والرسالة التوضيحية:</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="تظهر للمشتري وللكاشير عند تطبيق الخصم تلقائياً..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">نوع قاعدة العرض:</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as PromotionType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold text-slate-800"
                >
                  <option value="buy_x_get_y">اشترِ X واحصل على Y مجاناً (Buy X Get Y Free)</option>
                  <option value="qty_discount_pct">خصم نسبة مئوية عند شراء حد أدنى للكمية</option>
                  <option value="cart_fixed_discount">خصم مبلغ مقطوع عند وصول سلة الشراء لحد أدنى</option>
                </select>
              </div>

              {/* Dynamic Rule Details Based on Type */}
              {type === 'buy_x_get_y' && (
                <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-xl space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">الصنف المطلوب شراؤه:</label>
                    <select
                      value={buyProductId}
                      onChange={(e) => {
                        setBuyProductId(e.target.value);
                        setFreeProductId(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit}) - {p.sellingPriceSdg.toLocaleString()} ج.س
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">الكمية المشراة (X):</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={buyQuantity}
                        onChange={(e) => setBuyQuantity(e.target.value)}
                        className="w-full px-3 py-2 font-mono font-bold border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">الكمية المجانية (Y):</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={freeQuantity}
                        onChange={(e) => setFreeQuantity(e.target.value)}
                        className="w-full px-3 py-2 font-mono font-bold border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {type === 'qty_discount_pct' && (
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">الصنف المستهدف بالخصم:</label>
                    <select
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit}) - {p.sellingPriceSdg.toLocaleString()} ج.س
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">الحد الأدنى للكمية:</label>
                      <input
                        type="number"
                        min="2"
                        required
                        value={minQuantity}
                        onChange={(e) => setMinQuantity(e.target.value)}
                        className="w-full px-3 py-2 font-mono font-bold border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">نسبة الخصم (%):</label>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        required
                        value={discountPct}
                        onChange={(e) => setDiscountPct(e.target.value)}
                        className="w-full px-3 py-2 font-mono font-bold border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {type === 'cart_fixed_discount' && (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">الحد الأدنى لقيمة السلة (ج.س):</label>
                      <input
                        type="number"
                        min="1000"
                        required
                        value={minCartTotalSdg}
                        onChange={(e) => setMinCartTotalSdg(e.target.value)}
                        className="w-full px-3 py-2 font-mono font-bold border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">قيمة الخصم المباشر (ج.س):</label>
                      <input
                        type="number"
                        min="100"
                        required
                        value={discountAmountSdg}
                        onChange={(e) => setDiscountAmountSdg(e.target.value)}
                        className="w-full px-3 py-2 font-mono font-bold border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                حفظ وتفعيل العرض
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
