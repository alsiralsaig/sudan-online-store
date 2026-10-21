import React, { useState } from 'react';
import {
  X,
  Plus,
  ShoppingBag,
  Megaphone,
  CheckCircle,
  Camera,
  MapPin,
  Phone,
  Tag,
  DollarSign,
  Clock,
  Sparkles,
  HelpCircle,
  Building,
} from 'lucide-react';
import type { ClientMarketAd, ClientPurchaseRequest } from '../types.ts';
import { MediaUploader, type UploadedMedia } from './MediaUploader.tsx';
import { api } from '../../lib/api.ts';
import { getOwnerToken } from '../lib/ownerToken.ts';

interface ClientCreateAdOrRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdCreated: (ad: ClientMarketAd) => void;
  pricing?: { standardFeeSdg: number; vipFeeSdg: number; currency: string };
  onRequestCreated: (request: ClientPurchaseRequest) => void;
}

export const ClientCreateAdOrRequestModal: React.FC<ClientCreateAdOrRequestModalProps> = ({
  isOpen,
  onClose,
  onAdCreated,
  onRequestCreated,
  pricing = { standardFeeSdg: 0, vipFeeSdg: 5000, currency: 'SDG' },
}) => {
  const [activeTab, setActiveTab] = useState<'ad' | 'request'>('ad');
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Ad form state
  const [adForm, setAdForm] = useState({
    title: '',
    category: 'إلكترونيات',
    priceSdg: '',
    location: 'الخرطوم',
    phone: '',
    description: '',
    isVip: false,
  });

  const [adMedia, setAdMedia] = useState<UploadedMedia | null>(null);
  const videoUrl: string | null = null;

  // Purchase request form state
  const [requestForm, setRequestForm] = useState({
    itemName: '',
    category: 'سلع ومواد تموينية',
    quantity: '1',
    budgetSdg: '',
    city: 'الخرطوم',
    customerName: '',
    customerPhone: '',
    urgency: 'this_week' as 'urgent' | 'this_week' | 'flexible',
    notes: '',
  });

  if (!isOpen) return null;

  const sampleImages = [
    { label: 'سيارة حديثة', url: '/assets/images/albander_hyundai_car_1792184093653.jpg' },
    { label: 'لابتوب وماك بوك', url: '/assets/images/albander_macbook_laptop_1792184108039.jpg' },
    { label: 'شاحنة بيك آب', url: '/assets/images/albander_pickup_truck_1792184123630.jpg' },
    { label: 'مواد تموينية وغذائية', url: '/assets/images/product_cooking_oil_1792173269992.jpg' },
  ];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const feeSdg = adForm.isVip ? pricing.vipFeeSdg : pricing.standardFeeSdg;

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!adForm.title.trim() || !adForm.phone.trim()) return;
    if (!adMedia) {
      setSubmitError('أضف صورة أو فيديو للإعلان أولاً.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.createMarketAd({
        title: adForm.title,
        category: adForm.category,
        priceSdg: Number(adForm.priceSdg) || 0,
        location: adForm.location,
        phone: adForm.phone,
        whatsapp: adForm.phone,
        description: adForm.description,
        imageUrl: adMedia.kind === 'image' ? adMedia.url : '',
        videoUrl: adMedia.kind === 'video' ? adMedia.url : undefined,
        isVip: adForm.isVip,
        ownerToken: getOwnerToken(),
      });

      setIsSuccess(true);
      setSuccessMessage(
        res.ad.feeSdg > 0
          ? `تم إرسال إعلانك للإدارة. رسوم النشر ${res.ad.feeSdg.toLocaleString('en-US')} ج.س — سيظهر في السوق بعد الموافقة وتأكيد السداد.`
          : 'تم إرسال إعلانك للإدارة. سيظهر في السوق بعد الموافقة.'
      );
    } catch (err) {
      setSubmitError((err as Error).message || 'تعذر إرسال الإعلان. تحقق من الاتصال وحاول مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.itemName.trim() || !requestForm.customerPhone.trim()) return;

    const newRequest: ClientPurchaseRequest = {
      id: `rfq_${Date.now()}`,
      itemName: requestForm.itemName,
      category: requestForm.category,
      quantity: Number(requestForm.quantity) || 1,
      budgetSdg: Number(requestForm.budgetSdg) || undefined,
      city: requestForm.city,
      customerName: requestForm.customerName || 'عميل سند',
      customerPhone: requestForm.customerPhone,
      urgency: requestForm.urgency,
      notes: requestForm.notes,
      createdAt: new Date().toISOString(),
      status: 'open',
      quotesCount: 0,
    };

    onRequestCreated(newRequest);
    setIsSuccess(true);
    setSuccessMessage('تم إرسال طلب الشراء للمتاجر المسجلة! سيتواصل معك التجار بعروض الأسعار.');
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">إضافة جديدة في السوق</h3>
              <p className="text-xs text-slate-500">اختر نوع الإضافة للمتابعة</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('ad')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'ad'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>إضافة إعلان جديد 📢</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('request')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'request'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>طلب شراء من المتاجر 🛍️</span>
          </button>
        </div>

        {/* Success Alert */}
        {isSuccess ? (
          <div className="py-10 text-center space-y-3 animate-in fade-in duration-300">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h4 className="text-base font-bold text-slate-900">{successMessage}</h4>
            <p className="text-xs text-slate-400">جارٍ التحديث...</p>
          </div>
        ) : activeTab === 'ad' ? (
          /* Form 1: Add New Ad */
          <form onSubmit={handleCreateAd} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                عنوان الإعلان <span className="text-red-500">*</span>:
              </label>
              <input
                type="text"
                required
                placeholder="مثال: مكيفات آيس فخامة وجودة أو سيارة توسان 2022"
                value={adForm.title}
                onChange={(e) => setAdForm({ ...adForm, title: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">القسم:</label>
                <select
                  value={adForm.category}
                  onChange={(e) => setAdForm({ ...adForm, category: e.target.value })}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="الإلكترونيات">الإلكترونيات والأجهزة</option>
                  <option value="السيارات والمركبات">السيارات والمركبات</option>
                  <option value="قسم الخدمات">قسم الخدمات</option>
                  <option value="العقارات والأراضي">العقارات والأراضي</option>
                  <option value="سلع ومواد تموينية">سلع ومواد تموينية</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المدينة:</label>
                <select
                  value={adForm.location}
                  onChange={(e) => setAdForm({ ...adForm, location: e.target.value })}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="الخرطوم">الخرطوم</option>
                  <option value="أم درمان">أم درمان</option>
                  <option value="بورتسودان">بورتسودان</option>
                  <option value="القضارف">القضارف</option>
                  <option value="عطبرة">عطبرة</option>
                  <option value="كسلا">كسلا</option>
                  <option value="ود مدني">ود مدني</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">السعر (ج.س):</label>
                <input
                  type="number"
                  placeholder="مثال: 1350000"
                  value={adForm.priceSdg}
                  onChange={(e) => setAdForm({ ...adForm, priceSdg: e.target.value })}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الهاتف أو الواتساب <span className="text-red-500">*</span>:
                </label>
                <input
                  type="tel"
                  required
                  placeholder="09XXXXXXXX"
                  value={adForm.phone}
                  onChange={(e) => setAdForm({ ...adForm, phone: e.target.value })}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Media Upload */}
            <MediaUploader value={adMedia} onChange={setAdMedia} />

            {/* Ready-made samples as a fallback */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
                أو اختر صورة جاهزة:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {sampleImages.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setAdMedia({ url: img.url, kind: 'image', previewUrl: img.url })
                    }
                    className={`relative rounded-xl overflow-hidden border-2 aspect-video transition-all ${
                      adMedia?.url === img.url
                        ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] py-0.5 text-center truncate px-1">
                      {img.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* VIP Checkbox */}
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <input
                type="checkbox"
                id="isVipAd"
                checked={adForm.isVip}
                onChange={(e) => setAdForm({ ...adForm, isVip: e.target.checked })}
                className="w-4 h-4 text-amber-600 rounded"
              />
              <label htmlFor="isVipAd" className="text-xs text-amber-950 font-bold flex items-center gap-1 cursor-pointer flex-1">
                <span>👑 تمييز كإعلان VIP في واجهة المتجر الرئيسية</span>
              </label>
              <span className="text-[11px] font-black text-amber-700 shrink-0">
                {pricing.vipFeeSdg > 0
                  ? `+${pricing.vipFeeSdg.toLocaleString('en-US')} ج.س`
                  : 'مجاني'}
              </span>
            </div>

            {/* Publishing fee — the amount the admin will confirm */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-600">رسوم نشر الإعلان:</span>
              <span className="text-xs font-black text-emerald-700">
                {feeSdg > 0 ? `${feeSdg.toLocaleString('en-US')} ج.س` : 'مجاناً'}
              </span>
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed">
              يُرسل الإعلان إلى الإدارة للمراجعة. لا يظهر في السوق إلا بعد الموافقة،
              {feeSdg > 0 ? ' ويُطلب سداد الرسوم قبل النشر.' : ' والنشر مجاني.'}
            </p>

            {submitError && (
              <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="animate-pulse">جارٍ الإرسال للمراجعة…</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>إرسال الإعلان للمراجعة</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* Form 2: Request Purchase from Registered Stores (RFQ) */
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl text-xs text-teal-950 space-y-1">
              <strong className="block font-bold">خدمة «اطلب ووفر» من تجار المنصة:</strong>
              <p className="text-[11px] text-teal-800">
                أرسل مواصفات السلعة أو الغرض الذي ترغب بشرائه، وسيقوم تجار سند المسجلين بمراجعة طلبك
                وتقديم عروض الأسعار لك عبر الواتساب فوراً.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم الغرض أو السلعة المطلوبة <span className="text-red-500">*</span>:
              </label>
              <input
                type="text"
                required
                placeholder="مثال: شاشة سامسونج 55 بوصة أو 10 جوالات دقيق سيقا"
                value={requestForm.itemName}
                onChange={(e) => setRequestForm({ ...requestForm, itemName: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الكمية المطلوبة:</label>
                <input
                  type="number"
                  min="1"
                  value={requestForm.quantity}
                  onChange={(e) => setRequestForm({ ...requestForm, quantity: e.target.value })}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الميزانية التقريبية (ج.س):</label>
                <input
                  type="number"
                  placeholder="اختياري"
                  value={requestForm.budgetSdg}
                  onChange={(e) => setRequestForm({ ...requestForm, budgetSdg: e.target.value })}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المدينة المفضلة:</label>
                <select
                  value={requestForm.city}
                  onChange={(e) => setRequestForm({ ...requestForm, city: e.target.value })}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white"
                >
                  <option value="الخرطوم">الخرطوم</option>
                  <option value="أم درمان">أم درمان</option>
                  <option value="بورتسودان">بورتسودان</option>
                  <option value="القضارف">القضارف</option>
                  <option value="عطبرة">عطبرة</option>
                  <option value="ود مدني">ود مدني</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سرعة التوفير المطلوبة:</label>
                <select
                  value={requestForm.urgency}
                  onChange={(e) => setRequestForm({ ...requestForm, urgency: e.target.value as any })}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white"
                >
                  <option value="urgent">عاجل اليوم ⚡</option>
                  <option value="this_week">خلال هذا الأسبوع</option>
                  <option value="flexible">غير مستعجل (أفضل سعر)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسمك الكريم:</label>
                <input
                  type="text"
                  placeholder="مثال: محمد علي"
                  value={requestForm.customerName}
                  onChange={(e) => setRequestForm({ ...requestForm, customerName: e.target.value })}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الواتساب للتواصل <span className="text-red-500">*</span>:
                </label>
                <input
                  type="tel"
                  required
                  placeholder="09XXXXXXXX"
                  value={requestForm.customerPhone}
                  onChange={(e) => setRequestForm({ ...requestForm, customerPhone: e.target.value })}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات أو مواصفات إضافية:</label>
              <textarea
                rows={2}
                placeholder="أية تفاصيل إضافية عن الماركة، الحالة (جديد أو مستعمل)، أو شروط التسليم..."
                value={requestForm.notes}
                onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>إرسال طلب الشراء للمتاجر</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
