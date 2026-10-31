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
  /** سعر الشراء المعلن في المصدر (اختياري) */
  buy?: number | null;
  /** سعر البيع المعلن في المصدر (اختياري) */
  sell?: number | null;
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
  /** When the *source itself* says the table was published (articles only). */
  sourceUpdatedAt?: string;
  /** Headline of the article the numbers were taken from. */
  sourceTitle?: string;
}

const SOURCE_URL = 'https://www.alsoug.com/currency';
export const SOURCE_NAME = 'سوق السودان (alsoug.com)';

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

/* ------------------------------------------------------------------ */
/*  sudanakhbar.com — rates live inside a daily article, not a table    */
/* ------------------------------------------------------------------ */

const AR_MONTHS: Record<string, number> = {
  يناير: 0, فبراير: 1, مارس: 2, ابريل: 3, أبريل: 3, مايو: 4, يونيو: 5,
  يوليو: 6, اغسطس: 7, أغسطس: 7, سبتمبر: 8, اكتوبر: 9, أكتوبر: 9,
  نوفمبر: 10, ديسمبر: 11,
};

/** "22 أكتوبر، 2026 - 8:12 صباحاً" → ISO string (UTC, Khartoum = UTC+2). */
export const parseArabicPublishedAt = (text: string): string | undefined => {
  const m = text.match(
    /(\d{1,2})\s+([\u0600-\u06FF]{3,10})\s*[،,]?\s*(\d{4})\s*(?:-|—|\|)?\s*(\d{1,2})[:.](\d{2})?\s*(صباح|مساء|ص|م)?/
  );
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = AR_MONTHS[m[2].replace(/[^\u0621-\u064A]/g, '')];
  const year = Number(m[3]);
  if (month === undefined || !day || !year) return undefined;
  let hour = Number(m[4] || 0);
  const minute = Number(m[5] || 0);
  const meridiem = m[6] || '';
  if ((meridiem === 'مساء' || meridiem === 'م') && hour < 12) hour += 12;
  if ((meridiem === 'صباح' || meridiem === 'ص') && hour === 12) hour = 0;
  // Sudan is UTC+2 year-round
  const utc = Date.UTC(year, month, day, hour - 2, minute);
  return new Date(utc).toISOString();
};

/** Strips tags to plain text so an article body can be scanned. */
const htmlToText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const AR_LABEL_TO_CODE: Array<{ re: RegExp; code: string }> = [
  // NB: all groups are non-capturing — the captured number must stay at index 1
  /* «الدولار» وحدها كافية — المقال يكتب «سعر شراء الدولار» بلا صفة */
  { re: /(?:الدولار|دولار)(?:\s*(?:الأمريكي|الامريكي|الاميركي|الأميركي))?/i, code: 'USD' },
  { re: /الريال\s*السعودي/i, code: 'SAR' },
  { re: /الدرهم\s*(?:الإماراتي|الاماراتي)/i, code: 'AED' },
  { re: /اليورو/i, code: 'EUR' },
  { re: /(?:الجنيه|الجنية)\s*(?:المصري|المصرى)/i, code: 'EGP' },
  { re: /الريال\s*القطري/i, code: 'QAR' },
  { re: /(?:الجنيه|الجنية)\s*(?:الإسترليني|الاسترليني|الاسترلينى)/i, code: 'GBP' },
  { re: /الريال\s*العماني/i, code: 'OMR' },
  { re: /الدينار\s*الكويتي/i, code: 'KWD' },
  { re: /الدينار\s*البحريني/i, code: 'BHD' },
  /* الليرة التركية لا ترد في جدول «السوق الموازي» بل في جداول البنوك */
  { re: /(?:الليرة|ليرة)\s*التركية/i, code: 'TRY' },
  { re: /الروبل\s*الروسي/i, code: 'RUB' },
  { re: /اليوان\s*الصيني/i, code: 'CNY' },
];

