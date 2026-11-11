import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
let passed=0;const check=(name:string,value:unknown)=>{assert.ok(value,name);passed++;console.log('PASS '+name);};
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const external:string[]=[];await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1'){external.push(u.hostname);return r.abort();}return r.continue();});
 await page.goto('http://127.0.0.1:8090');
 await page.getByRole('heading',{name:'سكر تجريبي',exact:true}).waitFor();
 check('preview boots without merchant credentials from user',true);
 mkdirSync('/home/user/sanad-sale-journey-delivery/preview-shots',{recursive:true});
 await page.screenshot({path:'/home/user/sanad-sale-journey-delivery/preview-shots/mobile-sale.png',fullPage:true});
 for(const offline of [false,true]){
  if(offline)await page.getByRole('button',{name:'محاكاة انقطاع الاتصال',exact:true}).click();
  await page.getByRole('heading',{name:'سكر تجريبي',exact:true}).click();
  await page.getByRole('button',{name:/الدفع وإصدار الفاتورة/}).click();
  await page.getByRole('button',{name:'تأكيد وقبض الفاتورة',exact:true}).click();
  const receipt=page.locator('#printable-receipt');await receipt.waitFor();
  check((offline?'offline':'online')+' receipt shows expected total',(await receipt.innerText()).includes('1,150'));
  check((offline?'offline':'online')+' completion status is visible',(await page.getByRole('status').innerText()).includes(offline?'هذا الجهاز':'خادم الاختبار'));
  await page.screenshot({path:`/home/user/sanad-sale-journey-delivery/preview-shots/${offline?'offline':'online'}-receipt.png`,fullPage:true});
  await page.getByRole('button',{name:'فاتورة جديدة',exact:true}).click();
 }
 await page.getByRole('button',{name:'إعادة الاتصال',exact:true}).click();
 await page.getByRole('button',{name:'مزامنة العمليات',exact:true}).click();
 await page.getByRole('status').filter({hasText:'تمت المزامنة'}).waitFor();
 check('offline sale synchronizes through preview server',true);
 check('no unhandled browser errors',errors.length===0);
 check('no external network dependency required',external.length===0);
 console.log(`\n${passed} live preview checks passed. No physical print verification.`);
}finally{await browser.close();}
