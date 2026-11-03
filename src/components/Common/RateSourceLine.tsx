import React from 'react';
import { ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  MARKET_RATES_ARTICLES_URL,
  MARKET_RATES_SOURCE_NAME,
  fmtMarketTime,
  isMarketRateOld,
  type MarketRatesMeta,
} from '../../lib/marketRates.ts';

interface Props {
  meta: MarketRatesMeta;
  /** أسماء مختصرة للعملات وشراء/بيع؛ الافتراضي سطر واحد */
  compact?: boolean;
  /** زر «تحديث الآن» — يُمرَّر من الشاشة التي تعرف كيف تُحدّث */
  onRefresh?: () => void;
  refreshing?: boolean;
  className?: string;
}

/**
 * سطر «سعر اليوم من أخبار السودان» — يُعرض تحت أي حقل تسعير بالعملات.
 * ------------------------------------------------------------------
 * سبب وجوده: المستخدم طلب أن يكون **الرابط** ظاهراً في كل مكان فيه تسعير،
 * وأن يكون واضحاً أن الرقم هو سعر اليوم المنشور (لا رقم مثبّت في الكود).
 * يعرض: المصدر · وقت نشر الخبر · رابط المقال · رابط صفحة الأسعار · تحذير
 * لو صار السعر قديماً (أكثر من 20 ساعة).
 */
export const RateSourceLine: React.FC<Props> = ({
  meta,
  compact = false,
  onRefresh,
  refreshing = false,
  className = '',
}) => {
  const old = isMarketRateOld(meta);
  const article = meta.articleUrl || MARKET_RATES_ARTICLES_URL;
  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[9.5px] leading-relaxed ${
        old ? 'text-amber-800' : 'text-slate-500'
      } ${className}`}
      dir="rtl"
    >
      <span className="rounded bg-emerald-100 px-1 py-0.5 font-black text-emerald-800">
        {MARKET_RATES_SOURCE_NAME} · سعر اليوم
      </span>
      <span>نُشر: {fmtMarketTime(meta.publishedAt || meta.fetchedAt)}</span>
      <a
        href={article}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-0.5 font-black text-sky-700 underline"
      >
        فتح جدول الأسعار <ExternalLink className="h-2.5 w-2.5" />
      </a>
      {!compact && (
        <a
          href={MARKET_RATES_ARTICLES_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-slate-600 underline"
        >
          كل مقالات الأسعار اليوم <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-0.5 rounded bg-slate-900 px-1.5 py-0.5 font-black text-white disabled:opacity-60"
        >
          <RefreshCw className={`h-2.5 w-2.5 ${refreshing ? 'animate-spin' : ''}`} />
          تحديث السعر
        </button>
      )}
      {old && (
        <span className="inline-flex items-center gap-0.5 font-black text-amber-800">
          <AlertTriangle className="h-2.5 w-2.5" /> السعر ليس من اليوم — راجعه قبل التحصيل
        </span>
      )}
    </div>
  );
};
