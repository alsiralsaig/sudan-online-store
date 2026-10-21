import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Printer,
  MousePointerClick,
  Eye,
  TrendingUp,
  CalendarDays,
  Loader2,
  AlertCircle,
  Award,
} from 'lucide-react';
import { api } from '../../lib/api.ts';

interface DayRow {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface BannerLike {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  advertiserName?: string;
  active?: boolean;
}

interface Props {
  banner: BannerLike;
  onClose: () => void;
}

type RangeKey = 'month' | '7' | '30' | 'all';

const AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** '2026-10-21' → '21 أكتوبر 2026' (Arabic, no Intl dependency). */
const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const prettyDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${AR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const shortDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
};
const dayName = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? '' : AR_DAYS[d.getUTCDay()];
};

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
};

/** Advertiser report with a print-to-PDF layout. */
export const MarketBannerReportModal: React.FC<Props> = ({ banner, onClose }) => {
  const today = isoDay(new Date());
  const [range, setRange] = useState<RangeKey>('month');
  const [days, setDays] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const window$ = useMemo(() => {
    if (range === '7') return { from: addDays(today, -6), to: today };
    if (range === '30') return { from: addDays(today, -29), to: today };
    if (range === 'month') {
      const d = new Date(`${today}T00:00:00.000Z`);
      return { from: isoDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))), to: today };
    }
    return { from: undefined as string | undefined, to: undefined as string | undefined };
  }, [range, today]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getMarketBannerReport(banner.id, { from: window$.from, to: window$.to })
      .then((res) => {
        if (!cancelled) setDays(res.days || []);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message || 'تعذر تحميل التقرير.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [banner.id, window$.from, window$.to]);

  // Lock the page behind the sheet so the report never drifts sideways on phones
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const totals = useMemo(() => {
    const impressions = days.reduce((a, d) => a + d.impressions, 0);
    const clicks = days.reduce((a, d) => a + d.clicks, 0);
    return {
      impressions,
      clicks,
      ctr: impressions ? ((clicks / impressions) * 100).toFixed(1) : '—',
    };
  }, [days]);

  const bestDay = useMemo(
    () => days.reduce<DayRow | null>((best, d) => (d.impressions > (best?.impressions || 0) ? d : best), null),
    [days]
  );
  const activeDays = days.filter((d) => d.impressions > 0 || d.clicks > 0);
  const peak = Math.max(1, ...days.map((d) => d.impressions));

  const rangeLabel =
    range === 'month'
      ? 'هذا الشهر'
      : range === '7'
      ? 'آخر 7 أيام'
      : range === '30'
      ? 'آخر 30 يوم'
      : 'كل الفترة المسجّلة';

  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto overflow-x-hidden p-3 sm:p-6">
      {/* Print rules: only the report sheet reaches the paper / PDF */}
      <style>{`
        @media print {
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          .banner-report-sheet, .banner-report-sheet * { visibility: visible !important; }
          .banner-report-sheet {
            position: absolute !important; inset: 0 !important;
            width: 100% !important; max-width: none !important;
            margin: 0 !important; padding: 18px !important;
            background: #fff !important; color: #0f172a !important;
            border: 0 !important; border-radius: 0 !important;
            box-shadow: none !important;
          }
          .banner-report-noprint { display: none !important; }
          .banner-report-sheet .rp-card { background: #f8fafc !important; border-color: #e2e8f0 !important; }
          .banner-report-sheet .rp-dim { color: #475569 !important; }
          .banner-report-sheet .rp-ink { color: #0f172a !important; }
          .banner-report-sheet .rp-green { color: #047857 !important; }
          .banner-report-sheet thead { background: #e2e8f0 !important; }
          .banner-report-sheet thead th { color: #0f172a !important; }
          .banner-report-sheet tbody td { color: #0f172a !important; border-color: #cbd5e1 !important; }
          .banner-report-sheet tbody tr { border-color: #cbd5e1 !important; }
          .banner-report-sheet .max-h-64 { max-height: none !important; overflow: visible !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="banner-report-sheet w-full max-w-3xl mx-auto shrink-0 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl my-2">
        {/* header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-800">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-emerald-400 tracking-widest">سَنَد | تقرير إعلان</p>
            <h3 className="text-base font-black text-white mt-0.5 truncate rp-ink">{banner.title}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 rp-dim">
              {banner.advertiserName ? `المعلن: ${banner.advertiserName} • ` : ''}
              {rangeLabel}
              {first && last ? ` • ${prettyDate(first)} — ${prettyDate(last)}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="banner-report-noprint shrink-0 w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* controls */}
        <div className="banner-report-noprint flex items-center justify-between gap-2 flex-wrap px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-1">
            {(
              [
                ['month', 'هذا الشهر'],
                ['7', 'آخر 7 أيام'],
                ['30', 'آخر 30 يوم'],
                ['all', 'الكل'],
              ] as Array<[RangeKey, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                  range === key
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-200 hover:text-white flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> طباعة / PDF
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> جاري تحميل التقرير…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rp-card bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 rp-dim flex items-center gap-1">
                  <Eye className="w-3 h-3 text-sky-400" /> مرات الظهور
                </p>
                <p className="text-lg font-black text-white mt-1 rp-ink">
                  {totals.impressions.toLocaleString('en-US')}
                </p>
              </div>
              <div className="rp-card bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 rp-dim flex items-center gap-1">
                  <MousePointerClick className="w-3 h-3 text-emerald-400" /> النقرات
                </p>
                <p className="text-lg font-black text-white mt-1 rp-ink">
                  {totals.clicks.toLocaleString('en-US')}
                </p>
              </div>
              <div className="rp-card bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 rp-dim flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-amber-400" /> نسبة التفاعل
                </p>
                <p className="text-lg font-black text-emerald-400 mt-1 rp-green">
                  {totals.ctr === '—' ? '—' : `${totals.ctr}%`}
                </p>
              </div>
              <div className="rp-card bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 rp-dim flex items-center gap-1">
                  <CalendarDays className="w-3 h-3 text-slate-300" /> أيام فيها نشاط
                </p>
                <p className="text-lg font-black text-white mt-1 rp-ink">
                  {activeDays.length.toLocaleString('en-US')}
                </p>
                {bestDay && bestDay.impressions > 0 && (
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate rp-dim">
                    أفضل يوم: {shortDate(bestDay.date)} ({bestDay.impressions})
                  </p>
                )}
              </div>
            </div>

            {/* chart */}
            {days.length > 0 && (
              <div className="rp-card bg-slate-800/40 border border-slate-700 rounded-xl p-3">
                <p className="text-[11px] font-bold text-slate-300 mb-2 rp-ink">الأداء اليومي</p>
                <div dir="ltr" className="flex items-end gap-[3px] h-28 overflow-x-auto pb-1">
                  {days.map((d) => {
                    const h = Math.round((d.impressions / peak) * 100);
                    const ch = d.impressions
                      ? Math.round((d.clicks / Math.max(1, d.impressions)) * h)
                      : 0;
                    return (
                      <div
                        key={d.date}
                        className="flex-1 min-w-[7px] h-full flex flex-col justify-end"
                        title={`${prettyDate(d.date)} — ${d.impressions} ظهور / ${d.clicks} نقرة`}
                      >
                        <div
                          className={`w-full rounded-t relative overflow-hidden ${
                            d.impressions ? 'bg-sky-500/80' : 'bg-slate-600/30'
                          }`}
                          style={{ height: `${Math.max(h, d.impressions ? 4 : 1)}%` }}
                        >
                          {d.clicks > 0 && (
                            <div
                              className="absolute bottom-0 left-0 right-0 bg-emerald-400"
                              style={{ height: `${Math.max(ch, 6)}%` }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 rp-dim">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-sky-500/70 inline-block" /> الظهور
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> النقرات
                  </span>
                  <span className="ms-auto" dir="ltr">
                    {shortDate(first || today)} — {shortDate(last || today)}
                  </span>
                </div>
              </div>
            )}

            {/* table */}
            <div className="rp-card bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
                <p className="text-[11px] font-bold text-slate-300 rp-ink">تفصيل الأيام</p>
                <p className="text-[10px] text-slate-400 rp-dim">
                  {activeDays.length} يوم فيه نشاط من {days.length}
                </p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-slate-800 text-slate-400 rp-dim">
                    <tr>
                      <th className="text-right px-3 py-1.5 font-bold">اليوم</th>
                      <th className="text-right px-3 py-1.5 font-bold">الظهور</th>
                      <th className="text-right px-3 py-1.5 font-bold">النقرات</th>
                      <th className="text-right px-3 py-1.5 font-bold">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...days].reverse().map((d) => (
                      <tr key={d.date} className="border-t border-slate-800/60">
                        <td className="px-3 py-1.5 text-slate-200 rp-ink whitespace-nowrap">
                          {dayName(d.date)} {shortDate(d.date)}
                        </td>
                        <td className="px-3 py-1.5 text-sky-300">{d.impressions.toLocaleString('en-US')}</td>
                        <td className="px-3 py-1.5 text-emerald-300">{d.clicks.toLocaleString('en-US')}</td>
                        <td className="px-3 py-1.5 text-slate-300 rp-dim">
                          {d.impressions ? `${d.ctr}%` : '—'}
                        </td>
                      </tr>
                    ))}
                    {days.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                          لا توجد بيانات في هذه الفترة.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* footer note */}
            <div className="flex items-start justify-between gap-3 flex-wrap pt-1">
              <p className="text-[10px] text-slate-500 rp-dim max-w-md leading-relaxed">
                الظهور يُحسب عندما يبقى البانر نصف ظاهر على الشاشة لمدة ثانية على الأقل. النقرة تُحسب عند
                ضغط الزائر على البانر. الأرقام بتوقيت UTC.
              </p>
              <p className="text-[10px] font-bold text-slate-400 rp-dim flex items-center gap-1">
                <Award className="w-3 h-3 text-amber-400" /> منصة سند — تقرير أداء الإعلان
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketBannerReportModal;
