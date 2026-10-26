/**
 * محرك الوحدات والأوزان السودانية — منقول من مشروع «حساباتي السودان»
 * (shared/units + src/data/initialData) ومهيّأ لبيانات سند.
 *
 * الفكرة: كل صنف في سند له وحدة أساس (كجم/لتر/حبة) وسعر للوحدة الواحدة.
 * المحرك يحوّل أي وحدة سودانية (رطل، أوقية، جوال، دستة، جركانة…) إلى سعر
 * عادل مشتق من سعر الأساس، ما لم يكن للتاجر سعر مخصص لتلك الوحدة.
 */

export type UnitType = 'weight' | 'volume' | 'count' | 'container';

export interface SudaneseUnit {
  id: string;
  nameAr: string;
  /** كل الصيغ اللي ممكن التاجر يقولها */
  aliases: string[];
  symbolAr: string;
  type: UnitType;
  /**
   * المعامل إلى الوحدة الأساسية لبُعدها:
   *   الوزن ⟹ كيلوجرام · الحجم ⟹ لتر · العدد ⟹ حبة
   */
  toBase: number;
  /** الوحدة الأساسية لبُعدها — للتحقق من قابلية التحويل */
  baseUnitId: string;
  equivalentStandard: string;
}

/** جدول الوحدات السودانية المتعارف عليها في الدكاكين والأسواق */
export const SUDANESE_UNITS: SudaneseUnit[] = [
  {
    id: 'kg',
    nameAr: 'كيلوجرام',
    aliases: ['كيلو', 'كيلوجرام', 'كيلوجرامات', 'كجم', 'كج', 'كيلو جرام', 'kilo', 'kg'],
    symbolAr: 'كجم',
    type: 'weight',
    toBase: 1,
    baseUnitId: 'kg',
    equivalentStandard: '1000 جرام',
  },
  {
    id: 'ratl',
    nameAr: 'رطل',
    aliases: ['رطل', 'رطله', 'رطلين', 'أرطال', 'ارطال', 'رطل ونص'],
    symbolAr: 'رطل',
    type: 'weight',
    // العرف السوداني: الرطل = 450 جرام
    toBase: 0.45,
    baseUnitId: 'kg',
    equivalentStandard: '450 جرام تقريباً',
  },
  {
    id: 'ouqya',
    nameAr: 'أوقية',
    aliases: ['أوقية', 'وقية', 'أواقي', 'اوقيه', 'وقيه', 'أوقيات'],
    symbolAr: 'وقية',
    type: 'weight',
    toBase: 0.0375,
    baseUnitId: 'kg',
    equivalentStandard: '37.5 جرام',
  },
  {
    id: 'ton',
    nameAr: 'طن',
    aliases: ['طن', 'طنين', 'أطنان', 'اطنان'],
    symbolAr: 'طن',
    type: 'weight',
    toBase: 1000,
    baseUnitId: 'kg',
    equivalentStandard: '1000 كجم',
  },
  {
    id: 'liter',
    nameAr: 'لتر',
    aliases: ['لتر', 'لترات', 'لترين', 'liter', 'l'],
    symbolAr: 'لتر',
    type: 'volume',
    toBase: 1,
    baseUnitId: 'liter',
    equivalentStandard: '1000 مل',
  },
  {
    id: 'jirkana',
    nameAr: 'جركانة',
    aliases: ['جركانة', 'جركانه', 'باغة', 'باقه', 'باغه', 'جراكن'],
    symbolAr: 'جركانة',
    type: 'volume',
    // الغالب في السوق: جركانة زيت 4 لتر
    toBase: 4,
    baseUnitId: 'liter',
    equivalentStandard: '4 لتر (باغة زيت)',
  },
  {
    id: 'piece',
    nameAr: 'حبة',
    aliases: ['حبة', 'حبه', 'قطعة', 'قطعه', 'حبات', 'قطع', 'واحدة', 'وحدة'],
    symbolAr: 'حبة',
    type: 'count',
    toBase: 1,
    baseUnitId: 'piece',
    equivalentStandard: 'قطعة واحدة',
  },
  {
    id: 'dasta',
    nameAr: 'دستة',
    aliases: ['دستة', 'دسته', 'دستتين', 'دستات', 'دزينة', 'درزن'],
    symbolAr: 'دستة',
    type: 'count',
    toBase: 12,
    baseUnitId: 'piece',
    equivalentStandard: '12 حبة',
  },
  {
    id: 'kartona',
    nameAr: 'كرتونة',
    aliases: ['كرتونة', 'كرتونه', 'كراتين', 'باكت', 'باكتين', 'باكتات', 'بارسل'],
    symbolAr: 'كرتونة',
    type: 'count',
    // افتراضي متحفظ: 12 حبة — التاجر يقدر يحدد سعراً مخصصاً للكرتونة
    toBase: 12,
    baseUnitId: 'piece',
    equivalentStandard: '12 حبة (افتراضي)',
  },
  {
    id: 'gawal',
    nameAr: 'جوال',
    aliases: ['جوال', 'جوالين', 'شكارة', 'شكاره', 'شوال', 'شوالات', 'جوالي'],
    symbolAr: 'جوال',
    type: 'weight',
    toBase: 50,
    baseUnitId: 'kg',
    equivalentStandard: '50 كجم (سكر/دقيق)',
  },
  {
    id: 'rabta',
    nameAr: 'ربطة',
    aliases: ['ربطة', 'ربطه', 'ربطات', 'حزمة', 'حزمه'],
    symbolAr: 'ربطة',
    type: 'count',
    toBase: 1,
    baseUnitId: 'piece',
    equivalentStandard: 'حزمة مجمعة',
  },
  {
    id: 'kouz',
    nameAr: 'كوز',
    aliases: ['كوز', 'كوزين', 'مكيال', 'مكيالين', 'قدح'],
    symbolAr: 'كوز',
    type: 'volume',
    toBase: 1,
    baseUnitId: 'liter',
    equivalentStandard: 'مكيال تقليدي للحبوب',
  },
];

