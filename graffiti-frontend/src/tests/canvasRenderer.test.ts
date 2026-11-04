import { describe, expect, it } from "vitest";
import { getFreedrawOutline, getSvgPathFromStroke, wrapTextLines } from "../lib/canvasRenderer";
import { pointInElement, getElementTransformHandles, getHitTransformHandle } from "../lib/collision";
import type { CanvasElement } from "../types";

describe("canvas renderer and interaction tests", () => {
  it("generates freedraw outlines and svg paths for pen strokes", () => {
    const points = [
      { x: 10, y: 10, pressure: 0.5 },
      { x: 20, y: 20, pressure: 0.7 },
      { x: 30, y: 30, pressure: 0.9 },
    ];
    const outline = getFreedrawOutline(points, 3);
    expect(outline.length).toBeGreaterThan(0);

    const pathData = getSvgPathFromStroke(outline);
    expect(pathData).toBeTruthy();
    expect(pathData).toMatch(/^M/);
  });

  it("hit-tests interior of transparent rectangle", () => {
    const transparentRect: CanvasElement = {
      id: "rect-trans",
      pageId: "page-1",
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 80,
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      seed: 1,
    };

    // Clicking right in the center of a transparent rectangle selects it
    expect(pointInElement({ x: 100, y: 90 }, transparentRect)).toBe(true);

    // Clicking outside does not select it
    expect(pointInElement({ x: 10, y: 10 }, transparentRect)).toBe(false);
  });

  it("hit-tests ellipse and diamond geometry", () => {
    const ellipse: CanvasElement = {
      id: "el-1",
      pageId: "page-1",
      type: "ellipse",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      seed: 2,
    };

    // Center is (150, 150) -> inside
    expect(pointInElement({ x: 150, y: 150 }, ellipse)).toBe(true);

    // Corner (100, 100) is outside the circle rx=50, ry=50
    expect(pointInElement({ x: 102, y: 102 }, ellipse)).toBe(false);

    const diamond: CanvasElement = {
      id: "dia-1",
      pageId: "page-1",
      type: "diamond",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      seed: 3,
    };

    // Center of diamond (150, 150) -> inside
    expect(pointInElement({ x: 150, y: 150 }, diamond)).toBe(true);

    // Near corner (105, 105) -> outside diamond perimeter
    expect(pointInElement({ x: 105, y: 105 }, diamond)).toBe(false);
  });

  it("computes arrow handles and midpoint drag handle accurately", () => {
    const arrow: CanvasElement = {
      id: "arr-1",
      pageId: "page-1",
      type: "arrow",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 80 },
        { x: 200, y: 100 },
      ],
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      seed: 4,
    };

    const handles = getElementTransformHandles(arrow, 1);
    expect(handles.p0).toEqual([100, 100]);
    expect(handles.pMid).toEqual([200, 180]);
    expect(handles.p1).toEqual([300, 200]);

    const hit = getHitTransformHandle({ x: 200, y: 180 }, arrow, 1);
    expect(hit).toBe("pMid");
  });

  it("auto-wraps shape text into multiple lines without horizontal overflow", () => {
    // Mock 2D context measureText
    const mockCtx = {
      measureText: (str: string) => ({ width: str.length * 8 }),
    } as unknown as CanvasRenderingContext2D;

    // A long text in a 100px wide shape (max text width = 80px -> ~10 chars per line)
    const longText = "Process Auth Token and Return User Profile";
    const wrapped = wrapTextLines(mockCtx, longText, 80);

    expect(wrapped.length).toBeGreaterThan(1);
    // Every line should respect maxWidth (<= 80px)
    for (const line of wrapped) {
      expect(mockCtx.measureText(line).width).toBeLessThanOrEqual(80);
    }
    // All words should be preserved
    expect(wrapped.join(" ")).toBe(longText);
  });
});
