/**
 * Arabic wording for parallel-market prices.
 *
 * Kept free of network and db imports so it can be unit-tested directly and
 * reused by the assistant, the REST endpoints and the chat fallback.
 *
 * Two rules drive every sentence here:
 *   1. Never present an old reading as "today's price".
 *   2. Never claim a source is unreachable while we can reach it — the platform
 *      reads both alsoug.com and sudanakhbar.com on demand.
 */

import type { LiveRatesSnapshot } from './rates.ts';

export const AR_NAMES: Record<string, string> = {
  USD: 'الدولار الأمريكي',
  SAR: 'الريال السعودي',
  AED: 'الدرهم الإماراتي',
  EUR: 'اليورو',
  EGP: 'الجنيه المصري',
  QAR: 'الريال القطري',
  TRY: 'الليرة التركية',
  GBP: 'الجنيه الإسترليني',
  OMR: 'الريال العماني',
  KWD: 'الدينار الكويتي',
};

/** Display order: what people actually trade first. */
const CODE_ORDER = ['USD', 'SAR', 'AED', 'EUR', 'EGP', 'QAR', 'GBP', 'OMR', 'KWD', 'TRY'];

const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** Two decimals max — long floats look like a machine wrote them. */
const sortRates = <T extends { code: string }>(rates: T[]): T[] =>
  [...rates].sort(
    (a, b) => (CODE_ORDER.indexOf(a.code) + 1 || 99) - (CODE_ORDER.indexOf(b.code) + 1 || 99)
  );

/**
 * «نُشر الخبر في المصدر: ٢٢ أكتوبر ٨:١٢ ص (اليوم)» — the honest answer to
 * «السعر ده قديم من أمس؟».
 */
export const describeSourceDate = (iso?: string, now: number = Date.now()): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // Always Khartoum time — serverless containers run in UTC
  const tz = { timeZone: 'Africa/Khartoum' } as const;
  const time = d.toLocaleTimeString('ar-SD', { hour: '2-digit', minute: '2-digit', ...tz });
  const day = d.toLocaleDateString('ar-SD', { day: 'numeric', month: 'long', ...tz });
  const fmtDay = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'Africa/Khartoum' });
  const sameDay = fmtDay(new Date(now)) === fmtDay(d);
  return `${day} ${time} (${sameDay ? 'اليوم' : describeAgeAr(iso, now)})`;
};

export const SOURCE_ALIASES: Array<{ name: string; re: RegExp }> = [
  { name: 'alsoug', re: /alsoug|سوق\s*السودان|البديل/i },
  { name: 'sudanakhbar', re: /أخبار\s*السودان|اخبار\s*السودان|سودان\s*أخبار|sudanakhbar/i },
];

/** "قبل ٣ دقائق" / "قبل ساعتين" / "قبل يوم" — honest, human, Arabic. */
export const describeAgeAr = (iso?: string, now: number = Date.now()): string => {
  if (!iso) return 'غير معروف';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'غير معروف';
  const mins = Math.max(0, Math.round((now - t) / 60000));
  const d = (n: number) => n.toLocaleString('ar-EG');
  if (mins < 1) return 'الآن';
  if (mins < 60) return `قبل ${d(mins)} دقيقة`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours < 24) {
    const base = hours === 1 ? 'قبل ساعة' : hours === 2 ? 'قبل ساعتين' : `قبل ${d(hours)} ساعات`;
    return rest ? `${base} و${d(rest)} دقيقة` : base;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return 'قبل يوم';
  if (days === 2) return 'قبل يومين';
  return `قبل ${d(days)} أيام`;
};

/** Any question about prices / currencies / buying money (or naming a source). */
export const isRateQuery = (msg: string): boolean =>
  /سعر|أسعار|اسعار|سوق\s*(الموازي|الأسود|السوداء)|دولار|ريال|درهم|يورو|جنيه\s*مصري|ليرة|عملة|عملات|صرف|تحويل|بنكك\s*سعر/i.test(
    msg
  ) || asksForSources(msg);

/** The user explicitly named a source (or asked to compare them). */
export const asksForSources = (msg: string): boolean => {
  if (SOURCE_ALIASES.some((s) => s.re.test(msg))) return true;
  return /المصدرين|المصادر|قارن|مقارنة|كل\s*المصادر|الموقعين|التقارير/i.test(msg);
};

/** Which sources to fetch for this message. */
export const sourcesWanted = (msg: string): 'both' | 'primary' | 'backup' | 'primary-first' => {
  if (SOURCE_ALIASES[1].re.test(msg) && !SOURCE_ALIASES[0].re.test(msg)) return 'backup';
  if (asksForSources(msg)) return 'both';
  return 'primary-first';
};

/**
 * سطر لكل عملة. إن كان المصدر يعلن شراءً وبيعاً نعرضهما كما هما — الفرق
 * بين 10300 و10500 هو هامش التاجر، وإخفاؤه يجعل الرقم يبدو «غير مطابق
 * للمصدر» (وهو بالضبط ما شكا منه المستخدم).
 */
const priceLines = (snapshot: LiveRatesSnapshot): string[] =>
  sortRates((snapshot.rates || []).filter((r) => r.parallel || r.official)).map((r) => {
    const any = r as any;
    const buy = typeof any.buy === 'number' ? any.buy : null;
    const sell = (r.parallel ?? r.official)!;
    const bank = r.official ? ` (البنك: ${money(r.official)})` : '';
    const both =
      buy !== null && Math.abs(buy - sell) >= 0.01
        ? `ش ${money(buy)} · ب ${money(sell)}`
        : money(sell);
    return `• ${AR_NAMES[r.code] || r.code}: ${both} ج.س${bank}`;
  });

