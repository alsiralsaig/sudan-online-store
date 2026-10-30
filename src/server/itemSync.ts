import type { DatabaseSchema } from './db.ts';
import type { ItemLink, Product } from '../types/index.ts';

/**
 * مزامنة الأصناف بين الطبقات (B2B/B2C Item Sync)
 * ---------------------------------------------------------------------------
 * الطبقات: مورد ← جملة ← قطاعي.
 * القطاعي يربط صنفه بصنف عند الجملة (أو عند المورد إن كان VIP)، ويحدد هامش
 * ربح نسبة %. النتيجة:
 *   • الاسم / الوصف / تاريخ الصلاحية / الوحدة / التصنيف / الصورة تُنسخ تلقائياً.
 *   • سعر البيع = سعر المصدر + الهامش، ويُعاد حسابه في كل مزامنة (كل ساعة + عند
 *     فتح الشاشة + مباشرة بعد أي تعديل على صنف المصدر).
 *   • لو عدّل التاجر سعره بيده (priceMode='manual') لا ندهس تعديله، ونظهر له
 *     أنه معدّل يدوياً مع زر «إرجاع للسعر التلقائي».
 */

/** الهامش المسموح — يحمي من الأسعار السالبة أو الأخطاء المطبعية. */
export const MAX_MARGIN_PERCENT = 500;

export function clampMargin(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_MARGIN_PERCENT, Math.round(n * 100) / 100);
}

/** السعر المحسوب = سعر المصدر + الهامش %. */
export function priceWithMargin(sourcePriceSdg: number, marginPercent: number): number {
  const base = Number(sourcePriceSdg) || 0;
  const margin = clampMargin(marginPercent);
  const price = base * (1 + margin / 100);
  /* لا كسور في الجنيه — تقريب لأقرب جنيه */
  return Math.max(0, Math.round(price));
}

/** هل يستطيع هذا المتجر رؤية بضاعة متجر آخر؟ (الطبقة الأعلى فقط، وVIP للمورد) */
export function canSeeCatalogOf(
  viewer: { accountSegment?: string; isVip?: boolean } | null | undefined,
  owner: { accountSegment?: string } | null | undefined
): boolean {
  const viewerSegment = viewer?.accountSegment || 'retailer';
  const ownerSegment = owner?.accountSegment || 'retailer';
  if (viewerSegment === 'retailer') {
    /* القطاعي يرى الجملة دائماً، والمورد فقط لو VIP */
    if (ownerSegment === 'wholesaler') return true;
    if (ownerSegment === 'supplier') return Boolean(viewer?.isVip);
    return false;
  }
  if (viewerSegment === 'wholesaler') return ownerSegment === 'supplier';
  /* المورد لا يشتري من أحد */
  return false;
}

/**
 * مزامنة كل الروابط لمتجر معيّن (أو كل المتاجر إن لم يُحدد).
 * ترجع عدد الروابط التي تغيّر شيء فيها.
 */
export function syncItemLinks(data: DatabaseSchema, retailerId?: string): number {
  const links = data.itemLinks || [];
  if (!links.length) return 0;

  let changed = 0;
  const now = new Date().toISOString();

  for (const link of links) {
    if (retailerId && link.retailerId !== retailerId) continue;

    const source = data.products.find((p) => p.id === link.sourceItemId && p.isActive !== false);
    const target = data.products.find((p) => p.id === link.retailerItemId);

    /* المصدر اختفى: نوقف التحديث ولا نحذف صنف التاجر */
    if (!source || !target) continue;

    const sourcePrice = Number(source.sellingPriceSdg) || 0;
    const autoPrice = priceWithMargin(sourcePrice, link.marginPercent);

    let touched = false;

    /* نسخ بيانات المصدر (الاسم والوصف والصلاحية وغيرها) */
    const copyFields: (keyof Product)[] = ['name', 'category', 'unit', 'imageUrl', 'videoUrl', 'expiryDate'];
    for (const field of copyFields) {
      const incoming = (source as any)[field];
      if (incoming === undefined || incoming === null || incoming === '') continue;
      if ((target as any)[field] !== incoming) {
        (target as any)[field] = incoming;
        touched = true;
      }
    }
    if ((source as any).description && (target as any).description !== (source as any).description) {
      (target as any).description = (source as any).description;
      touched = true;
    }

    /* السعر: تلقائي يُحسب دائماً، ويدوي يبقى كما هو ما دام المصدر لم يتغيّر */
    const priceMoved = Number(link.lastSourcePriceSdg) !== sourcePrice;
    if (link.priceMode === 'manual' && priceMoved) {
      /* نبه ضمنياً: نُبقي السعر اليدوي ونحدّث مرجع المصدر ليعرف أن الأساس تغيّر */
      (link as ItemLink).lastSourcePriceSdg = sourcePrice;
      touched = true;
    } else if (link.priceMode !== 'manual' && Number(target.sellingPriceSdg) !== autoPrice) {
      (target as any).sellingPriceSdg = autoPrice;
      (target as any).purchaseCost = sourcePrice;
      touched = true;
    }

    (target as any).linkedToItemId = source.id;
    (target as any).linkId = link.id;

    if (touched || Number(link.lastSyncedPriceSdg) !== autoPrice || link.lastSyncedAt !== now) {
      (link as ItemLink).lastSourcePriceSdg = sourcePrice;
      (link as ItemLink).lastSyncedPriceSdg = autoPrice;
      (link as ItemLink).lastSyncedAt = now;
      changed += 1;
    }
  }

  return changed;
}

/** رابط موجود لنفس الزوج؟ (منع تكرار الربط) */
export function findLink(data: DatabaseSchema, retailerId: string, sourceItemId: string): ItemLink | undefined {
  return (data.itemLinks || []).find((l) => l.retailerId === retailerId && l.sourceItemId === sourceItemId);
}
