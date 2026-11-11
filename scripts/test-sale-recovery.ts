/** Real browser API + IndexedDB + local Express/PGlite. No production data. */
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { setSqlClient } from '../src/server/pg.ts';
import { chromium } from '@playwright/test';
import esbuild from 'esbuild';
import http from 'node:http';
process.env.SANAD_AUTH_SECRET = 'local-lost-response-test-only-secret-123456';
process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;
let passed = 0;
function check(name: string, condition: unknown) { assert.ok(condition, name); passed++; console.log(`PASS ${name}`); }
const pglite = new PGlite();
setSqlClient({ query: async (text: string, params?: any[]) => { const r = await pglite.query(text, params); return { rows: r.rows as any[], rowCount: r.affectedRows ?? null }; } });
const { createApp } = await import('../server.ts');
const { db } = await import('../src/server/db.ts');
const { newMerchantCode, merchantCodeHash } = await import('../src/server/securitySessions.ts');
await db.init();

const schema = db.getSchema() as any;
const tenantId = 'tenant_alrowad', branchId = 'branch_kht_main';
const tenant = db.getTenant(tenantId)!;
tenant.settings.allowNegativeStock = false;
tenant.settings.vatEnabled = true;
tenant.settings.defaultVatPct = 15;
tenant.settings.pricesIncludeVat = false;
tenant.settings.defaultMaxDiscountPct = 100;
schema.sales = schema.sales.filter((s: any) => s.tenantId !== tenantId);
schema.returns = schema.returns.filter((r: any) => r.tenantId !== tenantId);

function addProduct(id: string, price: number, stock: number, opts: any = {}) {
  schema.products.push({ id, tenantId, name: id, sku: id, barcode: id, category: 't', unit: 'piece', purchaseCost: 10, costCurrency: 'SDG', sellingPriceSdg: price, minStockAlert: 0, isActive: true, createdAt: new Date().toISOString(), ...opts });
  if (stock) db.adjustStock({ tenantId, branchId, productId: id, delta: stock, type: 'adjustment', reason: 'seed', actorName: 'test' });
}
addProduct('cur_a', 1000, 100);
addProduct('cur_b', 250, 100, { isTaxExempt: true });
addProduct('cur_service', 500, 0, { trackInventory: false });
addProduct('cur_empty', 100, 0);
addProduct('cur_race', 100, 1);

const code = newMerchantCode();
db.setMerchantCode(tenantId, merchantCodeHash(code)!);
db.commit(); await db.flush();

const server = createApp().listen(0, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
async function call(path: string, method = 'GET', body?: any, token?: string, extraHeaders: Record<string,string> = {}) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json() as any };
}
// A cashier has no override_stock / edit_prices: used for strict-stock cases.
const cashierHeaders = { 'x-actor-id': 'cur_cashier', 'x-actor-role': 'cashier' };
const login = await call('/auth/merchant/login', 'POST', { code });
assert.equal(login.status, 200);
const token = login.body.token;
const stock = async (id: string) => {
  const r = await pglite.query('SELECT quantity FROM sanad_branch_inventories WHERE "tenantId"=$1 AND "branchId"=$2 AND "productId"=$3', [tenantId, branchId, id]);
  return r.rows.length ? Number((r.rows[0] as any).quantity) : 0;
};
const line = (productId: string, quantity = 1, extra: any = {}) => ({ productId, quantity, ...extra });
const saleBody = (id: string, items: any[], extra: any = {}) => ({ id, branchId, items, paymentMethod: 'cash', ...extra });