/** توحيد شكل الحروف العربية: تشكيل، همزات، تاء مربوطة، ياء */
export function normalizeArabic(input: string): string {
  return (input || '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // تشكيل وتطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** أرقام عربية-هندية (٠١٢…) إلى لاتينية */
export function normalizeDigits(input: string): string {
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  return (input || '').replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));
}

/** إيجاد الوحدة المذكورة في نص — الأطول أولاً حتى لا «رطل» تأكل «رطلين» */
export function findUnitInText(text: string): SudaneseUnit | null {
  const norm = normalizeArabic(normalizeDigits(text));
  const sorted = [...SUDANESE_UNITS].sort((a, b) => b.nameAr.length - a.nameAr.length);
  for (const unit of sorted) {
    for (const alias of [unit.nameAr, ...unit.aliases]) {
      const needle = normalizeArabic(alias);
      if (!needle) continue;
      if (norm.includes(needle)) return unit;
    }
  }
  return null;
}

/** تحويل كمية من وحدة إلى أخرى — يرجع null لو الوحدتين من بُعدين مختلفين */
export function convertQuantity(
  quantity: number,
  fromUnitId: string,
  toUnitId: string
): number | null {
  const from = SUDANESE_UNITS.find((u) => u.id === fromUnitId);
  const to = SUDANESE_UNITS.find((u) => u.id === toUnitId);
  if (!from || !to) return null;
  if (from.baseUnitId !== to.baseUnitId) return null;
  const inBase = quantity * from.toBase;
  return Math.round((inBase / to.toBase) * 1000) / 1000;
}

/** الوحدة اللي بيسعّر عليها الصنف في سند (حقل unit نص حر) */
export function resolveProductBaseUnit(productUnit: string): SudaneseUnit {
  const found = findUnitInText(productUnit);
  if (found) return found;
  // افتراضي: حبة (معظم أصناف الدكان)
  return SUDANESE_UNITS.find((u) => u.id === 'piece')!;
}

export interface UnitPriceResult {
  /** سعر الوحدة المطلوبة */
  unitPrice: number;
  /** كمية الوحدة المطلوبة بالوحدة الأساسية للصنف */
  quantityInBaseUnits: number;
  /** الوحدة اللي حُسب منها السعر */
  baseUnit: SudaneseUnit;
  /** هل التحويل ممكن أصلاً */
  ok: boolean;
  /** شرح جاهز للعرض على الكاشير */
  explanation: string;
}

/**
 * سعر أي وحدة سودانية مشتق من سعر وحدة الصنف.
 * مثال: سكر الكيلو بـ1500 ⟹ الرطل 675، الجوال 75,000، الأوقية 56.25.
 */
export function priceForUnit(
  basePrice: number,
  productUnit: string,
  targetUnitId: string,
  quantity = 1
): UnitPriceResult {
  const base = resolveProductBaseUnit(productUnit);
  const target = SUDANESE_UNITS.find((u) => u.id === targetUnitId) || base;

  if (base.baseUnitId !== target.baseUnitId) {
    return {
      unitPrice: basePrice,
      quantityInBaseUnits: quantity,
      baseUnit: base,
      ok: false,
      explanation: `الوحدة «${target.nameAr}» لا تُقاس بنفس وحدة الصنف «${base.nameAr}» — يحتاج سعراً مخصصاً.`,
    };
  }

  const pricePerBase = basePrice / base.toBase;
  const raw = pricePerBase * target.toBase;
  // تقريب لوجيه: أرقام صحيحة إلا للكسور الصغيرة (أوقية)
  const unitPrice = raw >= 100 ? Math.round(raw) : Math.round(raw * 100) / 100;

  return {
    unitPrice,
    quantityInBaseUnits: Math.round(target.toBase * quantity * 1000) / 1000,
    baseUnit: base,
    ok: true,
    explanation:
      target.id === base.id
        ? `${quantity} ${target.symbolAr} × ${unitPrice.toLocaleString()} ج.س`
        : `${quantity} ${target.symbolAr} = ${Math.round(target.toBase * quantity * 1000) / 1000} ${base.symbolAr} × السعر ⟹ ${unitPrice.toLocaleString()} ج.س للـ${target.symbolAr}`,
  };
}

/** وحدات معقولة لصنف معيّن — تُعرض للكاشير كأزرار سريعة */
export function unitsForProduct(productUnit: string): SudaneseUnit[] {
  const base = resolveProductBaseUnit(productUnit);
  return SUDANESE_UNITS.filter((u) => u.baseUnitId === base.baseUnitId);
}
