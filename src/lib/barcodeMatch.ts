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
