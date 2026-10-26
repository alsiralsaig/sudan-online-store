import React, { useEffect, useState } from 'react';
import { X, Plus, CheckCircle, Tag } from 'lucide-react';
import { MediaUploader, type UploadedMedia } from '../../SanadClientApp/components/MediaUploader.tsx';
import { api } from '../../lib/api.ts';

/** نفس جهاز المتجر — الإعلانات مربوطة بالكود ده مش بجهاز الزبون */
export const merchantAdOwnerToken = (): string => {
  const id = api.getTenantId() || 'store';
  const token = `tenant:${id}`;
  return token.length >= 8 ? token : `${token}________`.slice(0, 12);
};

interface Plan {
  id: string;
  label: string;
  days: number;
  priceSdg: number;
  available: boolean;
  note?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  publisherName?: string;
}

const FALLBACK_PLANS: Plan[] = [
  { id: 'monthly', label: 'خطة شهرية', days: 30, priceSdg: 14000, available: true },
  { id: 'quarterly', label: 'خطة 3 شهور', days: 90, priceSdg: 0, available: false, note: 'مجانية: لاحقاً' },
  { id: 'biannual', label: 'خطة 6 شهور', days: 180, priceSdg: 60000, available: true },
  { id: 'yearly', label: 'خطة سنوية', days: 365, priceSdg: 100000, available: true },
];

export const MerchantCreateAdModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onCreated,
  publisherName = 'متجر سند',
}) => {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [vipFee, setVipFee] = useState(5000);
  const [form, setForm] = useState({
    title: '',
    category: 'الإلكترونيات',
    priceSdg: '',
    location: 'الخرطوم',
    phone: '',
    description: '',
    isVip: false,
    planId: 'monthly',
  });
  const [media, setMedia] = useState<UploadedMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setDone('');
    setError('');
    api
      .getMarketAds(merchantAdOwnerToken())
      .then((res) => {
        const p = res.pricing as any;
        if (p?.plans?.length) setPlans(p.plans);
        if (typeof p?.vipFeeSdg === 'number') setVipFee(p.vipFeeSdg);
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selected = plans.find((p) => p.id === form.planId) || plans[0];
  const fee = (selected?.priceSdg || 0) + (form.isVip ? vipFee : 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || form.title.trim().length < 4) {
      setError('عنوان الإعلان مطلوب (4 أحرف على الأقل).');
      return;
    }
    if (!form.phone.trim() || form.phone.trim().length < 9) {
      setError('رقم الهاتف أو الواتساب مطلوب.');
      return;
    }
    if (!media) {
      setError('أضف صورة أو فيديو للإعلان أولاً.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.createMarketAd({
        title: form.title.trim(),
        category: form.category,
        priceSdg: Number(form.priceSdg) || 0,
        location: form.location,
        phone: form.phone.trim(),
        whatsapp: form.phone.trim(),
        description: form.description,
        imageUrl: media.kind === 'image' ? media.url : media.posterUrl || '',
        videoUrl: media.kind === 'video' ? media.url : undefined,
        isVip: form.isVip,
        planId: form.planId,
        publisherName,
        ownerToken: merchantAdOwnerToken(),
      });
      setDone(
        res.ad?.feeSdg > 0
          ? `اترسل للإدارة. رسوم النشر ${Number(res.ad.feeSdg).toLocaleString('en-US')} ج.س — يظهر بعد الموافقة.`
          : 'اترسل للإدارة. يظهر في السوق بعد الموافقة.'
      );
      onCreated();
    } catch (err) {
      setError((err as Error).message || 'تعذر إرسال الإعلان.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
          <h3 className="text-sm font-black text-slate-900">إضافة إعلان في السوق</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {done ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-slate-900 leading-relaxed">{done}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-black"
              >
                تمام
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                إعلان متجرك يظهر في صفحة سوق سند بعد موافقة الإدارة. ما بننشر واتساب لبائع وهمي.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عنوان الإعلان <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="مثال: مكيفات آيس أصلية مع تركيب"
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">القسم</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-2 py-2.5 text-xs rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="الإلكترونيات">الإلكترونيات والأجهزة</option>
                    <option value="السيارات والمركبات">السيارات والمركبات</option>
                    <option value="قسم الخدمات">قسم الخدمات</option>
                    <option value="العقارات والأراضي">العقارات والأراضي</option>
                    <option value="سلع ومواد تموينية">سلع ومواد تموينية</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المدينة</label>
                  <select
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full px-2 py-2.5 text-xs rounded-xl border border-slate-200 bg-white"
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">السعر (ج.س)</label>
                  <input
                    type="number"
                    value={form.priceSdg}
                    onChange={(e) => setForm({ ...form, priceSdg: e.target.value })}
                    placeholder="اختياري"
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    واتساب / هاتف <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="09XXXXXXXX"
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وصف مختصر</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <MediaUploader value={media} onChange={setMedia} disabled={busy} />

              <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <input
                  type="checkbox"
                  id="merchantVipAd"
                  checked={form.isVip}
                  onChange={(e) => setForm({ ...form, isVip: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="merchantVipAd" className="text-xs font-bold text-amber-950 flex-1">
                  تمييز VIP في الرئيسية
                </label>
                <span className="text-[11px] font-black text-amber-700">
                  {vipFee > 0 ? `+${vipFee.toLocaleString('en-US')} ج.س` : 'مجاني'}
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-emerald-600" /> خطة النشر
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {plans.map((plan) => {
                    const active = form.planId === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        disabled={!plan.available}
                        onClick={() => setForm({ ...form, planId: plan.id })}
                        className={`text-right p-2 rounded-xl border ${
                          active
                            ? 'border-emerald-600 bg-emerald-50'
                            : plan.available
                            ? 'border-slate-200 bg-white'
                            : 'border-dashed border-amber-300 bg-amber-50/60 opacity-80 cursor-not-allowed'
                        }`}
                      >
                        <span className="text-[11px] font-black text-slate-800">{plan.label}</span>
                        <span className="block text-[10px] text-slate-500">
                          {plan.available
                            ? `${plan.priceSdg > 0 ? `${plan.priceSdg.toLocaleString('en-US')} ج.س` : 'مجاناً'} • ${plan.days} يوم`
                            : plan.note || 'لاحقاً'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[11px] font-black text-slate-700">إجمالي الرسوم</span>
                <span className="text-xs font-black text-emerald-700">
                  {fee > 0 ? `${fee.toLocaleString('en-US')} ج.س` : 'مجاناً'}
                </span>
              </div>

              {error && (
                <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Plus className="w-4 h-4" />
                {busy ? 'جارٍ الإرسال…' : 'إرسال الإعلان للمراجعة'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default MerchantCreateAdModal;
