const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const PORT = 4173;
const URL = `http://127.0.0.1:${PORT}/`;
const OUT_DIR = path.join(__dirname, 'data');
fs.mkdirSync(OUT_DIR, { recursive: true });

function fixture(count) {
  const pageId = 'page-fps-bench';
  return {
    pages: [{
      id: pageId,
      title: 'FPS Benchmark Page',
      template: 'blank',
      elements: Array.from({ length: count }, (_, index) => ({
        id: `rect-${index}`,
        pageId,
        type: (index % 3 === 0) ? 'rectangle' : (index % 3 === 1) ? 'ellipse' : 'diamond',
        x: (index % 35) * 65,
        y: Math.floor(index / 35) * 55,
        width: 50,
        height: 35,
        text: `N${index}`,
        strokeColor: '#3b82f6',
        backgroundColor: '#1e293b',
        strokeWidth: 2,
        roughness: 1,
        opacity: 100,
        seed: index + 1,
      })),
    }],
    activePageId: pageId,
  };
}

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServer() {
  const isUp = await checkPort(PORT);
  if (isUp) {
    console.log(`Preview server already running on port ${PORT}`);
    return null;
  }

  console.log(`Starting Vite preview server on port ${PORT}...`);
  const frontendDir = path.resolve(__dirname, '../graffiti-frontend');
  const server = spawn('npm.cmd', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(PORT)], {
    cwd: frontendDir,
    stdio: 'ignore',
    shell: true,
  });

  // Poll until ready
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await checkPort(PORT)) {
      console.log('Preview server is up!');
      return server;
    }
  }
  throw new Error('Timed out waiting for Vite preview server to start.');
}

async function run() {
  let serverProcess = null;
  try {
    serverProcess = await ensureServer();
  } catch (err) {
    console.error('Failed to ensure preview server:', err);
    process.exit(1);
  }

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const counts = [100, 500, 1000, 2500, 5000];
  const summaryRows = [];

  console.log('\n=== RUNNING 60 FPS CANVAS RENDER STRESS BENCHMARK ===');

  for (const count of counts) {
    console.log(`\nTesting shape density: ${count} elements...`);
    const dataFixture = fixture(count);

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    // Prime localStorage with the fixture
    await page.addInitScript((state) => {
      localStorage.setItem('graffiti:notebook_state_v1', JSON.stringify(state));
      localStorage.setItem('graffiti_theme', 'dark');
    }, dataFixture);

    await page.goto(URL, { waitUntil: 'networkidle' });

    // Wait for canvas element
    const canvas = page.locator('canvas').first();
    await canvas.waitFor({ timeout: 15000 });
    await page.waitForTimeout(600); // Warmup and initial render settling

    // Inject rAF frame profiling and pan-and-zoom trajectory
    const fpsData = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const frameDeltas = [];
        let lastTime = performance.now();
        let running = true;

        function recordFrame(now) {
          const delta = now - lastTime;
          frameDeltas.push(delta);
          lastTime = now;
          if (running) {
            requestAnimationFrame(recordFrame);
          }
        }
        requestAnimationFrame(recordFrame);

        // Simulate 4 seconds of pan/zoom user interaction
        const start = performance.now();
        const duration = 4000;
        const canvasEl = document.querySelector('canvas');

        const interval = setInterval(() => {
          const elapsed = performance.now() - start;
          if (elapsed >= duration) {
            clearInterval(interval);
            running = false;
            // Wait 2 extra frames before resolving
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                resolve(frameDeltas.slice(2)); // Skip initial warm frame
              });
            });
            return;
          }

          // Dispatch synthetic mousewheel and pan events on canvas
          if (canvasEl) {
            const angle = (elapsed / 500) * Math.PI;
            const deltaX = Math.cos(angle) * 15;
            const deltaY = Math.sin(angle) * 15;
            const wheelEv = new WheelEvent('wheel', {
              deltaX,
              deltaY,
              clientX: 720,
              clientY: 450,
              bubbles: true,
            });
            canvasEl.dispatchEvent(wheelEv);
          }
        }, 16);
      });
    });

    await context.close();

    // Analyze Frame Durations
    const sorted = [...fpsData].sort((a, b) => a - b);
    const totalFrames = sorted.length;
    const avgDelta = sorted.reduce((a, b) => a + b, 0) / totalFrames;
    const meanFps = 1000 / avgDelta;

    const p50Delta = sorted[Math.floor(totalFrames * 0.5)];
    const p95Delta = sorted[Math.floor(totalFrames * 0.95)];
    const p99Delta = sorted[Math.floor(totalFrames * 0.99)];
    const onePercentLowFps = 1000 / p99Delta;

    const jankFrames = sorted.filter((d) => d > 33.3).length; // below 30 fps
    const severeJankFrames = sorted.filter((d) => d > 50.0).length; // below 20 fps
    const jankRatePercent = (jankFrames / totalFrames) * 100;

    const resultRow = {
      shape_count: count,
      total_frames: totalFrames,
      mean_fps: Number(meanFps.toFixed(2)),
      one_percent_low_fps: Number(onePercentLowFps.toFixed(2)),
      mean_frame_time_ms: Number(avgDelta.toFixed(2)),
      p95_frame_time_ms: Number(p95Delta.toFixed(2)),
      p99_frame_time_ms: Number(p99Delta.toFixed(2)),
      jank_frames_count: jankFrames,
      jank_rate_pct: Number(jankRatePercent.toFixed(2)),
      severe_jank_count: severeJankFrames,
    };

    summaryRows.push(resultRow);
    console.log(`-> Mean FPS: ${resultRow.mean_fps} | 1% Low FPS: ${resultRow.one_percent_low_fps} | p95 Frame Time: ${resultRow.p95_frame_time_ms}ms | Jank Rate: ${resultRow.jank_rate_pct}%`);
  }

  await browser.close();

  if (serverProcess) {
    serverProcess.kill('SIGINT');
  }

  // Write CSV
  const csvHeader = Object.keys(summaryRows[0]).join(',');
  const csvBody = summaryRows.map((r) => Object.values(r).join(',')).join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'canvas_fps_summary.csv'), `${csvHeader}\n${csvBody}\n`, 'utf-8');

  // Write JSON
  fs.writeFileSync(path.join(OUT_DIR, 'canvas_fps_results.json'), JSON.stringify(summaryRows, null, 2), 'utf-8');

  console.log('\n=== CANVAS 60 FPS RENDER BENCHMARK COMPLETE ===');
  console.log(`Results saved to ${path.join(OUT_DIR, 'canvas_fps_summary.csv')}`);
}

run().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

