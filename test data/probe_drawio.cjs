const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch({channel:'chrome',headless:true});
const c=await b.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
const p=await c.newPage();
p.on('pageerror',e=>console.log('PAGEERROR',e.message.slice(0,200)));
await p.goto('https://app.diagrams.net/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(3000);
console.log('url',p.url());
console.log('buttons', (await p.getByRole('button').allTextContents()).slice(0,20));
console.log('body', (await p.locator('body').innerText()).slice(0,700));
console.log('rect count',await p.getByRole('button',{name:'Rectangle',exact:true}).count());
await p.screenshot({path:'data/drawio_probe_before.png'});
if(await p.getByRole('button',{name:'Rectangle',exact:true}).count()){
  await p.getByRole('button',{name:'Rectangle',exact:true}).click();
  await p.waitForTimeout(1200);
  console.log('application',await p.getByRole('application').getAttribute('aria-label'));
  await p.screenshot({path:'data/drawio_probe.png'});
  await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(2500);
  console.log('after reload',await p.getByRole('application').getAttribute('aria-label'));
  await p.screenshot({path:'data/drawio_probe_reload.png'});
}
await b.close();
})().catch(e=>{console.error(e);process.exitCode=1});
