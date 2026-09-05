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
});