/**
 * سعرا الشراء والبيع كما هما في نص «أخبار السودان».
 * ------------------------------------------------------------------
 * المقال يكتب: «ارتفاع سعر شراء الدولار إلى 10300 جنيه، مقابل 10500 جنيه
 * للبيع». القارئ القديم كان يأخذ أول رقم يجده (سوق السودان: 10310) أو
 * الرقم الخطأ من داخل جملة طويلة، فيخرج السعر غير مطابق للمصدر.
 * هذه الدالة تقرأ الجملة نفسها وتعطي (شراء، بيع) بالترتيب الصحيح.
 */
const buySellFor = (scope: string, label: RegExp): { buy: number; sell: number } | null => {
  const NUM = '([0-9][0-9,]{2,}(?:\\.[0-9]+)?)';
  const num = (x?: string) => toNumber(x);
  const ok = (n: number | null): n is number => n !== null && n >= 100 && n < 1_500_000;

  /*
   * نقسم النص جُمل. المقال يقارن أسعار اليوم بالأمس وبالسبت، فلو أخذنا أول
   * رقم في الصفحة نقع على رقم قديم (10310 أو 10100 بدل 10500 الحقيقي).
   * لذلك نستبعد جمل المقارنة أولاً.
   */
  /* لا نكسر الأرقام العشرية: النقطة تُعدّ نهاية جملة فقط لو بعدها مسافة */
  const sentences = scope.split(/[!؟\n]+|\.\s+/).map((x) => x.trim()).filter(Boolean);
  /*
   * الجملة الواحدة قد تحمل «سعر اليوم … مقارنة بمستويات الأمس»؛ نُبقي الجزء
   * الأول فقط (سعر اليوم) بدل رمي الجملة كلها — وإلا ضاع سعر الدولار الحقيقي.
   */
  const trimComparison = (t: string) =>
    t.split(/مقارنة|مقابل مستويات|التي بلغت|الأربعاء|السبت|أمس|سابق/)[0].trim();
  const current = sentences.map(trimComparison).filter(Boolean);
  const pools = [current, sentences];

  const attempts: Array<(t: string) => { buy: number; sell: number } | null> = [
    // «ارتفاع سعر شراء الدولار إلى 10300 جنيه، مقابل 10500 جنيه للبيع»
    (t) => {
      const m = t.match(
        new RegExp(
          `شراء\\s*${label.source}[^.]{0,80}?${NUM}[^.]{0,120}?${NUM}\\s*(?:جنيه[اً]?)?\\s*للبيع`,
          'i'
        )
      );
      const a = num(m?.[1]);
      const b = num(m?.[2]);
      return ok(a) && ok(b) ? { buy: Math.min(a, b), sell: Math.max(a, b) } : null;
    },
    // «2745.64 جنيه للشراء و2798.96 جنيه للبيع» داخل جملة تخص العملة
    (t) => {
      if (!label.test(t)) return null;
      const m = t.match(
        new RegExp(`${NUM}\\s*(?:جنيه[اً]?)?\\s*للشراء\\s*و\\s*${NUM}\\s*(?:جنيه[اً]?)?\\s*للبيع`, 'i')
      );
      const a = num(m?.[1]);
      const b = num(m?.[2]);
      return ok(a) && ok(b) ? { buy: Math.min(a, b), sell: Math.max(a, b) } : null;
    },
    // «ارتفاع سعر بيع الدولار إلى 10500 جنيه» — سعر البيع وحده
    (t) => {
      if (!label.test(t)) return null;
      const m = t.match(
        new RegExp(`بيع\\s*${label.source}[^.]{0,60}?(?:إلى|الى)?\\s*${NUM}`, 'i')
      );
      const sell = num(m?.[1]);
      return ok(sell) ? { buy: sell, sell } : null;
    },
    // «الدولار الأمريكي 10500 جنيه» — آخر ملاذ
    (t) => {
      if (!label.test(t)) return null;
      const m = t.match(new RegExp(`${label.source}\\s*(?:جنيه[اً]?)?\\s*${NUM}`, 'i'));
      const v = num(m?.[1]);
      return ok(v) ? { buy: v, sell: v } : null;
    },
  ];

  /* النمط الأقوى يُجرّب على كل الجُمل أولاً، ثم الأضعف — لا العكس */
  for (const attempt of attempts) {
    for (const pool of pools) {
      for (const t of pool) {
        const r = attempt(t);
        if (r) return r;
      }
    }
  }
  return null;
};

