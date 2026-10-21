/** Assistant route: validation, graceful fallbacks, and the speak endpoint. */
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';
const pglite = new PGlite();
setSqlClient({ query: async (t: string, p?: any[]) => { const r = await pglite.query(t, p); return { rows: r.rows as any[], rowCount: r.affectedRows ?? null }; } });
const { createApp } = await import('../server.ts');
const app = createApp(); const server = app.listen(0); const port = (server.address() as any).port;
const B = `http://127.0.0.1:${port}`;
const post = async (p: string, b: any) => { const r = await fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { code: r.status, body: await r.json().catch(() => null) }; };
let pass = 0, fail = 0; const ok = (n: string, c: boolean, d = '') => { c ? (pass++, console.log('  ✅ ' + n)) : (fail++, console.log('  ❌ ' + n + ' ' + d)); };

const empty = await post('/api/assistant/chat', {});
ok('empty message rejected', empty.code === 400, String(empty.code));

const general = await post('/api/assistant/chat', { message: 'ما هي عاصمة اليابان؟', mode: 'admin' });
ok('general question handled', general.code === 200, String(general.code));
ok('responds with reply or explicit reason', typeof general.body.reply === 'string' || !!general.body.reason, JSON.stringify(general.body).slice(0, 120));

const withHistory = await post('/api/assistant/chat', {
  message: 'وعاصمة السودان؟',
  mode: 'client',
  context: { tenantName: 'متجر تجريبي', branchName: 'فرع كسلا' },
  history: [
    { sender: 'user', text: 'ما هي عاصمة اليابان؟' },
    { sender: 'assistant', text: 'طوكيو.' },
  ],
});
ok('history accepted', withHistory.code === 200, String(withHistory.code));

const speakEmpty = await post('/api/assistant/speak', {});
ok('speak needs text', speakEmpty.code === 400, String(speakEmpty.code));
const speak = await post('/api/assistant/speak', { text: 'حبابك عشرة يا زول' });
ok('speak endpoint answers safely', speak.code === 200 && ('audio' in speak.body), JSON.stringify(speak.body).slice(0, 100));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
server.close(); process.exit(fail ? 1 : 0);
