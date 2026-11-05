import { describe, it, expect } from "vitest";
import {
  detectEqualsSign,
  findExpressionToLeft,
  evaluateHandwrittenMathOnStroke,
} from "../lib/handwrittenMath";
import type { CanvasElement } from "../types";

describe("Handwritten Math Detection Engine", () => {
  it("detects two stacked horizontal bars as an equals sign '='", () => {
    const bar1: CanvasElement = {
      id: "bar1",
      pageId: "page1",
      type: "pen",
      x: 100,
      y: 100,
      width: 30,
      height: 4,
      points: [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
      ],
      strokeColor: "#ffffff",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      seed: 123,
    };

    const bar2: CanvasElement = {
      id: "bar2",
      pageId: "page1",
      type: "pen",
      x: 102,
      y: 112,
      width: 28,
      height: 4,
      points: [
        { x: 0, y: 0 },
        { x: 28, y: 0 },
      ],
      strokeColor: "#ffffff",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      seed: 124,
    };

    const result = detectEqualsSign(bar2, [bar1]);
    expect(result.isEquals).toBe(true);
    expect(result.bounds).not.toBeNull();
    expect(result.bounds?.right).toBe(130);
  });

  it("finds expression from text element to the left of '='", () => {
    const textEl: CanvasElement = {
      id: "text1",
      pageId: "page1",
      type: "text",
      x: 20,
      y: 100,
      width: 60,
      height: 24,
      text: "25 + 75",
      strokeColor: "#3b82f6",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      fontSize: "medium",
      seed: 125,
    };

    const bounds = { minX: 100, maxX: 130, minY: 100, maxY: 115, right: 130, centerY: 108 };
    const expr = findExpressionToLeft(bounds, [textEl]);
    expect(expr).not.toBeNull();
    expect(expr?.rawExpression).toBe("25 + 75");
    expect(expr?.strokeColor).toBe("#3b82f6");
  });

  it("evaluates handwritten equation and generates editable answer element", () => {
    const textEl: CanvasElement = {
      id: "text1",
      pageId: "page1",
      type: "text",
      x: 20,
      y: 100,
      width: 60,
      height: 24,
      text: "12 * 8",
      strokeColor: "#e11d48",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      fontSize: "medium",
      seed: 126,
    };

    const bar1: CanvasElement = {
      id: "bar1",
      pageId: "page1",
      type: "pen",
      x: 95,
      y: 104,
      width: 25,
      height: 3,
      points: [{ x: 0, y: 0 }, { x: 25, y: 0 }],
      strokeColor: "#e11d48",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      seed: 127,
    };

    const bar2: CanvasElement = {
      id: "bar2",
      pageId: "page1",
      type: "pen",
      x: 96,
      y: 114,
      width: 24,
      height: 3,
      points: [{ x: 0, y: 0 }, { x: 24, y: 0 }],
      strokeColor: "#e11d48",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      seed: 128,
    };

    const answer = evaluateHandwrittenMathOnStroke(bar2, [textEl, bar1], "page1");
    expect(answer).not.toBeNull();
    expect(answer?.text).toBe("96");
    expect(answer?.strokeColor).toBe("#22c55e");
    expect(answer?.fontFamily).toBe("rough");
    expect(answer?.type).toBe("text");
    expect(answer?.x).toBeGreaterThan(120);
  });

  it("returns null if no equation or valid math is found ('else don't put anything there')", () => {
    const randomStroke: CanvasElement = {
      id: "rand",
      pageId: "page1",
      type: "pen",
      x: 50,
      y: 50,
      width: 100,
      height: 80,
      points: [{ x: 0, y: 0 }, { x: 100, y: 80 }],
      strokeColor: "#ffffff",
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      seed: 129,
    };

    const answer = evaluateHandwrittenMathOnStroke(randomStroke, [], "page1");
    expect(answer).toBeNull();
  });
});

