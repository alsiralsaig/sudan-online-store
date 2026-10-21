/**
 * Parallel-market ("السوق الموازي") exchange rates.
 *
 * Sudan runs on the parallel rate, not the bank rate, so the platform reads the
 * live table published by alsoug.com (سوق السودان) — it lists both
 * «بنك الخرطوم» (official) and «البديل» (parallel) per currency.
 *
 * The page is parsed defensively: any layout change simply yields no rows and
 * we keep the last good snapshot instead of showing invented numbers.
 * A stale-reading guard (MAX_AGE_HOURS) prevents months-old values being
 * presented as "today's rate".
 */

export interface LiveRate {
  code: string;
  official: number | null;
  parallel: number | null;
}

export interface LiveRatesSnapshot {
  rates: LiveRate[];
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  /** true when the fetch failed and these numbers came from an older snapshot */
  stale: boolean;
}

const SOURCE_URL = 'https://www.alsoug.com/currency';
const SOURCE_NAME = 'سوق السودان (alsoug.com)';

/** Arabic/English names as they appear in the table → ISO code. */
const CODE_BY_LABEL: Array<{ match: RegExp; code: string }> = [
  { match: /دولار\s*الامريكي|دولار\s*الأمريكي|USD/i, code: 'USD' },
  { match: /درهم\s*الاماراتي|درهم\s*الإماراتي|AED/i, code: 'AED' },
  { match: /يورو|EUR/i, code: 'EUR' },
  { match: /ريال\s*السعودي|SAR/i, code: 'SAR' },
  { match: /جنيه\s*المصري|EGP/i, code: 'EGP' },
  { match: /ريال\s*القطري|QAR/i, code: 'QAR' },
  { match: /جنيه\s*الاسترليني|GBP/i, code: 'GBP' },
];

/** "4,886.38" / "10386" / "1.338,74" → number */
const toNumber = (raw: string): number | null => {
  let s = String(raw || '').trim();
  if (!s) return null;
  // European style (1.338,74) vs plain (4,886.38)
  if (/,\d{1,2}$/.test(s) && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Pull the first table that carries a «البديل» column. */
const extractTableRows = (html: string): string[] => {
  const rows: string[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html))) {
    const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (c) => c[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim()
    );
    if (cells.length >= 2) rows.push(cells.join('|'));
  }
  return rows;
};

export const parseAlsougRates = (html: string): LiveRate[] => {
  const out: LiveRate[] = [];
  const seen = new Set<string>();

  for (const row of extractTableRows(html)) {
    const cells = row.split('|');
    const label = cells[0] || '';
    const hit = CODE_BY_LABEL.find((c) => c.match.test(label));
    if (!hit || seen.has(hit.code)) continue;

    // Keep only the numeric tokens (the page interleaves arrow icons as text)
    const numbers = cells
      .slice(1)
      .map((c) => (c.match(/[\d][\d.,]*/g) || []).map(toNumber).filter((n): n is number => n !== null))
      .filter((arr) => arr.length > 0);

    const official = numbers[0]?.[0] ?? null;
    const parallel = numbers[1]?.[0] ?? null;
    // A sane rate is at least 1 SDG per unit and under a million
    const ok = (n: number | null) => (n !== null && n >= 1 && n < 1_000_000 ? n : null);

    if (ok(official) === null && ok(parallel) === null) continue;
    out.push({ code: hit.code, official: ok(official), parallel: ok(parallel) });
    seen.add(hit.code);
  }

  return out;
};

/** Browser-like headers — the site answers 403 to plain bots. */
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ar,en-US;q=0.7,en;q=0.6',
  Referer: 'https://www.google.com/',
  'Cache-Control': 'no-cache',
};

/**
 * Backup source: Sudan Akhbar publishes a daily parallel-market article.
 * We only take it when alsoug is unreachable, and only if it clearly lists
 * a "السوق السوداء" table — same table shape, same parser.
 */
const SUDANAKHBAR_HOME = 'https://www.sudanakhbar.com/business-news/currency-rates-prices';

const fetchSudanAkhbarRates = async (): Promise<LiveRate[]> => {
  try {
    const c1 = new AbortController();
    const t1 = setTimeout(() => c1.abort(), 8000);
    const listing = await fetch(SUDANAKHBAR_HOME, { signal: c1.signal, headers: BROWSER_HEADERS });
    clearTimeout(t1);
    if (!listing.ok) return [];
    const html = await listing.text();

    // newest article that mentions the parallel market
    const linkRe = /href="(https:\/\/www\.sudanakhbar\.com\/\d{6,})"[^>]*>([^<]{10,160})</g;
    let best: string | null = null;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html))) {
      if (/السوق السوداء|الموازي/.test(m[2])) {
        best = m[1];
        break;
      }
    }
    if (!best) return [];

    const c2 = new AbortController();
    const t2 = setTimeout(() => c2.abort(), 8000);
    const article = await fetch(best, { signal: c2.signal, headers: BROWSER_HEADERS });
    clearTimeout(t2);
    if (!article.ok) return [];

    const body = await article.text();
    if (!/السوق السوداء|الموازي/.test(body)) return [];
    const rates = parseAlsougRates(body);
    // Only trust it when every rate looked like a plausible SDG value
    return rates.filter((r) => r.parallel !== null && r.parallel >= 100);
  } catch {
    return [];
  }
};

/** Fetch the live page and parse it. Never throws. */
export const fetchLiveRates = async (): Promise<LiveRatesSnapshot | null> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(SOURCE_URL, { signal: controller.signal, headers: BROWSER_HEADERS });
    clearTimeout(timer);

    if (res.ok) {
      const html = await res.text();
      const rates = parseAlsougRates(html);
      if (rates.length) {
        return {
          rates,
          source: SOURCE_NAME,
          sourceUrl: SOURCE_URL,
          fetchedAt: new Date().toISOString(),
          stale: false,
        };
      }
    }
  } catch {
    /* fall through to the backup source */
  }

  // Backup source
  const backup = await fetchSudanAkhbarRates();
  if (backup.length) {
    return {
      rates: backup,
      source: BACKUP_SOURCE_NAME,
      sourceUrl: SUDANAKHBAR_HOME,
      fetchedAt: new Date().toISOString(),
      stale: false,
    };
  }

  return null;
};

/** Readings older than this are flagged so nobody trades on an old number. */
export const MAX_AGE_HOURS = 36;

export const ageHours = (iso?: string): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 36e5;
};

export const isStale = (iso?: string): boolean => {
  const h = ageHours(iso);
  return h === null ? true : h > MAX_AGE_HOURS;
};

export const BACKUP_SOURCE_NAME = 'اخبار السودان (sudanakhbar.com)';

export const RATES_SOURCE = {
  primary: { url: SOURCE_URL, name: SOURCE_NAME },
  backup: { url: SUDANAKHBAR_HOME, name: BACKUP_SOURCE_NAME },
};
