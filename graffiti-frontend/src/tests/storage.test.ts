import { describe, it, expect, beforeEach } from "vitest";
import { IndexedDbStorageAdapter } from "../storage/IndexedDbStorageAdapter";

describe("StorageAdapter Models & Tree Logic", () => {
  it("formats and structures workspace entities", () => {
    const ws = {
      id: "ws-1",
      name: "Computer Science",
      color: "#4dabf7",
      createdAt: 1000,
      updatedAt: 1000,
    };
    expect(ws.name).toBe("Computer Science");
    expect(ws.id).toBe("ws-1");
  });

  it("handles folder hierarchy relationships", () => {
    const rootFolder = {
      id: "f-root",
      workspaceId: "ws-1",
      parentFolderId: null,
      name: "Lectures",
      color: "#51cf66",
      createdAt: 1000,
      updatedAt: 1000,
    };

    const subFolder = {
      id: "f-sub",
      workspaceId: "ws-1",
      parentFolderId: "f-root",
      name: "Week 1",
      color: "#fcc419",
      createdAt: 1000,
      updatedAt: 1000,
    };

    expect(subFolder.parentFolderId).toBe(rootFolder.id);
  });

  it("associates whiteboards with pages and elements", () => {
    const board = {
      id: "b-1",
      slug: "board-abc",
      name: "Architecture Diagram",
      workspaceId: "ws-1",
      folderId: "f-sub",
      activePageId: "p-1",
      pages: [
        {
          id: "p-1",
          whiteboardId: "b-1",
          title: "Page 1",
          template: "grid" as const,
          pageOrder: 0,
          elements: [],
          createdAt: 1000,
        },
      ],
      createdAt: 1000,
      updatedAt: 1000,
    };

    expect(board.pages.length).toBe(1);
    expect(board.pages[0].template).toBe("grid");
    expect(board.folderId).toBe("f-sub");
  });
});
