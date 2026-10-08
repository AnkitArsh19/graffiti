import { describe, expect, it } from "vitest";
import { getFolderColor } from "../components/WorkspaceSidebar";

describe("folder color normalization", () => {
  it("normalizes old blue and red default colors to gold", () => {
    expect(getFolderColor("#4dabf7")).toBe("var(--accent-primary, #d4a359)");
    expect(getFolderColor("#fa5252")).toBe("var(--accent-primary, #d4a359)");
    expect(getFolderColor("#3b82f6")).toBe("var(--accent-primary, #d4a359)");
    expect(getFolderColor("#ef4444")).toBe("var(--accent-primary, #d4a359)");
  });

  it("handles empty or missing color values by returning gold", () => {
    expect(getFolderColor(undefined)).toBe("var(--accent-primary, #d4a359)");
    expect(getFolderColor("")).toBe("var(--accent-primary, #d4a359)");
  });

  it("preserves valid intentional brand and zinc colors", () => {
    expect(getFolderColor("#d4a359")).toBe("#d4a359");
    expect(getFolderColor("#71717a")).toBe("#71717a");
    expect(getFolderColor("#22c55e")).toBe("#22c55e");
  });
});
