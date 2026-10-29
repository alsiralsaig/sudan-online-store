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
      await api.merchantLogin(value);
      onSuccess();
    } catch (e: any) {
      setErr(e.message || 'فشل تسجيل الدخول');
    } finally {
      setBusy(false);
    }
  };

  const activate = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = appCode.trim().toUpperCase();
    if (value.length < 6) {
      setActErr('اكتب كود الطلب كما وصلك من سند (مثال: SND-XXXX-XXXX).');
      return;
    }
    setActivating(true);
    setActErr('');
    setIssued(null);
    try {
      let storeCode: string | null = null;
      let storeName = '';
      try {
        const res: any = await api.activateTenantStore(value);
        storeCode = res?.merchantCode || null;
        storeName = res?.tenant?.name || '';
      } catch {
        /* المتجر مفعّل من قبل بلا كود → نسترجع الكود */
      }
      if (!storeCode) {
        const rec: any = await api.getStoreAccessCode(value);
        storeCode = rec?.merchantCode || null;
        storeName = rec?.tenant?.name || storeName;
      }
      if (!storeCode) {
        setActErr('المتجر مفعّل لكن له كود دخول مُصدر من قبل — اطلبه من إدارة سند عبر واتساب، أو أعد إصداره من المنصة.');
        return;
      }
      setIssued({ code: storeCode, storeName });
      setCode(storeCode);
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
              placeholder="SND-XXXX-XXXX-..."
              dir="ltr"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3.5 font-mono text-center tracking-widest focus:outline-none focus:border-sky-500"
            />
            {err && <p className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2 text-xs font-bold leading-relaxed">{err}</p>}
            <p className="text-[10.5px] text-slate-500 leading-relaxed">
              الحقل يعرض ٢٤ حرفاً فقط من الكود (الكود ٤٤ حرفاً). تأكد من **نسخ الكود كاملاً** —
              اضغط على الكود في رسالة سند مطوّلاً ثم «نسخ الكل». ولو النسخ ناقص، التطبيق يقبل البداية ويدخلك.
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
              <Store className="w-4 h-4" /> عندي كود طلب — أفعّل متجري الآن
            </button>

            <p className="text-[11px] text-slate-400 text-center">ليس لديك رمز؟ تواصل مع إدارة سند عبر واتساب للحصول على رمز متجرك.</p>
          </form>
        ) : (
          <form onSubmit={activate} className="space-y-4">
            <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3">
              <p className="text-[11px] leading-6 text-slate-700">
                <b>كود الطلب</b> وصلك من سند بعد الموافقة (شكله قصير:
                <span className="font-mono font-bold" dir="ltr"> SND-XXXX-XXXX</span>).
                إدخاله هنا ينشئ متجرك ويُصدر <b>كود الدخول الطويل</b> الذي تدخل به التطبيق.
              </p>
            </div>

            <input
              value={appCode}
              onChange={(e) => setAppCode(e.target.value)}
              placeholder="SND-XXXX-XXXX"
              dir="ltr"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3.5 font-mono text-center tracking-widest focus:outline-none focus:border-sky-500"
            />

            {actErr && <p className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2 text-xs font-bold leading-relaxed">{actErr}</p>}

            {issued && (
              <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3 space-y-2">
                <p className="text-[12px] font-black text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> تم تفعيل «{issued.storeName || 'متجرك'}» — هذا كود الدخول
                </p>
                <div className="flex items-center gap-2">
                  <code dir="ltr" className="flex-1 rounded-xl bg-white border border-emerald-200 px-2 py-2 text-center font-mono text-[9.5px] leading-4 font-bold text-slate-900 break-all" style={{ wordBreak: 'break-all' }}>
                    {issued.code}
                  </code>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard?.writeText(issued.code).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
                    className="shrink-0 rounded-xl bg-emerald-700 px-2.5 py-2 text-[11px] font-bold text-white flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" /> {copied ? 'تم' : 'نسخ'}
                  </button>
                </div>
                <p className="text-[10.5px] leading-relaxed text-emerald-800">
                  احفظه — تحتاجه في كل مرة (أرسله لنفسك في واتساب). اضغط «دخول الآن بهذا الكود» للمتابعة بلا نسخ.
                </p>
              </div>
            )}

            {actErr && appCode.trim().length >= 6 && (
              <button
                type="button"
                disabled={activating}
                onClick={async () => {
                  setActivating(true);
                  setActErr('');
                  try {
                    const rec: any = await api.getStoreAccessCode(appCode.trim().toUpperCase(), true);
                    if (rec?.merchantCode) {
                      setIssued({ code: rec.merchantCode, storeName: rec?.tenant?.name || '' });
                      setCode(rec.merchantCode);
                      setActErr('');
                    } else {
                      setActErr(rec?.merchantCodeMessage || 'تعذّر إصدار كود جديد.');
                    }
                  } catch (e: any) {
                    setActErr(e.message || 'تعذّر إصدار كود جديد.');
                  } finally {
                    setActivating(false);
                  }
                }}
                className="w-full rounded-2xl bg-amber-500 text-slate-950 py-3 font-black text-[12.5px]"
              >
                لم يظهر كود الدخول؟ أعد إصداره بكود الطلب
              </button>
            )}

            {!issued ? (
              <button
                type="submit"
                disabled={activating || appCode.trim().length < 6}
                className="w-full rounded-2xl bg-emerald-700 text-white py-3.5 font-black disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
                {activating ? 'جارٍ التفعيل...' : 'تفعيل المتجر'}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit(undefined, issued.code)}
                className="w-full rounded-2xl bg-sky-600 text-white py-3.5 font-black disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" /> {busy ? 'جارٍ الدخول...' : 'دخول الآن بهذا الكود'}
              </button>
            )}

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
