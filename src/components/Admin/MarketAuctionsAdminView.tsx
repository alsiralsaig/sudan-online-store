import React, { useEffect, useState } from 'react';
import {
  Gavel, CheckCircle, XCircle, Clock, RefreshCw, MapPin, Phone, Trash2, Eye, Images, Video,
} from 'lucide-react';
import { api } from '../../lib/api.ts';

/**
 * مراجعة المزادات في لوحة الإدارة.
 * ------------------------------------------------------------------
 * المزاد لا يظهر في تطبيق الجمهور قبل موافقة هنا (status: pending)،
 * وصاحب المزاد يُشعَر بالقرار. نفس أسلوب مراجعة إعلانات السوق.
 */
type Status = 'pending' | 'approved' | 'rejected' | 'closed';

interface Auction {
  id: string;
  title: string;
  category: string;
  description?: string;
  startPriceSdg: number;
  minIncrementSdg: number;
  images: string[];
  videoUrl?: string;
  city?: string;
  phone?: string;
  whatsapp?: string;
  storeName?: string;
  ownerToken: string;
  status: Status;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  topBidSdg?: number;
  topBidder?: string;
  rejectionReason?: string;
}

const money = (n?: number) => (n || 0).toLocaleString('en-US');

const statusChip: Record<Status, { label: string; cls: string }> = {
  pending: { label: 'قيد المراجعة', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  approved: { label: 'منشور', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  rejected: { label: 'مرفوض', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  closed: { label: 'منتهٍ', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
};

export const MarketAuctionsAdminView: React.FC = () => {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [rows, setRows] = useState<Auction[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Auction | null>(null);
  const [rejecting, setRejecting] = useState<Auction | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminMarketAuctions(filter);
      setRows((res.auctions || []) as Auction[]);
      setCounts(res.counts || { pending: 0, approved: 0, rejected: 0, closed: 0 });
    } catch (err) {
      console.error('[admin auctions] load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const approve = async (a: Auction) => {
    setBusyId(a.id);
    try {
      await api.reviewMarketAuction(a.id, 'approved');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await api.reviewMarketAuction(rejecting.id, 'rejected', rejectNote || undefined);
      setRejecting(null);
      setRejectNote('');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Gavel className="w-5 h-5 text-amber-400" /> مراجعة المزادات
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            المزاد لا يظهر في تطبيق الجمهور قبل الموافقة. قيد المراجعة الآن: {counts.pending}
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-[11px] font-bold flex items-center gap-1.5 border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> تحديث
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {([
          ['pending', `قيد المراجعة (${counts.pending})`],
          ['approved', `منشورة (${counts.approved})`],
          ['rejected', `مرفوضة (${counts.rejected})`],
          ['all', 'الكل'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${
              filter === id
                ? 'bg-sky-600 text-white border-sky-500'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40">
          <Gavel className="w-9 h-9 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-300">لا مزادات في هذا التصنيف</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <div key={a.id} className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
              <div className="flex gap-3 p-3">
                {a.images?.[0] ? (
                  <img
                    src={a.images[0]}
                    alt={a.title}
                    className="w-20 h-20 rounded-xl object-cover shrink-0 border border-slate-700"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                    <Gavel className="w-6 h-6 text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-black text-white leading-tight line-clamp-2">{a.title}</h3>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black border ${statusChip[a.status].cls}`}>
                      {statusChip[a.status].label}
                    </span>
                  </div>
                  <p className="text-[12px] font-bold text-sky-400 font-mono mt-0.5">
                    {money(a.startPriceSdg)} ج.س
                    <span className="text-[10px] text-slate-400 font-sans"> افتتاحي</span>
                    {a.topBidSdg ? <span className="text-emerald-400"> · أعلى مزايدة {money(a.topBidSdg)}</span> : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-400">
                    {a.city && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {a.city}</span>}
                    {a.phone && <span className="flex items-center gap-0.5" dir="ltr"><Phone className="w-3 h-3" /> {a.phone}</span>}
                    <span className="flex items-center gap-0.5"><Images className="w-3 h-3" /> {a.images?.length || 0}</span>
                    {a.videoUrl && <span className="flex items-center gap-0.5"><Video className="w-3 h-3" /> فيديو</span>}
                    <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> ينتهي {new Date(a.endsAt).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>
              </div>

              <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                <button
                  onClick={() => setPreview(a)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-[11px] font-bold border border-slate-700 flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> معاينة
                </button>
                {a.status === 'pending' && (
                  <>
                    <button
                      onClick={() => approve(a)}
                      disabled={busyId === a.id}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-black flex items-center gap-1 disabled:opacity-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> موافقة ونشر
                    </button>
                    <button
                      onClick={() => { setRejecting(a); setRejectNote(''); }}
                      disabled={busyId === a.id}
                      className="px-2.5 py-1.5 rounded-lg bg-red-600/90 text-white text-[11px] font-black flex items-center gap-1 disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> رفض
                    </button>
                  </>
                )}
                {a.status !== 'pending' && (
                  <button
                    onClick={async () => {
                      if (!confirm(`حذف المزاد «${a.title}» نهائياً؟`)) return;
                      await api.deleteAdminMarketAuction(a.id);
                      await load();
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-red-400 text-[11px] font-bold border border-slate-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> حذف
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* معاينة */}
      {preview && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-slate-900 rounded-2xl max-w-lg w-full max-h-[88vh] overflow-y-auto border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {preview.images?.map((src, i) => (
                  <img key={i} src={src} alt={`صورة ${i + 1}`} className="w-full aspect-square object-cover rounded-xl border border-slate-700" />
                ))}
              </div>
              {preview.videoUrl && (
                <a href={preview.videoUrl} target="_blank" rel="noreferrer" className="block text-[12px] font-bold text-sky-400 underline" dir="ltr">
                  {preview.videoUrl}
                </a>
              )}
              <h3 className="text-base font-black text-white">{preview.title}</h3>
              {preview.description && <p className="text-[12px] text-slate-300 leading-relaxed">{preview.description}</p>}
              <p className="text-[13px] font-black text-sky-400 font-mono">
                {money(preview.startPriceSdg)} ج.س · أقل زيادة {money(preview.minIncrementSdg)} ج.س
              </p>
              <button onClick={() => setPreview(null)} className="w-full py-2 rounded-xl bg-slate-800 text-slate-200 text-sm font-bold">
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* رفض */}
      {rejecting && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-sm w-full p-4 space-y-3 border border-slate-700">
            <h3 className="text-sm font-black text-white">رفض «{rejecting.title.slice(0, 28)}»</h3>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="سبب الرفض (يُرسل لصاحب المزاد)"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500"
            />
            <div className="flex gap-2">
              <button onClick={reject} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-black">تأكيد الرفض</button>
              <button onClick={() => setRejecting(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
