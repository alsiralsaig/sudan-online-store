/**
 * Shared invoice arithmetic — single source of truth for POS, server, offline
 * sync and refund previews. Every amount is rounded to 2 decimal places.
 *
 * Rules:
 *  - Line discount is applied before VAT.
 *  - Invoice-level discount is distributed proportionally across lines before
 *    VAT, so mixed rates / exempt lines stay correct.
 *  - Refunds return the customer's actual paid share (net + VAT), and the last
 *    refund of a line receives the exact remaining remainder.
 */

export interface InvoiceLineInput {
  productId: string;
  productName?: string;
  unit?: string;
  quantity: number;
  unitPriceSdg: number;
  discountSdg?: number;
  isTaxExempt?: boolean;
  taxRate?: number;
  notes?: string;
  costPerUnitSdg?: number;
}

export interface ComputedInvoiceLine extends InvoiceLineInput {
  productName: string;
  unit: string;
  /** quantity * unitPrice - lineDiscount, before invoice-level discount */
  lineNetSdg: number;
  /** share of the invoice-level discount allocated to this line */
  invoiceDiscountShareSdg: number;
  /** lineNetSdg - invoiceDiscountShareSdg (tax base for exclusive prices) */
  netSdg: number;
  taxRate: number;
  taxAmountSdg: number;
  /** what the customer actually pays for this line, VAT included */
  totalSdg: number;
}

export interface InvoiceTotals {
  lines: ComputedInvoiceLine[];
  /** sum of line nets before invoice-level discount */
  subtotalSdg: number;
  discountTotalSdg: number;
  taxTotalSdg: number;
  grandTotalSdg: number;
}

