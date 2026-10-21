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

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
