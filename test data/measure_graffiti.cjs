const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const {execFileSync} = require('node:child_process');

const URL = 'http://127.0.0.1:4173/';
const OUT = path.join(__dirname, 'data');
fs.mkdirSync(OUT, { recursive: true });

function fixture(count) {
  const pageId = 'page-benchmark';
  return {
    pages: [{
      id: pageId,
      title: 'Benchmark page',
      template: 'blank',
      elements: Array.from({ length: count }, (_, index) => ({
        id: `rect-${index}`,
        pageId,
        type: 'rectangle',
        x: (index % 25) * 58,
        y: Math.floor(index / 25) * 44,
        width: 45,
        height: 30,
        text: `N${index}`,
        strokeColor: '#111827',
        backgroundColor: 'transparent',
        strokeWidth: 2,
        roughness: 1,
        opacity: 100,
        seed: index + 1,
      })),
    }],
    activePageId: pageId,
  };
}

function csv(rows) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  const q = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [columns.map(q).join(','), ...rows.map(row => columns.map(key => q(row[key])).join(','))].join('\n') + '\n';
}

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const info = {
    measuredAt: new Date().toISOString(),
    browserVersion: browser.version(),
    sourceCommit: execFileSync('git', ['rev-parse','--short','HEAD'], {cwd:path.resolve(__dirname,'..'),encoding:'utf8'}).trim(),
    appBuild: 'Vite production preview',
    operatingSystem: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0].model,
    logicalCores: os.cpus().length,
    memoryBytes: os.totalmem(),
    nodeVersion: process.version,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    url: URL,
  };
  const rows = [];
  const counts = [0, 100, 500, 1000];
  const order = Array.from({ length: 10 }, (_, repetition) => counts.map((_, i) => counts[(i + repetition) % counts.length])).flat();
  for (let trial = 0; trial < order.length; trial++) {
    const count = order[trial];
    const context = await browser.newContext({ viewport: info.viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const state = JSON.stringify(fixture(count));
    await context.addInitScript(value => localStorage.setItem('graffiti:notebook:v1', value), state);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByText(`${count} elements`).waitFor({ timeout: 30000 });
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      return canvas && canvas.width > 0 && canvas.height > 0;
    });
    const timing = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      resolve({ readyMs: performance.now(), responseEndMs: nav.responseEnd, domContentLoadedMs: nav.domContentLoadedEventEnd });
    }))));
    rows.push({ trial: trial + 1, repetition: Math.floor(trial / 4) + 1, objects: count,
      response_to_ready_ms: +(timing.readyMs - timing.responseEndMs).toFixed(3),
      navigation_to_ready_ms: +timing.readyMs.toFixed(3),
      dom_content_loaded_ms: +timing.domContentLoadedMs.toFixed(3),
      page_errors: errors.length });
    await context.close();
  }
  fs.writeFileSync(path.join(OUT, 'graffiti_render_trials.csv'), csv(rows));

  const exportRows = [];
  for (const count of counts.slice(1)) {
    const context = await browser.newContext({ viewport: info.viewport, acceptDownloads: true });
    const state = JSON.stringify(fixture(count));
    await context.addInitScript(value => localStorage.setItem('graffiti:notebook:v1', value), state);
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.getByText(`${count} elements`).waitFor();
    for (const kind of ['svg', 'json', 'png']) {
      await page.locator('details.export-menu').evaluate(element => { element.open = true; });
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: kind === 'svg' ? 'SVG vector' : kind === 'json' ? 'Graffiti file' : 'PNG image' }).click(),
      ]);
      const bytes = fs.readFileSync(await download.path());
      let verified = false;
      let observed = '';
      if (kind === 'svg') {
        const content = bytes.toString('utf8');
        const rects = (content.match(/<rect /g) || []).length - 1;
        const labels = (content.match(/<text /g) || []).length;
        observed = `rectangles=${rects};labels=${labels}`;
        verified = rects === count && labels === count;
      } else if (kind === 'json') {
        const parsed = JSON.parse(bytes.toString('utf8'));
        observed = `pages=${parsed.pages.length};objects=${parsed.pages[0].elements.length}`;
        verified = parsed.pages.length === 1 && parsed.pages[0].elements.length === count;
      } else {
        const width = bytes.readUInt32BE(16);
        const height = bytes.readUInt32BE(20);
        observed = `bytes=${bytes.length};width=${width};height=${height};sha256=${crypto.createHash('sha256').update(bytes).digest('hex')}`;
        verified = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.length > 1000;
      }
      exportRows.push({ objects: count, format: kind.toUpperCase(), downloaded: true,
        basic_validation_pass: verified,
        validation_rule: kind === 'png' ? 'PNG signature and nonempty file only' : 'Exact exported object and label count',
        observed, filename: download.suggestedFilename() });
    }
    await context.close();
  }
  fs.writeFileSync(path.join(OUT, 'graffiti_export_checks.csv'), csv(exportRows));

  const persistenceRows = [];
  for (let trial = 1; trial <= 10; trial++) {
    const context = await browser.newContext({ viewport: info.viewport });
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Rectangle (R)' }).click();
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    const x = box.x + 250;
    const y = box.y + 180;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 100, y + 70, { steps: 5 });
    await page.mouse.up();
    await page.getByText('1 element', { exact: false }).waitFor();
    await page.waitForFunction(() => {
      try { return JSON.parse(localStorage.getItem('graffiti:notebook:v1')).pages[0].elements.length === 1; }
      catch { return false; }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('1 element', { exact: false }).waitFor();
    const persisted = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('graffiti:notebook:v1'));
      return state.pages[0].elements.length === 1 && state.pages[0].elements[0].type === 'rectangle';
    });
    persistenceRows.push({ trial, saved: true, restored: persisted });
    await context.close();
  }
  fs.writeFileSync(path.join(OUT, 'graffiti_persistence_checks.csv'), csv(persistenceRows));
  fs.writeFileSync(path.join(OUT, 'run_metadata.json'), JSON.stringify(info, null, 2) + '\n');
  await browser.close();
  console.log(JSON.stringify({ renderTrials: rows.length, exportChecks: exportRows.length, persistenceChecks: persistenceRows.length,
    renderFailures: rows.filter(row => row.page_errors).length,
    exportFailures: exportRows.filter(row => !row.basic_validation_pass).length,
    persistenceFailures: persistenceRows.filter(row => !row.restored).length }, null, 2));
}

run().catch(error => { console.error(error); process.exitCode = 1; });
