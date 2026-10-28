import type { Request, Response } from 'express';

// Public, community-maintained catalogs. A barcode is not guaranteed to be present.
const CATALOGS = [
  { name: 'Open Food Facts', base: 'https://world.openfoodfacts.org' },
  { name: 'Open Beauty Facts', base: 'https://world.openbeautyfacts.org' },
  { name: 'Open Products Facts', base: 'https://world.openproductsfacts.org' },
] as const;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 250) : '';
}

async function queryCatalog(catalog: (typeof CATALOGS)[number], barcode: string) {
  const fields = 'product_name_ar,product_name_en,product_name,brands,quantity';
  const response = await fetch(`${catalog.base}/api/v2/product/${barcode}?fields=${fields}`, {
    headers: { 'User-Agent': 'SanadPOS/1.0 (alsiralsaig@gmail.com)' },
    signal: AbortSignal.timeout(7000),
  });
  // A missing code may be reported as either HTTP 404 or status=0.
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`catalog unavailable: ${response.status}`);
  const body: any = await response.json();
  if (body.status !== 1 || !body.product) return null;
  const p = body.product;
  const productName = text(p.product_name_ar) || text(p.product_name) || text(p.product_name_en);
  if (!productName) return null;
  const brand = text(p.brands).split(',')[0].trim();
  const quantity = text(p.quantity);
  const nameParts = [productName];
  if (brand && !productName.toLocaleLowerCase().includes(brand.toLocaleLowerCase())) nameParts.push(brand);
  if (quantity && !productName.toLocaleLowerCase().includes(quantity.toLocaleLowerCase())) nameParts.push(quantity);
  return { name: nameParts.join(' - '), source: catalog.name, sourceUrl: `${catalog.base}/product/${barcode}` };
}

export async function barcodeLookupHandler(req: Request, res: Response) {
  const barcode = req.params.barcode;
  if (!/^(?:\d{8}|\d{12,14})$/.test(barcode)) {
    return res.status(400).json({ error: 'استخدم باركود رقمي من 8 أو 12 إلى 14 رقماً.' });
  }
  res.set('Cache-Control', 'no-store');
  const results = await Promise.allSettled(CATALOGS.map((catalog) => queryCatalog(catalog, barcode)));
  const match = results.find((result) => result.status === 'fulfilled' && result.value !== null);
  if (match?.status === 'fulfilled' && match.value) return res.json({ found: true, product: match.value });
  // An incomplete search must not be reported as a confirmed absence.
  if (results.some((result) => result.status === 'rejected')) {
    return res.status(503).json({ error: 'تعذر البحث في قواعد البيانات حالياً. حاول مرة أخرى أو أكمل البيانات يدوياً.' });
  }
  return res.json({ found: false });
}
