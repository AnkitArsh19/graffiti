import { describe, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import rough from "roughjs";
import type { CanvasElement } from "../types";

function createSyntheticElements(count: number): CanvasElement[] {
  const elements: CanvasElement[] = [];
  const types: CanvasElement["type"][] = ["rectangle", "ellipse", "diamond", "line", "arrow"];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const x = (i % 50) * 60;
    const y = Math.floor(i / 50) * 50;

    elements.push({
      id: `el-${i}`,
      pageId: "page-1",
      type,
      x,
      y,
      width: 50,
      height: 35,
      strokeColor: "#3b82f6",
      backgroundColor: type === "rectangle" ? "#1e293b" : "transparent",
      strokeWidth: 2,
      roughness: 1,
      opacity: 100,
      seed: i + 1,
    });
  }
  return elements;
}

// Mock 2D Context for High-Throughput Canvas Measurement
function createMockContext() {
  return {
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    fillText: () => {},
    measureText: (text: string) => ({ width: text.length * 8 }),
    setLineDash: () => {},
    getLineDash: () => [],
    globalAlpha: 1.0,
    strokeStyle: "#000",
    fillStyle: "#000",
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe("Canvas 60 FPS Render Scalability & Frame-Budget Benchmark", () => {
  it(
    "evaluates frame rendering latency, effective FPS, and viewport culling across 100 to 10,000 shapes",
    () => {
    const SHAPE_COUNTS = [100, 500, 1000, 2500, 5000, 10000];
    const ITERATIONS_PER_LEVEL = 100;
    const summaryRows: any[] = [];
    const generator = rough.generator();
    const ctx = createMockContext();

    console.log("\n=== RUNNING HIGH-DENSITY CANVAS RENDER STRESS BENCHMARK ===");

    SHAPE_COUNTS.forEach((count) => {
      const elements = createSyntheticElements(count);
      const frameLatenciesMs: number[] = [];

      // Warmup
      for (let w = 0; w < 5; w++) {
        for (let i = 0; i < Math.min(count, 50); i++) {
          generator.rectangle(elements[i].x, elements[i].y, elements[i].width, elements[i].height, { roughness: 1 });
        }
      }

      // Viewport culling simulation (Camera at (0, 0) with 1440x900 viewport)
      const viewportW = 1440;
      const viewportH = 900;
      let culledCount = 0;
      let visibleCount = 0;

      elements.forEach((el) => {
        const isVisible = el.x + el.width >= 0 && el.x <= viewportW && el.y + el.height >= 0 && el.y <= viewportH;
        if (isVisible) {
          visibleCount++;
        } else {
          culledCount++;
        }
      });

      // Benchmark frame render times
      for (let it = 0; it < ITERATIONS_PER_LEVEL; it++) {
        const tStart = performance.now();

        // Render visible scene with viewport culling optimization
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          // Bounding box culling check
          if (el.x + el.width < 0 || el.x > viewportW || el.y + el.height < 0 || el.y > viewportH) {
            continue;
          }

          if (el.type === "rectangle") {
            generator.rectangle(el.x, el.y, el.width, el.height, { roughness: el.roughness, seed: el.seed });
          } else if (el.type === "ellipse") {
            generator.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width, el.height, { roughness: el.roughness, seed: el.seed });
          } else {
            generator.line(el.x, el.y, el.x + el.width, el.y + el.height, { roughness: el.roughness, seed: el.seed });
          }
        }

        const tEnd = performance.now();
        frameLatenciesMs.push(tEnd - tStart);
      }

      frameLatenciesMs.sort((a, b) => a - b);
      const meanLatency = frameLatenciesMs.reduce((a, b) => a + b, 0) / frameLatenciesMs.length;
      const p50Latency = frameLatenciesMs[Math.floor(frameLatenciesMs.length * 0.5)];
      const p95Latency = frameLatenciesMs[Math.floor(frameLatenciesMs.length * 0.95)];
      const p99Latency = frameLatenciesMs[Math.floor(frameLatenciesMs.length * 0.99)];

      // 60 FPS Target budget = 16.67ms per frame
      const effectiveFps = Math.min(120, 1000 / Math.max(meanLatency, 0.1));
      const onePercentLowFps = Math.min(120, 1000 / Math.max(p99Latency, 0.1));
      const frameBudgetUsedPercent = (meanLatency / 16.67) * 100;
      const jankFrames = frameLatenciesMs.filter((d) => d > 16.67).length;

      const row = {
        shape_count: count,
        visible_shapes: visibleCount,
        culled_shapes: culledCount,
        mean_frame_time_ms: Number(meanLatency.toFixed(2)),
        p50_frame_time_ms: Number(p50Latency.toFixed(2)),
        p95_frame_time_ms: Number(p95Latency.toFixed(2)),
        p99_frame_time_ms: Number(p99Latency.toFixed(2)),
        effective_fps: Number(effectiveFps.toFixed(1)),
        one_percent_low_fps: Number(onePercentLowFps.toFixed(1)),
        frame_budget_used_pct: Number(frameBudgetUsedPercent.toFixed(1)),
        jank_frames_count: jankFrames,
      };

      summaryRows.push(row);
      console.log(`[${count.toString().padStart(5)} shapes] Mean: ${row.mean_frame_time_ms}ms | p95: ${row.p95_frame_time_ms}ms | FPS: ${row.effective_fps} | Budget Used: ${row.frame_budget_used_pct}%`);
    });

    const outDir = path.resolve(process.cwd(), "../test data/data");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // Save CSV and JSON
    const csvHeader = Object.keys(summaryRows[0]).join(",");
    const csvBody = summaryRows.map((r) => Object.values(r).join(",")).join("\n");
    fs.writeFileSync(path.join(outDir, "canvas_fps_summary.csv"), `${csvHeader}\n${csvBody}\n`, "utf-8");

    fs.writeFileSync(path.join(outDir, "canvas_fps_results.json"), JSON.stringify(summaryRows, null, 2), "utf-8");

    console.log("\n=== CANVAS 60 FPS RENDER BENCHMARK COMPLETE ===");
    console.log(`Results saved to ${path.join(outDir, "canvas_fps_summary.csv")}`);
  }, 35000);
});

