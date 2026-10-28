import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';
process.env.SANAD_AUTH_SECRET = 'test-secret-not-production-secret-long-enough-1234567890';
process.env.SANAD_ADMIN_PASSWORD = 'test-admin-password-very-long-enough-12345';
const pg = new PGlite();
setSqlClient({ query: async (sql, params) => {
  const r = await pg.query(sql, params);
  return { rows: r.rows as any[], rowCount: r.affectedRows ?? null };
}});
const { createApp } = await import('../server.ts');
const { db } = await import('../src/server/db.ts');
const { newMerchantCode, merchantCodeHash, adminRevision } = await import('../src/server/securitySessions.ts');
const server = createApp().listen(0, '127.0.0.1');
await new Promise<void>(r=>server.once('listening', r));
const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
async function req(path:string, method='GET', body?:any, headers:Record<string,string>={}) {
  const res = await fetch(base+path, { method, headers:{'content-type':'application/json', ...headers}, body: body? JSON.stringify(body): undefined });
  let j; try{ j=await res.json();} catch{ j={}; }
  return { status: res.status, body: j, headers: res.headers };
}
try{
  // seed codes for two tenants
  const t1='tenant_alrowad', t2='tenant_nile_boutique';
  const c1=newMerchantCode(), c2=newMerchantCode();
  const h1=merchantCodeHash(c1)!, h2=merchantCodeHash(c2)!;
  db.setMerchantCode(t1,h1); db.setMerchantCode(t2,h2); db.commit(); await db.refresh();
  // unauthenticated merchant endpoint should 401
  let r=await req('/products'); assert.equal(r.status,401,'unauth merchant /products should 401');
  r=await req('/admin/tenants'); assert.equal(r.status,401,'unauth admin should 401');
  // login merchant A
  r=await req('/auth/merchant/login','POST',{code:c1}); assert.equal(r.status,200); const tokA=r.body.token;
  r=await req('/auth/merchant/login','POST',{code:c2}); assert.equal(r.status,200); const tokB=r.body.token;
  // login admin
  r=await req('/auth/admin/login','POST',{password:process.env.SANAD_ADMIN_PASSWORD}); assert.equal(r.status,200); const admTok=r.body.token;
  // merchant A cannot list all tenants (admin only)
  r=await req('/tenants/list','GET',undefined,{Authorization:`Bearer ${tokA}`}); assert.equal(r.status,401);
  // admin can list
  r=await req('/tenants/list','GET',undefined,{Authorization:`Bearer ${admTok}`}); assert.equal(r.status,200); assert(r.body.tenants.length>=2);
  // merchant A creates product
  r=await req('/products','POST',{name:'منتج A', barcode:'1111111111111', unit:'حبة', sellingPriceSdg:100, purchaseCost:50, minStockAlert:1, branchId:'branch_kht_main'}, {Authorization:`Bearer ${tokA}`}); assert.equal(r.status,200); const pid=r.body.product.id;
  // merchant B tries to delete it -> 404
  r=await req(`/products/${pid}`,'DELETE',undefined,{Authorization:`Bearer ${tokB}`}); assert.equal(r.status,404,'cross-tenant delete should 404');
  // merchant B tries to fetch it via products list -> should not see
  r=await req('/products','GET',undefined,{Authorization:`Bearer ${tokB}`}); assert.equal(r.status,200); assert(!r.body.products.some((p:any)=>p.id===pid));
  // merchant A can still fetch own
  r=await req('/products','GET',undefined,{Authorization:`Bearer ${tokA}`}); assert.equal(r.status,200); assert(r.body.products.some((p:any)=>p.id===pid));
  // merchant token cannot access admin stats
  r=await req('/admin/stats','GET',undefined,{Authorization:`Bearer ${tokA}`}); assert.equal(r.status,401);
  // admin token cannot access merchant products (merchant middleware expects merchant role)
  r=await req('/products','GET',undefined,{Authorization:`Bearer ${admTok}`}); assert.equal(r.status,401);
  // storefront public remains accessible
  const slug=db.getTenant(t1)!.slug;
  r=await req(`/storefront/${slug}`); assert.equal(r.status,200);
  // market ad spoof test: anon claiming tenant: should be rejected
  r=await req('/market-ads','POST',{title:'إعلان مزيف يحاول انتحال متجر', phone:'0911000000', imageUrl:'https://example.com/x.jpg', ownerToken:`tenant:${t1}`, category:'عام', priceSdg:1000, location:'الخرطوم'}); assert.equal(r.status,401,'spoof tenant ad without auth should 401');
  // anon ad without spoof should succeed with anon token
  r=await req('/market-ads','POST',{title:'إعلان مجهول عادي', phone:'0911000000', imageUrl:'https://example.com/x.jpg', category:'عام', priceSdg:1000, location:'الخرطوم'}); assert.equal(r.status,200); assert(r.body.ad.ownerToken.startsWith('anon:'));
  // merchant A publishes ad as store -> should be tenant: prefix derived securely
  r=await req('/market-ads','POST',{title:'إعلان متجر A الرسمي', phone:'0911000000', imageUrl:'https://example.com/y.jpg', category:'عام', priceSdg:2000, location:'الخرطوم'}, {Authorization:`Bearer ${tokA}`}); assert.equal(r.status,200); assert.equal(r.body.ad.ownerToken,`tenant:${t1}`);
  // verify code rotation: admin issues new code for t1, old token should 401, new login works
  r=await req(`/admin/tenants/${t1}/merchant-code`,'POST',{}, {Authorization:`Bearer ${admTok}`}); assert.equal(r.status,200); const newCode=r.body.code;
  r=await req('/products','GET',undefined,{Authorization:`Bearer ${tokA}`}); assert.equal(r.status,401,'old merchant token after rotation should 401');
  r=await req('/auth/merchant/login','POST',{code:newCode}); assert.equal(r.status,200);
  console.log('PASS: isolation, roles, cross-tenant, admin/merchant separation, market ad spoof protection, code rotation');
} finally{ server.close(); await pg.close(); }