export const parseSudanAkhbarArticle = (
  html: string
): { rates: LiveRate[]; publishedAt?: string; title?: string } => {
  const text = htmlToText(html);
  const title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Prefer the block that explicitly says «السوق الموازي»; fall back to all text.
  const blockStart = text.search(/متوسط\s*(اسعار|أسعار)\s*العملات/i);
  const scope = blockStart >= 0 ? text.slice(blockStart) : text;

  const rates: LiveRate[] = [];
  const seen = new Set<string>();

  const NUM = '([0-9][0-9,]{2,}(?:\\.[0-9]+)?)';
  /**
   * Ordered candidates — the first plausible value wins.
   * `pick` says which capture group holds the price we want (2 = the selling
   * price in «X جنيه للشراء وY جنيه للبيع»).
   */
  const patternsFor = (source: string): Array<{ re: RegExp; pick: number }> => [
    {
      // «10200 جنيه للشراء و10393.1747 جنيه للبيع» → the sell price
      re: new RegExp(
        source + `\\s*(?:جنيه[اً]?)?\\s*${NUM}\\s*(?:جنيه[اً]?)?\\s*للشراء\\s*و\\s*${NUM}\\s*(?:جنيه[اً]?)?\\s*للبيع`,
        'i'
      ),
      pick: 2,
    },
    {
      // «10200 و10393 للبيع»
      re: new RegExp(
        source + `\\s*(?:جنيه[اً]?)?\\s*${NUM}\\s*(?:جنيه[اً]?)?\\s*و\\s*${NUM}\\s*(?:جنيه[اً]?)?\\s*للبيع`,
        'i'
      ),
      pick: 2,
    },
    {
      // «10393.1747 ( ارتفاع سعر متوسط )» → the market average table
      re: new RegExp(source + `\\s*${NUM}\\s*\\(\\s*(?:ارتفاع|انخفاض)`),
      pick: 1,
    },
    {
      // «13662.3000 جنيهاً للبيع»
      re: new RegExp(source + `\\s*${NUM}\\s*(?:جنيه[اً]?)?\\s*للبيع`),
      pick: 1,
    },
    {
      // plain «الدولار الامريكي 10200 جنيها»
      re: new RegExp(source + `\\s*${NUM}`),
      pick: 1,
    },
  ];

  for (const { re, code } of AR_LABEL_TO_CODE) {
    if (seen.has(code)) continue;
    let value: number | null = null;

    /*
     * الأولوية لصيغة «شراء … مقابل … للبيع» — هي الصيغة الفعلية للمقال.
     * السعر المعتمد للتداول هو سعر البيع، والشراء يُحفظ للعرض فقط.
     */
    /*
     * نص المقال أولاً ثم الجدول: جملة «شراء … مقابل … للبيع» تسبق جدول
     * «متوسط اسعار العملات»، فلو بحثنا في الجدول وحده نأخذ رقم المتوسط
     * (10300) ونخسر سعر البيع الحقيقي (10500).
     */
    const bs = buySellFor(text, re) || buySellFor(scope, re);
    if (bs) {
      rates.push({ code, official: null, parallel: bs.sell, buy: bs.buy, sell: bs.sell });
      seen.add(code);
      continue;
    }

    for (const { re: candidate, pick } of patternsFor(re.source)) {
      const m = scope.match(candidate) || text.match(candidate);
      if (!m) continue;
      const parsedValue = toNumber(m[pick] ?? m[1]);
      // A sane parallel price is 100 … 1,500,000 SDG
      if (parsedValue === null || parsedValue < 100 || parsedValue >= 1_500_000) continue;
      value = parsedValue;
      break;
    }

    if (value === null) continue;
    rates.push({ code, official: null, parallel: value });
    seen.add(code);
  }

  // The article date is the only trustworthy "when did the market move" signal
  const publishedAt =
    parseArabicPublishedAt(text.slice(0, Math.max(400, text.indexOf('مصدر الخبر') + 200))) ||
    parseArabicPublishedAt(text);

  return { rates, publishedAt, title: title || undefined };
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

/**
 * Reads today's Sudan Akhbar parallel-market article.
 * Returns the rates plus the article's own publish time — the only signal we
 * have for "when did the market actually move" on that site.
 */
/**
 * Reader fallback.
 *
 * sudanakhbar.com answers 403 to datacenter IPs (Vercel's egress), so the
 * direct fetch works from a phone but not from the serverless function. A
 * plain reader proxy fetches the same public page from its own network, which
 * keeps the second source working without any paid service or API key.
 */
const READER = (url: string) => `https://r.jina.ai/${url}`;

const fetchViaReader = async (url: string, timeoutMs = 9000): Promise<string | null> => {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs);
    const res = await fetch(READER(url), {
      signal: c.signal,
      headers: { Accept: 'text/plain', 'X-Return-Format': 'text' },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > 200 ? text : null;
  } catch {
    return null;
  }
};

/** Reads sudanakhbar through the reader proxy (used when the direct call is 403). */
export const fetchSudanAkhbarViaReader = async (
  diag: SourceDiag[] = []
): Promise<{ rates: LiveRate[]; publishedAt?: string; title?: string; url?: string } | null> => {
  // Preferred: the same REST endpoint, fetched by the proxy's network
  for (const q of ['سعر الدولار', 'السوق الموازي']) {
    const raw = await fetchViaReader(
      `https://www.sudanakhbar.com/wp-json/wp/v2/posts?search=${encodeURIComponent(q)}` +
        `&per_page=5&_fields=id,date_gmt,link,title,content`
    );
    if (!raw) {
      diag.push({ method: `reader:wp-json:${q}`, ok: false, detail: 'proxy unavailable' });
      continue;
    }
    try {
      const start = raw.indexOf('[');
      const posts = JSON.parse(raw.slice(start));
      const picked = pickArticleFromPosts(posts, `reader:wp-json:${q}`, diag);
      if (picked) return picked;
    } catch {
      diag.push({ method: `reader:wp-json:${q}`, ok: false, detail: 'unparseable json' });
    }
  }

  // Last resort: the rendered listing → the article page
  const listing = await fetchViaReader(SUDANAKHBAR_HOME);
  if (!listing) {
    diag.push({ method: 'reader:listing', ok: false, detail: 'proxy unavailable' });
    return null;
  }
  const linkRe = /(https:\/\/www\.sudanakhbar\.com\/\d{6,})/g;
  const seen = new Set<string>();
  const candidates: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(listing)) && candidates.length < 6) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      candidates.push(m[1]);
    }
  }
  const compact = listing.replace(/\s+/g, ' ');
  const ranked = candidates.sort((a, b) => {
    const near = (u: string) => {
      const i = compact.indexOf(u);
      const window = i >= 0 ? compact.slice(i, i + 260) : '';
      return /السوق السوداء|الموازي|سعر الدولار/.test(window) ? 0 : 1;
    };
    return near(a) - near(b);
  });

  for (const url of ranked.slice(0, 3)) {
    const article = await fetchViaReader(url);
    if (!article) {
      diag.push({ method: 'reader:article', ok: false, detail: url });
      continue;
    }
    const parsed = parseSudanAkhbarArticle(article);
    if (parsed.rates.length < 3) {
      diag.push({ method: 'reader:article', ok: false, detail: 'no rate table' });
      continue;
    }
    diag.push({ method: 'reader:article', ok: true, detail: `${parsed.rates.length} rates` });
    return { rates: parsed.rates, publishedAt: parsed.publishedAt, title: parsed.title, url };
  }
  return null;
};

