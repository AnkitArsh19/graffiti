const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const OUT = path.join(__dirname, 'data');
fs.mkdirSync(OUT, {recursive:true});
const VIEWPORT = {width:1440,height:900};
const SYSTEMS = ['Graffiti','Excalidraw','draw.io','tldraw','Whitebophir'];
const REPEATS = 10;

function csv(rows) {
  const fields = Object.keys(rows[0]);
  const q = v => `"${String(v ?? '').replaceAll('"','""')}"`;
  return [fields.map(q).join(','), ...rows.map(r=>fields.map(k=>q(r[k])).join(','))].join('\n')+'\n';
}
async function dragRectangle(page) {
  await page.mouse.move(500,300);
  await page.mouse.down();
  await page.mouse.move(620,380,{steps:5});
  await page.mouse.up();
}

async function trial(browser, system, repeat) {
  const context = await browser.newContext({viewport:VIEWPORT,deviceScaleFactor:1,reducedMotion:'reduce'});
  const page = await context.newPage();
  const row = {system,repeat,started_at:new Date().toISOString(),url:'',method:'',
    before_objects:'',after_draw_objects:'',after_reload_objects:'',restored:false,error:''};
  try {
    if (system === 'Graffiti') {
      await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
      await page.getByRole('button',{name:'Rectangle (R)'}).click();
      row.method='toolbar and pointer drag'; row.before_objects=0;
      const box=await page.locator('canvas').first().boundingBox();
      await page.mouse.move(box.x+250,box.y+180); await page.mouse.down();
      await page.mouse.move(box.x+350,box.y+250,{steps:5}); await page.mouse.up();
      await page.getByText('1 element',{exact:false}).waitFor();
      row.after_draw_objects=1; // Verified by the visible element-count UI; storage writes are debounced.
      await page.waitForTimeout(1500);
      await page.reload({waitUntil:'domcontentloaded'});
      await page.getByText('1 element',{exact:false}).waitFor({timeout:15000});
      row.after_reload_objects=await page.evaluate(()=>JSON.parse(localStorage.getItem('graffiti:notebook:v1')).pages[0].elements.length);
    } else if (system === 'Excalidraw') {
      await page.goto('https://excalidraw.com/',{waitUntil:'domcontentloaded'});
      await page.getByRole('button',{name:'Rectangle',exact:true}).waitFor({timeout:25000});
      row.method='toolbar and pointer drag'; row.before_objects=0;
      await page.getByRole('button',{name:'Rectangle',exact:true}).click();
      await dragRectangle(page);
      await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('excalidraw')).length===1}catch{return false}},{timeout:15000});
      row.after_draw_objects=await page.evaluate(()=>JSON.parse(localStorage.getItem('excalidraw')).length);
      await page.waitForTimeout(1500);
      await page.reload({waitUntil:'domcontentloaded'});
      await page.getByRole('button',{name:'Rectangle',exact:true}).waitFor({timeout:25000});
      row.after_reload_objects=await page.evaluate(()=>JSON.parse(localStorage.getItem('excalidraw')||'[]').length);
    } else if (system === 'draw.io') {
      await page.goto('https://app.diagrams.net/',{waitUntil:'domcontentloaded'});
      await page.getByRole('button',{name:'Rectangle',exact:true}).waitFor({timeout:25000});
      row.method='sidebar insert'; row.before_objects=0;
      await page.getByRole('button',{name:'Rectangle',exact:true}).click();
      await page.getByRole('application',{name:/Shapes 1, Connectors 0/}).waitFor({timeout:15000});
      row.after_draw_objects=1;
      await page.waitForTimeout(1500);
      await page.reload({waitUntil:'domcontentloaded'});
      await page.getByRole('application').waitFor({timeout:25000});
      const label=await page.getByRole('application').getAttribute('aria-label');
      row.after_reload_objects=Number(label.match(/Shapes (\d+)/)?.[1] ?? -1);
    } else if (system === 'tldraw') {
      await page.goto('https://www.tldraw.com/',{waitUntil:'domcontentloaded'});
      await page.getByRole('button',{name:'Rectangle — R'}).waitFor({timeout:25000});
      row.method='toolbar and pointer drag'; row.before_objects=await page.locator('[data-shape-id]').count();
      await page.getByRole('button',{name:'Rectangle — R'}).click();
      await dragRectangle(page);
      await page.locator('[data-shape-id]').first().waitFor({timeout:15000});
      row.after_draw_objects=await page.locator('[data-shape-id]').count();
      await page.waitForTimeout(1500);
      await page.reload({waitUntil:'domcontentloaded'});
      await page.getByRole('button',{name:'Rectangle — R'}).waitFor({timeout:25000});
      await page.locator('[data-shape-id]').first().waitFor({timeout:15000});
      row.after_reload_objects=await page.locator('[data-shape-id]').count();
    } else {
      await page.goto('https://wbo.ophir.dev/',{waitUntil:'domcontentloaded'});
      await page.getByRole('link',{name:'Create a private board'}).click();
      await page.getByRole('listitem',{name:'Rectangle'}).waitFor({timeout:25000});
      await page.getByText('Loading',{exact:true}).waitFor({state:'hidden',timeout:25000});
      row.method='private board; toolbar and pointer drag';
      row.before_objects=await page.locator('svg#canvas rect').count();
      await page.getByRole('listitem',{name:'Rectangle'}).click();
      await dragRectangle(page);
      await page.waitForFunction(n=>document.querySelectorAll('svg#canvas rect').length>n,row.before_objects,{timeout:15000});
      row.after_draw_objects=await page.locator('svg#canvas rect').count();
      await page.waitForTimeout(1500);
      row.url=page.url().split('#')[0];
      await page.reload({waitUntil:'domcontentloaded'});
      await page.getByRole('listitem',{name:'Rectangle'}).waitFor({timeout:25000});
      await page.getByText('Loading',{exact:true}).waitFor({state:'hidden',timeout:25000});
      row.after_reload_objects=await page.locator('svg#canvas rect').count();
    }
    if (!row.url) row.url=page.url().split('#')[0];
    row.restored=system==='Whitebophir'
      ? row.after_reload_objects>row.before_objects
      : row.after_reload_objects===1;
    if (!row.restored) row.error='Object absent after reload';
  } catch(e) {
    row.url=row.url||page.url().split('#')[0];
    row.error=String(e.message||e).split('\n')[0];
  } finally {await context.close();}
  return row;
}

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const rows=[];
  try {
    for(let repeat=1;repeat<=REPEATS;repeat++){
      for(const system of SYSTEMS){
        const row=await trial(browser,system,repeat);
        rows.push(row);
        fs.writeFileSync(path.join(OUT,'reload_comparison_trials.csv'),csv(rows));
        console.log(`${system} ${repeat}/${REPEATS}: ${row.restored?'restored':`failed (${row.error})`}`);
      }
    }
    fs.writeFileSync(path.join(OUT,'reload_comparison_metadata.json'),JSON.stringify({
      measuredAt:new Date().toISOString(),browserVersion:browser.version(),viewport:VIEWPORT,
      operatingSystem:`${os.type()} ${os.release()}`,cpu:os.cpus()[0].model,
      logicalCores:os.cpus().length,memoryBytes:os.totalmem(),nodeVersion:process.version,
      repeats:REPEATS,method:'One rectangle created using visible UI; wait 1.5 s; reload same browser context; verify native object count.',
      limitation:'Hosted comparator versions and remote server/network conditions were not pinned. An immediate reload is not a long-term durability test.'
    },null,2)+'\n');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
