import { describe, expect, it } from "vitest";
import {
  clamp,
  createId,
  createSeed,
  moveElement,
  screenToWorld,
  worldToScreen,
  doesElementIntersectBox,
  isElementFullyInsideBox,
  normalizePenElement,
} from "../lib/geometry";
import type { CanvasElement } from "../types";

const rectangle: CanvasElement = {
  id: "rect-1",
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

describe("geometry utilities", () => {
  it("clamps values", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("converts screen to world coordinates correctly", () => {
    const world = screenToWorld({ x: 200, y: 150 }, 50, 25, 1.5);
    expect(world.x).toBeCloseTo(200 / 1.5 - 50, 4);
    expect(world.y).toBeCloseTo(150 / 1.5 - 25, 4);
  });

  it("converts world to screen coordinates correctly", () => {
    const screen = worldToScreen({ x: 100, y: 100 }, 50, 25, 2);
    expect(screen.x).toBe((100 + 50) * 2);
    expect(screen.y).toBe((100 + 25) * 2);
  });

  it("creates ids with prefix", () => {
    const id = createId("page");
    expect(id.startsWith("page_")).toBe(true);
  });

  it("creates non-zero random seeds", () => {
    const seed = createSeed();
    expect(seed).toBeGreaterThan(0);
  });

  it("moves element by delta", () => {
    const moved = moveElement(rectangle, 15, -10);
    expect(moved.x).toBe(115);
    expect(moved.y).toBe(70);
  });

  it("determines if element intersects box for selection", () => {
    const selectionBox = { x: 50, y: 50, width: 100, height: 100 };
    expect(doesElementIntersectBox(rectangle, selectionBox)).toBe(true);

    const outsideBox = { x: 0, y: 0, width: 20, height: 20 };
    expect(doesElementIntersectBox(rectangle, outsideBox)).toBe(false);
  });

  it("determines strict containment inside selection box", () => {
    // Selection box fully enclosing the rectangle [100, 80] to [220, 140]
    const fullyEnclosingBox = { x: 80, y: 60, width: 160, height: 100 };
    expect(isElementFullyInsideBox(rectangle, fullyEnclosingBox)).toBe(true);

    // Selection box overlapping only a part of the rectangle
    const partialOverlapBox = { x: 80, y: 60, width: 50, height: 50 };
    expect(isElementFullyInsideBox(rectangle, partialOverlapBox)).toBe(false);
  });

  it("normalizes pen elements accurately", () => {
    const penElement: CanvasElement = {
      id: "pen-1",
      pageId: "page-1",
      type: "pen",
      x: 100,
      y: 100,
      width: 10,
      height: 10,
      strokeColor: "#000000",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      seed: 1,
      points: [
        { x: 0, y: 0 },
        { x: -20, y: 30 },
        { x: 50, y: 40 },
      ],
    };

    const normalized = normalizePenElement(penElement);
    expect(normalized.x).toBe(80);
    expect(normalized.y).toBe(100);
    expect(normalized.width).toBe(70);
    expect(normalized.height).toBe(40);
    expect(normalized.points?.[0]).toEqual({ x: 20, y: 0 });
    expect(normalized.points?.[1]).toEqual({ x: 0, y: 30 });
    expect(normalized.points?.[2]).toEqual({ x: 70, y: 40 });
  });

  it("returns already-normalized pen element untouched", () => {
    const alreadyNormalized: CanvasElement = {
      id: "pen-2",
      pageId: "page-1",
      type: "pen",
      x: 50,
      y: 50,
      width: 60,
      height: 40,
      strokeColor: "#000000",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      seed: 2,
      points: [
        { x: 0, y: 0 },
        { x: 60, y: 40 },
      ],
    };

    const result = normalizePenElement(alreadyNormalized);
    expect(result.x).toBe(50);
    expect(result.y).toBe(50);
    expect(result.width).toBe(60);
    expect(result.height).toBe(40);
  });
});