const built = await esbuild.build({
 stdin: { contents: "export { api } from './src/lib/api.ts'; export { PosView } from './src/components/POS/PosView.tsx'; export { createRoot } from 'react-dom/client'; export { createElement } from 'react'; export { getPendingOfflineSales, saveOfflineSale, clearSyncedSales } from './src/lib/indexedDb.ts';", resolveDir: process.cwd(), loader:'ts' },
 bundle:true, write:false, platform:'browser', format:'iife', globalName:'SaleTest', define:{'import.meta.env':'{}'},
});
const web = http.createServer((_req, res) => {
 res.setHeader('content-type','text/html');
 res.end('<!doctype html><html><body><script>'+built.outputFiles[0].text+'</script></body></html>');
}).listen(0,'127.0.0.1');
await new Promise<void>(r=>web.once('listening',r));
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH});
try {
 const context = await browser.newContext();
 const page = await context.newPage();
 let loseSaleReply = true, loseSyncReply = false, rejectRecoveryOnce = false;
 let holdNextSale = false, saleRequests = 0;
 let releaseHeld!: () => void, notifyHeld!: () => void;
 let heldGate: Promise<void> = Promise.resolve();
 let acceptedId = '', acceptedInvoice = '';
 await page.context().route('**/api/**',async route=>{
   const path = new URL(route.request().url()).pathname.replace(/^\/api/,'');
   if(path==='/pos/sales' && rejectRecoveryOnce){
     rejectRecoveryOnce=false;
     await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'UNAUTHORIZED'})});return;
   }
   if(path!=='/pos/sales' && path!=='/sync/batch') {await route.fulfill({status:200,contentType:'application/json',body:'{}'});return;}
   if(path==='/pos/sales') saleRequests++;
   // Forward to the real local application, then simulate a lost response AFTER commit.
   const response = await route.fetch({url:base+path, headers:{...route.request().headers(),authorization:`Bearer ${token}`}});
   if(path==='/pos/sales' && holdNextSale){
     holdNextSale=false; notifyHeld(); await heldGate;
   }
   if(path==='/pos/sales' && loseSaleReply) {
     assert.equal(response.status(),200);
     const result = await response.json(); acceptedId=result.sale.id; acceptedInvoice=result.sale.invoiceNumber;
     loseSaleReply=false; await route.abort('connectionreset'); return;
   }
   if(path==='/sync/batch' && loseSyncReply) { loseSyncReply=false; await route.abort('connectionreset'); return; }
   await route.fulfill({response}).catch(() => {});
 });
 const url=`http://127.0.0.1:${(web.address() as any).port}`;
 await page.goto(url);
 await page.evaluate(id=>(window as any).SaleTest.api.setTenantId(id),tenantId);
 const before=await stock('cur_a');
 const result=await page.evaluate(async p=>(window as any).SaleTest.api.recordSale(p),saleBody('recovery_lost_reply',[line('cur_a',1,{unitPriceSdg:1000})]));
 check('accepted server sale with lost reply is preserved in local queue',result.isOffline===true);
 check('local and server sale retain the same id',result.sale.id===acceptedId);
 check('server deducted stock once',await stock('cur_a')===before-1);
 await page.reload();
 const queued=await page.evaluate(async ()=>(window as any).SaleTest.getPendingOfflineSales());
 check('queue survives page reload',queued.length===1 && queued[0].id===acceptedId);
 check('queued total agrees with accepted server total',queued[0].grandTotalSdg===1150);
 loseSyncReply=true;
 const failed=await page.evaluate(async()=>{try{await (window as any).SaleTest.api.syncPendingOfflineSales();return false;}catch{return true;}});
 check('lost sync reply is reported, not silent success',failed);
 check('lost sync reply keeps the queued sale',await page.evaluate(async()=>(await (window as any).SaleTest.getPendingOfflineSales()).length)===1);
 const sync=await page.evaluate(async()=>(window as any).SaleTest.api.syncPendingOfflineSales());
 check('retry sync succeeds',sync.success===true);
 check('confirmed sync clears queue',await page.evaluate(async()=>(await (window as any).SaleTest.getPendingOfflineSales()).length)===0);
 check('retry sync does not deduct stock twice',await stock('cur_a')===before-1);
 const saved=db.getSchema().sales.filter((s:any)=>s.id===acceptedId);
 check('one server sale only',saved.length===1);
 check('official invoice number stays unchanged',saved[0].invoiceNumber===acceptedInvoice);
 const empty=await page.evaluate(async()=>(window as any).SaleTest.api.syncPendingOfflineSales());
 check('syncing an empty queue changes nothing',empty.syncedCount===0 && await stock('cur_a')===before-1);
 // An explicit transaction abort must reject; previously only onerror was handled.
 const abortResult=await page.evaluate(async()=>{
   const original=IDBDatabase.prototype.transaction;
   IDBDatabase.prototype.transaction=function(...args:any[]){
     const tx=(original as any).apply(this,args);
     if(args[0]==='offline_sales' && args[1]==='readwrite') {
       const getStore=tx.objectStore.bind(tx);
       (tx as any).objectStore=(name:string)=>{
         const store=getStore(name), put=store.put.bind(store);
         store.put=((...values:any[])=>{
           const req=(put as any)(...values);
           req.addEventListener('success',()=>tx.abort());
           return req;
         }) as any;
         return store;
       };
     }
     return tx;
   } as any;
   try {
    return await Promise.race([
     (window as any).SaleTest.saveOfflineSale({id:'aborted_sale'}).then(()=> 'resolved',()=> 'rejected'),
     new Promise(r=>setTimeout(()=>r('pending'),1000)),
    ]);
   } finally {IDBDatabase.prototype.transaction=original;}
 });
 check('aborted local write rejects instead of hanging or claiming success',abortResult==='rejected');
 check('aborted write is not present in queue',await page.evaluate(async()=>(await (window as any).SaleTest.getPendingOfflineSales()).length)===0);
 const rejected=await page.evaluate(async p=>{
   try {await (window as any).SaleTest.api.recordSale(p);return {threw:false,status:0};}
   catch(e:any){return {threw:true,status:e.status};}
 },saleBody('recovery_invalid',[]));
 check('real server validation rejection reaches the caller',rejected.threw && rejected.status===400);
 check('rejected sale is not queued as offline success',await page.evaluate(async()=>(await (window as any).SaleTest.getPendingOfflineSales()).length)===0);
 check('a fresh local write succeeds after an abort',await page.evaluate(async()=>{
   await (window as any).SaleTest.saveOfflineSale({id:'after_abort'});
   return (await (window as any).SaleTest.getPendingOfflineSales()).some((s:any)=>s.id==='after_abort');
 }));


 // Compound failure: server committed, reply lost, then IndexedDB unavailable.
 const beforeCompound=await stock('cur_a');
 loseSaleReply=true;
 const compound=await page.evaluate(async p=>{
  const original=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(...args:any[]){
   if(args[0]==='offline_sales' && args[1]==='readwrite') throw new Error('simulated storage failure');
   return (original as any).apply(this,args);
  } as any;
  try {await (window as any).SaleTest.api.recordSale(p);return false;}catch{return true;}
  finally{IDBDatabase.prototype.transaction=original;}
 },saleBody('compound_sale',[line('cur_a',1,{unitPriceSdg:1000})]));
 check('compound failure reports no acknowledged local success',compound);
 check('server accepted compound sale exactly once',await stock('cur_a')===beforeCompound-1);
 await page.reload();
 const journal=await page.evaluate(()=>(window as any).SaleTest.api.getPendingSaleAttempt());
 check('write-ahead journal survives reload despite IndexedDB failure',journal?.id==='compound_sale');
 const blocked=await page.evaluate(async p=>{try{await (window as any).SaleTest.api.recordSale(p);return false;}catch{return true;}},saleBody('must_not_send',[line('cur_a')]));
 check('unresolved attempt blocks a new sale',blocked && !db.getSchema().sales.some((s:any)=>s.id==='must_not_send'));
 rejectRecoveryOnce=true;
 const authFailure=await page.evaluate(async()=>{try{await (window as any).SaleTest.api.retryPendingSale();return false;}catch(e:any){return e.status===401;}});
 check('expired recovery session reports authentication failure',authFailure);
 check('authentication failure during recovery preserves original attempt',await page.evaluate(()=>(window as any).SaleTest.api.getPendingSaleAttempt()?.id)==='compound_sale');
 const recovered=await page.evaluate(()=>(window as any).SaleTest.api.retryPendingSale());
 check('explicit recovery returns the original accepted id',recovered.sale.id==='compound_sale');
 check('explicit recovery returns official invoice',recovered.sale.invoiceNumber===acceptedInvoice);
 check('recovery has no second stock deduction',await stock('cur_a')===beforeCompound-1);
 check('acknowledged recovery clears journal',await page.evaluate(()=>(window as any).SaleTest.api.getPendingSaleAttempt())===null);
 // If the recovery journal cannot be written, never send the sale.
 const cannotJournal=await page.evaluate(async p=>{
  const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k:string,v:string){if(k.startsWith('sanad_sale_attempt_v1:'))throw new Error('quota');return original.call(this,k,v);};
  try {await (window as any).SaleTest.api.recordSale(p);return false;}catch{return true;}
  finally{Storage.prototype.setItem=original;}
 },saleBody('journal_blocked',[line('cur_a')]));
 check('journal write failure blocks submission',cannotJournal && !db.getSchema().sales.some((s:any)=>s.id==='journal_blocked'));
 check('blocked journal write leaves stock unchanged',await stock('cur_a')===beforeCompound-1);

 const sibling=await page.context().newPage();
 await sibling.goto(url);
 check('tabs share the same storage origin',await sibling.evaluate(()=>location.origin)===await page.evaluate(()=>location.origin));
 const beforeTabs=await stock('cur_a');
 const beforeRequests=saleRequests;
 const heldReady=new Promise<void>(r=>{notifyHeld=r;});
 heldGate=new Promise<void>(r=>{releaseHeld=r;});
 holdNextSale=true;
 const firstTab=page.evaluate(p=>(window as any).SaleTest.api.recordSale(p),saleBody('tab_first',[line('cur_a',1,{unitPriceSdg:1000})]));
 await heldReady;
 check('first tab journal is visible in second tab',await sibling.evaluate(()=>(window as any).SaleTest.api.getPendingSaleAttempt()?.id)==='tab_first');
 const secondTab=await sibling.evaluate(async p=>{
  try{await (window as any).SaleTest.api.recordSale(p);return '';}catch(e:any){return e.message;}
 },saleBody('tab_blocked',[line('cur_a')]));
 check('second tab sale is refused while first holds lock',secondTab.includes('تبويب آخر'));
 const secondRetry=await sibling.evaluate(async()=>{try{await (window as any).SaleTest.api.retryPendingSale();return '';}catch(e:any){return e.message;}});
 check('second tab cannot recover an in-flight sale',secondRetry.includes('تبويب آخر'));
 check('blocked tab sends no additional sale request',saleRequests===beforeRequests+1);
 releaseHeld();
 const acknowledged=await firstTab;
 check('first tab completes successfully',acknowledged.success && acknowledged.sale.id==='tab_first');
 check('only the first tab sale affects stock',await stock('cur_a')===beforeTabs-1 && !db.getSchema().sales.some((s:any)=>s.id==='tab_blocked'));
 const later=await sibling.evaluate(p=>(window as any).SaleTest.api.recordSale(p),saleBody('tab_later',[line('cur_a',1,{unitPriceSdg:1000})]));
 check('second tab can start a distinct sale after lock release',later.success && later.sale.id==='tab_later');
 check('two distinct sequential sales deduct exactly two units',await stock('cur_a')===beforeTabs-2);

 for (const kind of ['actor','tenant']) {
  const beforeIdentity=await stock('cur_a');
  const ready=new Promise<void>(r=>{notifyHeld=r;});
  heldGate=new Promise<void>(r=>{releaseHeld=r;});holdNextSale=true;
  const inFlight=page.evaluate(async p=>{
   try{await (window as any).SaleTest.api.recordSale(p);return {success:true,message:''};}
   catch(e:any){return {success:false,message:e.message};}
  },saleBody('identity_'+kind,[line('cur_a',1,{unitPriceSdg:1000})]));
  await ready;
  await page.evaluate(kind=>{
   const api=(window as any).SaleTest.api;
   if(kind==='actor')api.setActor({id:'different_cashier',name:'آخر',role:'cashier'});
   else api.setTenantId('different_tenant');
  },kind);
  releaseHeld();const changed=await inFlight;
  check(kind+': late response does not become success in changed account',!changed.success && changed.message.includes('تغير حساب'));
  await page.evaluate(id=>{
   const api=(window as any).SaleTest.api;api.setTenantId(id);api.setActor({id:'owner_default',name:'مالك المتجر',role:'owner'});
  },tenantId);
  check(kind+': original journal is retained',await page.evaluate(()=>(window as any).SaleTest.api.getPendingSaleAttempt()?.id)==='identity_'+kind);
  const restored=await page.evaluate(()=>(window as any).SaleTest.api.retryPendingSale());
  check(kind+': original account can recover original sale',restored.sale.id==='identity_'+kind && await stock('cur_a')===beforeIdentity-1);
 }
 const beforeClose=await stock('cur_a');
 const closeReady=new Promise<void>(r=>{notifyHeld=r;});
 heldGate=new Promise<void>(r=>{releaseHeld=r;});holdNextSale=true;
 const closingCall=page.evaluate(p=>(window as any).SaleTest.api.recordSale(p),saleBody('closed_tab_sale',[line('cur_a',1,{unitPriceSdg:1000})])).then(()=> 'resolved',()=> 'closed');
 await closeReady;
 await page.close();releaseHeld();await closingCall;
 check('closing tab preserves journal for another tab',await sibling.evaluate(()=>(window as any).SaleTest.api.getPendingSaleAttempt()?.id)==='closed_tab_sale');
 const closeRecovered=await sibling.evaluate(()=>(window as any).SaleTest.api.retryPendingSale());
 check('browser releases lock after tab closes',closeRecovered.success && closeRecovered.sale.id==='closed_tab_sale');
 check('closing-tab recovery does not duplicate stock deduction',await stock('cur_a')===beforeClose-1);
 const beforeUnsupported=saleRequests;
 const unsupported=await sibling.evaluate(async p=>{
  Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});
  try{await (window as any).SaleTest.api.recordSale(p);return '';}catch(e:any){return e.message;}
 },saleBody('unsupported_lock',[line('cur_a')]));
 check('unsupported lock environment fails closed',unsupported.includes('لا يدعم قفل البيع'));
 check('unsupported browser sends no sale and writes no journal',saleRequests===beforeUnsupported && await sibling.evaluate(()=>(window as any).SaleTest.api.getPendingSaleAttempt())===null);
 await sibling.close();

 db.getSchema().cashierShifts.push({id:'ui_local_shift',tenantId,branchId,status:'open',cashierId:'owner_default',totalSalesSdg:0,totalCashSalesSdg:0,salesCount:0} as any);
 db.commit();await db.flush();
 for(const mode of ['online','lost-reply']) {
  const ui=await context.newPage();
  await ui.addInitScript('window.__name = (fn) => fn;');
  await ui.setViewportSize({width:390,height:844});
  await ui.goto(url);
  await ui.evaluate(async()=>{await (window as any).SaleTest.clearSyncedSales(['after_abort']);});
  const stockBeforeUI=await stock('cur_a');
  if(mode==='lost-reply')loseSaleReply=true;
  await ui.evaluate(({tenantId,branchId})=>{
   const t=(window as any).SaleTest;
   t.api.setTenantId(tenantId);
   t.api.setActor({id:'owner_default',name:'مالك المتجر',role:'owner'});
   const root=document.createElement('div');document.body.appendChild(root);
   t.createRoot(root).render(t.createElement(t.PosView,{
    products:[{id:'cur_a',tenantId,name:'cur_a',sku:'cur_a',barcode:'cur_a',category:'اختبار',unit:'piece',sellingPriceSdg:1000,purchaseCost:10,isActive:true}],
    currentBranch:{id:branchId,name:'فرع اختبار'},activeShift:{id:'ui_local_shift'},isOffline:false,
    tenant:{id:tenantId,settings:{vatEnabled:true,defaultVatPct:15,pricesIncludeVat:false}},
    onOpenShiftModal:()=>{},onRefreshShift:()=>{},onSaleCompleted:(sale:any,offline:boolean)=>{(window as any).uiSaved={sale,offline};},
   }));
  },{tenantId,branchId});
  await ui.getByRole('heading',{name:'cur_a',exact:true}).click();
  await ui.getByRole('button',{name:/الدفع وإصدار الفاتورة/}).click();
  await ui.getByRole('button',{name:'تأكيد وقبض الفاتورة',exact:true}).click();
  await ui.locator('#printable-receipt').waitFor({timeout:5000}).catch(async e=>{console.log((await ui.locator('body').innerText()).slice(-2500));throw e;});
  await ui.waitForFunction(()=>!!(window as any).uiSaved);
  const uiSaved=await ui.evaluate(()=>(window as any).uiSaved);
  const persisted=db.getSchema().sales.find((s:any)=>s.id===uiSaved.sale.id);
  check(mode+': real POS screen saves through real local server',!!persisted);
  check(mode+': receipt total equals persisted total',uiSaved.sale.grandTotalSdg===persisted!.grandTotalSdg && uiSaved.sale.grandTotalSdg===1150);
  check(mode+': receipt displays saved total',await ui.evaluate(()=>document.getElementById('printable-receipt')!.textContent!.includes((window as any).uiSaved.sale.grandTotalSdg.toLocaleString())));
  check(mode+': real UI sale deducts one unit only',await stock('cur_a')===stockBeforeUI-1);
  if(mode==='online') check('online receipt uses official saved invoice',uiSaved.sale.invoiceNumber===persisted!.invoiceNumber);
  else {
   check('lost reply is shown through offline completion path',uiSaved.offline===true);
   const result=await ui.evaluate(()=>(window as any).SaleTest.api.syncPendingOfflineSales());
   check('real UI lost-reply sale synchronizes without repeat deduction',result.success && await stock('cur_a')===stockBeforeUI-1);
  }
  await ui.close();
 }
 console.log(`\n${passed} checks passed. Browser API/storage plus mounted POS component + local backend integration; no physical printer.`);
} finally {
 await browser.close(); web.closeAllConnections(); web.close();
 server.closeAllConnections(); server.close(); await pglite.close();
}
