import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import esbuild from 'esbuild';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {PosView} from './src/components/POS/PosView.tsx';
import {api} from './src/lib/api.ts';
import {writeSaleAttempt,clearSaleAttempt} from './src/lib/saleAttempt.ts';
const w=window as any;
w.calls=0; w.refreshes=0; w.prints=0; w.printReady=false;
w.mode=new URL(location.href).searchParams.get('mode');
localStorage.setItem('sanad_pos_printer_settings',JSON.stringify({printerType:'browser',autoPrintOnSale:w.mode==='print',paperWidth:'80mm',printCopies:1}));
window.print=()=>{w.prints++;w.printReady=!!document.querySelector('#printable-receipt');if(w.mode==='print')throw new Error('printer unavailable');};
api.getPromotions=async()=>({promotions:[]});
api.recordSale=async(payload:any)=>{
 w.calls++;await new Promise(r=>setTimeout(r,50));
 if(w.mode==='save-fail')throw new Error('تعذر الحفظ للاختبار');
 const sale={...payload,id:'saved-ui',invoiceNumber:'INV-TEST-001',createdAt:'2026-11-04T10:00:00Z',cashierName:'اختبار',branchName:'فرع الاختبار',status:'completed'};
 w.saved=sale;return {success:true,sale};
};
if(w.mode==='recovery'){
 const sale:any={id:'recover-ui',tenantId:'tenant_alrowad',cashierId:'owner_default',invoiceNumber:'INV-OLD-LOCAL',createdAt:'2026-11-04T10:00:00Z',items:[],subtotalSdg:1000,grandTotalSdg:1150,taxTotalSdg:150,discountTotalSdg:0,paymentMethod:'cash'};
 writeSaleAttempt(sale);
 api.retryPendingSale=async()=>{w.retries=(w.retries||0)+1;clearSaleAttempt(sale.tenantId,sale.id);return {success:true,sale:{...sale,invoiceNumber:'INV-RECOVERED-001'}};};
}
const product:any={id:'p1',name:'سكر اختبار',sku:'123',barcode:'123',category:'مواد',unit:'كيلو',sellingPriceSdg:1000,purchaseCost:500,isActive:true};
createRoot(document.getElementById('root')!).render(<PosView products={[product]} currentBranch={{id:'b1',name:'فرع الاختبار'} as any} activeShift={{id:'shift1'} as any} isOffline={false}
 onOpenShiftModal={()=>{}} onRefreshShift={()=>{w.refreshes++;if(w.mode==='refresh')return Promise.reject(new Error('refresh failed'));}}
 onSaleCompleted={()=>{if(w.mode==='callback')throw new Error('update failed');if(w.mode==='async-callback')return Promise.reject(new Error('async update failed'));}} />);