export interface SourceDiag {
  method: string;
  ok: boolean;
  detail: string;
}

/** Picks the first post that actually contains a rate table. */
const pickArticleFromPosts = (
  posts: any[],
  method: string,
  diag: SourceDiag[]
): { rates: LiveRate[]; publishedAt?: string; title?: string; url?: string } | null => {
  for (const post of posts) {
    const title = String(post?.title?.rendered || '').replace(/<[^>]+>/g, ' ').trim();
    const html = String(post?.content?.rendered || '');
    const parsed = parseSudanAkhbarArticle(html);
    if (parsed.rates.length < 3) continue;
    const publishedAt = post?.date_gmt
      ? new Date(`${post.date_gmt}Z`).toISOString()
      : parsed.publishedAt;
    diag.push({ method, ok: true, detail: `${parsed.rates.length} rates · ${post?.link || ''}` });
    return { rates: parsed.rates, publishedAt, title: title || undefined, url: post?.link };
  }
  diag.push({ method, ok: false, detail: 'no post with a rate table' });
  return null;
};

const WP_SEARCH = (q: string) =>
  `https://www.sudanakhbar.com/wp-json/wp/v2/posts?search=${encodeURIComponent(q)}` +
  `&per_page=5&_fields=id,date_gmt,link,title,content`;

