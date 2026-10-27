import React, { useState, useEffect } from 'react';
import {
  Globe,
  ShoppingCart,
  Search,
  MapPin,
  Phone,
  Truck,
  Building,
  CheckCircle,
  Clock,
  Package,
  Plus,
  Minus,
  Trash2,
  X,
  CreditCard,
  Smartphone,
} from 'lucide-react';
import type { StorefrontOrder, Tenant, Branch, Product } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface StorefrontViewProps {
  tenant: Tenant | null;
  branches: Branch[];
  products: Product[];
  onRefresh: () => void;
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  tenant,
  branches,
  products,
  onRefresh,
}) => {
  const [viewMode, setViewMode] = useState<'customer_view' | 'merchant_orders'>('customer_view');
  const [orders, setOrders] = useState<StorefrontOrder[]>([]);

  // Customer Shopping State
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerCart, setCustomerCart] = useState<{ product: Product; quantity: number }[]>([]);

  // Customer Checkout Modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [pickupBranchId, setPickupBranchId] = useState(branches[0]?.id || '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [bankakRef, setBankakRef] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<StorefrontOrder | null>(null);

  const loadOrders = async () => {
    try {
      const res = await api.getStorefrontOrders();
      setOrders(res.orders);
    } catch (err) {
      console.warn('Failed loading store orders:', err);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [viewMode]);

  const categories = ['الكل', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'الكل' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch && p.isActive;
  });

  const cartTotal = customerCart.reduce(
    (acc, item) => acc + item.quantity * item.product.sellingPriceSdg,
    0
  );

  const addToCustomerCart = (p: Product) => {
    setCustomerCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx].quantity += 1;
        return next;
      }
      return [...prev, { product: p, quantity: 1 }];
    });
  };

  const updateCustomerCartQty = (productId: string, delta: number) => {
    setCustomerCart((prev) =>
      prev
        .map((it) => (it.product.id === productId ? { ...it, quantity: it.quantity + delta } : it))
        .filter((it) => it.quantity > 0)
    );
  };

  // Submit Order
  const handleSubmitCustomerOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setIsOrdering(true);

    try {
      const res = await api.submitStoreOrder(tenant.slug, {
        customerName: custName,
        customerPhone: custPhone,
        deliveryMethod,
        pickupBranchId: deliveryMethod === 'pickup' ? pickupBranchId : undefined,
        deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : undefined,
        items: customerCart.map((it) => ({ productId: it.product.id, quantity: it.quantity })),
        bankakRef: bankakRef || undefined,
        notes: orderNotes,
      });

      if (res.success) {
        setOrderSuccess(res.order);
        setCustomerCart([]);
        setIsCheckoutOpen(false);
        loadOrders();
      }
    } catch (err: any) {
      alert(err.message || 'فشل إرسال الطلب');
    } finally {
      setIsOrdering(false);
    }
  };

  // Update order status in pipeline
  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      await api.updateStoreOrderStatus(orderId, status);
      loadOrders();
    } catch (err) {
      alert('فشل تحديث حالة الطلب');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* View Switcher Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-600" />
            <span>المتجر الإلكتروني العام: {tenant?.tradeName || tenant?.name}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            رابط المتجر العام: <code className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">/store/{tenant?.slug}</code>
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setViewMode('customer_view')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              viewMode === 'customer_view'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600'
            }`}
          >
            واجهة الزبائن والمتجر
          </button>
          <button
            onClick={() => setViewMode('merchant_orders')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              viewMode === 'merchant_orders'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600'
            }`}
          >
            لوحة تجهيز وإدارة الطلبات ({orders.length})
          </button>
        </div>
      </div>

      {viewMode === 'customer_view' ? (
        /* CUSTOMER PUBLIC STOREFRONT VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Store Catalog */}
          <div className="lg:col-span-3 space-y-4">
            {/* Storefront Hero Card */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 text-white p-6 shadow-sm">
              <div className="relative z-10 max-w-xl space-y-2">
                <span className="text-xs font-bold text-emerald-400">التسوق الإلكتروني المباشر</span>
                <h1 className="text-2xl font-bold tracking-tight">{tenant?.tradeName}</h1>
                <p className="text-xs text-slate-300 leading-relaxed">
                  اطلب الآن واستلم من أقرب فرع في {tenant?.city} أو اختر خدمة التوصيل المباشر حتى باب منزلك مع خيارات الدفع عبر بنكك أو عند الاستلام.
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-300 pt-2 font-mono">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{tenant?.phone}</span>
                  </span>
                  <span className="flex items-center gap-1 font-sans">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{tenant?.address}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث في المتجر..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow group"
                >
                  <div className="aspect-square w-full rounded-lg bg-slate-100 overflow-hidden mb-2 relative">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-bold">
                        {p.name.slice(0, 1)}
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                      {p.unit}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block">{p.category}</span>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mb-1">{p.name}</h4>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-bold text-emerald-700 font-mono tabular-nums">
                        {p.sellingPriceSdg.toLocaleString()} ج.س
                      </span>
                      <button
                        onClick={() => addToCustomerCart(p)}
                        className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>أضف</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Shopping Cart Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm h-fit space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-sm text-slate-900">سلة التسوق</span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">
                {customerCart.length} أصناف
              </span>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {customerCart.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                  <div className="flex-1 pr-2">
                    <span className="font-semibold text-slate-900 block leading-tight">
                      {item.product.name}
                    </span>
                    <span className="font-mono text-slate-500 text-[11px]">
                      {item.product.sellingPriceSdg.toLocaleString()} ج.س
                    </span>
                  </div>

                  <div className="flex items-center border border-slate-300 rounded bg-white shrink-0">
                    <button
                      onClick={() => updateCustomerCartQty(item.product.id, -1)}
                      className="p-1 hover:bg-slate-100 text-slate-600"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-mono font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateCustomerCartQty(item.product.id, 1)}
                      className="p-1 hover:bg-slate-100 text-slate-600"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              {customerCart.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  السلة فارغة حالياً. تصفح المنتجات وأضف ما يناسبك!
                </div>
              )}
            </div>

            {customerCart.length > 0 && (
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">المجموع النهائي:</span>
                  <span className="font-bold text-emerald-700 font-mono text-base">
                    {cartTotal.toLocaleString()} ج.س
                  </span>
                </div>

                <button
                  onClick={() => setIsCheckoutOpen(true)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                >
                  تأكيد الطلب والدفع
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* MERCHANT ORDERS MANAGEMENT VIEW */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">طلبات المتجر الإلكتروني الواردة</span>
            <span className="text-xs text-slate-500 font-mono">{orders.length} طلبات</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">رقم الطلب</th>
                  <th className="py-3 px-4">العميل والهاتف</th>
                  <th className="py-3 px-4">طريقة الاستلام / العنوان</th>
                  <th className="py-3 px-4">الأصناف المطلوبة</th>
                  <th className="py-3 px-4">المبلغ الإجمالي</th>
                  <th className="py-3 px-4">حالة الدفع</th>
                  <th className="py-3 px-4">حالة الطلب</th>
                  <th className="py-3 px-4 text-center">تغيير الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{o.orderNumber}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{o.customerName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{o.customerPhone}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {o.deliveryMethod === 'delivery' ? (
                        <div>
                          <span className="text-emerald-700 font-semibold">توصيل منزلي: </span>
                          <span>{o.deliveryAddress}</span>
                        </div>
                      ) : (
                        <span className="text-blue-700 font-semibold">استلام من الفرع</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {o.items.map((it, idx) => (
                        <div key={idx}>
                          {it.productName} ({it.quantity})
                        </div>
                      ))}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {o.totalSdg.toLocaleString()} ج.س
                    </td>
                    <td className="py-3 px-4">
                      {o.paymentStatus === 'paid_bankak' && (
                        <span className="text-red-700 font-medium">
                          مدفوع بنكك ({o.bankakRef})
                        </span>
                      )}
                      {o.paymentStatus === 'paid_on_delivery' && (
                        <span className="text-slate-600">دفع عند الاستلام</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      {o.status === 'new' && <span className="text-amber-700">طلب جديد</span>}
                      {o.status === 'preparing' && <span className="text-blue-700">قيد التجهيز</span>}
                      {o.status === 'ready' && <span className="text-purple-700">جاهز للتسليم</span>}
                      {o.status === 'delivered' && <span className="text-emerald-700">تم التسليم</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <select
                        value={o.status}
                        onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1"
                      >
                        <option value="new">طلب جديد</option>
                        <option value="preparing">قيد التجهيز</option>
                        <option value="ready">جاهز للتسليم</option>
                        <option value="delivered">تم التسليم</option>
                        <option value="cancelled">ملغي</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          CUSTOMER CHECKOUT MODAL
          ========================================================================= */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitCustomerOrder}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">إتمام طلب الشراء من المتجر</h3>
                <p className="text-[11px] text-emerald-100">المبلغ الإجمالي: {cartTotal.toLocaleString()} ج.س</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الاسم الكامل:</label>
                  <input
                    type="text"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="اسم المشتري"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">رقم الهاتف (للتواصل والتأكيد):</label>
                  <input
                    type="text"
                    required
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="0912000000"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">طريقة الاستلام والتسليم:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('delivery')}
                    className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-1.5 font-semibold ${
                      deliveryMethod === 'delivery'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>توصيل للمنزل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('pickup')}
                    className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-1.5 font-semibold ${
                      deliveryMethod === 'pickup'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <Building className="w-3.5 h-3.5" />
                    <span>استلام من الفرع</span>
                  </button>
                </div>
              </div>

              {deliveryMethod === 'delivery' ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">عنوان التوصيل في {tenant?.city}:</label>
                  <input
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="الحي، الشارع، رقم المنزل أو معلم بارز..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">اختر الفرع للاستلام:</label>
                  <select
                    value={pickupBranchId}
                    onChange={(e) => setPickupBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} - {b.city}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Bankak Payment Reference Option */}
              <div className="p-3 bg-red-50/60 rounded-xl border border-red-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-red-900">سداد عبر بنكك (اختياري):</span>
                  {tenant?.settings?.bankakAccount ? (
                    <span className="font-mono text-red-800 text-xs" dir="ltr">
                      حساب المتجر: {tenant.settings.bankakAccount}
                    </span>
                  ) : (
                    <span className="text-[11px] text-red-700">ما في حساب بنكك مسجّل للمتجر</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  حوّل على رقم المتجر فوق، وبعدين اكتب رقم العملية الظاهر في تطبيق بنكك.
                </p>
                <input
                  type="text"
                  value={bankakRef}
                  onChange={(e) => setBankakRef(e.target.value)}
                  placeholder="رقم العملية من إشعار بنكك"
                  className="w-full px-3 py-1.5 font-mono text-xs border border-slate-300 rounded bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ملاحظات إضافية:</label>
                <textarea
                  rows={2}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="أي تعليمات خاصة بالطلب أو مواعيد الاستلام..."
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isOrdering}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                {isOrdering ? 'جاري الإرسال...' : 'تأكيد وإرسال الطلب'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Success notification */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900">تم استلام طلبك بنجاح!</h3>
            <p className="text-xs text-slate-600">
              رقم الطلب الخاص بك هو:{' '}
              <strong className="font-mono text-slate-900">{orderSuccess.orderNumber}</strong>. سنتواصل معك هاتفياً على الرقم{' '}
              <strong className="font-mono">{orderSuccess.customerPhone}</strong> لتأكيد التسليم.
            </p>
            <button
              onClick={() => setOrderSuccess(null)}
              className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
            >
              حسناً
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
