const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({channel:'chrome',headless:true});
  const c = await b.newContext({acceptDownloads:true});
  const p = await c.newPage();
  p.on('download', d => console.log('DOWNLOAD',d.suggestedFilename()));
  p.on('console', m => console.log('CONSOLE',m.type(),m.text()));
  p.on('pageerror', e => console.log('PAGEERROR',e.message));
  await p.goto('http://127.0.0.1:4173/');
  console.log('summary',await p.locator('details.export-menu').count());
  await p.locator('details.export-menu summary').click();
  console.log('open',await p.locator('details.export-menu').getAttribute('open'));
  console.log('button',await p.getByRole('button',{name:'SVG vector'}).count());
  await p.getByRole('button',{name:'SVG vector'}).click();
  await p.waitForTimeout(2000);
  await b.close();
})().catch(e=>{console.error(e);process.exitCode=1});
