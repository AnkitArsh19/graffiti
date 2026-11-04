import { describe, expect, it } from "vitest";
import { executeAiRequest, generateLocalDiagram } from "../lib/aiClient";

describe("aiClient", () => {
  it("generates deterministic local diagrams", () => {
    const elements = generateLocalDiagram("Step A -> Step B -> Step C", "test-page");
    expect(elements.length).toBe(5); // 3 nodes + 2 arrows
    const nodes = elements.filter((e) => e.type === "rectangle" || e.type === "diamond");
    const arrows = elements.filter((e) => e.type === "arrow");
    expect(nodes.length).toBe(3);
    expect(arrows.length).toBe(2);
    expect(nodes[0].text).toBe("Step A");
    expect(nodes[1].text).toBe("Step B");
    expect(nodes[2].text).toBe("Step C");
  });

  it("falls back to local math solver when offline", async () => {
    const res = await executeAiRequest({
      feature: "math",
      equation: "25 * 4 =",
      anchor: { x: 100, y: 150 },
    });
    expect(res).not.toBeNull();
    expect(res?.type).toBe("AI_GHOST_OP");
    expect(res?.payload?.ghostPreview).toBe(true);
    expect(res?.payload?.proposedElements?.[0].text).toBe("= 100");
  });

  it("falls back to local beautifier when offline", async () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    const res = await executeAiRequest({
      feature: "beautify",
      points: pts,
    });
    expect(res).not.toBeNull();
    expect(res?.type).toBe("AI_GHOST_OP");
    expect(res?.payload?.ghostPreview).toBe(true);
    expect(res?.payload?.proposedElements?.length).toBe(1);
    expect(["rectangle", "diamond", "ellipse"]).toContain(res?.payload?.proposedElements?.[0].type);
  });

  it("falls back to local text-to-diagram when offline", async () => {
    const res = await executeAiRequest({
      feature: "diagram",
      prompt: "Auth -> Dashboard",
    });
    expect(res).not.toBeNull();
    expect(res?.type).toBe("AI_GHOST_OP");
    expect(res?.payload?.ghostPreview).toBe(true);
    expect(res?.payload?.proposedElements?.length).toBeGreaterThan(1);
  });
});
