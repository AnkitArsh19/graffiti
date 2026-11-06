import { describe, it, expect } from "vitest";
import { alignElements, distributeElements, tidyUpElements } from "../lib/alignment";
import type { CanvasElement } from "../types";

function createMockEl(id: string, x: number, y: number, width: number, height: number): CanvasElement {
  return {
    id,
    pageId: "p1",
    type: "rectangle",
    x,
    y,
    width,
    height,
    strokeColor: "#000",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    roundness: "sharp",
    seed: 12345,
  };
}

describe("Alignment & Tidy Up Engine", () => {
  it("aligns elements to the left", () => {
    const el1 = createMockEl("1", 100, 50, 60, 40);
    const el2 = createMockEl("2", 200, 80, 80, 40);
    const aligned = alignElements([el1, el2], "left");

    expect(aligned[0].x).toBe(100);
    expect(aligned[1].x).toBe(100);
  });

  it("aligns elements to the center", () => {
    const el1 = createMockEl("1", 100, 50, 40, 40); // center at 120
    const el2 = createMockEl("2", 200, 80, 80, 40); // bounds 100..280 => mid 190
    const aligned = alignElements([el1, el2], "center");

    expect(aligned[0].x + aligned[0].width / 2).toBe(190);
    expect(aligned[1].x + aligned[1].width / 2).toBe(190);
  });

  it("aligns elements to the top", () => {
    const el1 = createMockEl("1", 50, 100, 50, 50);
    const el2 = createMockEl("2", 150, 200, 50, 50);
    const aligned = alignElements([el1, el2], "top");

    expect(aligned[0].y).toBe(100);
    expect(aligned[1].y).toBe(100);
  });

  it("distributes elements horizontally with equal gaps", () => {
    const el1 = createMockEl("1", 0, 50, 50, 50);
    const el2 = createMockEl("2", 120, 50, 50, 50);
    const el3 = createMockEl("3", 300, 50, 50, 50);
    // Span = 350. Total element width = 150. Total gap = 200 => gap per space = 100
    const distributed = distributeElements([el1, el2, el3], "horizontal");

    expect(distributed[0].x).toBe(0);
    expect(distributed[1].x).toBe(150); // 0 + 50 + 100
    expect(distributed[2].x).toBe(300); // 150 + 50 + 100
  });

  it("tidies up multiple scattered elements into an ordered grid", () => {
    const elements = [
      createMockEl("1", 300, 200, 80, 60),
      createMockEl("2", 50, 50, 80, 60),
      createMockEl("3", 500, 100, 80, 60),
      createMockEl("4", 100, 400, 80, 60),
    ];

    const tidied = tidyUpElements(elements, 20);
    expect(tidied.length).toBe(4);
    // Check that elements form a 2x2 grid (cols = ceil(sqrt(4)) = 2)
    // Row 0: x = 50, y = 50 and x = 50 + 80 + 20 = 150, y = 50
    // Row 1: x = 50, y = 50 + 60 + 20 = 130 and x = 150, y = 130
    expect(tidied[0].x).toBe(50);
    expect(tidied[0].y).toBe(50);
    expect(tidied[1].x).toBe(150);
    expect(tidied[1].y).toBe(50);
    expect(tidied[2].x).toBe(50);
    expect(tidied[2].y).toBe(130);
    expect(tidied[3].x).toBe(150);
    expect(tidied[3].y).toBe(130);
  });
});
