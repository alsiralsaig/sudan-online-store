/**
 * محرك تحليل اللهجة السودانية للبيع — منقول من مشروع «حساباتي السودان»
 * (shared/parseWithSudaneseRules.ts) ومهيّأ لأصناف سند.
 *
 * يعمل بدون إنترنت وبدون أي مفتاح API — ده مهم في السودان.
 * القاعدة الذهبية المنقولة كما هي: **ما نخدم سعراً من راسنا** — كل سعر
 * يجي من صنف موجود في المخزون، وأي التباس نرجّعه سؤالاً للكاشير.
 */

import type { Product } from '../types/index.ts';
import {
  findUnitInText,
  normalizeArabic,
  normalizeDigits,
  priceForUnit,
  resolveProductBaseUnit,
  SUDANESE_UNITS,
} from './sudaneseUnits.ts';

export interface ParsedLine {
  /** الصنف المطابق في مخزون سند (null لو لم يُطابق) */
  product: Product | null;
  /** الاسم كما نطقه الكاشير */
  spokenName: string;
  quantity: number;
  unitId: string;
  unitName: string;
  unitPrice: number;
  /** ثقة المطابقة 0..1 */
  confidence: number;
  /** شرح التحويل/السعر */
  note: string;
}

export interface Clarification {
  phrase: string;
  reason: string;
  /** اقتراحات من المخزون لاختيار أقرب صنف */
  suggestions: Product[];
}

export type PaymentMethodGuess = 'cash' | 'bankak' | 'fawry' | 'credit';

export interface ParsedSale {
  lines: ParsedLine[];
  clarifications: Clarification[];
  paymentMethod: PaymentMethodGuess;
  discountAmount: number;
  discountPercent: number;
  customerName: string | null;
  summary: string;
  /** النص بعد التوحيد — يُعرض للكاشير ليتأكد */
  normalizedText: string;
}

const NUMBER_WORDS: Record<string, number> = {
  واحد: 1,
  واحده: 1,
  اتنين: 2,
  اثنين: 2,
  تنين: 2,
  تلاته: 3,
  ثلاثه: 3,
  تلاتة: 3,
  اربعه: 4,
  اربعة: 4,
  خمسه: 5,
  خمسة: 5,
  سته: 6,
  ستة: 6,
  سبعه: 7,
  سبعة: 7,
  تمانيه: 8,
  ثمانيه: 8,
  ثمانية: 8,
  تسعه: 9,
  تسعة: 9,
  عشره: 10,
  عشرة: 10,
  اتناشر: 12,
  اتنعشر: 12,
  عشرين: 20,
  'خمسه وعشرين': 25,
  نص: 0.5,
  نصف: 0.5,
  ربع: 0.25,
  تمن: 0.125,
  'تلاته ترباع': 0.75,
};

const FILLER_WORDS = [
  'بعت',
  'بعنا',
  'سجل',
  'اضف',
  'اعمل فاتوره',
  'فاتوره',
  'نزل لي',
  'جيب لي',
  'هات',
  'عايز',
  'عاوز',
  'من فضلك',
  'لو سمحت',
  'كمان',
  'بس',
  'معاي',
  'للعميل',
  'للزول',
];

/** كلمات تخص الدفع/الخصم — لا تُعد أصنافاً */
const NON_PRODUCT_WORDS = [
  'كاش',
  'نقدا',
  'بنكك',
  'فوري',
  'بنك فيصل',
  'بنك الخرطوم',
  'خصم',
  'اجل',
  'دين',
  'علي الحساب',
  'على الحساب',
  'تحويل',
];