/** WordPress REST search — structured content + the article's own date. */
const fetchSudanAkhbarViaApi = async (
  diag: SourceDiag[],
  opts: { fast?: boolean } = {}
): Promise<{ rates: LiveRate[]; publishedAt?: string; title?: string; url?: string } | null> => {
  /* في المسار السريع (تحديث تلقائي داخل طلب HTTP) نجرّب استعلاماً واحداً فقط */
  /* «السوق الموازي» أولاً: مقالات السوق السوداء هي التي تحمل سعر التداول (10500) */
  const queries = opts.fast
    ? ['السوق الموازي']
    : ['السوق الموازي', 'السوق السوداء', 'سعر الدولار', 'العملات'];
  for (const q of queries) {
    try {
      const url =
        `https://www.sudanakhbar.com/wp-json/wp/v2/posts?search=${encodeURIComponent(q)}` +
        `&per_page=6&_fields=id,date,date_gmt,link,title,content`;
      /*
       * الموقع يرفض طلبات مراكز البيانات (403) بشكل متقطّع، ومعه حجب مؤقت
       * لأي طلب سريع يتكرر. نحاول مرتين مباشرة، ثم مرة عبر القارئ، ثم ننتقل
       * لكلمة بحث أخرى — بدل الاستسلام وعرض أسعار المصدر الآخر فقط.
       */
      let posts: any[] | null = null;
      for (const attempt of [1]) {
        try {
          const c = new AbortController();
          const t = setTimeout(() => c.abort(), 7000);
          const res = await fetch(url, { signal: c.signal, headers: BROWSER_HEADERS });
          clearTimeout(t);
          if (res.ok) {
            posts = await res.json().catch(() => null);
            if (Array.isArray(posts) && posts.length) break;
          } else {
            diag.push({ method: `wp-json:${q}#${attempt}`, ok: false, detail: `HTTP ${res.status}` });
          }
        } catch (err) {
          diag.push({ method: `wp-json:${q}#${attempt}`, ok: false, detail: (err as Error).name });
        }
      }

      /* المسار البديل: نفس الـwp-json عبر نسخة القارئ */
      if (!posts || !posts.length) {
        const raw = await fetchViaReader(url, 9000);
        if (raw) {
          const a = raw.indexOf('[');
          const b = raw.lastIndexOf(']');
          if (a >= 0 && b > a) {
            try {
              posts = JSON.parse(raw.slice(a, b + 1));
            } catch {
              posts = null;
            }
          }
        }
      }

      if (!posts || !posts.length) {
        diag.push({ method: `wp-json:${q}`, ok: false, detail: 'empty list' });
        continue;
      }
      if (!Array.isArray(posts) || !posts.length) {
        diag.push({ method: `wp-json:${q}`, ok: false, detail: 'empty list' });
        continue;
      }
      /*
       * الأحدث أولاً: كانت النتائج تُؤخذ بترتيب البحث، فيُقرأ أحياناً مقال
       * «أبرز عناوين الصحف» (يذكر سعر الدولار عرضاً) بدل مقال أسعار اليوم.
       * نستبعد أيضاً المقالات التي لا تحتوي جدول عملات حقيقياً.
       */
      const marketScore = (p: any) => {
        const t = String(p?.title?.rendered || '');
        if (/السوق\s*(الموازي|السوداء)/.test(t)) return 0;
        if (/الدولار|العملات/.test(t)) return 1;
        return 2;
      };
      const sorted = [...posts].sort(
        (a, b) =>
          marketScore(a) - marketScore(b) ||
          Date.parse(b?.date_gmt || 0) - Date.parse(a?.date_gmt || 0)
      );
      const currencyPosts = sorted.filter((p) => {
        const t = String(p?.title?.rendered || '');
        const isCurrency = /(العملات|الدولار|السوق\s*(الموازي|السوداء)|اسعار|أسعار)/.test(t);
        /*
         * مقال «أسعار البنوك» يعطي سعر البنك (5,843) لا سعر السوق (10,500).
         * نستبعده إلا لو كان يتحدث عن السوق الموازي أيضاً.
         */
        const isBankOnly = /بنوك|مصارف/.test(t) && !/الموازي|السوداء/.test(t);
        return isCurrency && !isBankOnly;
      });
      /*
       * نختار **أحدث** مقال يحوي جدول أسعار حقيقياً (≥3 عملات) وليس جدول بنوك.
       * الاعتماد على «أول نتيجة» كان يعطي أحياناً مقالاً قديماً أو مقالاً
       * ناقص الجدول، فتظهر أسعار يوم سابق.
       */
      const pool = (currencyPosts.length ? currencyPosts : sorted).slice(0, 6);
      const withTables = pool
        .map((post) => ({ post, parsed: parseSudanAkhbarArticle(String(post?.content?.rendered || '')) }))
        .filter((x) => x.parsed.rates.length >= 3)
        .sort((a, b) => Date.parse(b.post?.date_gmt || 0) - Date.parse(a.post?.date_gmt || 0));

      if (withTables.length) {
        const { post, parsed } = withTables[0];
        const title = String(post?.title?.rendered || '').replace(/<[^>]+>/g, ' ').trim();
        diag.push({ method: `wp-json:${q}`, ok: true, detail: `${parsed.rates.length} rates · ${post?.link || ''}` });
        return {
          rates: parsed.rates,
          publishedAt: post?.date_gmt ? new Date(`${post.date_gmt}Z`).toISOString() : parsed.publishedAt,
          title: title || undefined,
          url: post?.link,
        };
      }
      diag.push({ method: `wp-json:${q}`, ok: false, detail: 'no post with a rate table' });
    } catch (err) {
      diag.push({ method: `wp-json:${q}`, ok: false, detail: (err as Error).name });
    }
  }
  return null;
};