`;
const baselinePlugins = process.env.SALE_FOLLOWUP_BASELINE ? [{name:'baseline-pos',setup(build:any){
 build.onLoad({filter:/[\\/]POS[\\/]PosView\.tsx$/},(args:any)=>({contents:execFileSync('git',['show','0e0aa89:src/components/POS/PosView.tsx'],{encoding:'utf8'}),loader:'tsx',resolveDir:path.dirname(args.path)}));
}}] : [];
const built=await esbuild.build({plugins:baselinePlugins,stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'import.meta.env':'{}','process.env.NODE_ENV':'"test"'}});
const server=http.createServer((_req,res)=>{res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="ar"><meta charset="utf-8"><div id="root"></div><script>'+built.outputFiles[0].text+'</script></html>');}).listen(0,'127.0.0.1');
await new Promise<void>(r=>server.once('listening',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
let passed=0;
function check(name:string,condition:unknown){assert.ok(condition,name);passed++;console.log('PASS '+name);}
try{
 for(const mode of ['normal','callback','async-callback','refresh','print','save-fail']){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.setDefaultTimeout(5000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.goto(`http://127.0.0.1:${(server.address() as any).port}/?mode=${mode}`);
  await page.getByText('سكر اختبار',{exact:true}).click();
  await page.getByRole('button',{name:/الدفع وإصدار الفاتورة/}).click();
  await page.getByRole('button',{name:'تأكيد وقبض الفاتورة',exact:true}).click();
  if(mode==='save-fail'){
   await page.getByText('تعذر الحفظ للاختبار',{exact:true}).waitFor();
   check('save failure keeps confirmation available',await page.getByRole('button',{name:'تأكيد وقبض الفاتورة',exact:true}).isEnabled());
   check('save failure does not show a successful receipt',await page.locator('#printable-receipt').count()===0);
  }else{
   await page.locator('#printable-receipt').waitFor();
   check(mode+': receipt remains visible',await page.locator('#printable-receipt').innerText().then(t=>t.includes('INV-TEST-001')));
   if(mode!=='normal')await page.getByRole('alert').filter({hasText:'البيع محفوظ'}).waitFor();
   await page.waitForFunction(()=>(window as any).refreshes===1);
   check(mode+': independent refresh runs once',await page.evaluate(()=>(window as any).refreshes)===1);
   check(mode+': no second sale is submitted',await page.evaluate(()=>(window as any).calls)===1);
   check(mode+': payment confirmation is closed',await page.getByRole('button',{name:'تأكيد وقبض الفاتورة',exact:true}).count()===0);
   if(mode==='print'){
    check('automatic printing waits for committed receipt',await page.evaluate(()=>(window as any).printReady));
    check('automatic printing attempted only once',await page.evaluate(()=>(window as any).prints)===1);
    await page.getByRole('button',{name:/طباعة \(/}).click();
    check('manual print retry does not create a new sale',await page.evaluate(()=>(window as any).calls===1 && (window as any).prints===2));
   }
  }
  check(mode+': no unhandled browser errors',errors.length===0);
  await page.close();
 }
 const recoveryContext=await browser.newContext({viewport:{width:390,height:844}});
 const recoveryPage=await recoveryContext.newPage();
 await recoveryPage.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await recoveryPage.goto(`http://127.0.0.1:${(server.address() as any).port}/?mode=recovery`);
 await recoveryPage.getByRole('button',{name:'استعادة البيع السابق',exact:true}).waitFor();
 check('pending journal shows recovery instead of new-sale checkout',await recoveryPage.getByRole('button',{name:/الدفع وإصدار الفاتورة/}).count()===0);
 const journalRaw=await recoveryPage.evaluate(()=>localStorage.getItem('sanad_sale_attempt_v1:tenant_alrowad'));
 const peer=await recoveryContext.newPage();
 await peer.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await peer.goto(`http://127.0.0.1:${(server.address() as any).port}/?mode=normal`);
 await peer.evaluate(()=>localStorage.removeItem('sanad_sale_attempt_v1:tenant_alrowad'));
 await recoveryPage.getByRole('button',{name:/الدفع وإصدار الفاتورة/}).waitFor();
 check('cleared journal in peer tab updates recovery screen',await recoveryPage.getByRole('button',{name:'استعادة البيع السابق',exact:true}).count()===0);
 await peer.evaluate(raw=>localStorage.setItem('sanad_sale_attempt_v1:tenant_alrowad',raw!),journalRaw);
 await recoveryPage.getByRole('button',{name:'استعادة البيع السابق',exact:true}).waitFor();
 check('new journal in peer tab blocks checkout without reload',await recoveryPage.getByRole('button',{name:/الدفع وإصدار الفاتورة/}).count()===0);
 await peer.close();
 await recoveryPage.getByRole('button',{name:'استعادة البيع السابق',exact:true}).click();
 await recoveryPage.locator('#printable-receipt').waitFor();
 check('recovered official invoice is visible',await recoveryPage.locator('#printable-receipt').innerText().then(t=>t.includes('INV-RECOVERED-001')));
 check('recovery uses retry API not a new recordSale',await recoveryPage.evaluate(()=>(window as any).retries===1 && (window as any).calls===0));
 check('recovery clears the local journal',await recoveryPage.evaluate(()=>localStorage.getItem('sanad_sale_attempt_v1:tenant_alrowad')===null));
 await recoveryPage.close();
 console.log(`\n${passed} browser checks passed. Real POS component, mocked sale API and printer; no production access.`);
}finally{await browser.close();server.closeAllConnections();server.close();}
