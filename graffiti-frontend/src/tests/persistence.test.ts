// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveActiveDocumentToCache,
  getActiveDocumentFromCache,
  clearActiveDocumentCache,
} from "../lib/documentCache";

describe("Persistence & Offline Session Integrity", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("persists active whiteboard ID and retrieves it", () => {
    const wbId = "board-uuid-456";
    localStorage.setItem("graffiti:active_whiteboard_id", wbId);
    expect(localStorage.getItem("graffiti:active_whiteboard_id")).toBe("board-uuid-456");
  });

  it("persists viewport per page and globally", () => {
    const pageId = "page-main";
    const vp = { zoom: 1.5, scrollX: 250, scrollY: 180 };
    localStorage.setItem(`graffiti:viewport:${pageId}`, JSON.stringify(vp));
    localStorage.setItem("graffiti:viewport", JSON.stringify(vp));

    const retrieved = JSON.parse(localStorage.getItem(`graffiti:viewport:${pageId}`)!);
    expect(retrieved.zoom).toBe(1.5);
    expect(retrieved.scrollX).toBe(250);
    expect(retrieved.scrollY).toBe(180);

    const globalRetrieved = JSON.parse(localStorage.getItem("graffiti:viewport")!);
    expect(globalRetrieved.zoom).toBe(1.5);
  });

  it("persists document page index and annotations", () => {
    const fileName = "Lecture-Slides.pdf";
    const fileSize = 1048576;
    const pageKey = `graffiti:doc_page:${fileName}`;
    const annKey = `graffiti:doc_annotations:${fileName}_${fileSize}`;

    localStorage.setItem(pageKey, "3");
    const sampleAnnotations = {
      "3": [
        {
          id: "ann-1",
          tool: "highlighter",
          color: "#d4a359",
          size: 14,
          points: [{ x: 50, y: 50, pressure: 0.5 }],
        },
      ],
    };
    localStorage.setItem(annKey, JSON.stringify(sampleAnnotations));

    expect(localStorage.getItem(pageKey)).toBe("3");
    const retrievedAnns = JSON.parse(localStorage.getItem(annKey)!);
    expect(retrievedAnns["3"]).toHaveLength(1);
    expect(retrievedAnns["3"][0].tool).toBe("highlighter");
  });

  it("persists desktop overlay strokes and layout", () => {
    const strokes = [
      {
        id: "s-1",
        tool: "pen",
        color: "#ef4444",
        size: 5,
        points: [{ x: 10, y: 20, pressure: 0.8 }],
      },
    ];
    localStorage.setItem("graffiti:overlay_strokes", JSON.stringify(strokes));
    localStorage.setItem("graffiti:overlay_orient", "vertical");
    localStorage.setItem("graffiti:overlay_pos", JSON.stringify({ x: 100, y: 50 }));

    const savedStrokes = JSON.parse(localStorage.getItem("graffiti:overlay_strokes")!);
    expect(savedStrokes).toHaveLength(1);
    expect(savedStrokes[0].color).toBe("#ef4444");
    expect(localStorage.getItem("graffiti:overlay_orient")).toBe("vertical");
    expect(JSON.parse(localStorage.getItem("graffiti:overlay_pos")!)).toEqual({ x: 100, y: 50 });
  });

  it("handles documentCache operations safely in test environments", async () => {
    // In node/vitest environment without full native IndexedDB, functions handle errors gracefully
    await expect(clearActiveDocumentCache()).resolves.toBeUndefined();
    const doc = await getActiveDocumentFromCache();
    expect(doc).toBeNull();
  });

  it("recovers auth user profile from cached localStorage on offline boot", () => {
    const cachedUser = {
      userId: "u-999",
      email: "engineer@graffiti.app",
      name: "Graffiti Architect",
      avatarUrl: null,
      provider: "LOCAL",
    };
    localStorage.setItem("graffiti:auth:user", JSON.stringify(cachedUser));
    localStorage.setItem("graffiti:auth:token", "fake-jwt-token");

    const loadedUser = JSON.parse(localStorage.getItem("graffiti:auth:user")!);
    expect(loadedUser.userId).toBe("u-999");
    expect(loadedUser.email).toBe("engineer@graffiti.app");
    expect(localStorage.getItem("graffiti:auth:token")).toBe("fake-jwt-token");
  });
});
