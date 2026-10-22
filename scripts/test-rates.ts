/** Parallel-market rates: parser, safety guards, and applying to trading prices. */
import { parseAlsougRates, isStale, ageHours } from '../src/server/rates.ts';
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = '') => { c ? (pass++, console.log('  ✅ ' + n)) : (fail++, console.log('  ❌ ' + n + ' ' + d)); };

console.log('\n=== parser ===');
const sample = `<table>
<tr><td>العملة</td><td>بنك الخرطوم</td><td>البديل</td></tr>
<tr><td><img src="d.svg"> $ الدولار الامريكي</td><td>4886.38<img src="a.svg"></td><td>10386<img src="a.svg"></td></tr>
<tr><td><img src="x.svg"><br>الدرهم الاماراتي</td><td>1338.74</td><td>2830</td></tr>
<tr><td>€ اليورو</td><td>5388.22</td><td>11954</td></tr>
<tr><td>الريال السعودي</td><td>1313.55</td><td>2740</td></tr>
<tr><td>الجنيه المصري</td><td>89.66</td><td>189</td></tr>
<tr><td>الريال القطري</td><td>1355.23</td><td>2830</td></tr>
</table>`;
const rows = parseAlsougRates(sample);
ok('six currencies parsed', rows.length === 6, String(rows.length));
ok('USD official/parallel', rows[0].code === 'USD' && rows[0].official === 4886.38 && rows[0].parallel === 10386, JSON.stringify(rows[0]));
ok('AED split across lines still parses', rows.some((r) => r.code === 'AED' && r.parallel === 2830));
ok('EGP small numbers kept', rows.some((r) => r.code === 'EGP' && r.parallel === 189));
ok('no duplicate codes', new Set(rows.map((r) => r.code)).size === rows.length);
ok('garbage html yields nothing', parseAlsougRates('<table><tr><td>مرحبا</td><td>0</td></tr></table>').length === 0);
ok('absurd rates rejected', parseAlsougRates('<tr><td>الدولار الامريكي</td><td>0.0001</td><td>99999999</td></tr>').length === 0);

console.log('\n=== freshness guard ===');
const now = new Date().toISOString();
ok('fresh snapshot not stale', isStale(now) === false);
ok('old snapshot flagged', isStale(new Date(Date.now() - 48 * 36e5).toISOString()) === true);
ok('missing date = stale', isStale(undefined) === true);
ok('age in hours', Math.round(ageHours(new Date(Date.now() - 6 * 36e5).toISOString())!) === 6);

console.log('\n=== applying to the store (parallel becomes the trading rate) ===');
const pglite = new PGlite();
setSqlClient({ query: async (t: string, p?: any[]) => { const r = await pglite.query(t, p); return { rows: r.rows as any[], rowCount: r.affectedRows ?? null }; } });
const { db } = await import('../src/server/db.ts');
const { createApp } = await import('../server.ts');
const before = db.getSchema().currencies.find((c) => c.code === 'USD')!.rateToSdg;
const res = db.applyLiveRates(
  { rates: rows, source: 'test', sourceUrl: 'https://example.com', fetchedAt: now },
  'اختبار'
);
const usd = db.getSchema().currencies.find((c) => c.code === 'USD')!;
ok('rate applied', usd.rateToSdg === 10386, String(usd.rateToSdg));
ok('old fake rate replaced', before !== usd.rateToSdg, `${before} -> ${usd.rateToSdg}`);
ok('official kept for display', usd.officialRate === 4886.38);
ok('marked as parallel source', usd.rateSource === 'parallel');
ok('SDG untouched', db.getSchema().currencies.find((c) => c.code === 'SDG')!.rateToSdg === 1);
ok('history written', db.getSchema().currencyRateHistory.length >= 5, String(db.getSchema().currencyRateHistory.length));
ok('snapshot stored', db.getRatesSnapshot()?.source === 'test');
ok('unsupported code reported', res.skipped.includes('TRY'), JSON.stringify(res.skipped));
ok('TRY keeps its manual rate', !!db.getSchema().currencies.find((c) => c.code === 'TRY')!.rateToSdg);
ok('second identical run writes no new history', (() => {
  const n = db.getSchema().currencyRateHistory.length;
  db.applyLiveRates({ rates: rows, source: 'test', sourceUrl: 'https://example.com', fetchedAt: now });
  return db.getSchema().currencyRateHistory.length === n;
})());

console.log('\n=== API surfaces the parallel rate ===');
const app = createApp(); const server2 = app.listen(0); const port2 = (server2.address() as any).port;
const B2 = `http://127.0.0.1:${port2}`;
const get = async (p: string) => { const r = await fetch(B2 + p, { headers: { 'x-tenant-id': 'tenant_alrowad' } }); return { code: r.status, body: await r.json().catch(() => null) }; };

