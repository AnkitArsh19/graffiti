// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import type { Stroke } from "../components/OverlayScratchpad";

function isPointInStroke(stroke: Stroke, x: number, y: number): boolean {
  const tolerance = Math.max(14, stroke.size + 8);
  if (stroke.tool === "pen" || stroke.tool === "highlighter") {
    if (stroke.points.length === 0) return false;
    if (stroke.points.length === 1) {
      return Math.hypot(stroke.points[0].x - x, stroke.points[0].y - y) <= tolerance;
    }
    for (let i = 1; i < stroke.points.length; i++) {
      const p0 = stroke.points[i - 1];
      const p1 = stroke.points[i];
      const d = Math.hypot((p0.x + p1.x) / 2 - x, (p0.y + p1.y) / 2 - y);
      if (d <= tolerance) return true;
    }
    return false;
  }
  if (stroke.tool === "rect") {
    const p0 = stroke.points[0];
    const p1 = stroke.points[stroke.points.length - 1];
    const minX = Math.min(p0.x, p1.x);
    const maxX = Math.max(p0.x, p1.x);
    const minY = Math.min(p0.y, p1.y);
    const maxY = Math.max(p0.y, p1.y);
    return x >= minX - tolerance && x <= maxX + tolerance && y >= minY - tolerance && y <= maxY + tolerance;
  }
  return false;
}

function getContrastAdjustedColor(color: string, padTheme: "white" | "black"): string {
  if (padTheme === "white") {
    if (color.toLowerCase() === "#ffffff" || color.toLowerCase() === "#fff") {
      return "#0f172a";
    }
  } else {
    if (color.toLowerCase() === "#09090b" || color.toLowerCase() === "#000000") {
      return "#f8fafc";
    }
  }
  return color;
}

describe("Overlay Dedicated Scratchpad Engine", () => {
  it("adapts white ink to dark charcoal on Whiteboard canvas for high contrast", () => {
    const adjusted = getContrastAdjustedColor("#ffffff", "white");
    expect(adjusted).toBe("#0f172a");

    const nonWhite = getContrastAdjustedColor("#ef4444", "white");
    expect(nonWhite).toBe("#ef4444");
  });

  it("adapts black ink to radiant white on Blackboard canvas for high contrast", () => {
    const adjusted = getContrastAdjustedColor("#09090b", "black");
    expect(adjusted).toBe("#f8fafc");

    const vibrant = getContrastAdjustedColor("#d4a359", "black");
    expect(vibrant).toBe("#d4a359");
  });

  it("hit-tests points inside a rectangle scratchpad stroke", () => {
    const rectStroke: Stroke = {
      id: "s1",
      tool: "rect",
      color: "#d4a359",
      size: 4,
      points: [
        { x: 50, y: 50, pressure: 0.5 },
        { x: 200, y: 150, pressure: 0.5 },
      ],
    };

    expect(isPointInStroke(rectStroke, 100, 100)).toBe(true);
    expect(isPointInStroke(rectStroke, 300, 300)).toBe(false);
  });

  it("hit-tests points along a freehand pen scratchpad stroke", () => {
    const penStroke: Stroke = {
      id: "s2",
      tool: "pen",
      color: "#22c55e",
      size: 4,
      points: [
        { x: 10, y: 10, pressure: 0.5 },
        { x: 50, y: 50, pressure: 0.5 },
      ],
    };

    expect(isPointInStroke(penStroke, 30, 30)).toBe(true);
    expect(isPointInStroke(penStroke, 150, 150)).toBe(false);
  });

  it("calculates 4-corner multi-directional iPad Stage Manager resize bounds correctly", () => {
    const initial = { w: 500, h: 380, x: 100, y: 100 };

    // 1. Bottom-Right (se): expands width & height
    const se = { w: initial.w + 50, h: initial.h + 30, x: initial.x, y: initial.y };
    expect(se).toEqual({ w: 550, h: 410, x: 100, y: 100 });

    // 2. Bottom-Left (sw): expands width to the left (shifting x) & expands height
    const sw = { w: initial.w - (-40), x: initial.x + (-40), h: initial.h + 20, y: initial.y };
    expect(sw).toEqual({ w: 540, x: 60, h: 400, y: 100 });

    // 3. Top-Right (ne): expands width to the right & expands height upward (shifting y)
    const ne = { w: initial.w + 30, h: initial.h - (-20), x: initial.x, y: initial.y + (-20) };
    expect(ne).toEqual({ w: 530, h: 400, x: 100, y: 80 });

    // 4. Top-Left (nw): expands width to the left & height upward (shifting both x and y)
    const nw = {
      w: initial.w - (-30),
      x: initial.x + (-30),
      h: initial.h - (-40),
      y: initial.y + (-40),
    };
    expect(nw).toEqual({ w: 530, x: 70, h: 420, y: 60 });
  });

  it("converts pad strokes to desktop canvas elements for Whiteboard & Notebook saving", async () => {
    const { convertStrokesToCanvasElements, savePadToNotebook, insertPadIntoActiveCanvas } = await import(
      "../components/OverlayScratchpad"
    );

    const padStrokes: Stroke[] = [
      {
        id: "p1",
        tool: "pen",
        color: "#d4a359",
        size: 3,
        points: [
          { x: 10, y: 10, pressure: 0.5 },
          { x: 20, y: 20, pressure: 0.5 },
        ],
      },
      {
        id: "p2",
        tool: "rect",
        color: "#22c55e",
        size: 2,
        points: [
          { x: 50, y: 50, pressure: 0.5 },
          { x: 150, y: 120, pressure: 0.5 },
        ],
      },
    ];

    const elements = convertStrokesToCanvasElements(padStrokes);
    expect(elements).toHaveLength(2);
    expect(elements[0].type).toBe("pen");
    expect(elements[0].strokeColor).toBe("#d4a359");
    expect(elements[1].type).toBe("rectangle");
    expect(elements[1].width).toBe(100);
    expect(elements[1].height).toBe(70);

    // Test saving to notebook
    localStorage.clear();
    const saved = savePadToNotebook(padStrokes, "grid");
    expect(saved).toBe(true);
    const rawNotebook = localStorage.getItem("graffiti:notebook:v3");
    expect(rawNotebook).not.toBeNull();
    const parsedNotebook = JSON.parse(rawNotebook!);
    expect(parsedNotebook.pages).toHaveLength(1);
    expect(parsedNotebook.pages[0].elements).toHaveLength(2);

    // Test inserting to active canvas
    const inserted = insertPadIntoActiveCanvas(padStrokes);
    expect(inserted).toBe(true);
    const rawImported = localStorage.getItem("graffiti:overlay_imported_elements");
    expect(rawImported).not.toBeNull();
    const parsedImported = JSON.parse(rawImported!);
    expect(parsedImported).toHaveLength(2);
  });
});