/**
 * Single-source answer (used by the instant endpoint and the offline fallback).
 * `changed` tells whether the numbers differ from the previous reading, so the
 * assistant can say «السعر ما اتغيّر» instead of inventing a new one.
 */
export const formatRatesAnswer = (
  snapshot: any,
  opts: { changed?: boolean | null; previousAt?: string } = {}
): string | null => {
  if (!snapshot?.rates?.length) return null;
  const lines = priceLines(snapshot);
  const when = snapshot.fetchedAt
    ? new Date(snapshot.fetchedAt).toLocaleString('ar-SD', { timeZone: 'Africa/Khartoum' })
    : '';
  const age = describeAgeAr(snapshot.fetchedAt);

  const note =
    opts.changed === false
      ? `ملاحظة مهمة: قارنت القراءة بالقراءة السابقة — الأرقام ما اتغيّرت، يعني السوق في المصدر ما تحرّك من ${describeAgeAr(
          opts.previousAt
        )}.`
      : opts.changed === true
      ? 'فيه تحرّك في الأسعار مقارنة بالقراءة السابقة.'
      : '';

  const sourceDate = snapshot.sourceUpdatedAt
    ? `\nنُشرت الأرقام في المصدر: ${describeSourceDate(snapshot.sourceUpdatedAt)}.`
    : '';

  return (
    `حبابك 👋 دي أسعار السوق الموازي (السوق الأسود) من آخر قراءة حقيقية:\n` +
    `${lines.join('\n')}\n\n` +
    `المصدر: ${snapshot.source} — تم سحب القراءة من الموقع: ${age}${when ? ` (${when})` : ''}.${sourceDate}\n` +
    (note ? `${note}\n` : '') +
    `السعر الرسمي للبنك أقل من سوق الموازي، والتعامل في السودان بيمشي بسعر السوق.`
  );
};

/** Side-by-side answer for «شوف الأسعار في أخبار السودان» / «قارن المصدرين». */
export const formatMultiSourceAnswer = (
  sources: LiveRatesSnapshot[],
  opts: { storedAt?: string } = {}
): string => {
  if (!sources.length) {
    return (
      'يا حبيبنا، جرّبت أفتح المصدرين (سوق السودان وأخبار السودان) هسي وما رجّعوا جدول أسعار صالح. ' +
      'دي مشكلة في المواقع نفسها مش في المنصة — بنعيد المحاولة كل شوية، وتقدر تشوف آخر قراءة محفوظة من شاشة «العملات والصرف».'
    );
  }

  const blocks = sources.map((s) => {
    const lines = priceLines(s);
    const published = s.sourceUpdatedAt
      ? ` · نُشر في المصدر: ${describeSourceDate(s.sourceUpdatedAt)}`
      : '';
    return (
      `— ${s.source} —\n` +
      (lines.length ? lines.join('\n') : '• ما لقيت جدول أسعار في الصفحة الآن') +
      `\nسحب القراءة: ${describeAgeAr(s.fetchedAt)}${published}`
    );
  });

  /* سطر واحد يشرح الرموز، مرة واحدة في آخر الجواب */
  const hasBuySell = sources.some((s) =>
    (s.rates || []).some((r) => typeof (r as any).buy === 'number' && Math.abs((r as any).buy - (r.parallel ?? 0)) >= 0.01)
  );
  const legend = hasBuySell ? '\n\n(ش = سعر الشراء من التاجر · ب = سعر البيع)' : '';

  // Compare the currencies both sources publish
  const perSource = sources.map((s) => ({
    name: s.source,
    map: new Map(s.rates.filter((r) => r.parallel).map((r) => [r.code, r.parallel as number])),
  }));
  const comparisons: string[] = [];
  if (perSource.length >= 2) {
    for (const code of perSource[0].map.keys()) {
      const values = perSource
        .map((s) => ({ name: s.name, value: s.map.get(code) }))
        .filter((v) => typeof v.value === 'number');
      if (values.length < 2) continue;
      const min = Math.min(...values.map((v) => v.value as number));
      const max = Math.max(...values.map((v) => v.value as number));
      if (min === max) {
        comparisons.push(`• ${AR_NAMES[code] || code}: المصدرين متطابقين (${money(min)} ج.س)`);
      } else {
        const gap = (((max - min) / min) * 100).toFixed(1);
        comparisons.push(
          `• ${AR_NAMES[code] || code}: فرق ${gap}% بين ${money(min)} و${money(max)} ج.س`
        );
      }
    }
  }

  return (
    `حبابك يا غالي 👋 فتحت المصدرين وسحبت الأسعار منهم هسي (مش من الذاكرة):\n\n` +
    `${blocks.join('\n\n')}\n\n` +
    (comparisons.length ? `مقارنة سريعة:\n${comparisons.join('\n')}\n\n` : '') +
    (opts.storedAt
      ? `آخر قراءة محفوظة في المنصة كانت ${describeAgeAr(opts.storedAt)} — والأرقام فوق هي الأحدث.\n`
      : '') +
    legend +
    `نصيحة: الأسعار بتتغيّر في نفس اليوم، فأكّد مع التاجر وقت التنفيذ.`
  );
};