function cleanClause(clause: string): string {
  let out = ` ${normalizeArabic(clause)} `;
  for (const filler of FILLER_WORDS) {
    out = out.replace(new RegExp(`(^|\\s)${normalizeArabic(filler)}(\\s|$)`, 'g'), ' ');
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** كلمات الصنف المفيدة للمطابقة (بدون «ال» التعريف وكلمات قصيرة) */
function nameTokens(name: string): string[] {
  return normalizeArabic(name)
    .split(/[\s/|,.\-()]+/)
    .map((t) => t.replace(/^ال/, ''))
    .filter((t) => t.length >= 3);
}

function matchProduct(clause: string, products: Product[]): { product: Product | null; confidence: number } {
  const norm = normalizeArabic(normalizeDigits(clause));

  // 1) باركود أو رمز صنف مذكور حرفياً
  for (const p of products) {
    if (p.barcode && norm.includes(normalizeArabic(p.barcode))) return { product: p, confidence: 0.99 };
    if (p.sku && norm.includes(normalizeArabic(p.sku))) return { product: p, confidence: 0.97 };
  }

  // 2) تطابق كلمات النص مع كلمات **اسم الصنف** وحده.
  //    كلمات الفئة كانت تُخفّض النسبة فتضيع أصناف واضحة مثل «سكر» في
  //    «سكر كنانة أبيض» — الآن الفئة تعطي أفضلية صغيرة فقط.
  let best: Product | null = null;
  let bestScore = 0;
  let bestHits = 0;
  for (const p of products) {
    const tokens = nameTokens(p.name);
    if (!tokens.length) continue;
    let hits = 0;
    for (const t of tokens) if (norm.includes(t)) hits += 1;
    if (!hits) continue;

    let score = hits / tokens.length;
    if (norm.includes(normalizeArabic(p.name))) score = 1.2; // الاسم كامل
    if (nameTokens(p.category || '').some((t) => norm.includes(t))) score += 0.05;

    if (score > bestScore || (score === bestScore && hits > bestHits)) {
      bestScore = score;
      bestHits = hits;
      best = p;
    }
  }

  if (best && bestScore >= 0.3) {
    return { product: best, confidence: Math.min(0.96, 0.55 + Math.min(bestScore, 1) * 0.4) };
  }
  return { product: null, confidence: 0 };
}

function parseQuantity(clause: string): { quantity: number; explicit: boolean } {
  const norm = normalizeArabic(normalizeDigits(clause));
  const digit = norm.match(/(\d+(?:\.\d+)?)/);
  if (digit) return { quantity: parseFloat(digit[1]), explicit: true };

  // «كيلو ونص» / «رطل ونص» = 1.5 من الوحدة
  if (/ونص|و نص/.test(norm) && findUnitInText(norm)) return { quantity: 1.5, explicit: true };

  // أطول الكلمات أولاً حتى «خمسه وعشرين» تسبق «خمسه»
  const words = Object.entries(NUMBER_WORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [word, value] of words) {
    if (norm.includes(normalizeArabic(word))) return { quantity: value, explicit: true };
  }

  // «كيلو ونص» تعني 1.5
  if (/ونص|و نص/.test(norm)) return { quantity: 1.5, explicit: true };
  return { quantity: 1, explicit: false };
}

/**
 * تحليل جملة بيع منطوقة إلى سطور فاتورة.
 * مثال: «بعت اتنين كيلو سكر ورطل شاي وخصم 500» ⟹ سطران + خصم.
 */
export function parseSudaneseSale(text: string, products: Product[]): ParsedSale {
  const raw = normalizeDigits(text || '').trim();
  const normalizedText = normalizeArabic(raw);

  let paymentMethod: PaymentMethodGuess = 'cash';
  if (/بنكك|بنك الخرطوم|تحويل بنكي|ابلكيشن بنكك/.test(normalizedText)) paymentMethod = 'bankak';
  else if (/فوري|بنك فيصل/.test(normalizedText)) paymentMethod = 'fawry';
  else if (/اجل|دين|علي الحساب|على الحساب|شكك|شيك/.test(normalizedText)) paymentMethod = 'credit';

  const customerMatch = normalizedText.match(/(?:للعميل|للزول|للأستاذ|للاستاذ|لعم|لـ|ل)\s+([^\s,،]+)/);
  const customerName = customerMatch && customerMatch[1] && customerMatch[1].length > 1 ? customerMatch[1] : null;

  let discountAmount = 0;
  let discountPercent = 0;
  const percentMatch = normalizedText.match(/خصم\s*(\d+(?:\.\d+)?)\s*(?:%|في الميه|بالميه|بالمئه)/);
  const amountMatch = normalizedText.match(/خصم\s*(\d+(?:\.\d+)?)/);
  if (percentMatch) discountPercent = parseFloat(percentMatch[1]);
  else if (amountMatch) discountAmount = parseFloat(amountMatch[1]);

  // تقسيم الجملة على «و» وعلامات الترقيم و«ثم»
  /** «كيلو ونص» ما تتقسم: نحمي «ونص» بعلامة قبل التقسيم على «و» */
  const guarded = normalizedText
    .replace(/خصم\s*\d+(?:\.\d+)?\s*(?:%|في الميه|بالميه|بالمئه)?/g, ' ')
    .replace(/\s*و\s*نص(ف)?/g, ' §نص');

  const clauses = guarded
    .split(/,|،|\s+ثم\s+|\s+و\s+|\s+و(?=[^\s])/g)
    .map((c) => c.replace(/§نص/g, 'ونص').trim())
    .filter(Boolean);

  /** «كيلو ونص» تتقسم إلى «كيلو» و«نص» — نرجّع الكسر للجزء اللي قبله */
  const mergedClauses: string[] = [];
  for (const part of clauses) {
    const isFraction = /^(نص|نصف|ربع|تمن|تلاته ترباع)$/.test(normalizeArabic(part));
    if (isFraction && mergedClauses.length) {
      mergedClauses[mergedClauses.length - 1] = `${mergedClauses[mergedClauses.length - 1]} ونص`;
    } else {
      mergedClauses.push(part);
    }
  }

  const lines: ParsedLine[] = [];
  const clarifications: Clarification[] = [];

  for (const clause of mergedClauses) {
    const cleaned = cleanClause(clause);
    if (!cleaned || cleaned.length < 2) continue;
    if (NON_PRODUCT_WORDS.some((w) => cleaned.includes(normalizeArabic(w))) && cleaned.length <= 14) continue;

    // ضمير مبهم: «داك»، «الحاجة ديك»
    if (/داك|داكا|ديك|الحاجه دي|الشي دا|خمسه من داك/.test(cleaned)) {
      clarifications.push({
        phrase: clause,
        reason: 'اسم الصنف مبهم — قل اسم الصنف نفسه.',
        suggestions: products.slice(0, 4),
      });
      continue;
    }

    const { product, confidence } = matchProduct(cleaned, products);
    if (!product) {
      if (cleaned.length > 2) {
        clarifications.push({
          phrase: clause,
          reason: 'الصنف غير موجود في مخزونك أو الاسم غير واضح.',
          suggestions: products.slice(0, 4),
        });
      }
      continue;
    }

    const { quantity } = parseQuantity(cleaned);
    const spokenUnit = findUnitInText(cleaned);
    const baseUnit = resolveProductBaseUnit(product.unit);
    const unit = spokenUnit || baseUnit;
    const priced = priceForUnit(product.sellingPriceSdg, product.unit, unit.id, quantity);

    if (!priced.ok) {
      clarifications.push({
        phrase: clause,
        reason: `الصنف «${product.name}» مسعّر بـ${baseUnit.nameAr}، فما ينفع نبيعه بـ${unit.nameAr} بدون سعر مخصص.`,
        suggestions: [product],
      });
      continue;
    }

    lines.push({
      product,
      spokenName: cleaned,
      quantity,
      unitId: unit.id,
      unitName: unit.symbolAr,
      unitPrice: priced.unitPrice,
      confidence,
      note: priced.explanation,
    });
  }

  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const summary = lines.length
    ? `تم التعرف على ${lines.length} صنف بإجمالي ${Math.round(total).toLocaleString()} ج.س${
        discountAmount || discountPercent
          ? ` (خصم ${discountAmount || `${discountPercent}%`})`
          : ''
      }`
    : 'ما تعرّفنا على أي صنف — أعد المحاولة أو اختر الأصناف يدوياً.';

  return {
    lines,
    clarifications,
    paymentMethod,
    discountAmount,
    discountPercent,
    customerName,
    summary,
    normalizedText,
  };
}

/** كل الوحدات المتاحة لعرضها في الشاشة */
export const ALL_UNITS = SUDANESE_UNITS;