const live = await get('/api/currency/parallel-rates');
ok('endpoint returns a snapshot', !!live.body?.snapshot?.rates?.length, JSON.stringify(live.body).slice(0, 80));
const usdFromLive = (live.body?.currencies || []).find((c: any) => c.code === 'USD');
ok('currencies in payload use the parallel rate', usdFromLive?.rateToSdg === 10386, String(usdFromLive?.rateToSdg));
ok('official still exposed for display', usdFromLive?.officialRate === 4886.38);

const curr = await get('/api/currencies');
const usdApi = (curr.body?.currencies || []).find((c: any) => c.code === 'USD');
ok('/currencies trades on the parallel rate', usdApi?.rateToSdg === 10386, String(usdApi?.rateToSdg));
ok('/currencies flags the source', usdApi?.rateSource === 'parallel');
ok('SDG stays 1', (curr.body?.currencies || []).find((c: any) => c.code === 'SDG')?.rateToSdg === 1);
server2.close();

/* ------------------------------------------------------------------ */
/*  Answers: honesty about age + both-source questions                 */
/* ------------------------------------------------------------------ */
console.log('\n=== answer wording ===');
const {
  describeAgeAr,
  isRateQuery,
  asksForSources,
  sourcesWanted,
  formatRatesAnswer,
  formatMultiSourceAnswer,
} = await import('../src/server/rateAnswer.ts');

const t0 = Date.parse('2026-10-22T09:00:00Z');
ok('age in minutes', describeAgeAr('2026-10-22T08:57:00Z', t0) === 'قبل ٣ دقيقة', describeAgeAr('2026-10-22T08:57:00Z', t0));
ok('age in hours', /قبل .*ساع/.test(describeAgeAr('2026-10-22T05:00:00Z', t0)));
ok('age in days', /قبل .*أيام|قبل يوم/.test(describeAgeAr('2026-10-19T09:00:00Z', t0)), describeAgeAr('2026-10-19T09:00:00Z', t0));
ok('one day says «قبل يوم»', describeAgeAr('2026-10-21T09:00:00Z', t0) === 'قبل يوم', describeAgeAr('2026-10-21T09:00:00Z', t0));
ok('unknown age is honest', describeAgeAr(undefined) === 'غير معروف');

ok('detects a rate question', isRateQuery('سعر الدولار اليوم كم؟'));
ok('detects sudanakhbar by name', isRateQuery('شوف الأسعار علي أخبار السودان'));
ok('asksForSources on sudanakhbar', asksForSources('شوف الأسعار علي أخبار السودان'));
ok('asksForSources on comparison', asksForSources('قارن المصدرين'));
ok('plain rate query stays single-source', sourcesWanted('سعر الدولار اليوم') === 'primary-first');
ok('sudanakhbar alone → backup', sourcesWanted('أسعار أخبار السودان') === 'backup');
ok('both when comparing', sourcesWanted('قارن أسعار المصدرين') === 'both');

const snapA = {
  rates: [
    { code: 'USD', official: 4886.38, parallel: 10386 },
    { code: 'SAR', official: 1313.55, parallel: 2740 },
  ],
  source: 'سوق السودان (alsoug.com)',
  sourceUrl: 'https://www.alsoug.com/currency',
  fetchedAt: '2026-10-22T08:57:00Z',
  stale: false,
};
const single = formatRatesAnswer(snapA, { changed: false, previousAt: '2026-10-21T18:48:00Z' });
ok('single answer keeps the parallel price', /10,386/.test(single));
ok('single answer states the reading age', /تم سحب القراءة من الموقع: قبل/.test(single));
ok('unchanged price is stated honestly', /ما اتغيّرت/.test(single));
ok('no false "today" claim', !/حقت الليلة|أسعار اليوم/.test(single));

const snapB = { ...snapA, source: 'اخبار السودان (sudanakhbar.com)', fetchedAt: '2026-10-22T08:59:00Z' };
const multi = formatMultiSourceAnswer([snapA, snapB], { storedAt: '2026-10-21T18:48:00Z' });
ok('multi answer names alsoug', /alsoug/.test(multi));
ok('multi answer names sudanakhbar', /sudanakhbar/.test(multi));
ok('multi answer compares the sources', /مقارنة سريعة|متطابقين|فرق/.test(multi));
ok('multi answer reports each reading age', (multi.match(/سحب القراءة/g) || []).length === 2);
ok('empty result never invents a price', !/10,386/.test(formatMultiSourceAnswer([])));


/* ------------------------------------------------------------------ */
/*  sudanakhbar article parser (the text-only source)                  */
/* ------------------------------------------------------------------ */
console.log('\n=== sudanakhbar article parser ===');
const { parseSudanAkhbarArticle, parseArabicPublishedAt } = await import('../src/server/rates.ts');

