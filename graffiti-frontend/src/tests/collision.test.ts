import { describe, expect, it } from "vitest";
import {
  getElementTransformHandles,
  getHandleCursor,
  getHitTransformHandle,
  pointInElement,
  rotatePoint,
} from "../lib/collision";
import type { CanvasElement } from "../types";

describe("collision and transform handles", () => {
  const arrowElement: CanvasElement = {
    id: "arrow-1",
    pageId: "page-1",
    type: "arrow",
    x: 50,
    y: 50,
    width: 100,
    height: 50,
    points: [
      { x: 0, y: 0 },
      { x: 50, y: 25 },
      { x: 100, y: 50 },
    ],
    strokeColor: "#000000",
    backgroundColor: "transparent",
    strokeWidth: 2,
    roughness: 0,
    opacity: 100,
    seed: 10,
  };

  it("calculates transform handles for an arrow", () => {
    const handles = getElementTransformHandles(arrowElement, 1);
    expect(handles.p0).toEqual([50, 50]);
    expect(handles.pMid).toEqual([100, 75]);
    expect(handles.p1).toEqual([150, 100]);
  });

  it("identifies hit handles accurately", () => {
    const hitP0 = getHitTransformHandle({ x: 52, y: 51 }, arrowElement, 1);
    expect(hitP0).toBe("p0");

    const hitPMid = getHitTransformHandle({ x: 100, y: 76 }, arrowElement, 1);
    expect(hitPMid).toBe("pMid");

    const hitP1 = getHitTransformHandle({ x: 148, y: 99 }, arrowElement, 1);
    expect(hitP1).toBe("p1");

    const miss = getHitTransformHandle({ x: 0, y: 0 }, arrowElement, 1);
    expect(miss).toBeNull();
  });

  it("returns correct cursor styles for handles", () => {
    expect(getHandleCursor("nw")).toBe("nwse-resize");
    expect(getHandleCursor("se")).toBe("nwse-resize");
    expect(getHandleCursor("ne")).toBe("nesw-resize");
    expect(getHandleCursor("sw")).toBe("nesw-resize");
    expect(getHandleCursor("n")).toBe("ns-resize");
    expect(getHandleCursor("s")).toBe("ns-resize");
    expect(getHandleCursor("e")).toBe("ew-resize");
    expect(getHandleCursor("w")).toBe("ew-resize");
    expect(getHandleCursor("rotation")).toBe("grab");
    expect(getHandleCursor("p0")).toBe("crosshair");
    expect(getHandleCursor("p1")).toBe("crosshair");
    expect(getHandleCursor("pMid")).toBe("crosshair");
  });

  it("hit-tests arrow segments with distance tolerance", () => {
    // Point on the line segment
    expect(pointInElement({ x: 100, y: 75 }, arrowElement, 5)).toBe(true);

    // Point far away
    expect(pointInElement({ x: 300, y: 300 }, arrowElement, 5)).toBe(false);
  });

  it("rotates points correctly", () => {
    const [rx, ry] = rotatePoint([10, 0], [0, 0], Math.PI / 2);
    expect(rx).toBeCloseTo(0, 4);
    expect(ry).toBeCloseTo(10, 4);
  });

  it("culls overlapping handles for thin horizontal elements (pen strokes / lines)", () => {
    const thinHorizontal = {
      id: "pen-line-1",
      pageId: "page-1",
      type: "pen" as const,
      x: 100,
      y: 200,
      width: 300,
      height: 4, // thin horizontal
      strokeColor: "#000",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
    } as CanvasElement;
    const handles = getElementTransformHandles(thinHorizontal, 1);
    // Should only have w (left), e (right), and rotation — NO n, s, nw, ne, sw, se colliding
    expect(Object.keys(handles)).toEqual(["w", "e", "rotation"]);
    expect(handles.w).toEqual([100, 202]);
    expect(handles.e).toEqual([400, 202]);
  });

  it("culls overlapping handles for drawn single lines and pen strokes (e.g. 40px height)", () => {
    const singleLinePen = {
      id: "pen-single-line",
      pageId: "page-1",
      type: "pen" as const,
      x: 100,
      y: 200,
      width: 450,
      height: 42, // as drawn in user screenshot
      strokeColor: "#8b5cf6",
      backgroundColor: "transparent",
      strokeWidth: 4,
      roughness: 0,
      opacity: 100,
    } as CanvasElement;
    const handles = getElementTransformHandles(singleLinePen, 1);
    // Never show stacked double buttons (n/s, nw/sw, ne/se) along the single line
    expect(Object.keys(handles)).toEqual(["w", "e", "rotation"]);
    expect(handles.w).toEqual([100, 221]);
    expect(handles.e).toEqual([550, 221]);
  });

  it("accurately hit-tests rotated pen strokes", () => {
    const rotatedPen: CanvasElement = {
      id: "pen-rot-1",
      pageId: "page-1",
      type: "pen",
      x: 100,
      y: 100,
      width: 100,
      height: 10,
      points: [
        { x: 0, y: 5 },
        { x: 100, y: 5 },
      ],
      angle: Math.PI / 2, // rotated 90 degrees around center (150, 105)
      strokeColor: "#000",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      seed: 1,
    };
    // The rotated line now runs vertically around x=150, from y=55 to y=155
    expect(pointInElement({ x: 150, y: 105 }, rotatedPen, 5)).toBe(true);
    expect(pointInElement({ x: 150, y: 60 }, rotatedPen, 5)).toBe(true);
    // Point on original unrotated stroke should now miss
    expect(pointInElement({ x: 105, y: 105 }, rotatedPen, 5)).toBe(false);
  });

  it("culls overlapping handles for thin vertical elements", () => {
    const thinVertical = {
      id: "pen-line-2",
      pageId: "page-1",
      type: "pen" as const,
      x: 200,
      y: 100,
      width: 4, // thin vertical
      height: 300,
      strokeColor: "#000",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
    } as CanvasElement;
    const handles = getElementTransformHandles(thinVertical, 1);
    expect(Object.keys(handles)).toEqual(["n", "s", "rotation"]);
    expect(handles.n).toEqual([202, 100]);
    expect(handles.s).toEqual([202, 400]);
  });

  it("returns all 8 bounding handles for standard 2D boxes", () => {
    const box = {
      id: "rect-1",
      pageId: "page-1",
      type: "rectangle" as const,
      x: 50,
      y: 50,
      width: 200,
      height: 150,
      strokeColor: "#000",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
    } as CanvasElement;
    const handles = getElementTransformHandles(box, 1);
    expect(Object.keys(handles)).toEqual([
      "nw",
      "ne",
      "se",
      "sw",
      "n",
      "s",
      "w",
      "e",
      "rotation",
    ]);
  });
});
