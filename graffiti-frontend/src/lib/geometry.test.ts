import { describe, expect, it } from "vitest";
import { distanceToSegment, moveElement, normalizeBox, pointInElement, screenToWorld } from "./geometry";
import type { CanvasElement } from "../types";

const rectangle: CanvasElement = {
  id: "rectangle-1",
  pageId: "page-1",
  type: "rectangle",
  x: 100,
  y: 80,
  width: 120,
  height: 60,
  strokeColor: "#111827",
  backgroundColor: "#dbeafe",
  strokeWidth: 2,
  roughness: 1,
  opacity: 100,
  seed: 42,
};

describe("canvas geometry", () => {
  it("converts screen coordinates to world coordinates", () => {
    expect(screenToWorld({ x: 240, y: 180 }, { x: 40, y: 20, zoom: 2 })).toEqual({ x: 100, y: 80 });
  });

  it("normalizes reverse drag boxes", () => {
    expect(normalizeBox({ x: 80, y: 60 }, { x: 20, y: 10 })).toEqual({
      x: 20,
      y: 10,
      width: 60,
      height: 50,
    });
  });

  it("detects bounding-box hits", () => {
    expect(pointInElement({ x: 130, y: 100 }, rectangle)).toBe(true);
    expect(pointInElement({ x: 300, y: 300 }, rectangle)).toBe(false);
  });

  it("calculates line distance and moves point-based elements", () => {
    expect(distanceToSegment({ x: 5, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(4);
    const line = { ...rectangle, type: "line" as const, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] };
    expect(moveElement(line, 5, -2).points).toEqual([{ x: 5, y: -2 }, { x: 15, y: 8 }]);
  });
});