const article = `
<div class="post-content"><h1>ارتفاع جنوني.. سعر الدولار في السودان اليوم الخميس 22 اكتوبر 2026م</h1>
<p>مصدر الخبر فريق التحرير 22 أكتوبر، 2026 - 8:12 صباحًا</p>
<p>الدولار الأميركي 10200 جنيه للشراء و10393.1747 جنيه للبيع، بينما بلغ سعر الريال السعودي 2719.2749 جنيه للشراء و2770.7744 جنيه للبيع.</p>
<p>متوسط اسعار العملات في السودان في السوق الموازي</p>
<p>الدولار الامريكي 10200 جنيها ( ارتفاع سعر متوسط ) الريال السعودي 2719.2749 جنيها ( ارتفاع سعر متوسط )
الدرهم الاماراتي 2777.3997 جنيها ( ارتفاع سعر متوسط ) اليورو 11458.0991 جنيها ( ارتفاع سعر متوسط )
الجنيه الاسترليني 13662.3000 جنيها ( ارتفاع سعر متوسط ) الجنية المصري 187.7416 جنيها ( ارتفاع سعر متوسط )
الريال القطري 2802.1977 جنيها ( ارتفاع سعر متوسط )</p></div>`;

const parsedArticle = parseSudanAkhbarArticle(article);
const byCode = (code: string) => parsedArticle.rates.find((r) => r.code === code)?.parallel;
ok('reads the dollar', byCode('USD') === 10393.1747, String(byCode('USD')));
ok('reads the riyal', byCode('SAR') === 2770.7744, String(byCode('SAR')));
ok('reads the dirham', byCode('AED') === 2777.3997, String(byCode('AED')));
ok('reads the euro', byCode('EUR') === 11458.0991, String(byCode('EUR')));
ok('reads the egyptian pound', byCode('EGP') === 187.7416, String(byCode('EGP')));
ok('reads the qatari riyal', byCode('QAR') === 2802.1977, String(byCode('QAR')));
ok('prefers the selling price over the buying price', byCode('USD') !== 10200);
ok('extracts the article publish time', !!parsedArticle.publishedAt, String(parsedArticle.publishedAt));
ok(
  'publish time is Khartoum 08:12 → 06:12Z',
  parsedArticle.publishedAt === '2026-10-22T06:12:00.000Z',
  String(parsedArticle.publishedAt)
);
ok('keeps the headline', /ارتفاع جنوني/.test(parsedArticle.title || ''));
ok('no rates invented from empty html', parseSudanAkhbarArticle('<html><body>لا شيء</body></html>').rates.length === 0);
ok('date parser ignores junk', parseArabicPublishedAt('لا يوجد تاريخ') === undefined);


/* ------------------------------------------------------------------ */
/*  Chat text: no raw Markdown markers in any answer                   */
/* ------------------------------------------------------------------ */
console.log('\n=== chat text normaliser ===');
const { toChatText } = await import('../src/lib/chatText.ts');

ok('bold is unwrapped', toChatText('**دولار أمريكي:** 10,386 ج.س') === 'دولار أمريكي: 10,386 ج.س', toChatText('**دولار أمريكي:** 10,386 ج.س'));
ok('italic underscores are unwrapped', toChatText('_سحب القراءة: الآن_') === 'سحب القراءة: الآن');
ok('star bullets become real bullets', toChatText('* دولار\n* ريال') === '• دولار\n• ريال', JSON.stringify(toChatText('* دولار\n* ريال')));
ok('dash bullets become real bullets', toChatText('- دولار\n- ريال') === '• دولار\n• ريال');
ok('headings are flattened', toChatText('## أسعار اليوم') === 'أسعار اليوم');
ok('inline code loses backticks', toChatText('`10386` ج.س') === '10386 ج.س');
ok('bullet used inside a number list survives', /•|١|1/.test(toChatText('* 10386 ج.س')));
ok('plain Arabic is untouched', toChatText('حبابك يا غالي 👋') === 'حبابك يا غالي 👋');

const cleanAnswers = [formatRatesAnswer(snapA), formatMultiSourceAnswer([snapA, snapB], {})].join('\n');
ok('rate answers carry no ** markers', !cleanAnswers.includes('**'));
ok('rate answers carry no single-asterisk markers', !/[*_]/.test(cleanAnswers), (cleanAnswers.match(/[*_]/g) || []).join(''));
ok('multi-source uses a plain separator', cleanAnswers.includes('— سوق السودان'));
ok('answers still readable as plain text', /• الدولار الأمريكي: 10,386/.test(cleanAnswers));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
