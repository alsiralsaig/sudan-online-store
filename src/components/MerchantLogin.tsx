import React, { useState } from 'react';
import { api } from '../lib/api.ts';
import { KeyRound, LogIn, ShieldAlert } from 'lucide-react';

export function MerchantLogin({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api.merchantLogin(code.trim());
      onSuccess();
    } catch (e: any) {
      setErr(e.message || 'فشل تسجيل الدخول');
    } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-[28px] p-7 space-y-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center text-white"><KeyRound className="w-6 h-6" /></div>
          <div>
            <h1 className="text-[17px] font-black text-slate-900">دخول المتجر</h1>
            <p className="text-[12px] text-slate-500">أدخل رمز متجرك الخاص (يبدأ بـ SND-) للدخول لإدارة متجرك فقط</p>
          </div>
        </div>
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 flex gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-5 text-slate-700">كل تاجر يرى متجره فقط. لا تظهر إدارة المنصة ولا قائمة التجار داخل تطبيق التاجر.</p>
        </div>
        <input value={code} onChange={e=>setCode(e.target.value)} placeholder="SND-XXXX-XXXX-..." dir="ltr"
          className="w-full rounded-2xl border border-slate-300 px-4 py-3.5 font-mono text-center tracking-widest focus:outline-none focus:border-emerald-500" />
        {err && <p className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2 text-xs font-bold">{err}</p>}
        <button disabled={busy || code.trim().length<6} className="w-full rounded-2xl bg-emerald-700 text-white py-3.5 font-black disabled:opacity-50 flex items-center justify-center gap-2">
          <LogIn className="w-4 h-4" /> {busy ? 'جارٍ التحقق...' : 'دخول المتجر'}
        </button>
        <p className="text-[11px] text-slate-400 text-center">ليس لديك رمز؟ تواصل مع إدارة سند عبر واتساب للحصول على رمز متجرك.</p>
      </form>
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
          className="w-full rounded-2xl border border-slate-700 bg-slate-900 text-white px-4 py-3.5 focus:outline-none focus:border-emerald-500" />
        {err && <p className="rounded-xl bg-rose-950 text-rose-200 px-3 py-2 text-xs font-bold border border-rose-900">{err}</p>}
        <button disabled={busy} className="w-full rounded-2xl bg-amber-500 text-slate-950 py-3.5 font-black disabled:opacity-50">{busy ? '...' : 'دخول الإدارة'}</button>
      </form>
    </div>
  );
}
