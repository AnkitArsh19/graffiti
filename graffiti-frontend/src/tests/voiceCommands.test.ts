import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "../lib/voiceCommands";

describe("voiceCommands parser", () => {
  it("recognizes exact undo command", () => {
    const res = parseVoiceCommand("undo");
    expect(res).not.toBeNull();
    expect(res?.type).toBe("undo");
    expect(res?.label).toBe("Triggered Undo");
  });

  it("recognizes common phonetic mishearings of undo ('ando', 'and do', 'un do', 'undu', 'ondo')", () => {
    const mishearings = [
      "ando",
      "and do",
      "an do",
      "un do",
      "undu",
      "ondo",
      "on do",
      "end do",
      "please ando",
      "can you and do",
      "ando that",
      "undo please",
    ];

    for (const phrase of mishearings) {
      const res = parseVoiceCommand(phrase);
      expect(res, `Failed for phrase: "${phrase}"`).not.toBeNull();
      expect(res?.type).toBe("undo");
    }
  });

  it("recognizes redo and variations ('re do', 'read do', 'ree do')", () => {
    expect(parseVoiceCommand("redo")?.type).toBe("redo");
    expect(parseVoiceCommand("re do")?.type).toBe("redo");
    expect(parseVoiceCommand("read do")?.type).toBe("redo");
  });

  it("recognizes shape tools and mishearings", () => {
    // Rectangle
    expect(parseVoiceCommand("rectangle")?.type).toBe("selectTool");
    expect(parseVoiceCommand("wreck tangle")?.type).toBe("selectTool");
    expect(parseVoiceCommand("rect angle")?.type).toBe("selectTool");
    expect(parseVoiceCommand("box")?.type).toBe("selectTool");

    // Circle / Ellipse
    expect(parseVoiceCommand("circle")?.type).toBe("selectTool");
    expect(parseVoiceCommand("sircle")?.type).toBe("selectTool");
    expect(parseVoiceCommand("ellipse")?.type).toBe("selectTool");
    expect(parseVoiceCommand("oval")?.type).toBe("selectTool");

    // Diamond
    expect(parseVoiceCommand("diamond")?.type).toBe("selectTool");
    expect(parseVoiceCommand("dimond")?.type).toBe("selectTool");
    expect(parseVoiceCommand("rhombus")?.type).toBe("selectTool");

    // Arrow / Line
    expect(parseVoiceCommand("arrow")?.type).toBe("selectTool");
    expect(parseVoiceCommand("straight line")?.type).toBe("selectTool");

    // Pen / Draw
    expect(parseVoiceCommand("pen")?.type).toBe("selectTool");
    expect(parseVoiceCommand("pencil")?.type).toBe("selectTool");
    expect(parseVoiceCommand("draw")?.type).toBe("selectTool");
    expect(parseVoiceCommand("sketch")?.type).toBe("selectTool");

    // Sticky Note
    expect(parseVoiceCommand("sticky note")?.type).toBe("selectTool");
    expect(parseVoiceCommand("post it")?.type).toBe("selectTool");

    // Eraser
    expect(parseVoiceCommand("eraser")?.type).toBe("selectTool");
    expect(parseVoiceCommand("rubber")?.type).toBe("selectTool");
  });

  it("recognizes navigation and canvas actions", () => {
    expect(parseVoiceCommand("zoom in")?.type).toBe("zoomIn");
    expect(parseVoiceCommand("zoomin")?.type).toBe("zoomIn");
    expect(parseVoiceCommand("zoom out")?.type).toBe("zoomOut");
    expect(parseVoiceCommand("reset view")?.type).toBe("resetView");
    expect(parseVoiceCommand("zoom to fit")?.type).toBe("resetView");
    expect(parseVoiceCommand("fit to screen")?.type).toBe("resetView");
    expect(parseVoiceCommand("new page")?.type).toBe("newPage");
    expect(parseVoiceCommand("add page")?.type).toBe("newPage");
    expect(parseVoiceCommand("clear canvas")?.type).toBe("clearCanvas");
    expect(parseVoiceCommand("clear all")?.type).toBe("clearCanvas");
    expect(parseVoiceCommand("beautify")?.type).toBe("beautify");
    expect(parseVoiceCommand("smooth")?.type).toBe("beautify");
    expect(parseVoiceCommand("solve math")?.type).toBe("solveMath");
    expect(parseVoiceCommand("calculate")?.type).toBe("solveMath");
    expect(parseVoiceCommand("storyboard")?.type).toBe("storyboard");
    expect(parseVoiceCommand("tidy up")?.type).toBe("tidyUp");
    expect(parseVoiceCommand("card")?.type).toBe("selectTool");
    expect(parseVoiceCommand("table")?.type).toBe("selectTool");
  });

  it("returns null for unrecognized speech", () => {
    expect(parseVoiceCommand("hello world")).toBeNull();
    expect(parseVoiceCommand("random chatter")).toBeNull();
    expect(parseVoiceCommand("")).toBeNull();
  });
});

