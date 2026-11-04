import { describe, expect, it } from "vitest";
import { beautifyStroke, ramerDouglasPeucker } from "../lib/beautifier";
import type { Point } from "../types";

describe("beautifier", () => {
  it("simplifies points with Ramer-Douglas-Peucker", () => {
    // Collinear points with slight middle wiggle
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
    expect(result.confidence).toBeGreaterThan(0.85);
    expect(result.element.type).toBe("line");
    expect(result.element.width).toBeGreaterThanOrEqual(95);
  });

  it("beautifies circular strokes into ellipses/circles", () => {
    const pts: Point[] = [];
    const radius = 50;
    const cx = 100;
    const cy = 100;
    // Draw 360 degrees
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
    // Top edge
    for (let x = 0; x <= 100; x += 10) pts.push({ x, y: 0 });
    // Right edge
    for (let y = 0; y <= 60; y += 10) pts.push({ x: 100, y });
    // Bottom edge
    for (let x = 100; x >= 0; x -= 10) pts.push({ x, y: 60 });
    // Left edge
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
    // Top to right
    for (let t = 0; t <= 1; t += 0.2) pts.push({ x: cx + t * rx, y: cy - (1 - t) * ry });
    // Right to bottom
    for (let t = 0; t <= 1; t += 0.2) pts.push({ x: cx + (1 - t) * rx, y: cy + t * ry });
    // Bottom to left
    for (let t = 0; t <= 1; t += 0.2) pts.push({ x: cx - t * rx, y: cy + (1 - t) * ry });
    // Left to top
    for (let t = 0; t <= 1; t += 0.2) pts.push({ x: cx - (1 - t) * rx, y: cy - t * ry });

    const result = beautifyStroke(pts, undefined, "test-page");
    expect(result.shape).toBe("diamond");
    expect(result.element.type).toBe("diamond");
  });

  it("handles degenerate / single point strokes gracefully", () => {
    const singlePoint: Point[] = [{ x: 50, y: 50 }];
    const result = beautifyStroke(singlePoint, undefined, "test-page");
    expect(result.shape).toBe("smoothed_stroke");
    expect(result.element.type).toBe("pen");
  });
});

