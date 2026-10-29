import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.ts';
import { roleLabel } from '../lib/staffPermissions.ts';
import { KeyRound, LogIn, ShieldCheck, Delete, UserRound } from 'lucide-react';

/**
 * شاشة دخول الموظف بالرمز السري (PIN).
 * -------------------------------------------------
 * بعد دخول المتجر بكود SND، يختار الموظف اسمه ويُدخل رمزه، فلا يستطيع أحد
 * أن ينتحل دور «المالك» أو يغيّر صلاحيات من جهاز الكاشير. المالك أيضاً يدخل
 * برمزه — وهو من يصدر رموز الموظفين من تبويب الموظفين.
 */
export function StaffPinGate({ onSuccess }: { onSuccess: (employee: { id: string; name: string; role: string }) => void }) {
  const [employees, setEmployees] = useState<{ id: string; name: string; role: string }[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .staffList()
      .then((r: any) => {
        const list = (r.employees || []) as { id: string; name: string; role: string }[];
        setEmployees(list);
        /* المالك أولاً — أول من يدخل المتجر عادة هو صاحبها */
        const owner = list.find((e) => e.role === 'owner');
        setSelectedId(owner?.id || list[0]?.id || '');
      })
      .catch(() => setErr('تعذّر تحميل قائمة الموظفين — تحقق من الاتصال.'))
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(() => employees.find((e) => e.id === selectedId) || null, [employees, selectedId]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedId) return setErr('اختر اسمك من القائمة أولاً.');
    if (pin.length < 4) return setErr('الرمز السري 4 أرقام على الأقل.');
    setBusy(true);
    setErr('');
    try {
      const r: any = await api.staffLogin(selectedId, pin);
      onSuccess(r.employee || { id: selectedId, name: selected?.name || '', role: selected?.role || 'cashier' });
    } catch (error: any) {
      setErr(error.message || 'الرمز السري غير صحيح.');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const press = (d: string) => {
    if (d === 'del') return setPin((p) => p.slice(0, -1));
    if (d === 'clear') return setPin('');
    setPin((p) => (p.length >= 6 ? p : p + d));
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-[28px] p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sky-600 flex items-center justify-center text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-[17px] font-black text-slate-900">من يدخل الآن؟</h1>
            <p className="text-[12px] text-slate-500">اختر اسمك وأدخل رمزك السري الخاص — كل موظف يرى ما تسمح به صلاحياته فقط.</p>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-sm text-slate-500 py-6">جارٍ تحميل الموظفين…</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
                <UserRound className="w-3.5 h-3.5" /> الموظف
              </label>
              <select
                value={selectedId}
                onChange={(e) => { setSelectedId(e.target.value); setPin(''); setErr(''); }}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:border-sky-500"
              >
                {employees.length === 0 && <option value="">لا يوجد موظفون — اطلب من المالك إضافتك</option>}
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} — {roleLabel(e.role)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> الرمز السري
              </label>
              <div className="flex justify-center gap-2" dir="ltr">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`w-11 h-12 rounded-xl border flex items-center justify-center text-xl font-black ${
                      pin.length > i ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-300 bg-slate-50 text-slate-300'
                    }`}
                  >
                    {pin.length > i ? '•' : ''}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2" dir="ltr">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => press(k)}
                  disabled={busy}
                  className={`py-3 rounded-xl font-black text-base transition ${
                    k === 'del' || k === 'clear'
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      : 'bg-slate-50 text-slate-900 hover:bg-sky-50 border border-slate-200'
                  }`}
                >
                  {k === 'del' ? <Delete className="w-4 h-4 mx-auto" /> : k === 'clear' ? 'مسح' : k}
                </button>
              ))}
            </div>

            {err && <p className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2 text-xs font-bold">{err}</p>}

            <button
              type="submit"
              disabled={busy || pin.length < 4 || !selectedId}
              className="w-full rounded-2xl bg-sky-600 hover:bg-sky-500 text-white py-3.5 font-black disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" /> {busy ? 'جارٍ التحقق…' : 'دخول'}
            </button>
            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              نسيت رمزك؟ مالك المتجر يعيد ضبطه لك من «فريق العمل والصلاحيات» ← تعديل بيانات الموظف.
            </p>
          </>
        )}
      </form>
    </div>
  );
}
