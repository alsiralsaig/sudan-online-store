import React, { useState, useEffect } from 'react';
import {
  Search,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  Building,
  CreditCard,
  ExternalLink,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import type { StorefrontOrder, Branch } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface ClientOrderTrackerProps {
  branches: Branch[];
  initialOrderNumber?: string;
  currency?: string;
}

export const ClientOrderTracker: React.FC<ClientOrderTrackerProps> = ({
  branches,
  initialOrderNumber = '',
  currency = 'SDG',
}) => {
  const [query, setQuery] = useState(initialOrderNumber);
  const [orders, setOrders] = useState<StorefrontOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<StorefrontOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Load orders matching query or recent orders
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    try {
      const res = await api.getStorefrontOrders();
      const allOrders = res.orders || [];
      const cleanQ = query.trim().toLowerCase();
      const matched = allOrders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(cleanQ) ||
          o.customerPhone.includes(cleanQ) ||
          o.id.toLowerCase().includes(cleanQ)
      );
      setOrders(matched);
      if (matched.length > 0) {
        setSelectedOrder(matched[0]);
      } else {
        setSelectedOrder(null);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrderNumber) {
      setQuery(initialOrderNumber);
      handleSearch();
    } else {
      // Auto-load recent orders for convenience
      api.getStorefrontOrders().then((res) => {
        if (res.orders && res.orders.length > 0) {
          setOrders(res.orders.slice(0, 5));
          setSelectedOrder(res.orders[0]);
        }
      }).catch(() => {});
    }
  }, [initialOrderNumber]);

  const getStepIndex = (status: StorefrontOrder['status']) => {
    switch (status) {
      case 'new':
        return 0;
      case 'preparing':
        return 1;
      case 'ready':
        return 2;
      case 'delivered':
        return 3;
      case 'cancelled':
        return -1;
      default:
        return 0;
    }
  };

  const currentStep = selectedOrder ? getStepIndex(selectedOrder.status) : 0;

  const steps = [
    { title: 'تم استلام الطلب', desc: 'تم توثيق طلبك بنجاح في النظام' },
    { title: 'قيد التجهيز والتعبئة', desc: 'يقوم فريق الفرع بإعداد وتجهيز المواد' },
    { title: 'جاهز للاستلام / مع المندوب', desc: 'في طريق التوصيل أو جاهز بالفرع' },
    { title: 'تم التسليم بنجاح', desc: 'تم استلام الطلب ومطابقة الدفعة' },
  ];

  const getBranch = (branchId?: string) => {
    return branches.find((b) => b.id === branchId) || branches[0];
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Search Header Card */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-2xs space-y-4">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">تتبع حالة طلبك المباشرة</h2>
          <p className="text-xs text-slate-500">
            أدخل رقم الطلب (مثل: ORD-2026-894) أو رقم هاتفك لمعرفة المرحلة الحالية فورياً
          </p>
        </div>

        <form onSubmit={handleSearch} className="max-w-lg mx-auto flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="اكتب رقم الطلب أو رقم الهاتف..."
              className="w-full pl-4 pr-10 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono text-slate-900"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl flex items-center gap-2 transition-all shadow-xs"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <span>تتبع</span>
            )}
          </button>
        </form>

        {/* Recent orders pill selector if available */}
        {orders.length > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2 overflow-x-auto text-xs">
            <span className="text-slate-400 font-medium">الطلبات المطابقة:</span>
            {orders.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedOrder(o)}
                className={`px-3 py-1 rounded-full font-mono text-xs font-bold transition-all ${
                  selectedOrder?.id === o.id
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {o.orderNumber}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Order Detailed View */}
      {selectedOrder ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-6 p-6 md:p-8">
          {/* Top Status Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">رقم الطلب:</span>
                <span className="text-xl font-black font-mono text-slate-900">
                  {selectedOrder.orderNumber}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedOrder.status === 'delivered'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedOrder.status === 'ready'
                      ? 'bg-teal-100 text-teal-800'
                      : selectedOrder.status === 'preparing'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {selectedOrder.status === 'delivered'
                    ? 'مكتمل ومسلّم'
                    : selectedOrder.status === 'ready'
                    ? 'جاهز للاستلام'
                    : selectedOrder.status === 'preparing'
                    ? 'قيد التجهيز'
                    : 'طلب جديد'}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                تاريخ الطلب: {new Date(selectedOrder.createdAt).toLocaleString('ar-SD')}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-slate-400">إجمالي الحساب</div>
                <div className="text-xl font-black text-emerald-700 font-mono">
                  {selectedOrder.totalSdg.toLocaleString()} {currency}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Visual Progress Stepper */}
          <div className="py-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">
              مسار تنفيذ الطلب
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
              {steps.map((step, idx) => {
                const isPassed = currentStep >= idx;
                const isCurrent = currentStep === idx;

                return (
                  <div
                    key={idx}
                    className={`relative p-4 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-emerald-50/80 border-emerald-500 shadow-2xs'
                        : isPassed
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-slate-50/40 border-slate-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
                          isPassed
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isPassed ? '✓' : idx + 1}
                      </div>
                      <span className="font-bold text-xs text-slate-900">{step.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details Grid: Customer & Branch info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-200">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>بيانات العميل والاستلام</span>
              </h4>
              <div className="flex justify-between">
                <span className="text-slate-500">اسم العميل:</span>
                <span className="font-bold text-slate-900">{selectedOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">رقم الهاتف:</span>
                <span className="font-mono text-slate-900">{selectedOrder.customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">طريقة الاستلام:</span>
                <span className="font-medium text-slate-800">
                  {selectedOrder.deliveryMethod === 'pickup' ? 'استلام من الفرع' : 'توصيل لباب المنزل'}
                </span>
              </div>
              {selectedOrder.deliveryAddress && (
                <div className="flex justify-between">
                  <span className="text-slate-500">عنوان التوصيل:</span>
                  <span className="font-medium text-slate-800 text-left">{selectedOrder.deliveryAddress}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-200">
                <Building className="w-4 h-4 text-teal-600" />
                <span>الفرع المسؤول والتواصل</span>
              </h4>
              {(() => {
                const br = getBranch(selectedOrder.pickupBranchId);
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">الفرع:</span>
                      <span className="font-bold text-slate-900">{br.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">المدينة / العنوان:</span>
                      <span className="text-slate-800">{br.city} · {br.address}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">هاتف الفرع:</span>
                      <a href={`tel:${br.phone}`} className="font-mono text-emerald-700 font-bold hover:underline">
                        {br.phone}
                      </a>
                    </div>
                    {br.phone && (
                      <div className="pt-1">
                        <a
                          href={`https://wa.me/${br.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                            `مرحباً، أستفسر عن طلبي رقم: ${selectedOrder.orderNumber}`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>تواصل واتساب مع الفرع</span>
                        </a>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              قائمة المنتجات في الفاتورة ({selectedOrder.items?.length || 0})
            </h4>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {selectedOrder.items?.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50/50 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-mono font-bold flex items-center justify-center text-[11px]">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900">{item.productName}</span>
                      <div className="text-[11px] text-slate-500">
                        الكمية: <strong className="font-mono">{item.quantity}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="font-mono font-black text-slate-900">
                    {(item.totalSdg || item.unitPriceSdg * item.quantity).toLocaleString()} {currency}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : hasSearched ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">لم يتم العثور على أي طلب بهذا الرقم</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            يرجى التأكد من كتابة رقم الطلب بشكل صحيح كما ورد في رسالة التأكيد أو تجربة البحث برقم الهاتف.
          </p>
        </div>
      ) : null}
    </div>
  );
};
