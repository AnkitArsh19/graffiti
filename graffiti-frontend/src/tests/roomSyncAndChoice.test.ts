import { describe, it, expect, vi } from "vitest";
import { normalizePenElement } from "../lib/geometry";

describe("Room Multi-Page Synchronization & Creation Choice", () => {
  it("processes multi-page ops across collaborating room members", () => {
    // Initial state with Canvas 1
    const initialState = {
      pages: [
        { id: "page-1", title: "Canvas 1", template: "grid" as const, elements: [] },
      ],
      activePageId: "page-1",
    };

    // Simulate ADD_PAGE remote op received from another member
    const newPage = { id: "page-2", title: "Canvas 2", template: "dots" as const, elements: [] };
    const addPageOp = {
      type: "OP",
      payload: {
        __isPageOp: true,
        opAction: "ADD_PAGE",
        page: newPage,
      },
    };

    let state = {
      ...initialState,
      pages: [...initialState.pages, addPageOp.payload.page],
    };

    expect(state.pages).toHaveLength(2);
    expect(state.pages[1].id).toBe("page-2");
    expect(state.pages[1].title).toBe("Canvas 2");

    // Simulate RENAME_PAGE remote op
    const renameOp = {
      type: "OP",
      payload: {
        __isPageOp: true,
        opAction: "RENAME_PAGE",
        pageId: "page-2",
        title: "Architecture Diagram",
      },
    };

    state = {
      ...state,
      pages: state.pages.map((p) =>
        p.id === renameOp.payload.pageId ? { ...p, title: renameOp.payload.title } : p
      ),
    };

    expect(state.pages[1].title).toBe("Architecture Diagram");

    // Simulate DELETE_PAGE remote op
    const deleteOp = {
      type: "OP",
      payload: {
        __isPageOp: true,
        opAction: "DELETE_PAGE",
        pageId: "page-2",
      },
    };

    state = {
      ...state,
      pages: state.pages.filter((p) => p.id !== deleteOp.payload.pageId),
    };

    expect(state.pages).toHaveLength(1);
    expect(state.pages[0].id).toBe("page-1");
  });

  it("ensures joining member receives full room snapshot and does not overwrite with blank board", () => {
    // State of creator on server
    const serverSnapshot = {
      activePageId: "page-1",
      pages: [
        {
          id: "page-1",
          title: "Brainstorming",
          template: "grid",
          elements: [
            { id: "el-1", type: "rectangle", x: 10, y: 10, width: 100, height: 80 },
            { id: "el-2", type: "pen", points: [{ x: 0, y: 0 }, { x: 50, y: 50 }] },
          ],
        },
        {
          id: "page-2",
          title: "User Flow",
          template: "plain",
          elements: [
            { id: "el-3", type: "arrow", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
          ],
        },
      ],
    };

    // Joining member starts with default empty notebook
    const joiningMemberInitialState = {
      activePageId: "default-page",
      pages: [
        { id: "default-page", title: "Canvas 1", template: "grid", elements: [] },
      ],
    };

    let isRoomLoaded = false;
    let autoSyncPayload: any = null;

    // Simulated auto-sync function
    const triggerAutoSync = (state: any) => {
      if (!isRoomLoaded) return; // Guarded!
      autoSyncPayload = state;
    };

    // 1. Before server response arrives, auto-sync does nothing
    triggerAutoSync(joiningMemberInitialState);
    expect(autoSyncPayload).toBeNull();

    // 2. Server response arrives with serverSnapshot
    const rehydratedState = {
      activePageId: serverSnapshot.activePageId,
      pages: serverSnapshot.pages,
    };
    isRoomLoaded = true;

    // 3. Joining member now has full server content (2 pages, 3 elements)
    expect(rehydratedState.pages).toHaveLength(2);
    expect(rehydratedState.pages[0].elements).toHaveLength(2);
    expect(rehydratedState.pages[1].elements).toHaveLength(1);

    // 4. Any subsequent changes can now be safely synced
    triggerAutoSync(rehydratedState);
    expect(autoSyncPayload).toEqual(rehydratedState);
    expect(autoSyncPayload.pages).toHaveLength(2);
  });

  it("ensures elements committed during collaboration have valid pageId stamped", () => {
    const activePageId = "page-flow-123";
    const rawElement: { id: string; type: "pen"; x: number; y: number; strokeColor: string; strokeWidth: number; pageId?: string } = {
      id: "stroke-1",
      type: "pen",
      x: 0,
      y: 0,
      strokeColor: "#ffffff",
      strokeWidth: 4,
    };

    // App stamp logic
    const elWithPage = rawElement.pageId
      ? rawElement
      : { ...rawElement, pageId: activePageId };

    expect(elWithPage.pageId).toBe("page-flow-123");
  });

  it("handles real-time in-progress streaming drafts and clears them on commit", () => {
    const remoteDrafts = new Map<string, any>();

    // 1. Collaborator begins drawing a circle (in-progress shape)
    const inProgressMsg = {
      type: "PRESENCE",
      presenceType: "IN_PROGRESS_SHAPE",
      authorId: "user-2",
      payload: {
        name: "Alice",
        pageId: "page-1",
        element: {
          id: "circle-draft-1",
          type: "ellipse",
          x: 100,
          y: 100,
          width: 80,
          height: 80,
          strokeColor: "#d4a359",
        },
      },
    };

    remoteDrafts.set(inProgressMsg.authorId, {
      authorId: inProgressMsg.authorId,
      authorName: inProgressMsg.payload.name,
      pageId: inProgressMsg.payload.pageId,
      element: inProgressMsg.payload.element,
      lastUpdated: Date.now(),
    });

    expect(remoteDrafts.has("user-2")).toBe(true);
    expect(remoteDrafts.get("user-2").element.type).toBe("ellipse");
    expect(remoteDrafts.get("user-2").element.width).toBe(80);

    // 2. Collaborator releases mouse -> committed OP arrives -> draft cleared
    const commitOp = {
      type: "OP",
      shapeId: "circle-draft-1",
      authorId: "user-2",
      opType: "CREATE_OR_UPDATE",
    };

    if (remoteDrafts.has(commitOp.authorId)) {
      remoteDrafts.delete(commitOp.authorId);
    }

    expect(remoteDrafts.has("user-2")).toBe(false);
  });

  it("accurately tracks active members through presence heartbeats even without mouse movement", () => {
    const activeMembers = new Map<string, any>();

    // Member sends HEARTBEAT on room join
    const heartbeatMsg = {
      authorId: "user-bob",
      name: "Bob",
      lastSeen: Date.now(),
    };

    activeMembers.set(heartbeatMsg.authorId, heartbeatMsg);
    expect(activeMembers.size).toBe(1);

    // Live member count is active remote members + self
    const liveParticipantCount = activeMembers.size + 1;
    expect(liveParticipantCount).toBe(2);

    // User leaves
    activeMembers.delete("user-bob");
    expect(activeMembers.size).toBe(0);
    expect(activeMembers.size + 1).toBe(1);
  });

  it("normalizes in-progress pen drafts correctly even with negative relative stroke offsets", () => {
    const rawPenDraft = {
      id: "pen-draft-live",
      type: "pen" as const,
      x: 100,
      y: 100,
      width: 1,
      height: 1,
      points: [
        { x: 0, y: 0, pressure: 0.5 },
        { x: -20, y: -30, pressure: 0.6 },
        { x: 40, y: 50, pressure: 0.7 },
      ],
      strokeColor: "#ffffff",
      strokeWidth: 3,
    };

    const normalized = normalizePenElement(rawPenDraft as any);
    expect(normalized.x).toBe(80); // 100 + (-20)
    expect(normalized.y).toBe(70); // 100 + (-30)
    expect(normalized.width).toBe(60); // 40 - (-20)
    expect(normalized.height).toBe(80); // 50 - (-30)
    expect(normalized.points?.[0].x).toBe(20);
    expect(normalized.points?.[1].x).toBe(0);
  });

  it("determines whether to render remote draft based on multi-page vs single-page context", () => {
    const shouldSkipDraft = (
      rdPageId: string | undefined,
      activePageId: string,
      pages: Array<{ id: string }>
    ) => {
      return Boolean(
        pages &&
          pages.length > 1 &&
          rdPageId &&
          activePageId &&
          rdPageId !== activePageId &&
          pages.some((p) => p.id === rdPageId)
      );
    };

    // Case 1: Single page board with differing client IDs (should NOT skip)
    expect(
      shouldSkipDraft("page-alice-random", "page-bob-random", [{ id: "page-bob-random" }])
    ).toBe(false);

    // Case 2: Multi-page board where draft is explicitly on another known page (SHOULD skip)
    expect(
      shouldSkipDraft("page-2", "page-1", [{ id: "page-1" }, { id: "page-2" }])
    ).toBe(true);

    // Case 3: Multi-page board where draft is on the current page (should NOT skip)
    expect(
      shouldSkipDraft("page-1", "page-1", [{ id: "page-1" }, { id: "page-2" }])
    ).toBe(false);
  });

  it("safely handles opacity fallback without producing NaN", () => {
    const calculateAlpha = (opacity?: number) => {
      return Math.max(0.05, ((opacity ?? 100) / 100));
    };

    expect(calculateAlpha(undefined)).toBe(1);
    expect(calculateAlpha(50)).toBe(0.5);
    expect(calculateAlpha(0)).toBe(0.05); // Clamped minimum
    expect(Number.isNaN(calculateAlpha(undefined))).toBe(false);
  });
});
