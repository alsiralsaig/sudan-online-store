import React, { useEffect, useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Trash2,
  Clock,
  Eye,
  Phone,
  MapPin,
  Tag,
  RefreshCw,
  AlertTriangle,
  Banknote,
  CalendarDays,
} from 'lucide-react';
import { api } from '../../lib/api.ts';

type Status = 'pending' | 'approved' | 'rejected';

interface Ad {
  id: string;
  title: string;
  category: string;
  priceSdg: number;
  location: string;
  phone: string;
  whatsapp?: string;
  description?: string;
  imageUrl: string;
  videoUrl?: string;
  isVip: boolean;
  planLabel?: string;
  expiresAt?: string;
  publisherName?: string;
  feeSdg: number;
  paymentRef?: string;
  status: Status;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

const money = (n: number) => (n || 0).toLocaleString('en-US');

const statusChip: Record<Status, { label: string; className: string }> = {
  pending: { label: 'قيد المراجعة', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  approved: { label: 'منشور', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  rejected: { label: 'مرفوض', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

/**
 * Moderation queue for marketplace ads.
 *
 * Nothing reaches the shopper app until it is approved here, and paid (VIP)
 * ads show the fee the publisher owes so the admin can confirm payment.
 */
export const MarketAdsAdminView: React.FC = () => {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [ads, setAds] = useState<Ad[]>([]);
  const [counts, setCounts] = useState<any>({ pending: 0, approved: 0, rejected: 0, feesDueSdg: 0, feesCollectedSdg: 0 });
  const [pricing, setPricing] = useState({ standardFeeSdg: 0, vipFeeSdg: 5000, currency: 'SDG' });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Ad | null>(null);
  const [rejecting, setRejecting] = useState<Ad | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminMarketAds(filter);
      setAds(res.ads);
      setCounts(res.counts);
      if (res.pricing) setPricing(res.pricing);
    } catch (err) {
      console.error('[admin ads] load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const approve = async (ad: Ad) => {
    setBusyId(ad.id);
    try {
      await api.reviewMarketAd(ad.id, 'approved', undefined, ad.feeSdg > 0);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await api.reviewMarketAd(rejecting.id, 'rejected', rejectNote || undefined);
      setRejecting(null);
      setRejectNote('');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (ad: Ad) => {
    if (!confirm(`حذف الإعلان «${ad.title}» نهائياً؟`)) return;
    setBusyId(ad.id);
    try {
      await api.adminDeleteMarketAd(ad.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { key: typeof filter; label: string; count: number }[] = [
    { key: 'pending', label: 'بانتظار الموافقة', count: counts.pending },
    { key: 'approved', label: 'منشورة', count: counts.approved },
    { key: 'rejected', label: 'مرفوضة', count: counts.rejected },
    { key: 'all', label: 'الكل', count: counts.pending + counts.approved + counts.rejected },
  ];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center gap-2 text-amber-400 text-[11px] font-bold">
            <Clock className="w-3.5 h-3.5" /> بانتظار الموافقة
          </div>
          <p className="text-2xl font-black text-white mt-1">{counts.pending}</p>
          {counts.feesDueSdg > 0 && (
            <p className="text-[11px] text-amber-400/80 mt-0.5">
              رسوم مستحقة: {money(counts.feesDueSdg)} ج.س
            </p>
          )}
        </div>

        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-bold">
            <Banknote className="w-3.5 h-3.5" /> رسوم محصّلة
          </div>
          <p className="text-2xl font-black text-white mt-1">{money(counts.feesCollectedSdg)}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">ج.س من الإعلانات المنشورة</p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold">
            <Tag className="w-3.5 h-3.5" /> تسعيرة النشر
          </div>
          <p className="text-sm font-bold text-white mt-1.5">
            عادي: {pricing.standardFeeSdg > 0 ? `${money(pricing.standardFeeSdg)} ج.س` : 'مجاني'}
          </p>
          <p className="text-sm font-bold text-amber-400">
            VIP: {money(pricing.vipFeeSdg)} ج.س
          </p>
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
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {/* List */}
      {loading && ads.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-xs">جارٍ التحميل…</div>
      ) : ads.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-xs">
          لا توجد إعلانات في هذا القسم.
        </div>
      ) : (
        <div className="space-y-2.5">
          {ads.map((ad) => {
            const chip = statusChip[ad.status];
            return (
              <div
                key={ad.id}
                className="bg-slate-900 rounded-2xl border border-slate-800 p-3 flex gap-3"
              >
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800 shrink-0">
                  {ad.imageUrl ? (
                    <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-600">
                      فيديو
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{ad.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" /> {ad.category}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {ad.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {ad.phone}
                        </span>
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${chip.className}`}>
                      {chip.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-[11px] text-slate-400">
                      سعر السلعة: <b className="text-slate-200">{money(ad.priceSdg)}</b> ج.س
                    </span>
                    <span
                      className={`text-[11px] font-bold flex items-center gap-1 ${
                        ad.feeSdg > 0 ? 'text-amber-400' : 'text-slate-500'
                      }`}
                    >
                      <Banknote className="w-3 h-3" />
                      رسوم النشر: {ad.feeSdg > 0 ? `${money(ad.feeSdg)} ج.س` : 'مجاني'}
                      {ad.isVip && ' (VIP)'}
                    </span>
                    {ad.planLabel && (
                      <span className="text-[11px] text-sky-400 font-bold flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> {ad.planLabel}
                      </span>
                    )}
                    {ad.expiresAt && (
                      <span className="text-[10px] text-slate-400">
                        ينتهي: {new Date(ad.expiresAt).toLocaleDateString('ar-EG')}
                      </span>
                    )}
                    {ad.paymentRef && (
                      <span className="text-[10px] text-emerald-400">سداد: {ad.paymentRef}</span>
                    )}
                    <span className="text-[10px] text-slate-500">
                      {ad.publisherName} • {new Date(ad.createdAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>

                  {ad.status === 'rejected' && ad.rejectionReason && (
                    <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> {ad.rejectionReason}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    <button
                      onClick={() => setPreview(ad)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> معاينة
                    </button>

                    {ad.status !== 'approved' && (
                      <button
                        onClick={() => approve(ad)}
                        disabled={busyId === ad.id}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle className="w-3 h-3" />
                        موافقة ونشر{ad.feeSdg > 0 ? ' + تأكيد السداد' : ''}
                      </button>
                    )}

                    {ad.status !== 'rejected' && (
                      <button
                        onClick={() => setRejecting(ad)}
                        disabled={busyId === ad.id}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-red-400 hover:bg-red-500/15 flex items-center gap-1 disabled:opacity-50"
                      >
                        <XCircle className="w-3 h-3" /> رفض
                      </button>
                    )}

                    <button
                      onClick={() => remove(ad)}
                      disabled={busyId === ad.id}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-red-400 hover:bg-red-500/20 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" /> حذف
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div
            className="bg-slate-900 rounded-2xl max-w-md w-full overflow-hidden border border-slate-700"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="aspect-video bg-slate-800">
              {preview.videoUrl ? (
                <video src={preview.videoUrl} controls className="w-full h-full object-cover" />
              ) : (
                <img src={preview.imageUrl} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="p-4 space-y-2">
              <h3 className="text-base font-black text-white">{preview.title}</h3>
              <p className="text-xs text-slate-400">{preview.description || 'بدون وصف'}</p>
              <div className="text-xs text-slate-300 space-y-1">
                <p>سعر السلعة: <b>{money(preview.priceSdg)} ج.س</b></p>
                <p>رسوم النشر: <b className="text-amber-400">{preview.feeSdg > 0 ? `${money(preview.feeSdg)} ج.س` : 'مجاني'}</b></p>
                {preview.planLabel && <p>الخطة: <b className="text-sky-400">{preview.planLabel}</b></p>}
                {preview.expiresAt && <p>ينتهي في: <b>{new Date(preview.expiresAt).toLocaleDateString('ar-EG')}</b></p>}
                <p>الهاتف: {preview.phone}</p>
                <p>المعلن: {preview.publisherName}</p>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="w-full mt-2 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-sm w-full p-4 border border-slate-700" dir="rtl">
            <h3 className="text-sm font-black text-white mb-2">سبب الرفض</h3>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="مثال: الصورة غير واضحة، أو السعر غير مذكور."
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
                onClick={() => {
                  setRejecting(null);
                  setRejectNote('');
                }}
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
