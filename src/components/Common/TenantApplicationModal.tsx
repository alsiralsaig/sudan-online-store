import React, { useEffect, useState } from 'react';
import {
  X,
  Store,
  User,
  MapPin,
  Phone,
  Mail,
  GitBranch,
  Layers,
  Send,
  CheckCircle2,
  AlertCircle,
  Wallet,
} from 'lucide-react';
import { api } from '../../lib/api.ts';

interface TenantApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which app opened the form — kept for reporting. */
  source?: 'client' | 'merchant';
}

const FALLBACK_WILAYAS = [
  'الخرطوم', 'الجزيرة', 'النيل الأزرق', 'النيل الأبيض', 'البحر الأحمر', 'كسلا',
  'القضارف', 'سنار', 'الشمالية', 'نهر النيل', 'شمال كردفان', 'جنوب كردفان',
  'غرب كردفان', 'شمال دارفور', 'جنوب دارفور', 'شرق دارفور', 'غرب دارفور', 'وسط دارفور',
];

const FALLBACK_TYPES = [
  'بقالات ومواد غذائية', 'مطاعم وكافيهات', 'ملابس وأحذية', 'إلكترونيات وجوالات',
  'صيدلية ومستلزمات طبية', 'أجهزة منزلية', 'مواد بناء', 'قطع غيار وسيارات',
  'مستحضرات تجميل', 'مكتبات وأدوات مدرسية', 'خدمات أخرى',
];

/**
 * «طلب متجر» — a shop applies to join Sanad.
 * The request is reviewed by the admin; on approval the applicant receives
 * an activation code and the registration fee amount.
 */
