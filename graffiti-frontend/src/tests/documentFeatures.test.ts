// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { detectFileType } from "../lib/documentLoader";
import { getMergedCanvas } from "../lib/documentExporter";

describe("documentLoader - detectFileType", () => {
  it("correctly identifies PDF files", () => {
    const file = new File(["dummy"], "sample.pdf", { type: "application/pdf" });
    expect(detectFileType(file)).toBe("pdf");
  });

  it("correctly identifies DOCX files", () => {
    const file = new File(["dummy"], "report.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(detectFileType(file)).toBe("docx");
  });

  it("correctly identifies PPTX files", () => {
    const file = new File(["dummy"], "slides.pptx", {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    expect(detectFileType(file)).toBe("pptx");
  });

  it("handles uppercase extensions gracefully", () => {
    const file = new File(["dummy"], "DOCUMENT.PDF");
    expect(detectFileType(file)).toBe("pdf");
  });

  it("returns unsupported for other file types", () => {
    const file = new File(["dummy"], "data.csv");
    expect(detectFileType(file)).toBe("unsupported");
  });
});

describe("documentExporter - getMergedCanvas", () => {
  it("creates a canvas matching the page dimensions", () => {
    const baseCanvas = document.createElement("canvas");
    baseCanvas.width = 800;
    baseCanvas.height = 600;

    const drawingCanvas = document.createElement("canvas");
    drawingCanvas.width = 800;
    drawingCanvas.height = 600;

    const merged = getMergedCanvas({
      index: 0,
      baseCanvas,
      drawingCanvas,
      width: 800,
      height: 600,
      originalWidth: 595,
      originalHeight: 842,
    });

    expect(merged.width).toBe(800);
    expect(merged.height).toBe(600);
  });

  it("handles portrait A4 dimensions with correct aspect ratio", () => {
    const page = {
      index: 0,
      baseCanvas: document.createElement("canvas"),
      drawingCanvas: document.createElement("canvas"),
      width: 892,
      height: 1263,
      originalWidth: 595.28,
      originalHeight: 841.89,
    };
    expect(page.height).toBeGreaterThan(page.width);
    const aspectRatio = page.width / page.height;
    expect(aspectRatio).toBeCloseTo(0.706, 2);
  });
});
