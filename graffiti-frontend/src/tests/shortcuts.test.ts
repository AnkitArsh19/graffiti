import { describe, it, expect } from "vitest";
import { formatShortcut } from "../contexts/ShortcutsContext";

describe("formatShortcut platform formatting", () => {
  it("formats shortcuts correctly on macOS with standard symbols", () => {
    expect(formatShortcut("Ctrl+Shift+N", true)).toBe("⌘⇧N");
    expect(formatShortcut("Ctrl+O", true)).toBe("⌘O");
    expect(formatShortcut("Ctrl+D", true)).toBe("⌘D");
    expect(formatShortcut("Esc", true)).toBe("⎋");
    expect(formatShortcut("Ctrl+F", true)).toBe("⌘F");
    expect(formatShortcut("Ctrl+Shift+D", true)).toBe("⌘⇧D");
    expect(formatShortcut("Alt+M", true)).toBe("⌥M");
    expect(formatShortcut("Alt+V", true)).toBe("⌥V");
    expect(formatShortcut("Ctrl+,", true)).toBe("⌘,");
    expect(formatShortcut("Delete", true)).toBe("⌫");
    expect(formatShortcut("Space", true)).toBe("␣");
  });

  it("preserves standard shortcuts on Windows / Linux", () => {
    expect(formatShortcut("Ctrl+Shift+N", false)).toBe("Ctrl+Shift+N");
    expect(formatShortcut("Ctrl+O", false)).toBe("Ctrl+O");
    expect(formatShortcut("Ctrl+D", false)).toBe("Ctrl+D");
    expect(formatShortcut("Esc", false)).toBe("Esc");
    expect(formatShortcut("Alt+M", false)).toBe("Alt+M");
  });

  it("handles empty or undefined inputs gracefully", () => {
    expect(formatShortcut("")).toBe("");
  });
});
