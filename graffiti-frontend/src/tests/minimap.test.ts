import { describe, expect, it, vi } from "vitest";
import { drawMinimapText } from "../components/Minimap";

describe("minimap text rendering", () => {
  function createMockContext() {
    const calls: { method: string; args: any[] }[] = [];
    const ctx = {
      save: vi.fn(() => calls.push({ method: "save", args: [] })),
      restore: vi.fn(() => calls.push({ method: "restore", args: [] })),
      fillText: vi.fn((text: string, x: number, y: number) => {
        calls.push({ method: "fillText", args: [text, x, y] });
      }),
      measureText: vi.fn((text: string) => ({ width: text.length * 6 })),
      fillStyle: "",
      font: "",
      textBaseline: "",
      textAlign: "",
    } as unknown as CanvasRenderingContext2D;
    return { ctx, calls };
  }

  it("does not render if text is empty or only whitespace", () => {
    const { ctx, calls } = createMockContext();
    drawMinimapText(ctx, "   ", 10, 10, 50, 50, "#ffffff", 0.1);
    expect(calls.length).toBe(0);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("renders text with clamped font size (7px to 12px) and specified color", () => {
    const { ctx } = createMockContext();
    drawMinimapText(ctx, "Hello Minimap", 10, 10, 80, 40, "#ffffff", 0.05);

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.fillStyle).toBe("#ffffff");
    expect(ctx.font).toContain("7px"); // 0.05 scale clamps to minimum 7px
    expect(ctx.fillText).toHaveBeenCalledWith("Hello Minimap", expect.any(Number), expect.any(Number));
  });

  it("renders multiline text with line vertical offsets", () => {
    const { ctx } = createMockContext();
    drawMinimapText(ctx, "Line 1\nLine 2\nLine 3", 0, 0, 100, 100, "#d4a359", 0.1, "medium", "left", true);

    expect(ctx.fillText).toHaveBeenCalledTimes(3);
    expect(ctx.fillText).toHaveBeenNthCalledWith(1, "Line 1", 2, 0);
    // Line 2 should have y offset > 0
    const secondCall = (ctx.fillText as any).mock.calls[1];
    expect(secondCall[0]).toBe("Line 2");
    expect(secondCall[2]).toBeGreaterThan(0);
  });

  it("handles text alignment: center and right", () => {
    const { ctx: centerCtx } = createMockContext();
    drawMinimapText(centerCtx, "Centered", 20, 20, 60, 30, "#ffffff", 0.1, "medium", "center");
    expect(centerCtx.textAlign).toBe("center");
    expect(centerCtx.fillText).toHaveBeenCalledWith("Centered", 50, expect.any(Number)); // 20 + 60/2 = 50

    const { ctx: rightCtx } = createMockContext();
    drawMinimapText(rightCtx, "Right", 20, 20, 60, 30, "#ffffff", 0.1, "medium", "right");
    expect(rightCtx.textAlign).toBe("right");
    expect(rightCtx.fillText).toHaveBeenCalledWith("Right", 78, expect.any(Number)); // 20 + 60 - 2 = 78
  });

  it("truncates extremely long text with ellipsis", () => {
    const { ctx } = createMockContext();
    const longText = "This is a very long text string that definitely exceeds the maximum allowed line width on the minimap";
    drawMinimapText(ctx, longText, 0, 0, 40, 20, "#ffffff", 0.05);

    expect(ctx.fillText).toHaveBeenCalled();
    const renderedLine = (ctx.fillText as any).mock.calls[0][0];
    expect(renderedLine.endsWith("...")).toBe(true);
    expect(renderedLine.length).toBeLessThan(longText.length);
  });
});