/**
 * Reads today's Sudan Akhbar parallel-market article.
 *
 * Two routes, because the site sits behind different edges in different
 * regions: the WordPress REST API first (structured + dated), the article
 * listing as a fallback.
 */
type ArticleResult = { rates: LiveRate[]; publishedAt?: string; title?: string; url?: string };

/** The article changes a few times a day at most — 5 minutes is plenty. */
const ARTICLE_TTL_MS = 5 * 60 * 1000;
let articleCache: { at: number; value: ArticleResult | null } | null = null;

export const fetchSudanAkhbarArticle = async (
  diag: SourceDiag[] = [],
  opts: { fast?: boolean } = {}
): Promise<ArticleResult | null> => {
  if (articleCache && Date.now() - articleCache.at < ARTICLE_TTL_MS) {
    if (articleCache.value) diag.push({ method: 'cache', ok: true, detail: 'article cached' });
    return articleCache.value;
  }
  const store = (value: ArticleResult | null) => {
    articleCache = { at: Date.now(), value };
    return value;
  };

  const viaApi = await fetchSudanAkhbarViaApi(diag, opts);
  if (viaApi) return store(viaApi);
  /*
   * المسار السريع: لا نجرّب قائمة الأخبار (خطوتان إضافيتان ~20 ثانية) بل
   * ننتقل مباشرة إلى القارئ — يبقى الطلب داخل حدود مدة الدالة على Vercel.
   */
  if (opts.fast) return store(await fetchSudanAkhbarViaReader(diag));

  try {
    const c1 = new AbortController();
    const t1 = setTimeout(() => c1.abort(), 9000);
    const listing = await fetch(SUDANAKHBAR_HOME, { signal: c1.signal, headers: BROWSER_HEADERS });
    clearTimeout(t1);
    if (!listing.ok) {
      diag.push({ method: 'listing', ok: false, detail: `HTTP ${listing.status}` });
      return store(await fetchSudanAkhbarViaReader(diag));
    }
    const html = await listing.text();

    const linkRe = /href="(https:\/\/www\.sudanakhbar\.com\/\d{6,})"[^>]*>([^<]{10,200})</g;
    const candidates: { url: string; title: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html))) {
      if (/السوق السوداء|الموازي|سعر الدولار|العملات/.test(m[2])) {
        candidates.push({ url: m[1], title: m[2].trim() });
        if (candidates.length >= 3) break;
      }
    }
    if (!candidates.length) {
      diag.push({ method: 'listing', ok: false, detail: 'no matching article links' });
      return store(await fetchSudanAkhbarViaReader(diag));
    }

    for (const candidate of candidates) {
      const c2 = new AbortController();
      const t2 = setTimeout(() => c2.abort(), 9000);
      const article = await fetch(candidate.url, { signal: c2.signal, headers: BROWSER_HEADERS });
      clearTimeout(t2);
      if (!article.ok) {
        diag.push({ method: 'article', ok: false, detail: `HTTP ${article.status}` });
        continue;
      }
      const parsed = parseSudanAkhbarArticle(await article.text());
      if (parsed.rates.length < 3) {
        diag.push({ method: 'article', ok: false, detail: 'no rate table' });
        continue;
      }
      diag.push({ method: 'article', ok: true, detail: `${parsed.rates.length} rates` });
      return store({
        rates: parsed.rates,
        publishedAt: parsed.publishedAt,
        title: parsed.title || candidate.title,
        url: candidate.url,
      });
    }
    return store(await fetchSudanAkhbarViaReader(diag));
  } catch (err) {
    diag.push({ method: 'listing', ok: false, detail: (err as Error).name });
    return store(null);
  }
};

