/** توحيد ومقارنة الباركود — مسافات، أصفار، ورقم ناقص من القص. */
export function normalizeBarcode(raw?: string | null): string {
  return (raw || '').replace(/[\s\u200e\u200f-]/g, '');
}

export function barcodesMatch(a?: string | null, b?: string | null): boolean {
  const x = normalizeBarcode(a);
  const y = normalizeBarcode(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const minLen = Math.min(x.length, y.length);
  if (minLen >= 8 && (x.startsWith(y) || y.startsWith(x))) return true;
  const sx = x.replace(/^0+/, '');
  const sy = y.replace(/^0+/, '');
  return sx.length >= 8 && sx === sy;
}

export function findByBarcodeOrSku<T extends { barcode?: string; sku?: string; name?: string }>(
  items: T[],
  scanned: string
): T | undefined {
  const q = normalizeBarcode(scanned);
  if (!q) return undefined;
  return (
    items.find((it) => barcodesMatch(it.barcode, q) || normalizeBarcode(it.sku) === q) ||
    items.find((it) => (it.name || '').trim() === scanned.trim())
  );
}

export function looksLikeBarcode(raw?: string | null): boolean {
  const q = normalizeBarcode(raw);
  return q.length >= 8 && /^\d+$/.test(q);
}

export function productMatchesSearch(
  product: { name?: string; sku?: string; barcode?: string; category?: string },
  query: string
): boolean {
  const q = (query || '').trim();
  if (!q) return true;
  const nq = q.toLowerCase();
  if ((product.name || '').toLowerCase().includes(nq)) return true;
  if ((product.category || '').toLowerCase().includes(nq)) return true;
  if ((product.sku || '').toLowerCase().includes(nq)) return true;
  if ((product.barcode || '').includes(q)) return true;
  return barcodesMatch(product.barcode, q) || normalizeBarcode(product.sku) === normalizeBarcode(q);
}

export function pastedBarcode(raw: string): string {
  return normalizeBarcode(raw);
}
