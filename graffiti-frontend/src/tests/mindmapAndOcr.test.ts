import { describe, expect, it, vi } from "vitest";
import { apiAutoLayoutMindmap, apiGenerateMindmap, apiOcrExtract, apiMorphTheme } from "../lib/api";

describe("MindMap & OCR API Client Features", () => {
  it("dispatches mindmap auto-layout with non-overlapping parameters", async () => {
    const mockResponse = {
      success: true,
      rootNodeId: "root_1",
      nodes: [
        { id: "root_1", x: 400, y: 300, width: 180, height: 80, text: "Central System" },
        { id: "child_1", x: 740, y: 300, width: 160, height: 70, text: "Subsystem" },
      ],
      connectors: [
        { id: "conn_1", type: "arrow", points: [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 160, y: 0 }] },
      ],
      aiProvider: "groq-openai/gpt-oss-120b",
      summary: "Organized 2 nodes into symmetrical balanced mind-map",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const res = await apiAutoLayoutMindmap({
      elements: [{ id: "root_1", text: "Central System" }, { id: "child_1", text: "Subsystem" }],
      preferredModel: "auto",
    });

    expect(res.success).toBe(true);
    expect(res.nodes.length).toBe(2);
    expect(res.connectors.length).toBe(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/ai/mindmap/auto-layout"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("dispatches generate mind-map from topic prompt or markdown outline", async () => {
    const mockGenResponse = {
      success: true,
      rootNodeId: "mm_root_123",
      nodes: [
        { id: "mm_root_123", text: "React 19", x: 400, y: 300, width: 180, height: 80 },
        { id: "mm_branch_1", text: "Actions", x: 740, y: 240, width: 160, height: 65 },
        { id: "mm_branch_2", text: "Server Components", x: 60, y: 240, width: 160, height: 65 },
      ],
      connectors: [
        { id: "conn_1", type: "arrow", startBinding: { elementId: "mm_root_123" } },
        { id: "conn_2", type: "arrow", startBinding: { elementId: "mm_root_123" } },
      ],
      aiProvider: "groq-llm",
      summary: "Generated mind-map for 'React 19' with 2 branches (3 nodes total).",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGenResponse,
    } as any);

    const res = await apiGenerateMindmap({
      prompt: "React 19 Architecture",
      preferredModel: "groq",
    });

    expect(res.success).toBe(true);
    expect(res.nodes.length).toBe(3);
    expect(res.rootNodeId).toBe("mm_root_123");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/ai/mindmap/generate"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("dispatches background OCR extraction for handwriting strokes", async () => {
    const mockOcrResponse = {
      shapeId: "pen_stroke_999",
      ocrText: "handwritten note",
      confidence: 0.94,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOcrResponse,
    } as any);

    const res = await apiOcrExtract({
      shapeId: "pen_stroke_999",
      points: [
        { x: 10, y: 20 },
        { x: 50, y: 22 },
        { x: 100, y: 24 },
        { x: 150, y: 25 },
      ],
    });

    expect(res.shapeId).toBe("pen_stroke_999");
    expect(res.ocrText).toBe("handwritten note");
    expect(res.confidence).toBeGreaterThan(0.9);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/ocr/extract"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("dispatches theme morph with instant preset bypass support", async () => {
    const mockThemeResponse = {
      success: true,
      themeName: "Pastel Creative",
      canvasBackground: "#faf5ff",
      palette: {
        primaryStroke: "#7c3aed",
        secondaryStroke: "#059669",
        primaryBackground: "#f3e8ff",
        secondaryBackground: "#d1fae5",
        accentColor: "#f59e0b",
        canvasBackground: "#faf5ff",
        fontFamily: "clean",
        roughness: 0.8,
        strokeWidth: 2.0,
        fillStyle: "semi",
      },
      elementsMorphed: 1,
      updatedElements: [{ id: "1", type: "rectangle", x: 100, y: 100, strokeColor: "#7c3aed" }],
      aiProvider: "preset-instant",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockThemeResponse,
    } as any);

    const res = await apiMorphTheme({
      themePrompt: "Pastel Creative",
      elements: [{ id: "1", type: "rectangle", x: 100, y: 100, width: 100, height: 100 }],
    });

    expect(res.success).toBe(true);
    expect(res.aiProvider).toBe("preset-instant");
    expect(res.canvasBackground).toBe("#faf5ff");
    expect(res.palette.primaryStroke).toBe("#7c3aed");
  });
});

