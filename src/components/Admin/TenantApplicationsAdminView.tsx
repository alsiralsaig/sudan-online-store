import React, { useEffect, useState } from 'react';
import {
  Store,
  MapPin,
  Phone,
  Mail,
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  KeyRound,
  Send,
  Banknote,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { waHref } from '../../lib/contact.ts';

type Status = 'pending' | 'approved' | 'rejected';

interface Application {
  id: string;
  storeName: string;
  ownerName: string;
  wilaya: string;
  city: string;
  phone: string;
  email?: string;
  branchesCount: number;
  businessType: string;
  notes?: string;
  source: 'client' | 'merchant';
  status: Status;
  registrationFeeSdg: number;
  activationCode?: string;
  codeSentVia?: 'whatsapp' | 'sms' | 'email';
  codeSentAt?: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

const money = (n: number) => (n || 0).toLocaleString('en-US');

const statusChip: Record<Status, { label: string; className: string }> = {
  pending: { label: 'قيد المراجعة', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  approved: { label: 'معتمد', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  rejected: { label: 'مرفوض', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const whatsappLink = (phone: string, message: string) => waHref(phone, message);

export const TenantApplicationsAdminView: React.FC = () => {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [applications, setApplications] = useState<Application[]>([]);
  const [counts, setCounts] = useState<any>({
    pending: 0, approved: 0, rejected: 0, pendingBranches: 0, feesExpectedSdg: 0, feesCollectedSdg: 0,
  });
  const [pricing, setPricing] = useState({ registrationFeeSdg: 50000, currency: 'SDG' });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<Application | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminTenantApplications(filter);
      setApplications(res.applications);
      setCounts(res.counts);
      if (res.pricing) setPricing(res.pricing);
    } catch (err) {
      console.error('[admin tenant applications] load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const approve = async (application: Application) => {
    const draft = feeDrafts[application.id];
    const fee = draft !== undefined && draft !== '' ? Number(draft) : application.registrationFeeSdg;
    setBusyId(application.id);
    try {
      await api.reviewTenantApplication(application.id, 'approved', { registrationFeeSdg: fee });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await api.reviewTenantApplication(rejecting.id, 'rejected', { note: rejectNote || undefined });
      setRejecting(null);
      setRejectNote('');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (application: Application) => {
    if (!confirm(`حذف طلب «${application.storeName}» نهائياً؟`)) return;
    setBusyId(application.id);
    try {
      await api.adminDeleteTenantApplication(application.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const markSent = async (application: Application, via: 'whatsapp' | 'sms' | 'email') => {
    setBusyId(application.id);
    try {
      await api.markTenantApplicationSent(application.id, via);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const copyCode = async (application: Application) => {
    if (!application.activationCode) return;
    try {
      await navigator.clipboard.writeText(application.activationCode);
      setCopied(application.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard may be blocked — the code is visible anyway */
    }
  };

  const tabs: { key: typeof filter; label: string; count: number }[] = [
    { key: 'pending', label: 'بانتظار الموافقة', count: counts.pending },
    { key: 'approved', label: 'معتمدة', count: counts.approved },
    { key: 'rejected', label: 'مرفوضة', count: counts.rejected },
    { key: 'all', label: 'الكل', count: counts.pending + counts.approved + counts.rejected },
  ];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center gap-2 text-amber-400 text-[11px] font-bold">
            <Clock className="w-3.5 h-3.5" /> طلبات جديدة
          </div>
          <p className="text-2xl font-black text-white mt-1">{counts.pending}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">تشمل {counts.pendingBranches} فرعاً</p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-bold">
            <Banknote className="w-3.5 h-3.5" /> رسوم تسجيل محصّلة
          </div>
          <p className="text-2xl font-black text-white mt-1">{money(counts.feesCollectedSdg)}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">ج.س من المتاجر المعتمدة</p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold">
            <Store className="w-3.5 h-3.5" /> قيمة التسجيل الافتراضية
          </div>
          <p className="text-2xl font-black text-white mt-1">{money(pricing.registrationFeeSdg)}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">ج.س — يمكن تعديلها لكل متجر عند الموافقة</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${
                filter === t.key
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {t.label}
              {t.count > 0 && ` (${t.count})`}
            </button>
          ))}
        </div>

        <button
          onClick={load}
          className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> تحديث
        </button>
      </div>

      {/* List */}
      {loading && applications.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-xs">جارٍ التحميل…</div>
      ) : applications.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-xs">لا توجد طلبات في هذا القسم.</div>
      ) : (
        <div className="space-y-2.5">
          {applications.map((application) => {
            const chip = statusChip[application.status];
            const feeValue = feeDrafts[application.id] ?? String(application.registrationFeeSdg ?? '');
            return (
              <div key={application.id} className="bg-slate-900 rounded-2xl border border-slate-800 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      {application.storeName}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {application.ownerName} • {application.businessType}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${chip.className}`}>
                    {chip.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-2 flex-wrap text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {application.wilaya} - {application.city}</span>
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {application.phone}</span>
                  {application.email && (
                    <span className="flex items-center gap-1" dir="ltr"><Mail className="w-3 h-3" /> {application.email}</span>
                  )}
                  <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" /> {application.branchesCount} فرع</span>
                  <span className="text-slate-500">
                    {application.source === 'merchant' ? 'من تطبيق التاجر' : 'من تطبيق الجمهور'} •{' '}
                    {new Date(application.createdAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>

                {application.notes && (
                  <p className="text-[10px] text-slate-500 mt-1.5">ملاحظات المقدّم: {application.notes}</p>
                )}

                {application.status === 'rejected' && application.rejectionReason && (
                  <p className="text-[10px] text-red-400 mt-1">سبب الرفض: {application.rejectionReason}</p>
                )}

                {/* Fee + code row */}
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  <label className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Banknote className="w-3 h-3" /> رسوم التسجيل (ج.س)
                  </label>
                  <input
                    value={feeValue}
                    onChange={(e) =>
                      setFeeDrafts((prev) => ({ ...prev, [application.id]: e.target.value.replace(/[^\d]/g, '') }))
                    }
                    inputMode="numeric"
                    className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white font-mono focus:outline-none focus:border-emerald-500"
                  />

                  {application.activationCode && (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2 py-1">
                      <KeyRound className="w-3 h-3" /> {application.activationCode}
                      <button onClick={() => copyCode(application)} title="نسخ الكود" className="hover:text-white">
                        {copied === application.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </span>
                  )}

                  {application.codeSentVia && (
                    <span className="text-[10px] text-slate-500">
                      أُرسل الكود عبر {application.codeSentVia === 'whatsapp' ? 'واتساب' : application.codeSentVia === 'sms' ? 'رسالة نصية' : 'البريد'}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  {application.status !== 'approved' && (
                    <button
                      onClick={() => approve(application)}
                      disabled={busyId === application.id}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 disabled:opacity-50"
                    >
                      <CheckCircle className="w-3 h-3" /> موافقة + إصدار كود
                    </button>
                  )}

                  {application.status === 'approved' && application.activationCode && (
                    <>
                      <a
                        href={whatsappLink(
                          application.phone,
                          `مرحباً ${application.ownerName}، تمت الموافقة على متجر «${application.storeName}» في منصة سند.\nكود الدخول: ${application.activationCode}\nقيمة التسجيل: ${money(application.registrationFeeSdg)} ج.س\nسجّل متجرك من: https://sudan-online-store-eta.vercel.app/?app=merchant`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => markSent(application, 'whatsapp')}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" /> إرسال الكود واتساب
                      </a>
                      {application.email && (
                        <a
                          href={`mailto:${application.email}?subject=${encodeURIComponent('كود دخول متجرك في منصة سند')}&body=${encodeURIComponent(
                            `كود الدخول: ${application.activationCode}\nقيمة التسجيل: ${money(application.registrationFeeSdg)} ج.س`
                          )}`}
                          onClick={() => markSent(application, 'email')}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1"
                        >
                          <Mail className="w-3 h-3" /> إرسال بالبريد
                        </a>
                      )}
                    </>
                  )}

                  {application.status !== 'rejected' && (
                    <button
                      onClick={() => setRejecting(application)}
                      disabled={busyId === application.id}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-red-400 hover:bg-red-500/15 flex items-center gap-1 disabled:opacity-50"
                    >
                      <XCircle className="w-3 h-3" /> رفض
                    </button>
                  )}

                  <button
                    onClick={() => remove(application)}
                    disabled={busyId === application.id}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-red-400 hover:bg-red-500/20 flex items-center gap-1 disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" /> حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-sm w-full p-4 border border-slate-700" dir="rtl">
            <h3 className="text-sm font-black text-white mb-2">سبب رفض طلب «{rejecting.storeName}»</h3>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="مثال: رقم الهاتف غير صحيح، أو البيانات غير مكتملة."
              className="w-full bg-slate-800 text-white text-xs rounded-xl p-2.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={reject}
                disabled={busyId === rejecting.id}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-50"
              >
                تأكيد الرفض
              </button>
              <button
                onClick={() => { setRejecting(null); setRejectNote(''); }}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
