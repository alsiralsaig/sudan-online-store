/**
 * End-to-end check for store applications:
 * submit from the client app → pending → admin approve (code + fee) → status lookup.
 */
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';

const pglite = new PGlite();
setSqlClient({
  query: async (t: string, p?: any[]) => {
    const r = await pglite.query(t, p);
    return { rows: r.rows as any[], rowCount: r.affectedRows ?? null };
  },
});

const { createApp } = await import('../server.ts');
const app = createApp();
const server = app.listen(0);
const port = (server.address() as any).port;
const BASE = `http://127.0.0.1:${port}`;

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✅ ${n}`)) : (fail++, console.log(`  ❌ ${n} ${d}`)); };
const call = async (p: string, init: any = {}) => {
  const r = await fetch(BASE + p, init);
  return { code: r.status, body: await r.json().catch(() => null) };
};
const json = (b: any) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

console.log('\n=== config ===');
const cfg = await call('/api/tenant-applications/pricing');
ok('pricing endpoint', cfg.code === 200 && cfg.body.registrationFeeSdg > 0, JSON.stringify(cfg.body?.registrationFeeSdg));
ok('wilaya list present', Array.isArray(cfg.body.wilayas) && cfg.body.wilayas.length >= 18, String(cfg.body.wilayas?.length));
ok('business types present', Array.isArray(cfg.body.businessTypes) && cfg.body.businessTypes.length > 3);

console.log('\n=== validation ===');
ok('missing store name rejected', (await call('/api/tenant-applications', json({}))).code === 400);
ok('short phone rejected', (await call('/api/tenant-applications', json({
  storeName: 'متجر تجريبي', ownerName: 'أحمد', wilaya: 'كسلا', city: 'كسلا', phone: '123', branchesCount: 1,
}))).code === 400);
ok('bad email rejected', (await call('/api/tenant-applications', json({
  storeName: 'متجر تجريبي', ownerName: 'أحمد', wilaya: 'كسلا', city: 'كسلا', phone: '0912345678',
  branchesCount: 1, email: 'not-an-email',
}))).code === 400);
ok('branches 0 rejected', (await call('/api/tenant-applications', json({
  storeName: 'متجر تجريبي', ownerName: 'أحمد', wilaya: 'كسلا', city: 'كسلا', phone: '0912345678', branchesCount: 0,
}))).code === 400);

console.log('\n=== submit ===');
const created = await call('/api/tenant-applications', json({
  storeName: 'سوبرماركت السلام',
  ownerName: 'الطيب عبد الله',
  wilaya: 'كسلا',
  city: 'كسلا - حي المطار',
  phone: '0915566778',
  email: 'salam@example.com',
  branchesCount: 3,
  businessType: 'بقالات ومواد غذائية',
  notes: 'نحتاج نقطتي بيع.',
  source: 'client',
}));
ok('created', created.code === 200, String(created.code));
const applicationId = created.body?.application?.id;
ok('starts pending', created.body?.application?.status === 'pending');
ok('quote fee returned', created.body?.application?.registrationFeeSdg === cfg.body.registrationFeeSdg);
ok('no code before approval', !created.body?.application?.activationCode);

console.log('\n=== admin queue ===');
const queue = await call('/api/admin/tenant-applications?status=pending');
ok('visible in admin queue', queue.body.applications.some((a: any) => a.id === applicationId));
ok('branches counted', queue.body.counts.pendingBranches >= 3, JSON.stringify(queue.body.counts));
ok('fees expected tracked', queue.body.counts.feesExpectedSdg > 0);

console.log('\n=== approve with custom fee ===');
const approved = await call(`/api/admin/tenant-applications/${applicationId}/review`, json({
  decision: 'approved',
  registrationFeeSdg: 65000,
  codeSentVia: 'whatsapp',
}));
const issued = approved.body?.application;
ok('approved', issued?.status === 'approved');
ok('code issued', /^SND-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(issued?.activationCode || ''), issued?.activationCode);
ok('fee stored', issued?.registrationFeeSdg === 65000, String(issued?.registrationFeeSdg));
ok('delivery logged', issued?.codeSentVia === 'whatsapp' && !!issued?.codeSentAt);

console.log('\n=== applicant status lookup ===');
const lookup = await call(`/api/tenant-applications/status?code=${issued.activationCode}`);
ok('status by code works', lookup.code === 200 && lookup.body.application.storeName === 'سوبرماركت السلام');
ok('unknown code 404', (await call('/api/tenant-applications/status?code=SND-XXXX-XXXX')).code === 404);

console.log('\n=== reject path ===');
const second = await call('/api/tenant-applications', json({
  storeName: 'صيدلية النور', ownerName: 'منى عثمان', wilaya: 'الخرطوم', city: 'الخرطوم',
  phone: '0911223344', branchesCount: 1, source: 'merchant',
}));
ok('source stored', second.body?.application?.id !== undefined);
const rejected = await call(`/api/admin/tenant-applications/${second.body.application.id}/review`, json({
  decision: 'rejected', note: 'البيانات غير مكتملة',
}));
ok('rejected with note', rejected.body.application.status === 'rejected' && rejected.body.application.rejectionReason === 'البيانات غير مكتملة');
ok('no code on rejection', !rejected.body.application.activationCode);

console.log('\n=== deletion ===');
ok('admin delete works', (await call(`/api/admin/tenant-applications/${second.body.application.id}`, { method: 'DELETE' })).code === 200);
const gone = await call('/api/admin/tenant-applications?status=all');
ok('deleted gone', !gone.body.applications.some((a: any) => a.id === second.body.application.id));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
server.close();
process.exit(fail ? 1 : 0);
