/** Rate-move alerts: threshold, one alert per currency per day, WhatsApp routing. */
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';
const pglite = new PGlite();
setSqlClient({ query: async (t: string, p?: any[]) => { const r = await pglite.query(t, p); return { rows: r.rows as any[], rowCount: r.affectedRows ?? null }; } });

const { db } = await import('../src/server/db.ts');
const { checkRateMoves, detectMoves, THRESHOLD_PERCENT, whatsappConfigured } = await import('../src/server/rateAlerts.ts');
const { createApp } = await import('../server.ts');

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = '') => { c ? (pass++, console.log('  ✅ ' + n)) : (fail++, console.log('  ❌ ' + n + ' ' + d)); };
const snap = (usdParallel: number) => ({
  rates: [
    { code: 'USD', official: 4886.38, parallel: usdParallel },
    { code: 'SAR', official: 1313.55, parallel: 2740 },
    { code: 'AED', official: 1338.74, parallel: 2830 },
    { code: 'EUR', official: 5388.22, parallel: 11954 },
    { code: 'EGP', official: 89.66, parallel: 189 },
    { code: 'QAR', official: 1355.23, parallel: 2830 },
  ],
  source: 'test', sourceUrl: 'https://example.com', fetchedAt: new Date().toISOString(),
});

console.log('\n=== threshold ===');
ok('threshold is 3%', THRESHOLD_PERCENT === 3, String(THRESHOLD_PERCENT));

db.applyLiveRates(snap(10000), 'seed');
ok('first snapshot records no move', detectMoves().length === 0, JSON.stringify(detectMoves()));

db.applyLiveRates(snap(10150), 'test');            // +1.5% → below threshold
ok('small move ignored', detectMoves().length === 0, JSON.stringify(detectMoves().map(m => m.percent)));

db.applyLiveRates(snap(10600), 'test');            // +6% → alert
const moves = detectMoves();
ok('big move detected', moves.length === 1 && moves[0].code === 'USD', JSON.stringify(moves));
ok('percent is correct', Math.abs(moves[0].percent - 4.43) < 0.05, String(moves[0]?.percent));
ok('prices reported', moves[0].current === 10600 && moves[0].previous < moves[0].current);

console.log('\n=== alerts fire once per currency per day ===');
const first = await checkRateMoves(moves);
ok('alert triggered', first.triggered.length === 1, JSON.stringify(first.triggered));
ok('in-app notifications created (merchant + admin)', first.inApp === 2, String(first.inApp));
const notes = db.getSchema().notifications.filter((n: any) => String(n.dedupeKey || '').includes('rate_move'));
ok('notification says the direction', notes.some((n: any) => n.title.includes('ارتفع')), JSON.stringify(notes[0]?.title));
ok('notification links to the currencies screen', notes.every((n: any) => n.linkTab === 'currencies'), JSON.stringify(notes.map((n: any) => n.linkTab)));
ok('whatsapp reported as not configured', first.whatsapp.skipped === 'NOT_CONFIGURED' && whatsappConfigured() === false);

const second = await checkRateMoves(detectMoves());
ok('no duplicate alert the same day', second.triggered.length === 0, JSON.stringify(second.triggered));
ok('alert log keeps one row per currency/day', db.getRateAlertLog().filter((a) => a.code === 'USD').length === 1);

console.log('\n=== drop is an alert too ===');
db.applyLiveRates(snap(9000), 'test');             // −15%
const down = detectMoves();
ok('fall detected', down.length === 1 && down[0].percent < 0, JSON.stringify(down));

console.log('\n=== API surfaces ===');
const app = createApp(); const server = app.listen(0); const port = (server.address() as any).port;
const B = `http://127.0.0.1:${port}`;
const get = async (p: string) => { const r = await fetch(B + p, { headers: { 'x-tenant-id': 'tenant_alrowad' } }); return { code: r.status, body: await r.json().catch(() => null) }; };
const status = await get('/api/currency/alerts/status');
ok('status endpoint', status.code === 200 && status.body.thresholdPercent === 3);
ok('status reports whatsapp off', status.body.whatsappConfigured === false);
ok('status lists today alerts', Array.isArray(status.body.todayAlerts));

const rates = await get('/api/assistant/rates');
ok('assistant rates endpoint answers in Arabic', /السوق الموازي/.test(rates.body?.answer || ''), (rates.body?.answer || '').slice(0, 60));
ok('answer carries the live USD price', /10,386|9,000/.test(rates.body?.answer || ''));
ok('answer cites the source', /المصدر/.test(rates.body?.answer || ''));
ok('no invented fallback when snapshot exists', !!rates.body?.snapshot?.rates?.length);
server.close();

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
