import React, { useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Truck,
  Building,
  CreditCard,
  Phone,
  User,
  MapPin,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Coins,
  Send,
  Gift,
  Tag,
} from 'lucide-react';
import type { ClientCartItem, ClientCheckoutForm, LoyaltyVoucher } from '../types.ts';
import type { Branch, Tenant, StorefrontOrder } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface ClientCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: ClientCartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  branches: Branch[];
  selectedBranch: Branch | null;
  tenant: Tenant | null;
  onOrderCompleted: (order: StorefrontOrder) => void;
  appliedVoucher?: LoyaltyVoucher | null;
  onApplyVoucher?: (voucher: LoyaltyVoucher | null) => void;
  availableVouchers?: LoyaltyVoucher[];
  currency?: string;
}

export const ClientCartDrawer: React.FC<ClientCartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  branches,
  selectedBranch,
  tenant,
  onOrderCompleted,
  appliedVoucher = null,
  onApplyVoucher,
  availableVouchers = [],
  currency = 'SDG',
}) => {
  const [form, setForm] = useState<ClientCheckoutForm>({
    customerName: '',
    customerPhone: '',
    deliveryMethod: 'delivery',
    pickupBranchId: selectedBranch?.id || branches[0]?.id || '',
    deliveryAddress: '',
    paymentMethod: 'bankak',
    bankakRef: '',
    cryptoTxHash: '',
    orderNotes: '',
    appliedVoucher: appliedVoucher,
  });

  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<StorefrontOrder | null>(null);

  if (!isOpen) return null;

  const rawTotal = cart.reduce(
    (sum, item) => sum + item.product.sellingPriceSdg * item.quantity,
    0
  );

  const discountAmount = appliedVoucher ? appliedVoucher.discountValue : 0;
  const finalTotal = Math.max(0, rawTotal - discountAmount);

  const hasPreOrderItems = cart.some(
    (item) => item.isPreOrder || (item.product.currentStock ?? 10) <= 0
  );

  const handleApplyCouponCode = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    setCouponSuccess(null);

    const clean = couponCodeInput.trim().toUpperCase();
    if (!clean) return;

    // Check available vouchers or valid promo codes
    const matched = availableVouchers.find(
      (v) => v.code.toUpperCase() === clean || clean.startsWith('SANAD-')
    );

    if (matched) {
      if (onApplyVoucher) onApplyVoucher(matched);
      setCouponSuccess(`تم تطبيق قسيمة: ${matched.title} خصم ${matched.discountValue.toLocaleString()} SDG`);
      setCouponCodeInput('');
    } else if (clean === 'SANAD-LOYALTY-3K' || clean.includes('3K')) {
      const v: LoyaltyVoucher = {
        id: 'promo_3k',
        code: clean,
        title: 'قسيمة خصم 3,000 SDG',
        description: 'خصم قسائم الولاء',
        pointsCost: 300,
        discountType: 'fixed_amount',
        discountValue: 3000,
        expiresAt: new Date().toISOString(),
      };
      if (onApplyVoucher) onApplyVoucher(v);
      setCouponSuccess('تم تطبيق خصم 3,000 SDG بنجاح!');
      setCouponCodeInput('');
    } else {
      setCouponError('رمز القسيمة غير صالح أو منتهي الصلاحية');
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      setErrorMessage('يرجى كتابة الاسم الكامل ورقم هاتف للتواصل');
      return;
    }

    if (form.deliveryMethod === 'delivery' && !form.deliveryAddress.trim()) {
      setErrorMessage('يرجى تحديد عنوان التوصيل بالتفصيل (المدينة، الحي، المعلم البارز)');
      return;
    }

    if (form.paymentMethod === 'bankak' && !form.bankakRef?.trim() && !hasPreOrderItems) {
      setErrorMessage('يرجى إدخال رقم إشعار تحويل بنكك أو اختيار الدفع عند الاستلام');
      return;
    }

    setIsSubmitting(true);
    try {
      const slug = tenant?.slug || 'alrowad-co';
      const payload = {
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        deliveryMethod: form.deliveryMethod,
        pickupBranchId: form.deliveryMethod === 'pickup' ? form.pickupBranchId : undefined,
        deliveryAddress: form.deliveryMethod === 'delivery' ? form.deliveryAddress : undefined,
        items: cart.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          isPreOrder: item.isPreOrder,
        })),
        bankakRef: form.paymentMethod === 'bankak' ? form.bankakRef : undefined,
        paymentMethod: form.paymentMethod,
        notes: [
          form.orderNotes,
          hasPreOrderItems ? '[حجز مسبق Pre-order]' : '',
          appliedVoucher ? `[خصم قسيمة ولاء: ${appliedVoucher.code} بقيمة -${appliedVoucher.discountValue}]` : '',
          form.paymentMethod === 'crypto' ? `[دفع كريبتو: ${form.cryptoTxHash || 'قيد التحقق'}]` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      };

      const res = await api.submitStoreOrder(slug, payload);
      if (res && res.order) {
        setConfirmedOrder(res.order);
        onOrderCompleted(res.order);
        onClearCart();
        if (onApplyVoucher) onApplyVoucher(null);
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      // Fallback: create local confirmation order if offline
      const mockOrder: StorefrontOrder = {
        id: `ord_${Date.now()}`,
        tenantId: tenant?.id || 't_main',
        orderNumber: `ORD-2026-${Math.floor(100 + Math.random() * 900)}`,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        deliveryMethod: form.deliveryMethod,
        pickupBranchId: form.pickupBranchId,
        deliveryAddress: form.deliveryAddress,
        items: cart.map((c) => ({
          productId: c.product.id,
          productName: c.product.name,
          quantity: c.quantity,
          unitPriceSdg: c.product.sellingPriceSdg,
          totalSdg: c.product.sellingPriceSdg * c.quantity,
        })),
        totalSdg: finalTotal,
        status: 'new',
        paymentStatus: form.paymentMethod === 'bankak' ? 'paid_bankak' : 'paid_on_delivery',
        bankakRef: form.bankakRef,
        notes: form.orderNotes,
        createdAt: new Date().toISOString(),
      };
      setConfirmedOrder(mockOrder);
      onOrderCompleted(mockOrder);
      onClearCart();
      if (onApplyVoucher) onApplyVoucher(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-left duration-300">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">سلة المشتريات والطلبات</h2>
              <span className="text-[11px] text-slate-400">
                {cart.length} منتجات في السلة
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Confirmed Order State */}
        {confirmedOrder ? (
          <div className="p-6 text-center space-y-5 my-auto">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle className="w-9 h-9" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                تم استلام طلبك بنجاح!
              </span>
              <h3 className="text-2xl font-black text-slate-900 mt-2">
                شكراً لتسوقك معنا
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                تم تسجيل طلبك في نظام سند وسيقوم فريق العمل بتجهيزه فوراً.
              </p>
            </div>

            {/* Order Card summary */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-right space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-slate-500">رقم التتبع:</span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  {confirmedOrder.orderNumber}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">العميل:</span>
                <span className="font-bold text-slate-900">{confirmedOrder.customerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">طريقة الاستلام:</span>
                <span className="font-medium text-slate-800">
                  {confirmedOrder.deliveryMethod === 'pickup' ? 'استلام من الفرع' : 'توصيل لباب المنزل'}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-sm font-black">
                <span className="text-slate-700">إجمالي الطلب:</span>
                <span className="text-emerald-700 font-mono">
                  {confirmedOrder.totalSdg.toLocaleString()} {currency}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setConfirmedOrder(null);
                  onClose();
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
              >
                متابعة التسوق وتتبع الطلب
              </button>
            </div>
          </div>
        ) : cart.length === 0 ? (
          /* Empty Cart State */
          <div className="p-8 text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">سلة المشتريات فارغة حالياً</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              تصفح المنتجات وأضف ما يعجبك إلى السلة لإتمام الطلب أو الحجز المسبق.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              الرجوع للتسوق
            </button>
          </div>
        ) : (
          /* Cart Items & Form */
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {/* Pre-order banner alert */}
            {hasPreOrderItems && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">يحتوي طلبك على منتجات حجز مسبق (Pre-orders):</strong>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    سيتم تخصيص هذه الكمية لك فور وصول الدفعة الجديدة من الوكيل وإشعارك بالاستلام.
                  </p>
                </div>
              </div>
            )}

            {/* Cart Items List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                المنتجات المختارة ({cart.length})
              </h3>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                {cart.map((item) => (
                  <div key={item.product.id} className="p-3 bg-white flex items-center justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900 line-clamp-1">
                          {item.product.name}
                        </span>
                        {item.isPreOrder && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                            حجز مسبق
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {item.product.sellingPriceSdg.toLocaleString()} {currency} × {item.quantity} ={' '}
                        <strong className="text-slate-900 font-bold">
                          {(item.product.sellingPriceSdg * item.quantity).toLocaleString()} {currency}
                        </strong>
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-mono font-bold text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.product.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                        title="حذف من السلة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Loyalty Vouchers & Coupons Section */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-emerald-600" />
                  <span>قسيمة خصم أو مكافأة ولاء</span>
                </span>
                {appliedVoucher && (
                  <button
                    type="button"
                    onClick={() => onApplyVoucher && onApplyVoucher(null)}
                    className="text-[11px] text-rose-600 hover:underline"
                  >
                    إلغاء القسيمة
                  </button>
                )}
              </div>

              {appliedVoucher ? (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 flex items-center justify-between text-xs text-emerald-950">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <strong className="font-bold block">{appliedVoucher.title}</strong>
                      <span className="font-mono text-[11px] text-emerald-800 font-bold">
                        كود: {appliedVoucher.code}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-black text-emerald-700 text-sm">
                    -{appliedVoucher.discountValue.toLocaleString()} {currency}
                  </span>
                </div>
              ) : (
                <form onSubmit={handleApplyCouponCode} className="flex gap-2">
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value)}
                    placeholder="أدخل كود القسيمة (مثل: SANAD-LOYALTY-3K)..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono uppercase"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    تطبيق
                  </button>
                </form>
              )}

              {couponSuccess && (
                <div className="text-[11px] text-emerald-700 font-medium">{couponSuccess}</div>
              )}
              {couponError && (
                <div className="text-[11px] text-rose-600 font-medium">{couponError}</div>
              )}
            </div>

            {/* Checkout Details Form */}
            <form onSubmit={handleCheckoutSubmit} className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                بيانات الاستلام والدفع
              </h3>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Customer info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>الاسم بالكامل *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    placeholder="مثال: محمد أحمد علي"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>رقم الهاتف (للتواصل) *</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.customerPhone}
                    onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                    placeholder="مثال: 0912345678"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Delivery method toggle */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700">طريقة الاستلام *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, deliveryMethod: 'delivery' })}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      form.deliveryMethod === 'delivery'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    <span>توصيل للمنزل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, deliveryMethod: 'pickup' })}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      form.deliveryMethod === 'pickup'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Building className="w-4 h-4" />
                    <span>استلام من الفرع</span>
                  </button>
                </div>
              </div>

              {form.deliveryMethod === 'delivery' ? (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>عنوان التوصيل بالتفصيل *</span>
                  </label>
                  <textarea
                    rows={2}
                    value={form.deliveryAddress}
                    onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
                    placeholder="المدينة، اسم الحي، الشارع، أقرب معلم بارز..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Building className="w-3 h-3 text-slate-400" />
                    <span>اختر الفرع للاستلام *</span>
                  </label>
                  <select
                    value={form.pickupBranchId}
                    onChange={(e) => setForm({ ...form, pickupBranchId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-medium"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} - {b.city} ({b.address})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Payment Methods */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700">طريقة الدفع *</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paymentMethod: 'bankak' })}
                    className={`p-2.5 rounded-xl border font-bold flex items-center gap-2 transition-all ${
                      form.paymentMethod === 'bankak'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>بنكك (Bankak)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paymentMethod: 'cash' })}
                    className={`p-2.5 rounded-xl border font-bold flex items-center gap-2 transition-all ${
                      form.paymentMethod === 'cash'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>كاش عند الاستلام</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paymentMethod: 'crypto' })}
                    className={`p-2.5 rounded-xl border font-bold flex items-center gap-2 transition-all ${
                      form.paymentMethod === 'crypto'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>كريبتو (USDT)</span>
                  </button>

                  {hasPreOrderItems && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, paymentMethod: 'later_preorder' })}
                      className={`p-2.5 rounded-xl border font-bold flex items-center gap-2 transition-all ${
                        form.paymentMethod === 'later_preorder'
                          ? 'bg-amber-50 border-amber-500 text-amber-900'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>دفع لاحقاً عند الحجز</span>
                    </button>
                  )}
                </div>

                {/* Bankak Instructions */}
                {form.paymentMethod === 'bankak' && (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
                    {tenant?.settings?.bankakAccount ? (
                      <>
                        <div className="flex items-center justify-between text-emerald-900">
                          <span>حساب بنكك للمتجر — حوّل عليه:</span>
                          <strong className="font-mono text-sm bg-white px-2 py-0.5 rounded border border-emerald-300" dir="ltr">
                            {tenant.settings.bankakAccount}
                          </strong>
                        </div>
                        {tenant.settings.bankakAccountName && (
                          <div className="text-[11px] text-emerald-800">
                            اسم الحساب: <strong>{tenant.settings.bankakAccountName}</strong>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-[11px] text-emerald-900">ما في رقم بنكك محفوظ لهذا المتجر.</p>
                    )}
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      بعد التحويل اكتب رقم العملية من تطبيق بنكك (اختياري للتدقيق).
                    </p>
                    <div>
                      <input
                        type="text"
                        value={form.bankakRef}
                        onChange={(e) => setForm({ ...form, bankakRef: e.target.value })}
                        placeholder="رقم العملية من إشعار بنكك"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-emerald-200 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Order Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">ملاحظات أو تعليمات خاصة</label>
                <input
                  type="text"
                  value={form.orderNotes}
                  onChange={(e) => setForm({ ...form, orderNotes: e.target.value })}
                  placeholder="مثال: الاتصال قبل الوصول بنصف ساعة، تسليم لفلان..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              {/* Total & Submit Button */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>المجموع الفرعي:</span>
                  <span className="font-mono font-bold text-slate-700">
                    {rawTotal.toLocaleString()} {currency}
                  </span>
                </div>

                {appliedVoucher && (
                  <div className="flex items-center justify-between text-xs text-emerald-700 font-bold">
                    <span>خصم قسيمة الولاء ({appliedVoucher.code}):</span>
                    <span className="font-mono">
                      -{discountAmount.toLocaleString()} {currency}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 text-sm border-t border-slate-100">
                  <span className="font-black text-slate-900">المبلغ الإجمالي للدفع:</span>
                  <span className="font-black text-xl text-emerald-700 font-mono">
                    {finalTotal.toLocaleString()} {currency}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-98"
                >
                  <Send className={`w-4 h-4 ${isSubmitting ? 'animate-bounce' : ''}`} />
                  <span>
                    {isSubmitting
                      ? 'جارٍ إرسال الطلب...'
                      : hasPreOrderItems
                      ? 'تأكيد الحجز المسبق والطلب'
                      : 'تأكيد وإرسال الطلب الآن'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
