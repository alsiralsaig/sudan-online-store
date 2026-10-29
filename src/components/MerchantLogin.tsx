import React, { useState } from 'react';
import { api } from '../lib/api.ts';
import { KeyRound, LogIn, ShieldAlert, Store, ArrowRight, Copy, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * خطوة التفعيل داخل شاشة الدخول
 * ------------------------------
 * المشكلة اللي أوقفت التاجر: زر «تفعيل متجر بكود الدخول» كان موجوداً **داخل**
 * تطبيق التاجر فقط، والدخول يحتاج كوداً… فلولاه لا تصل للزر أبداً (حلقة مغلقة).
 * الحل: كود الطلب (SND-XXXX-XXXX) صار يُفعَّل من شاشة الدخول نفسها، ويظهر كود
 * الدخول الطويل فوراً، ويدخل به بضغطة.
 */
export function MerchantLogin({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'login' | 'activate'>('login');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [appCode, setAppCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [actErr, setActErr] = useState('');
  const [issued, setIssued] = useState<{ code: string; storeName: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e?: React.FormEvent, overrideCode?: string) => {
    e?.preventDefault();
    const value = (overrideCode ?? code).trim();
    setBusy(true);
    setErr('');
    try {
      /*
       * نمسح جلسة الجهاز القديمة قبل الدخول.
       * ليه: التاجر دخل بكود متجر «الأناقة» فتح له «برادايس» — لأن معرّف
       * المتجر/الموظف كان محفوظاً من جلسة سابقة على نفس المتصفح.
       */
      api.clearLocalSession();
      const res: any = await api.merchantLogin(value);
      if (res?.tenant?.id) api.setTenantId(res.tenant.id);
      onSuccess();
    } catch (e: any) {
      setErr(e.message || 'فشل تسجيل الدخول');
    } finally {
      setBusy(false);
    }
  };

  /**
   * تفعيل + دخول بخطوة واحدة بكود واحد.
   * المستخدم يكتب الكود الذي وصله من المنصة → يُنشأ المتجر (إن لم يكن) →
   * يدخل فوراً. لا كود ثانٍ ولا شاشات وسيطة.
   */
  const activate = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = appCode.trim().toUpperCase();
    if (value.length < 6) {
      setActErr('اكتب الكود كما وصلك من سند (مثال: SND-XXXX-XXXX-XXXX).');
      return;
    }
    setActivating(true);
    setActErr('');
    try {
      api.clearLocalSession();
      try {
        const res: any = await api.activateTenantStore(value);
        if (res?.tenant?.id) api.setTenantId(res.tenant.id);
        setIssued({ code: value, storeName: res?.tenant?.name || '' });
      } catch {
        /* مفعّل من قبل أو الكود كود دخول — ندخله مباشرة */
      }
      const login: any = await api.merchantLogin(value);
      if (login?.tenant?.id) api.setTenantId(login.tenant.id);
      onSuccess();
    } catch (e: any) {
      setActErr(e.message || 'تعذّر التفعيل — تحقق من الكود والاتصال.');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-[28px] p-7 space-y-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sky-600 flex items-center justify-center text-white">
            {mode === 'login' ? <KeyRound className="w-6 h-6" /> : <Store className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-[17px] font-black text-slate-900">
              {mode === 'login' ? 'دخول المتجر' : 'تفعيل متجر جديد'}
            </h1>
            <p className="text-[12px] text-slate-500">
              {mode === 'login'
                ? 'أدخل كود متجرك الخاص (يبدأ بـ SND-) للدخول لإدارة متجرك فقط'
                : 'عندك كود طلب من سند؟ فعّل متجرك واحصل على كود الدخول فوراً'}
            </p>
          </div>
        </div>

        {mode === 'login' ? (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 flex gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-5 text-slate-700">
                كل تاجر يرى متجره فقط. لا تظهر إدارة المنصة ولا قائمة التجار داخل تطبيق التاجر.
              </p>
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SND-XXXX-XXXX"
              dir="ltr"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3.5 font-mono text-center tracking-widest focus:outline-none focus:border-sky-500"
            />
            {err && <p className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2 text-xs font-bold leading-relaxed">{err}</p>}
            <p className="text-[10.5px] text-slate-500 leading-relaxed">
              كود واحد فقط لكل متجر — نفس الكود الذي وصلك من سند. اكتبه كما هو.
            </p>
            <button
              type="submit"
              disabled={busy || code.trim().length < 6}
              className="w-full rounded-2xl bg-sky-600 text-white py-3.5 font-black disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" /> {busy ? 'جارٍ التحقق...' : 'دخول المتجر'}
            </button>

            {/* المخرج من الحلقة المغلقة: التفعيل متاح من هنا قبل الدخول */}
            <button
              type="button"
              onClick={() => { setMode('activate'); setErr(''); }}
              className="w-full rounded-2xl border-2 border-sky-200 bg-sky-50 text-sky-800 py-3 font-black text-[13px] flex items-center justify-center gap-2"
            >
              <Store className="w-4 h-4" /> أول مرة؟ فعّل متجري بنفس الكود
            </button>

            <p className="text-[11px] text-slate-400 text-center">ليس لديك رمز؟ تواصل مع إدارة سند عبر واتساب للحصول على رمز متجرك.</p>
          </form>
        ) : (
          <form onSubmit={activate} className="space-y-4">
            <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3">
              <p className="text-[11.5px] leading-6 text-slate-700">
                اكتب <b>نفس الكود</b> الذي وصلك من إدارة سند بعد الموافقة.
                هذا الكود الوحيد: يُفعّل متجرك ويدخلك إليه مباشرة.
              </p>
            </div>

            <input
              value={appCode}
              onChange={(e) => setAppCode(e.target.value)}
              placeholder="SND-XXXX-XXXX-XXXX"
              dir="ltr"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3.5 font-mono text-center tracking-widest focus:outline-none focus:border-sky-500"
            />

            {actErr && <p className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2 text-xs font-bold leading-relaxed">{actErr}</p>}

            <button
              type="submit"
              disabled={activating || appCode.trim().length < 6}
              className="w-full rounded-2xl bg-emerald-700 text-white py-3.5 font-black disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {activating ? 'جارٍ التفعيل والدخول…' : 'تفعيل ودخول المتجر'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('login'); setActErr(''); }}
              className="w-full text-[12px] font-bold text-slate-500 flex items-center justify-center gap-1.5 py-1"
            >
              <ArrowRight className="w-3.5 h-3.5" /> رجوع لشاشة الدخول
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api.adminLogin(pw);
      onSuccess();
    } catch (e: any) { setErr(e.message || 'كلمة المرور غير صحيحة'); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4" dir="rtl">
      <form onSubmit={submit} className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-[28px] p-7 space-y-5">
        <h1 className="text-[16px] font-black text-white">دخول الإدارة العليا — منصة سند</h1>
        <p className="text-[11px] text-slate-400">مخصص لمالك المنصة فقط. التجار لا يرون هذه الشاشة داخل متاجرهم.</p>
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="كلمة مرور الإدارة"
          className="w-full rounded-2xl border border-slate-700 bg-slate-900 text-white px-4 py-3.5 focus:outline-none focus:border-sky-500" />
        {err && <p className="rounded-xl bg-rose-950 text-rose-200 px-3 py-2 text-xs font-bold border border-rose-900">{err}</p>}
        <button disabled={busy} className="w-full rounded-2xl bg-amber-500 text-slate-950 py-3.5 font-black disabled:opacity-50">{busy ? '...' : 'دخول الإدارة'}</button>
      </form>
    </div>
  );
}
