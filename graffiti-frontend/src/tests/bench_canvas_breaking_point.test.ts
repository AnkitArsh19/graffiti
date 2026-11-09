import { describe, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import rough from "roughjs";
import type { CanvasElement } from "../types";

function createVisibleElements(count: number, roughness = 1): CanvasElement[] {
  const elements: CanvasElement[] = [];
  const types: CanvasElement["type"][] = ["rectangle", "ellipse", "diamond", "line"];

  // Pack all elements inside a visible 1440x900 viewport space (e.g. fully zoomed out)
  const cols = Math.ceil(Math.sqrt(count * (1440 / 900)));
  const rows = Math.ceil(count / cols);
  const stepX = 1400 / Math.max(cols, 1);
  const stepY = 860 / Math.max(rows, 1);

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const type = types[i % types.length];

    elements.push({
      id: `el-vis-${i}`,
      pageId: "page-1",
      type,
      x: 20 + col * stepX,
      y: 20 + row * stepY,
      width: Math.max(stepX * 0.8, 8),
      height: Math.max(stepY * 0.8, 8),
      strokeColor: "#3b82f6",
      backgroundColor: type === "rectangle" ? "#1e293b" : "transparent",
      strokeWidth: 2,
      roughness,
      opacity: 100,
      seed: i + 1,
    });
  }
  return elements;
}

describe("Canvas Rendering Physical Breaking Point Benchmark (All Shapes Simultaneously Visible)", () => {
  it("determines the exact shape threshold where frame rates drop below 60 FPS, 30 FPS, and into hitching", () => {
    // Test densities with 100% visible elements (e.g. zoomed-out canvas)
    const DENSITIES = [100, 250, 500, 1000, 1500, 2000, 3000, 4000, 5000, 7500, 10000];
    const generator = rough.generator();
    const results: any[] = [];

    console.log("\n=== TESTING CANVAS RENDERING PHYSICAL BREAKING POINT ===");
    console.log("Simulating 100% simultaneously visible shapes on screen (Zoomed-Out Panoramic View)...\n");

    let breakingPoint60Fps: number | null = null;
    let breakingPoint30Fps: number | null = null;
    let breakingPoint10Fps: number | null = null;

    DENSITIES.forEach((count) => {
      const elements = createVisibleElements(count, 1.2); // Typical hand-drawn roughness
      const frameTimes: number[] = [];
      const ITERATIONS = 30;

      // Warmup
      for (let w = 0; w < 3; w++) {
        for (let i = 0; i < Math.min(count, 100); i++) {
          generator.rectangle(elements[i].x, elements[i].y, elements[i].width, elements[i].height, { roughness: 1 });
        }
      }

      // Benchmark full frame generation
      for (let iter = 0; iter < ITERATIONS; iter++) {
        const t0 = performance.now();

        // Render every single element without culling (all visible in view)
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          if (el.type === "rectangle") {
            generator.rectangle(el.x, el.y, el.width, el.height, { roughness: el.roughness, seed: el.seed });
          } else if (el.type === "ellipse") {
            generator.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width, el.height, { roughness: el.roughness, seed: el.seed });
          } else {
            generator.line(el.x, el.y, el.x + el.width, el.y + el.height, { roughness: el.roughness, seed: el.seed });
          }
        }

        const t1 = performance.now();
        frameTimes.push(t1 - t0);
      }

      frameTimes.sort((a, b) => a - b);
      const meanMs = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const p95Ms = frameTimes[Math.floor(frameTimes.length * 0.95)];
      const effectiveFps = Math.max(1, 1000 / Math.max(meanMs, 0.1));

      let status = "Smooth 60 FPS";
      if (meanMs > 100.0) {
        status = "CRITICAL FREEZE (<10 FPS)";
        if (!breakingPoint10Fps) breakingPoint10Fps = count;
      } else if (meanMs > 33.33) {
        status = "SEVERE DROP (<30 FPS)";
        if (!breakingPoint30Fps) breakingPoint30Fps = count;
      } else if (meanMs > 16.67) {
        status = "DROPPING (<60 FPS)";
        if (!breakingPoint60Fps) breakingPoint60Fps = count;
      }

      const row = {
        simultaneously_visible_shapes: count,
        mean_frame_time_ms: Number(meanMs.toFixed(2)),
        p95_frame_time_ms: Number(p95Ms.toFixed(2)),
        effective_fps: Number(effectiveFps.toFixed(1)),
        frame_budget_percent: Number(((meanMs / 16.67) * 100).toFixed(1)),
        status,
      };

      results.push(row);
      console.log(
        `[${count.toString().padStart(5)} visible] Frame: ${row.mean_frame_time_ms.toFixed(2)}ms | p95: ${row.p95_frame_time_ms.toFixed(2)}ms | FPS: ${row.effective_fps.toFixed(1).padStart(5)} | ${status}`
      );
    });

    console.log("\n=== BREAKING POINT SUMMARY ===");
    console.log(`- 60 FPS Threshold Limit: ~${breakingPoint60Fps || ">10,000"} simultaneously visible shapes`);
    console.log(`- 30 FPS Severe Lag Limit: ~${breakingPoint30Fps || ">10,000"} simultaneously visible shapes`);
    console.log(`- 10 FPS Critical Freeze Limit: ~${breakingPoint10Fps || ">10,000"} simultaneously visible shapes`);

    const outDir = path.resolve(process.cwd(), "../test data/data");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // Save CSV and JSON
    const csvHeader = Object.keys(results[0]).join(",");
    const csvBody = results.map((r) => Object.values(r).join(",")).join("\n");
    fs.writeFileSync(path.join(outDir, "canvas_breaking_point_summary.csv"), `${csvHeader}\n${csvBody}\n`, "utf-8");

    const jsonPayload = {
      benchmark: "Canvas Rendering Physical Breaking Point (Unculled 100% Visible)",
      thresholds: {
        breakingPoint60Fps,
        breakingPoint30Fps,
        breakingPoint10Fps,
      },
      results,
    };
    fs.writeFileSync(path.join(outDir, "canvas_breaking_point_results.json"), JSON.stringify(jsonPayload, null, 2), "utf-8");
  }, 35000);
});
