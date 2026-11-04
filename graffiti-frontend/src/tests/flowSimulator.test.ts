import { describe, expect, it } from "vitest";
import { associateNearbyFloatingText } from "../components/FlowSimulatorPanel";
import type { CanvasElement } from "../types";

describe("flow simulator spatial proximity parsing", () => {
  it("associates floating text inside or near shape borders with the shape", () => {
    const elements: CanvasElement[] = [
      {
        id: "rect-1",
        pageId: "page-1",
        type: "rectangle",
        x: 100,
        y: 100,
        width: 150,
        height: 70,
        strokeColor: "#ffffff",
        backgroundColor: "transparent",
        strokeWidth: 2,
        roughness: 0,
        opacity: 100,
        seed: 1,
      },
      {
        id: "text-1",
        pageId: "page-1",
        type: "text",
        x: 120,
        y: 115,
        width: 80,
        height: 25,
        text: "Validate Token",
        strokeColor: "#ffffff",
        backgroundColor: "transparent",
        strokeWidth: 2,
        roughness: 0,
        opacity: 100,
        seed: 2,
      },
      {
        id: "diamond-1",
        pageId: "page-1",
        type: "diamond",
        x: 350,
        y: 95,
        width: 120,
        height: 80,
        strokeColor: "#ffffff",
        backgroundColor: "transparent",
        strokeWidth: 2,
        roughness: 0,
        opacity: 100,
        seed: 3,
      },
      {
        id: "text-2",
        pageId: "page-1",
        type: "text",
        x: 370,
        y: 115,
        width: 80,
        height: 25,
        text: "Is Authorized?",
        strokeColor: "#ffffff",
        backgroundColor: "transparent",
        strokeWidth: 2,
        roughness: 0,
        opacity: 100,
        seed: 4,
      },
      {
        id: "arrow-1",
        pageId: "page-1",
        type: "arrow",
        x: 250,
        y: 135,
        width: 100,
        height: 0,
        startBinding: { elementId: "rect-1", pointId: "right" },
        endBinding: { elementId: "diamond-1", pointId: "left" },
        points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }],
        strokeColor: "#ffffff",
        backgroundColor: "transparent",
        strokeWidth: 2,
        roughness: 0,
        opacity: 100,
        seed: 5,
      },
      {
        id: "text-3",
        pageId: "page-1",
        type: "text",
        x: 290,
        y: 120,
        width: 30,
        height: 15,
        text: "POST",
        strokeColor: "#ffffff",
        backgroundColor: "transparent",
        strokeWidth: 2,
        roughness: 0,
        opacity: 100,
        seed: 6,
      },
    ];

    const processed = associateNearbyFloatingText(elements);

    const rect = processed.find((e) => e.id === "rect-1");
    expect(rect).toBeDefined();
    expect(rect?.text).toBe("Validate Token");

    const diamond = processed.find((e) => e.id === "diamond-1");
    expect(diamond).toBeDefined();
    expect(diamond?.text).toBe("Is Authorized?");

    const arrow = processed.find((e) => e.id === "arrow-1");
    expect(arrow).toBeDefined();
    expect(arrow?.text).toBe("POST");

    // Associated floating texts should be consumed, not duplicated
    expect(processed.find((e) => e.id === "text-1")).toBeUndefined();
    expect(processed.find((e) => e.id === "text-2")).toBeUndefined();
    expect(processed.find((e) => e.id === "text-3")).toBeUndefined();
  });
});