export const TenantApplicationModal: React.FC<TenantApplicationModalProps> = ({
  isOpen,
  onClose,
  source = 'client',
}) => {
  const [form, setForm] = useState({
    storeName: '',
    ownerName: '',
    wilaya: '',
    city: '',
    phone: '',
    email: '',
    branchesCount: '1',
    businessType: '',
    /** نوع الحساب: قطاعي / جملة / مورد — يحدد الطبقة واللي يشوفه المتجر */
    accountSegment: '',
    notes: '',
  });
  const [wilayas, setWilayas] = useState<string[]>(FALLBACK_WILAYAS);
  const [businessTypes, setBusinessTypes] = useState<string[]>(FALLBACK_TYPES);
  const [fee, setFee] = useState(50000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ message: string; storeName: string; fee: number; id: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    api
      .getTenantApplicationConfig()
      .then((cfg) => {
        setFee(cfg.registrationFeeSdg);
        if (cfg.wilayas?.length) setWilayas(cfg.wilayas);
        if (cfg.businessTypes?.length) setBusinessTypes(cfg.businessTypes);
      })
      .catch(() => {
        /* keep the defaults — the form still works offline */
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.storeName.trim().length < 3) return setError('اكتب اسم المتجر (3 أحرف على الأقل).');
    if (form.ownerName.trim().length < 3) return setError('اكتب اسم صاحب المتجر.');
    if (!form.accountSegment) return setError('اختر نوع الحساب: قطاعي أو جملة أو مورد.');
    if (!form.wilaya) return setError('اختر الولاية.');
    if (form.city.trim().length < 2) return setError('اكتب المدينة أو المحلية.');
    if (form.phone.replace(/\D/g, '').length < 9) return setError('رقم الهاتف غير صحيح.');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('البريد الإلكتروني غير صحيح.');

    setIsSubmitting(true);
    try {
      const res = await api.submitTenantApplication({
        ...form,
        branchesCount: Number(form.branchesCount) || 1,
        source,
      });
      setResult({
        message: res.message,
        storeName: res.application.storeName,
        fee: res.application.registrationFeeSdg,
        id: res.application.id,
      });
      setForm({
        storeName: '', ownerName: '', wilaya: '', city: '', phone: '',
        email: '', branchesCount: '1', businessType: '', accountSegment: '', notes: '',
      });
    } catch (err) {
      setError((err as Error).message || 'تعذر إرسال الطلب، تحقق من الاتصال وحاول مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    'w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 placeholder:text-slate-400';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-l from-emerald-700 via-emerald-800 to-teal-900 p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm">طلب فتح متجر على منصة سند</h3>
              <p className="text-[11px] text-emerald-100/90 mt-0.5">
                املأ البيانات، وتواصل معك الإدارة بعد المراجعة
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h4 className="text-base font-black text-slate-900">تم استلام طلبك بنجاح</h4>
            <p className="text-xs text-slate-600 leading-relaxed">{result.message}</p>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-right space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">اسم المتجر</span>
                <span className="font-bold text-slate-800">{result.storeName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">قيمة التسجيل</span>
                <span className="font-black text-emerald-700">{result.fee.toLocaleString('en-US')} ج.س</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">رقم الطلب</span>
                <span className="font-mono text-slate-700">{result.id}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              بعد الموافقة تُرسل لك الإدارة <b>كود الدخول</b> الخاص بمتجرك لتسجيله رسمياً على المنصة.
              احتفظ برقم الطلب للمتابعة.
            </p>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
            >
              إغلاق
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
              <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> قيمة تسجيل المتجر
              </span>
              <span className="text-xs font-black text-emerald-700">{fee.toLocaleString('en-US')} ج.س</span>
            </div>

            {/* نوع الحساب: مربع واحد، والضغط عليه يفتح الثلاثة */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3 text-emerald-600" /> نوع الحساب <span className="text-red-500">*</span>
              </label>
              <select
                value={form.accountSegment}
                onChange={(e) => set('accountSegment', e.target.value)}
                className={`${fieldClass} font-bold`}
              >
                <option value="">اختر النوع — قطاعي / جملة / مورد</option>
                <option value="retailer">قطاعي — يبيع للجمهور</option>
                <option value="wholesaler">جملة — يبيع لتجار القطاعي</option>
                <option value="supplier">مورد — بضاعته تظهر لتجار الجملة فقط</option>
              </select>
              <p className="text-[10.5px] text-slate-500 leading-5 mt-1">
                {form.accountSegment === 'retailer'
                  ? 'تشتري من تجار الجملة وتربط الأصناف بهامش ربح. (مع باقة VIP يمكنك الشراء من المورد مباشرة.)'
                  : form.accountSegment === 'wholesaler'
                    ? 'تربط أصنافك بالمورد، وتظهر أصنافك لتجار القطاعي للربط بها.'
                    : form.accountSegment === 'supplier'
                      ? 'أصنافك تظهر لتجار الجملة فقط، ولا تظهر لتجار القطاعي ولا للجمهور.'
                      : 'النوع يحدد من يرى بضاعتك: المورد ← الجملة ← القطاعي.'}
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Store className="w-3 h-3 text-emerald-600" /> اسم المتجر <span className="text-red-500">*</span>
              </label>
              <input
                value={form.storeName}
                onChange={(e) => set('storeName', e.target.value)}
                placeholder="مثال: بقالة البركة"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3 h-3 text-emerald-600" /> اسم صاحب المتجر <span className="text-red-500">*</span>
              </label>
              <input
                value={form.ownerName}
                onChange={(e) => set('ownerName', e.target.value)}
                placeholder="الاسم الكامل"
                className={fieldClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-600" /> الولاية <span className="text-red-500">*</span>
                </label>
                <select value={form.wilaya} onChange={(e) => set('wilaya', e.target.value)} className={fieldClass}>
                  <option value="">اختر الولاية</option>
                  {wilayas.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-600" /> المدينة / المحلية <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  placeholder="مثال: كسلا"
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-600" /> رقم الهاتف <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="09XXXXXXXX"
                  inputMode="tel"
                  className={`${fieldClass} font-mono`}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-emerald-600" /> البريد الإلكتروني
                  <span className="text-[10px] text-slate-400">(اختياري)</span>
                </label>
                <input
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="name@example.com"
                  inputMode="email"
                  dir="ltr"
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <GitBranch className="w-3 h-3 text-emerald-600" /> عدد الفروع <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.branchesCount}
                  onChange={(e) => set('branchesCount', e.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  placeholder="1"
                  className={`${fieldClass} font-mono`}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-emerald-600" /> نوع النشاط
                </label>
                <select value={form.businessType} onChange={(e) => set('businessType', e.target.value)} className={fieldClass}>
                  <option value="">اختر النشاط</option>
                  {businessTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 mb-1">ملاحظات إضافية (اختياري)</label>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
                placeholder="أي تفاصيل تساعدنا في تجهيز حسابك…"
                className={fieldClass}
              />
            </div>

            {error && (
              <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-xl p-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-black shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="animate-pulse">جارٍ إرسال الطلب…</span>
              ) : (
                <>
                  <Send className="w-4 h-4" /> إرسال طلب المتجر للإدارة
                </>
              )}
            </button>

            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              لا يُفتح المتجر إلا بعد موافقة إدارة سند وسداد قيمة التسجيل.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