export const fetchSudanAkhbarRates = async (): Promise<LiveRate[]> => {
  const article = await fetchSudanAkhbarArticle();
  return article ? article.rates.filter((r) => r.parallel !== null && r.parallel >= 100) : [];
};

/** Fetch the live page and parse it. Never throws. */
/**
 * المصدر المعتمد: **أخبار السودان (sudanakhbar.com)**.
 * ------------------------------------------------------------------
 * كان الترتيب معكوساً: سوق السودان أولاً وأخبار السودان احتياطياً، فكانت
 * المنصة تعرض 10,300 (سوق السودان) بينما المصدر المعتمد يقول 10,500 للبيع.
 * الآن: أخبار السودان أولاً (سعر البيع = سعر التداول) ثم سوق السودان احتياطاً.
 */
export const fetchLiveRates = async (): Promise<LiveRatesSnapshot | null> => {
  const akhbar = await fetchSudanAkhbarSnapshot();
  if (akhbar?.rates.length) return akhbar;

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
    /* no backup left — caller keeps the previous snapshot */
  }

  return null;
};

/** The backup source as a full snapshot (same shape as the primary). */
export const fetchSudanAkhbarSnapshot = async (
  diag: SourceDiag[] = [],
  opts: { fast?: boolean } = { fast: true }
): Promise<LiveRatesSnapshot | null> => {
  const article = await fetchSudanAkhbarArticle(diag, opts);
  if (!article?.rates.length) return null;
  return {
    rates: article.rates.filter((r) => r.parallel !== null && (r.parallel as number) >= 100),
    source: BACKUP_SOURCE_NAME,
    sourceUrl: article.url || SUDANAKHBAR_HOME,
    fetchedAt: new Date().toISOString(),
    stale: false,
    sourceUpdatedAt: article.publishedAt,
    sourceTitle: article.title,
  };
};

/** The primary source only (no silent fallback) — used by «قارن المصدرين». */
export const fetchAlsougSnapshot = async (): Promise<LiveRatesSnapshot | null> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(SOURCE_URL, { signal: controller.signal, headers: BROWSER_HEADERS });
    clearTimeout(timer);
    if (!res.ok) return null;
    const rates = parseAlsougRates(await res.text());
    if (!rates.length) return null;
    return {
      rates,
      source: SOURCE_NAME,
      sourceUrl: SOURCE_URL,
      fetchedAt: new Date().toISOString(),
      stale: false,
    };
  } catch {
    return null;
  }
};

