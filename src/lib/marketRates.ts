/**
 * أسعار السوق الموازي — مصدر واحد لكل شاشات التطبيق.
 * ---------------------------------------------------------------------------
 * لماذا هذا الملف؟
 * كانت شاشتان فقط (العملات، طلبات التوريد) تقرآن الأسعار الحيّة، وبقية
 * الشاشات تحمل أرقاماً مكتوبة في الكود (2,750 للدولار، 733 للريال…). أي أن
 * تغيّر السوق لا يصل إلى شاشة الدفع إطلاقاً، فيُحصّل التاجر بسعر قديم.
 *
 * القاعدة الآن: لا رقم صرف مكتوب في أي شاشة. كل شاشة تقرأ من هنا، وهذه
 * تقرأ من `/api/currency/parallel-rates` الذي يجلب جدول اليوم من
 * «أخبار السودان» ويُخزّنه في قاعدة البيانات كل ساعة.
 *
 * السعر **متغيّر**: نأخذ سعر البيع (sell) للتحصيل والبيع، وسعر الشراء (buy)
 * للتكاليف والمشتريات، ولو لم ينشر المصدر سعر شراء نرجع إلى سعر البيع.
 */

import { api } from './api.ts';

/** صفحة كل مقالات أسعار اليوم — المصدر البشري الذي يفتحه التاجر للتأكد */
export const MARKET_RATES_ARTICLES_URL =
  'https://www.sudanakhbar.com/business-news/currency-rates-prices';

export const MARKET_RATES_SOURCE_NAME = 'أخبار السودان';

/** بيع = ما نبيع/نحصّل به · buy = ما نشتري به */
export type RateSide = 'sell' | 'buy';

export interface MarketRatesMeta {
  /** وقت جلب الأرقام إلى التطبيق */
  fetchedAt: string | null;
  /** وقت نشر المقال في المصدر (سعر «اليوم» وليس سعر أمس) */
  publishedAt: string | null;
  /** رابط المقال نفسه الذي أُخذت منه الأرقام */
  articleUrl: string | null;
  sourceName: string;
  /** صفحة المصدر العامة (كل المقالات) */
  articlesUrl: string;
}

export interface MarketRates {
  /** 1 عملة أجنبية = كم جنيه سوداني (سعر البيع) */
  sell: Record<string, number>;
  /** 1 عملة أجنبية = كم جنيه سوداني (سعر الشراء) */
  buy: Record<string, number>;
  /** أسعار الشراء الرسمية/البنكية إن وُجدت (للعرض فقط) */
  official: Record<string, number>;
  meta: MarketRatesMeta;
  /** هل توجد أرقام فعلاً؟ (لو لا، الشاشة يجب أن تنبّه بدل أن تخمّن) */
  hasRates: boolean;
}

export const EMPTY_MARKET_RATES: MarketRates = {
  sell: { SDG: 1 },
  buy: { SDG: 1 },
  official: {},
  meta: {
    fetchedAt: null,
    publishedAt: null,
    articleUrl: null,
    sourceName: MARKET_RATES_SOURCE_NAME,
    articlesUrl: MARKET_RATES_ARTICLES_URL,
  },
  hasRates: false,
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** يحوّل رد `/currency/parallel-rates` إلى خرائط جاهزة للاستخدام. */
export function buildMarketRates(res: any): MarketRates {
  const snap = res?.snapshot || null;
  const sell: Record<string, number> = { SDG: 1 };
  const buy: Record<string, number> = { SDG: 1 };
  const official: Record<string, number> = {};

  for (const r of snap?.rates || []) {
    const code = String(r?.code || '').toUpperCase();
    if (!code || code === 'SDG') continue;
    const s = num(r?.sell) || num(r?.parallel);
    if (s > 1) sell[code] = s;
    const b = num(r?.buy);
    if (b > 1 && (!s || b < s)) buy[code] = b;
    const o = num(r?.official);
    if (o > 1) official[code] = o;
  }

  /*
   * احتياط محدود: نأخذ من العملات المخزّنة **فقط** ما جاء من السوق الموازي
   * (rateSource === 'parallel'). الأرقام الافتراضية القديمة في قاعدة البيانات
   * (2,750 للدولار…) مرفوضة، لأنها هي سبب التحصيل بسعر غير حقيقي. لو لا يوجد
   * سعر سوق حقيقي، نُظهر «—» ونطلب من الكاشير إدخال السعر بدل التخمين.
   */
  for (const c of res?.currencies || []) {
    const code = String(c?.code || '').toUpperCase();
    if (!code || code === 'SDG' || sell[code]) continue;
    if ((c as any)?.rateSource !== 'parallel') continue;
    const v = num(c?.parallelRate) || num(c?.rateToSdg);
    if (v > 1) sell[code] = v;
  }

  return {
    sell,
    buy,
    official,
    meta: {
      fetchedAt: snap?.fetchedAt || null,
      publishedAt: snap?.sourceUpdatedAt || null,
      articleUrl: snap?.sourceUrl || null,
      sourceName: String(snap?.source || MARKET_RATES_SOURCE_NAME),
      articlesUrl: MARKET_RATES_ARTICLES_URL,
    },
    hasRates: Object.keys(sell).length > 1,
  };
}

/**
 * سعر الصرف المطلوب لعملة معينة.
 * - sell: سعر البيع (التحصيل من العميل / البيع)
 * - buy: سعر الشراء (تكلفة الشراء من المورد) — يرجع للبيع لو غير منشور
 * لا يرجع أبداً رقماً مكتوباً في الكود.
 */
export function marketRateFor(
  rates: MarketRates,
  code: string,
  side: RateSide = 'sell'
): number | null {
  const c = String(code || '').toUpperCase();
  if (c === 'SDG') return 1;
  if (side === 'buy') return rates.buy[c] || rates.sell[c] || null;
  return rates.sell[c] || null;
}

/** يجلب الأسعار الحيّة من الـAPI (مشترك بين كل الشاشات). */
export async function loadMarketRates(): Promise<MarketRates> {
  const res = await api.getParallelRates();
  return buildMarketRates(res);
}

/** «١٠٬٥٠٠» بصيغة مقروءة */
export const fmtRate = (n?: number | null): string =>
  n && Number.isFinite(n) ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—';

/** وقت مختصر بالعربي (١٢:٢٧ م) — لتمييز «سعر اليوم» من سعر قديم */
export const fmtMarketTime = (iso?: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ar-EG', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

/** هل الرقم عمره أكثر من ساعات قليلة؟ (نُظهر تحذيراً بدل عرضه كسعر لحظي) */
export const isMarketRateOld = (meta: MarketRatesMeta, hours = 20): boolean => {
  const iso = meta.publishedAt || meta.fetchedAt;
  if (!iso) return true;
  return (Date.now() - Date.parse(iso)) / 3_600_000 >= hours;
};
