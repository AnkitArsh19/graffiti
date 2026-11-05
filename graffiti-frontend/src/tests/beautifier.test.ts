import { describe, expect, it } from "vitest";
import { beautifyStroke, ramerDouglasPeucker } from "../lib/beautifier";
import type { Point } from "../types";

// Helper to generate noisy points along polygon edges
function generatePolygonPoints(
  vertices: Point[],
  noise = 1.5,
  pointsPerEdge = 25
): Point[] {
  const pts: Point[] = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    for (let t = 0; t < 1; t += 1 / pointsPerEdge) {
      pts.push({
        x: a.x + t * (b.x - a.x) + (Math.random() * 2 - 1) * noise,
        y: a.y + t * (b.y - a.y) + (Math.random() * 2 - 1) * noise,
      });
    }
  }
  // Closure with slight overshoot
  pts.push({
    x: vertices[0].x + (Math.random() * 2 - 1) * noise,
    y: vertices[0].y + (Math.random() * 2 - 1) * noise,
  });
  return pts;
}

describe("beautifier", () => {
  it("simplifies points with Ramer-Douglas-Peucker", () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0.1 },
      { x: 20, y: -0.1 },
      { x: 50, y: 0 },
    ];
    const simplified = ramerDouglasPeucker(pts, 1.0);
    expect(simplified.length).toBe(2);
    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified[1]).toEqual({ x: 50, y: 0 });
  });

  it("beautifies straight strokes into clean lines", () => {
    const pts: Point[] = [];
    for (let x = 0; x <= 100; x += 5) {
      pts.push({ x, y: 50 + (Math.random() * 2 - 1) });
    }
    const result = beautifyStroke(pts, undefined, "test-page");
    expect(result.shape).toBe("line");
    expect(result.confidence).toBeGreaterThan(0.80);
    expect(result.element.type).toBe("line");
    expect(result.element.width).toBeGreaterThanOrEqual(95);
  });

  it("beautifies circular strokes into ellipses/circles", () => {
    const pts: Point[] = [];
    const radius = 50;
    const cx = 100;
    const cy = 100;
    for (let angle = 0; angle <= 360; angle += 15) {
      const rad = (angle * Math.PI) / 180;
      pts.push({
        x: cx + radius * Math.cos(rad) + (Math.random() * 2 - 1),
        y: cy + radius * Math.sin(rad) + (Math.random() * 2 - 1),
      });
    }
    const result = beautifyStroke(pts, undefined, "test-page");
    expect(["circle", "ellipse"]).toContain(result.shape);
    expect(result.element.type).toBe("ellipse");
    expect(result.element.width).toBeCloseTo(100, -1);
    expect(result.element.height).toBeCloseTo(100, -1);
  });

  it("beautifies rectangular strokes into rectangles", () => {
    const pts: Point[] = [];
    for (let x = 0; x <= 100; x += 10) pts.push({ x, y: 0 });
    for (let y = 0; y <= 60; y += 10) pts.push({ x: 100, y });
    for (let x = 100; x >= 0; x -= 10) pts.push({ x, y: 60 });
    for (let y = 60; y >= 0; y -= 10) pts.push({ x: 0, y });

    const result = beautifyStroke(pts, undefined, "test-page");
    expect(result.shape).toBe("rectangle");
    expect(result.element.type).toBe("rectangle");
    expect(result.element.width).toBe(100);
    expect(result.element.height).toBe(60);
  });

  it("beautifies diamond strokes into diamonds", () => {
    const pts: Point[] = [];
    const cx = 100;
    const cy = 100;
    const rx = 60;
    const ry = 60;
    for (let t = 0; t <= 1; t += 0.2) pts.push({ x: cx + t * rx, y: cy - (1 - t) * ry });
    for (let t = 0; t <= 1; t += 0.2) pts.push({ x: cx + (1 - t) * rx, y: cy + t * ry });
    for (let t = 0; t <= 1; t += 0.2) pts.push({ x: cx - t * rx, y: cy + (1 - t) * ry });
    for (let t = 0; t <= 1; t += 0.2) pts.push({ x: cx - (1 - t) * rx, y: cy - t * ry });

    const result = beautifyStroke(pts, undefined, "test-page");
    expect(result.shape).toBe("diamond");
    expect(result.element.type).toBe("diamond");
  });

  it("beautifies rotated rectangle at 30°", () => {
    const cos30 = Math.cos(Math.PI / 6);
    const sin30 = Math.sin(Math.PI / 6);
    const rectVerts: Point[] = [
      { x: 100, y: 100 },
      { x: 100 + 120 * cos30, y: 100 + 120 * sin30 },
      { x: 100 + 120 * cos30 - 60 * sin30, y: 100 + 120 * sin30 + 60 * cos30 },
      { x: 100 - 60 * sin30, y: 100 + 60 * cos30 },
    ];
    const rectPts = generatePolygonPoints(rectVerts, 1.5);
    const res = beautifyStroke(rectPts);
    expect(res.shape).toBe("rectangle");
    expect(res.element.type).toBe("rectangle");
    expect(res.confidence).toBeGreaterThanOrEqual(0.75);
    expect(res.element.angle).toBeDefined();
  });

  it("beautifies rotated diamond/rhombus at 40°", () => {
    const angle4 = 0.70;
    const dVerts: Point[] = [
      { x: 200 + 50 * Math.cos(angle4), y: 200 + 50 * Math.sin(angle4) },
      { x: 200 + 35 * Math.cos(angle4 + Math.PI / 2), y: 200 + 35 * Math.sin(angle4 + Math.PI / 2) },
      { x: 200 + 50 * Math.cos(angle4 + Math.PI), y: 200 + 50 * Math.sin(angle4 + Math.PI) },
      { x: 200 + 35 * Math.cos(angle4 + (3 * Math.PI) / 2), y: 200 + 35 * Math.sin(angle4 + (3 * Math.PI) / 2) },
    ];
    const diamondPts = generatePolygonPoints(dVerts, 1.5);
    const res = beautifyStroke(diamondPts);
    expect(res.shape).toBe("diamond");
    expect(res.element.type).toBe("diamond");
    expect(res.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("beautifies rotated triangle at 25°", () => {
    const triVerts: Point[] = [0, 1, 2].map((i) => {
      const a = 0.44 + (i * 2 * Math.PI) / 3;
      return { x: 200 + 80 * Math.cos(a), y: 200 + 80 * Math.sin(a) };
    });
    const triPts = generatePolygonPoints(triVerts, 1.5);
    const res = beautifyStroke(triPts);
    expect(res.shape).toBe("triangle");
    expect(res.element.type).toBe("pen");
    expect(res.element.customData?.isPolygon).toBe(true);
    expect(res.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("beautifies rotated pentagon at 15°", () => {
    const pentVerts: Point[] = [0, 1, 2, 3, 4].map((i) => {
      const a = 0.26 + (i * 2 * Math.PI) / 5;
      return { x: 200 + 80 * Math.cos(a), y: 200 + 80 * Math.sin(a) };
    });
    const pentPts = generatePolygonPoints(pentVerts, 1.5);
    const res = beautifyStroke(pentPts);
    expect(res.shape).toBe("pentagon");
    expect(res.element.type).toBe("pen");
    expect(res.element.customData?.isPolygon).toBe(true);
    expect(res.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("beautifies rotated hexagon at 45°", () => {
    const hexVerts: Point[] = [0, 1, 2, 3, 4, 5].map((i) => {
      const a = 0.785 + (i * 2 * Math.PI) / 6;
      return { x: 200 + 85 * Math.cos(a), y: 200 + 85 * Math.sin(a) };
    });
    const hexPts = generatePolygonPoints(hexVerts, 1.5);
    const res = beautifyStroke(hexPts);
    expect(res.shape).toBe("hexagon");
    expect(res.element.type).toBe("pen");
    expect(res.element.customData?.isPolygon).toBe(true);
    expect(res.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("beautifies large tilted ellipse at 35°", () => {
    const elPts: Point[] = [];
    const elAngle = 0.61;
    const cosE = Math.cos(elAngle);
    const sinE = Math.sin(elAngle);
    for (let t = 0; t <= 360; t += 6) {
      const rad = (t * Math.PI) / 180;
      const lx = 140 * Math.cos(rad) + (Math.random() * 4 - 2);
      const ly = 80 * Math.sin(rad) + (Math.random() * 4 - 2);
      elPts.push({
        x: 300 + lx * cosE - ly * sinE,
        y: 300 + lx * sinE + ly * cosE,
      });
    }
    const res = beautifyStroke(elPts);
    expect(res.shape).toBe("ellipse");
    expect(res.element.type).toBe("ellipse");
    expect(res.confidence).toBeGreaterThanOrEqual(0.75);
    expect(res.element.angle).toBeDefined();
  });

  it("handles degenerate / single point strokes gracefully", () => {
    const singlePoint: Point[] = [{ x: 50, y: 50 }];
    const result = beautifyStroke(singlePoint, undefined, "test-page");
    expect(result.shape).toBe("smoothed_stroke");
    expect(result.element.type).toBe("pen");
  });

  it("reliably regularizes handdrawn tilted rectangle with rounded corners without becoming a circle", () => {
    const angle = 0.42; // ~24 deg tilt, matching the user's uploaded image
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const w = 140;
    const h = 100;
    const cx = 250;
    const cy = 250;

    const pts: Point[] = [];
    const localVerts = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ];
    for (let i = 0; i < 4; i++) {
      const a = localVerts[i];
      const b = localVerts[(i + 1) % 4];
      for (let t = 0; t < 1; t += 0.05) {
        const lx = a.x + t * (b.x - a.x) + (Math.random() * 2 - 1);
        const ly = a.y + t * (b.y - a.y) + (Math.random() * 2 - 1);
        pts.push({
          x: cx + lx * cosA - ly * sinA,
          y: cy + lx * sinA + ly * cosA,
        });
      }
    }
    // Add closure overshoot
    pts.push({
      x: pts[0].x + 10 * cosA,
      y: pts[0].y + 10 * sinA,
    });

    const res = beautifyStroke(pts);
    expect(res.shape).toBe("rectangle");
    expect(res.element.type).toBe("rectangle");
    expect(res.shape).not.toBe("circle");
    expect(res.shape).not.toBe("ellipse");
    expect(res.element.angle).toBeDefined();
  });

  it("ensures a square with an accidental end hook never turns into a pentagon", () => {
    // 4 edges of a square + an end hook extending into a 5th vertex
    const pts: Point[] = [];
    for (let x = 100; x <= 200; x += 10) pts.push({ x, y: 100 + (Math.random() * 2 - 1) });
    for (let y = 100; y <= 200; y += 10) pts.push({ x: 200 + (Math.random() * 2 - 1), y });
    for (let x = 200; x >= 100; x -= 10) pts.push({ x, y: 200 + (Math.random() * 2 - 1) });
    for (let y = 200; y >= 100; y -= 10) pts.push({ x: 100 + (Math.random() * 2 - 1), y });
    // Accidental hook on lift
    pts.push({ x: 115, y: 108 });
    pts.push({ x: 125, y: 112 });

    const res = beautifyStroke(pts);
    expect(res.shape).toBe("rectangle");
    expect(res.element.type).toBe("rectangle");
    expect(res.shape).not.toBe("pentagon");
    expect(res.shape).not.toBe("polygon");
  });

  it("ensures a handdrawn wobbly circle never turns into a pentagon or hexagon", () => {
    const pts: Point[] = [];
    const radius = 60;
    const cx = 300;
    const cy = 300;
    for (let a = 0; a <= 360; a += 10) {
      const rad = (a * Math.PI) / 180;
      // Hand tremor wobble
      const wobble = Math.sin(a * 4) * 3 + (Math.random() * 2 - 1);
      pts.push({
        x: cx + (radius + wobble) * Math.cos(rad),
        y: cy + (radius + wobble) * Math.sin(rad),
      });
    }

    const res = beautifyStroke(pts);
    expect(["circle", "ellipse"]).toContain(res.shape);
    expect(res.element.type).toBe("ellipse");
    expect(res.shape).not.toBe("pentagon");
    expect(res.shape).not.toBe("hexagon");
  });
});