/**
 * آخر أخبار السودان — عناوين عامة (سياسة/اقتصاد/مجتمع)، لا أسعار صرف.
 * ------------------------------------------------------------------
 * المساعد كان مربوطاً بسوق السودان وأخبار السودان «للأسعار» فقط؛ لو سألت
 * «آخر الأخبار» يجيب من ذاكرة النموذج. الدالة دي تقرأ عناوين اليوم الحقيقية
 * من نفس الموقع (عبر wp-json ثم نسخة القارئ لو رجع 403).
 */
export interface SudanNewsItem {
  title: string;
  url?: string;
  publishedAt?: string;
}

const cleanHtml = (t: string) =>
  String(t || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();

export const fetchSudanAkhbarNews = async (limit = 6): Promise<SudanNewsItem[]> => {
  const endpoints = [
    `https://www.sudanakhbar.com/wp-json/wp/v2/posts?per_page=${limit}&_fields=id,date_gmt,link,title`,
    `https://www.sudanakhbar.com/wp-json/wp/v2/posts?categories=1&per_page=${limit}&_fields=id,date_gmt,link,title`,
  ];

  /* 1) مباشرة — أسرع وأدق */
  for (const url of endpoints) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 6000);
      const res = await fetch(url, { signal: c.signal, headers: BROWSER_HEADERS });
      clearTimeout(t);
      if (!res.ok) continue;
      const json = (await res.json()) as any[];
      const items = (Array.isArray(json) ? json : [])
        .map((p) => ({
          title: cleanHtml(p?.title?.rendered || ''),
          url: p?.link,
          publishedAt: p?.date_gmt ? `${p.date_gmt}Z` : undefined,
        }))
        .filter((x) => x.title.length > 12);
      if (items.length) return items.slice(0, limit);
    } catch {
      /* جرّب اللي بعده */
    }
  }

  /* 2) عبر نسخة القارئ (Vercel يُحجب أحياناً) */
  try {
    const raw = await fetchViaReader(
      `https://www.sudanakhbar.com/wp-json/wp/v2/posts?per_page=${limit}&_fields=id,date_gmt,link,title`,
      12000
    );
    if (raw) {
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']');
      if (start >= 0 && end > start) {
        const json = JSON.parse(raw.slice(start, end + 1));
        const items = (Array.isArray(json) ? json : [])
          .map((p: any) => ({
            title: cleanHtml(p?.title?.rendered || p?.title || ''),
            url: p?.link,
            publishedAt: p?.date_gmt ? `${p.date_gmt}Z` : undefined,
          }))
          .filter((x: SudanNewsItem) => x.title.length > 12);
        if (items.length) return items.slice(0, limit);
      }
    }
  } catch {
    /* لا شيء */
  }

  return [];
};

/**
 * Reads both published sources in parallel and returns whatever answered.
 * Used when the shopper asks for «أخبار السودان» or wants a comparison, so the
 * assistant never has to say «ما عندي وصول».
 */
export const fetchAllSources = async (
  diag: SourceDiag[] = []
): Promise<LiveRatesSnapshot[]> => {
  const [primary, backup] = await Promise.all([
    fetchAlsougSnapshot().catch(() => null),
    fetchSudanAkhbarSnapshot(diag).catch(() => null),
  ]);
  return [primary, backup].filter(Boolean) as LiveRatesSnapshot[];
};

/** Readings older than this are flagged so nobody trades on an old number. */
export const MAX_AGE_HOURS = 36;

export const ageHours = (iso?: string): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 36e5;
};

/** هل اللقطة صادرة من «أخبار السودان» (المصدر المعتمد)؟ */
export const isSudanAkhbarSnapshot = (snap?: { source?: string } | null): boolean =>
  String(snap?.source || '').includes('sudanakhbar') || String(snap?.source || '').includes('اخبار السودان');

export const isStale = (iso?: string): boolean => {
  const h = ageHours(iso);
  return h === null ? true : h > MAX_AGE_HOURS;
};

export const BACKUP_SOURCE_NAME = 'اخبار السودان (sudanakhbar.com)';

export const RATES_SOURCE = {
  primary: { url: SUDANAKHBAR_HOME, name: BACKUP_SOURCE_NAME },
  backup: { url: SOURCE_URL, name: SOURCE_NAME },
};