export interface InvoiceSettings {
  vatEnabled: boolean;
  defaultVatPct: number;
  pricesIncludeVat: boolean;
}

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function validateInvoiceLine(line: InvoiceLineInput): string | null {
  const qty = Number(line.quantity);
  const price = Number(line.unitPriceSdg);
  const discount = Number(line.discountSdg ?? 0);
  if (!Number.isFinite(qty) || qty <= 0) return 'الكمية يجب أن تكون رقماً موجباً';
  if (!Number.isFinite(price) || price < 0) return 'السعر يجب أن يكون رقماً صالحاً (صفر أو أكثر)';
  if (!Number.isFinite(discount) || discount < 0) return 'الخصم يجب أن يكون رقماً صالحاً غير سالب';
  if (discount > round2(qty * price) + 0.005) return 'خصم البند أكبر من قيمته';
  const rate = Number(line.taxRate ?? 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return 'معدل الضريبة غير صالح';
  return null;
}

/**
 * Compute invoice totals. `invoiceDiscountSdg` is clamped to the subtotal and
 * distributed proportionally to each line's net value.
 */
export function computeInvoiceTotals(
  items: InvoiceLineInput[],
  settings: InvoiceSettings,
  invoiceDiscountSdg = 0
): InvoiceTotals {
  const prepared = items.map((it) => {
    const qty = Number(it.quantity);
    const price = Number(it.unitPriceSdg);
    const lineDiscount = Math.min(round2(Number(it.discountSdg ?? 0)), round2(qty * price));
    const lineNet = round2(qty * price - lineDiscount);
    const rate = it.isTaxExempt || !settings.vatEnabled ? 0 : Number(it.taxRate ?? settings.defaultVatPct);
    return { ...it, quantity: qty, unitPriceSdg: price, discountSdg: lineDiscount, lineNet, rate };
  });

  const subtotal = round2(prepared.reduce((s, l) => s + l.lineNet, 0));
  const requestedDiscount = round2(Math.max(0, Number(invoiceDiscountSdg) || 0));
  const discountTotal = Math.min(requestedDiscount, subtotal);

  // Distribute invoice discount proportionally; last line absorbs rounding.
  let allocated = 0;
  const lines: ComputedInvoiceLine[] = prepared.map((l, idx) => {
    let share = 0;
    if (discountTotal > 0 && subtotal > 0) {
      share = idx === prepared.length - 1
        ? round2(discountTotal - allocated)
        : round2((l.lineNet / subtotal) * discountTotal);
      allocated = round2(allocated + share);
    }
    const net = round2(Math.max(0, l.lineNet - share));
    let tax = 0;
    if (settings.vatEnabled && l.rate > 0) {
      tax = settings.pricesIncludeVat
        ? round2(net - net / (1 + l.rate / 100))
        : round2(net * (l.rate / 100));
    }
    const total = settings.pricesIncludeVat ? net : round2(net + tax);
    return {
      productId: l.productId,
      productName: l.productName || 'صنف',
      unit: l.unit || 'حبة',
      quantity: l.quantity,
      unitPriceSdg: l.unitPriceSdg,
      discountSdg: l.discountSdg,
      isTaxExempt: l.isTaxExempt,
      taxRate: l.rate,
      notes: l.notes,
      costPerUnitSdg: l.costPerUnitSdg,
      lineNetSdg: l.lineNet,
      invoiceDiscountShareSdg: share,
      netSdg: net,
      taxAmountSdg: tax,
      totalSdg: total,
    };
  });

  const taxTotal = round2(lines.reduce((s, l) => s + l.taxAmountSdg, 0));
  const grandTotal = round2(lines.reduce((s, l) => s + l.totalSdg, 0));
  return { lines, subtotalSdg: subtotal, discountTotalSdg: discountTotal, taxTotalSdg: taxTotal, grandTotalSdg: grandTotal };
}

/* ------------------------------------------------------------------ */
/*  Refund allocation                                                  */
/* ------------------------------------------------------------------ */

export interface RefundableLine {
  productId: string;
  productName: string;
  quantity: number;
  /** actual paid amount for the whole line, VAT included */
  totalSdg: number;
  taxAmountSdg?: number;
}

export interface RefundAllocationLine {
  productId: string;
  productName: string;
  quantity: number;
  refundAmountSdg: number;
  taxRefundSdg: number;
}

export interface RefundAllocation {
  lines: RefundAllocationLine[];
  totalRefundSdg: number;
  taxRefundSdg: number;
}

/**
 * Allocate a refund across lines proportionally to what was actually paid.
 * `requested` maps productId -> quantity (already aggregated). The final
 * refund of a product receives the exact remaining amount so partial refunds
 * always reconcile to the original grand total.
 */
export function allocateRefund(
  saleLines: RefundableLine[],
  previouslyReturned: Record<string, { quantity: number; amountSdg: number; taxSdg?: number }>,
  requested: Record<string, number>,
  saleGrandTotalSdg: number,
  saleRefundedAmountSdg: number
): RefundAllocation {
  const lines: RefundAllocationLine[] = [];
  let total = 0;
  let taxTotal = 0;

  // Aggregate duplicate product lines in the original sale.
  const byProduct = new Map<string, { productName: string; quantity: number; totalSdg: number; taxAmountSdg: number }>();
  for (const l of saleLines) {
    const cur = byProduct.get(l.productId) || { productName: l.productName, quantity: 0, totalSdg: 0, taxAmountSdg: 0 };
    cur.quantity += Number(l.quantity) || 0;
    cur.totalSdg += Number(l.totalSdg) || 0;
    cur.taxAmountSdg += Number(l.taxAmountSdg ?? 0);
    byProduct.set(l.productId, cur);
  }

  const remainingRefundable = round2(Math.max(0, saleGrandTotalSdg - saleRefundedAmountSdg));

  for (const [productId, agg] of byProduct) {
    const qty = Number(requested[productId] || 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const prev = previouslyReturned[productId] || { quantity: 0, amountSdg: 0, taxSdg: 0 };
    const available = round2(Math.max(0, agg.quantity - prev.quantity));
    const take = Math.min(qty, available);
    if (take <= 0) continue;

    const isLast = Math.abs(take - available) < 1e-9;
    const remainingLineAmount = round2(Math.max(0, agg.totalSdg - prev.amountSdg));
    const remainingLineTax = round2(Math.max(0, agg.taxAmountSdg - (prev.taxSdg || 0)));

    let amount: number;
    let tax: number;
    if (isLast) {
      amount = remainingLineAmount;
      tax = remainingLineTax;
    } else {
      const unitPaid = agg.quantity > 0 ? agg.totalSdg / agg.quantity : 0;
      const unitTax = agg.quantity > 0 ? agg.taxAmountSdg / agg.quantity : 0;
      amount = round2(unitPaid * take);
      tax = round2(unitTax * take);
    }

    lines.push({ productId, productName: agg.productName, quantity: take, refundAmountSdg: amount, taxRefundSdg: tax });
    total = round2(total + amount);
    taxTotal = round2(taxTotal + tax);
  }

  // Never refund more than what remains on the invoice.
  if (total > remainingRefundable) {
    const excess = round2(total - remainingRefundable);
    for (let i = lines.length - 1; i >= 0 && excess > 0; i--) {
      const reducible = Math.min(lines[i].refundAmountSdg, excess);
      lines[i].refundAmountSdg = round2(lines[i].refundAmountSdg - reducible);
      total = round2(total - reducible);
      break;
    }
  }

  return { lines: lines.filter((l) => l.refundAmountSdg > 0 || l.quantity > 0), totalRefundSdg: total, taxRefundSdg: taxTotal };
}

/** Build the previously-returned map from existing return records. */
export function previouslyReturnedMap(
  returns: { items: { productId: string; quantity: number; refundAmountSdg: number; taxRefundSdg?: number; taxAmountSdg?: number }[] }[]
): Record<string, { quantity: number; amountSdg: number; taxSdg: number }> {
  const map: Record<string, { quantity: number; amountSdg: number; taxSdg: number }> = {};
  for (const r of returns) {
    for (const it of r.items || []) {
      const cur = map[it.productId] || { quantity: 0, amountSdg: 0, taxSdg: 0 };
      cur.quantity += Number(it.quantity) || 0;
      cur.amountSdg += Number(it.refundAmountSdg) || 0;
      cur.taxSdg += Number(it.taxRefundSdg ?? it.taxAmountSdg ?? 0);
      map[it.productId] = cur;
    }
  }
  return map;
}

/**
 * Legacy sales (pre-fix) stored tax before discount and totals that may not
 * reconcile. Infer per-line paid amounts from the stored grand total so old
 * invoices can still be refunded fairly.
 */
export function legacyRefundableLines(sale: {
  items: { productId: string; productName: string; quantity: number; totalSdg: number; taxAmountSdg?: number; taxRate?: number }[];
  grandTotalSdg: number;
  taxTotalSdg: number;
  subtotalSdg: number;
  discountTotalSdg?: number;
}): RefundableLine[] {
  const grand = Number(sale.grandTotalSdg) || 0;
  const storedNet = round2(sale.items.reduce((s, i) => s + (Number(i.totalSdg) || 0), 0));
  const storedTax = Number(sale.taxTotalSdg) || 0;
  // If stored line totals + tax already match grand, trust them.
  if (Math.abs(storedNet + storedTax - grand) < 0.02) {
    return sale.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      totalSdg: round2((Number(i.totalSdg) || 0) + (Number(i.taxAmountSdg) || 0)),
      taxAmountSdg: Number(i.taxAmountSdg) || 0,
    }));
  }
  // Otherwise distribute the actual grand total proportionally to line nets.
  const weightSum = storedNet || 1;
  let allocated = 0;
  return sale.items.map((i, idx) => {
    const weight = Number(i.totalSdg) || 0;
    const paid = idx === sale.items.length - 1
      ? round2(grand - allocated)
      : round2((weight / weightSum) * grand);
    allocated = round2(allocated + paid);
    const taxShare = storedTax > 0 && storedNet > 0 ? round2((weight / weightSum) * storedTax) : 0;
    return { productId: i.productId, productName: i.productName, quantity: i.quantity, totalSdg: paid, taxAmountSdg: taxShare };
  });
}
