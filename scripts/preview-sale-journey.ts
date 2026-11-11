/** Isolated, disposable POS review. Never connects to production data. */
import { randomBytes } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import esbuild from 'esbuild';
import { setSqlClient } from '../src/server/pg.ts';
process.env.NODE_ENV = 'test';
process.env.SANAD_AUTH_SECRET = randomBytes(48).toString('hex');
process.env.SANAD_ADMIN_PASSWORD = randomBytes(24).toString('hex');
delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;
const database = new PGlite();
setSqlClient({query:async(text:string,params?:any[])=>{const r=await database.query(text,params);return {rows:r.rows as any[],rowCount:r.affectedRows??null};}});
const {createApp} = await import('../server.ts');
const {db} = await import('../src/server/db.ts');
const {newMerchantCode,merchantCodeHash} = await import('../src/server/securitySessions.ts');
await db.init();
const tenantId='tenant_alrowad',branchId='branch_kht_main';
const tenant=db.getTenant(tenantId)!;
tenant.name='متجر تجربة سند';tenant.tradeName='متجر تجربة سند';
tenant.settings.vatEnabled=true;tenant.settings.defaultVatPct=15;tenant.settings.pricesIncludeVat=false;
const names=['سكر تجريبي','شاي تجريبي','زيت تجريبي','صابون تجريبي','دقيق تجريبي'];
const products=names.map((name,i)=>({id:`demo_pos_${i}`,tenantId,name,sku:`DEMO${i+1}`,barcode:`10000${i+1}`,category:'أصناف تجريبية',unit:'قطعة',sellingPriceSdg:[1000,500,2000,300,1500][i],purchaseCost:100,costCurrency:'SDG',isActive:true,minStockAlert:5,createdAt:new Date().toISOString()}));
db.getSchema().products.push(...products as any);
for(const p of products)db.adjustStock({tenantId,branchId,productId:p.id,delta:100,type:'adjustment',reason:'isolated preview seed',actorName:'preview'});
const shift:any={id:'demo_review_shift',tenantId,branchId,branchName:'فرع تجريبي',cashierId:'owner_default',cashierName:'كاشير تجريبي',status:'open',openingCashSdg:0,expectedCashSdg:0,totalSalesSdg:0,totalCashSalesSdg:0,salesCount:0,openedAt:new Date().toISOString()};
db.getSchema().cashierShifts.push(shift);
const code=newMerchantCode();db.setMerchantCode(tenantId,merchantCodeHash(code)!);
db.commit();await db.flush();
const config={tenantId,branchId,code,products,shift,tenant};
const entry=`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {PosView} from './src/components/POS/PosView.tsx';import {api} from './src/lib/api.ts';
const config=${JSON.stringify(config)};
async function boot(){
 const login=await fetch('/api/auth/merchant/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:config.code})});
 const session=await login.json();if(!session.token)throw new Error('تعذر فتح جلسة التجربة');
 localStorage.setItem('sanad_merchant_token',session.token);api.setTenantId(config.tenantId);api.setActor({id:'owner_default',name:'كاشير تجريبي',role:'owner'});
 function Review(){
  const [offline,setOffline]=useState(false),[notice,setNotice]=useState('جاهز للتجربة — لا توجد بيانات حقيقية'),[syncing,setSyncing]=useState(false);
  const sync=async()=>{setSyncing(true);try{const r=await api.syncPendingOfflineSales();setNotice(r.errors?.length?'توجد عمليات تحتاج مراجعة':'تمت المزامنة. عدد العمليات: '+r.syncedCount);}catch{setNotice('تعذرت المزامنة؛ المحاولات محفوظة للمراجعة.');}finally{setSyncing(false);}};
  return <main dir="rtl"><header className="p-3 bg-amber-100 text-amber-950 border-b border-amber-300 space-y-2"><h1 className="font-bold">معاينة سند — متجر وهمي للاختبار فقط</h1><p className="text-sm">البيع والمخزون يعملان على خادم اختبار. البيانات مؤقتة ومشتركة بين زوار هذه المعاينة؛ لا تُدخل بيانات عملاء حقيقية.</p><div className="flex flex-wrap gap-3"><button className="bg-slate-900 text-white rounded px-3 py-2" onClick={()=>{const next=api.toggleSimulateOffline(!offline);setOffline(next);setNotice(next?'محاكاة أوفلاين داخل التطبيق؛ الخادم نفسه متاح':'عاد الاتصال التجريبي');}}>{offline?'إعادة الاتصال':'محاكاة انقطاع الاتصال'}</button><button disabled={offline||syncing} className="bg-emerald-700 text-white rounded px-3 py-2 disabled:opacity-40" onClick={sync}>مزامنة العمليات</button></div><p role="status">{notice}</p></header><PosView products={config.products} tenant={config.tenant} currentBranch={{id:config.branchId,name:'فرع تجريبي'} as any} activeShift={config.shift} isOffline={offline} onOpenShiftModal={()=>{}} onRefreshShift={()=>{}} onSaleCompleted={(_sale,isOffline)=>setNotice(isOffline?'حُفظ البيع على هذا الجهاز بانتظار المزامنة':'حُفظ البيع على خادم الاختبار')} /></main>;
 }
 createRoot(document.getElementById('root')!).render(<Review/>);
}
boot().catch(()=>{document.getElementById('root')!.textContent='تعذر تشغيل المعاينة. حاول إعادة تحميل الصفحة.';});
`;
const bundle=await esbuild.build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'import.meta.env':'{}','process.env.NODE_ENV':'"development"'}});
const cssFile=readdirSync('dist/assets').find(f=>f.endsWith('.css'));
if(!cssFile)throw new Error('Run npm run build first');
const css=readFileSync(`dist/assets/${cssFile}`);
const outer=express();
outer.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');next();});
outer.get('/',(_req,res)=>res.type('html').send('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>معاينة رحلة البيع — سند</title><link rel="stylesheet" href="/review.css"><body><div id="root">جارٍ تجهيز متجر التجربة…</div><script src="/review.js"></script></body></html>'));
outer.get('/review.js',(_req,res)=>res.type('js').send(bundle.outputFiles[0].text));
outer.get('/review.css',(_req,res)=>res.type('css').send(css));
outer.use('/api',(req,res,next)=>{
 if(req.path==='/auth/merchant/login'||req.path==='/pos/sales'||req.path==='/sync/batch')return next();
 if(req.method==='GET')return res.json({promotions:[]});
 return res.status(403).json({error:'PREVIEW_ONLY',message:'هذه العملية غير متاحة في معاينة الاختبار'});
});
outer.use(createApp());
outer.listen(8090,'0.0.0.0',()=>console.log('Isolated POS review listening on 8090. In-memory test database only.'));
