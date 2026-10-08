import { useCallback, useEffect, useRef, useState } from "react";
import { StompClient, CollabOp, PresenceMessage, AiGhostMessage } from "./StompClient";
import { useAuth } from "../contexts/AuthContext";
import { apiSyncDelta } from "../lib/api";

export interface CursorInfo {
  authorId: string;
  name: string;
  x: number;
  y: number;
  color: string;
  lastSeen: number;
}

export interface RoomMemberPresence {
  authorId: string;
  name: string;
  color: string;
  lastSeen: number;
}

export interface RemoteDraft {
  authorId: string;
  authorName: string;
  color: string;
  pageId?: string;
  element: any;
  lastUpdated: number;
}

const CURSOR_COLORS = [
  "#d4a359", "#b47b18", "#22c55e", "#16a34a", "#ef4444",
  "#dc2626", "#eab308", "#ca8a04", "#06b6d4", "#8b5cf6",
  "#ec4899", "#3b82f6",
];

export function getCursorColor(authorId: string): string {
  let hash = 0;
  for (let i = 0; i < authorId.length; i++) {
    hash = ((hash << 5) - hash + authorId.charCodeAt(i)) | 0;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

/**
 * React hook providing real-time collaboration via STOMP WebSocket.
 * Features:
 * - Robust connection management with stable lifecycle (no tearing down on state updates)
 * - Automatic presence heartbeats & accurate active room member tracking
 * - Real-time streaming of in-progress strokes and dragging shapes (sub-10ms ephemeral delivery)
 * - CRDT delta recovery on reconnect
 */
export function useCollaboration(
  slug: string | null,
  onRemoteOp: (op: CollabOp | AiGhostMessage) => void,
  onReconnect?: () => void
) {
  const { token, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [cursors, setCursors] = useState<Map<string, CursorInfo>>(new Map());
  const [activeMembers, setActiveMembers] = useState<Map<string, RoomMemberPresence>>(new Map());
  const [remoteDrafts, setRemoteDrafts] = useState<Map<string, RemoteDraft>>(new Map());

  const clientRef = useRef<StompClient | null>(null);
  const cursorThrottleRef = useRef<number>(0);
  const draftThrottleRef = useRef<number>(0);
  const lastLamportRef = useRef(-1);

  // Keep callback refs stable to completely eliminate reconnect flapping
  const onRemoteOpRef = useRef(onRemoteOp);
  onRemoteOpRef.current = onRemoteOp;

  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  const [anonAuthorId] = useState<string>(() => {
    try {
      let id = sessionStorage.getItem("graffiti:anon_author_id");
      if (!id) {
        id = "guest_" + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem("graffiti:anon_author_id", id);
      }
      return id;
    } catch {
      return "guest_" + Math.random().toString(36).substring(2, 9);
    }
  });

  const effectiveAuthorId = user?.userId || anonAuthorId;
  const effectiveAuthorName = user?.name || user?.email || (user?.userId ? "User" : "Guest");

  // Periodic heartbeat to keep presence & member counts active
  useEffect(() => {
    if (!slug || !isConnected) return;

    // Send immediate heartbeat upon connecting
    clientRef.current?.sendPresence(effectiveAuthorId, "HEARTBEAT", {
      name: effectiveAuthorName,
    });

    // Send ongoing heartbeat every 4 seconds
    const interval = setInterval(() => {
      if (clientRef.current?.isConnected) {
        clientRef.current.sendPresence(effectiveAuthorId, "HEARTBEAT", {
          name: effectiveAuthorName,
        });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [slug, isConnected, effectiveAuthorId, effectiveAuthorName]);

  // Prune stale cursors (10s), stale members (18s), and orphaned drafts (5s)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      // Prune inactive cursors
      setCursors((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const [key, cursor] of next) {
          if (now - cursor.lastSeen > 10000) {
            next.delete(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      // Prune inactive room members (grace period: 18s = over 4 heartbeats)
      setActiveMembers((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const [key, member] of next) {
          if (now - member.lastSeen > 18000) {
            next.delete(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      // Prune orphaned in-progress drafts
      setRemoteDrafts((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const [key, draft] of next) {
          if (now - draft.lastUpdated > 5000) {
            next.delete(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Main stable WebSocket connection effect
  useEffect(() => {
    if (!slug) return;

    const recordMemberActivity = (authorId: string, authorName?: string) => {
      if (!authorId || authorId === effectiveAuthorId) return;
      setActiveMembers((prev) => {
        const existing = prev.get(authorId);
        const name = authorName || existing?.name || authorId.slice(0, 8);
        const next = new Map(prev);
        next.set(authorId, {
          authorId,
          name,
          color: getCursorColor(authorId),
          lastSeen: Date.now(),
        });
        return next;
      });
    };

    const handleMessage = (msg: CollabOp | PresenceMessage | AiGhostMessage) => {
      if (msg.type === "OP") {
        const op = msg as CollabOp;
        lastLamportRef.current = Math.max(lastLamportRef.current, op.lamportTs || -1);

        // Record collaborator activity
        if (op.authorId && op.authorId !== effectiveAuthorId) {
          recordMemberActivity(op.authorId);
          // If a committed op arrived from this author, clear any in-progress draft
          setRemoteDrafts((prev) => {
            if (!prev.has(op.authorId)) return prev;
            const next = new Map(prev);
            next.delete(op.authorId);
            return next;
          });
        }

        // Skip ops from self
        if (op.authorId === effectiveAuthorId) return;
        onRemoteOpRef.current(op);
      } else if (msg.type === "AI_GHOST_OP") {
        onRemoteOpRef.current(msg as AiGhostMessage);
      } else if (msg.type === "PRESENCE") {
        const presence = msg as PresenceMessage;
        const authorId = presence.authorId || presence.sessionId;
        if (!authorId || authorId === effectiveAuthorId) return;

        recordMemberActivity(authorId, presence.payload?.name);

        if (presence.presenceType === "cursor" && presence.payload) {
          setCursors((prev) => {
            const next = new Map(prev);
            next.set(authorId, {
              authorId,
              name: presence.payload.name || authorId.slice(0, 8),
              x: presence.payload.x || 0,
              y: presence.payload.y || 0,
              color: getCursorColor(authorId),
              lastSeen: Date.now(),
            });
            return next;
          });
        } else if (presence.presenceType === "IN_PROGRESS_SHAPE" && presence.payload?.element) {
          const el = presence.payload.element;
          setRemoteDrafts((prev) => {
            const next = new Map(prev);
            next.set(authorId, {
              authorId,
              authorName: presence.payload.name || authorId.slice(0, 8),
              color: getCursorColor(authorId),
              pageId: presence.payload.pageId,
              element: el,
              lastUpdated: Date.now(),
            });
            return next;
          });

          // Also update cursor position based on active stroke point or shape bounds
          const lastPoint = el.points?.[el.points.length - 1];
          const cx = lastPoint ? el.x + lastPoint.x : el.x + (el.width || 0);
          const cy = lastPoint ? el.y + lastPoint.y : el.y + (el.height || 0);
          if (typeof cx === "number" && typeof cy === "number") {
            setCursors((prev) => {
              const next = new Map(prev);
              next.set(authorId, {
                authorId,
                name: presence.payload.name || authorId.slice(0, 8),
                x: cx,
                y: cy,
                color: getCursorColor(authorId),
                lastSeen: Date.now(),
              });
              return next;
            });
          }
        } else if (presence.presenceType === "IN_PROGRESS_SHAPE_CLEAR") {
          setRemoteDrafts((prev) => {
            if (!prev.has(authorId)) return prev;
            const next = new Map(prev);
            next.delete(authorId);
            return next;
          });
        } else if (presence.presenceType === "USER_LEFT") {
          setCursors((prev) => {
            const next = new Map(prev);
            next.delete(authorId);
            return next;
          });
          setActiveMembers((prev) => {
            const next = new Map(prev);
            next.delete(authorId);
            return next;
          });
          setRemoteDrafts((prev) => {
            const next = new Map(prev);
            next.delete(authorId);
            return next;
          });
        } else if (presence.presenceType === "OWNER_CHANGED") {
          onRemoteOpRef.current({
            type: "PRESENCE",
            presenceType: "OWNER_CHANGED",
            payload: presence.payload,
          } as any);
        }
      }
    };

    const syncAfterReconnect = async () => {
      try {
        const delta = await apiSyncDelta(slug, lastLamportRef.current);
        if (Array.isArray(delta)) {
          delta.forEach((op) => handleMessage({ type: "OP", ...op }));
        }
      } catch (err) {
        console.warn("Delta op sync after reconnect failed:", err);
      }
      try {
        onReconnectRef.current?.();
      } catch (err) {
        console.warn("Error in onReconnect callback:", err);
      }
    };

    const client = new StompClient(slug, token, handleMessage, setIsConnected, syncAfterReconnect);
    clientRef.current = client;
    client.connect();

    return () => {
      // Disconnect cleanly
      client.sendPresence(effectiveAuthorId, "USER_LEFT", {});
      client.disconnect();
      clientRef.current = null;
      setIsConnected(false);
      setCursors(new Map());
      setActiveMembers(new Map());
      setRemoteDrafts(new Map());
    };
  }, [slug, token, effectiveAuthorId]);

  const sendOp = useCallback(
    (shapeId: string, opType: "CREATE_OR_UPDATE" | "DELETE", payload: any) => {
      if (!clientRef.current) return;
      clientRef.current.sendOp(shapeId, opType, payload, effectiveAuthorId);
    },
    [effectiveAuthorId]
  );

  const sendCursorPosition = useCallback(
    (x: number, y: number) => {
      if (!clientRef.current) return;
      const now = Date.now();
      if (now - cursorThrottleRef.current < 30) return; // 30ms throttle
      cursorThrottleRef.current = now;
      clientRef.current.sendPresence(effectiveAuthorId, "cursor", {
        x,
        y,
        name: effectiveAuthorName,
      });
    },
    [effectiveAuthorId, effectiveAuthorName]
  );

  // Stream in-progress drawing stroke or dragging element live
  const streamDraft = useCallback(
    (draftElement: any | null, pageId?: string) => {
      if (!clientRef.current) return;
      const now = Date.now();
      if (draftElement) {
        if (now - draftThrottleRef.current < 35) return; // ~28 fps throttle for smooth sub-10ms delivery
        draftThrottleRef.current = now;
        clientRef.current.sendPresence(effectiveAuthorId, "IN_PROGRESS_SHAPE", {
          element: draftElement,
          pageId: pageId || "",
          name: effectiveAuthorName,
        });
      } else {
        // Immediate clear upon release
        clientRef.current.sendPresence(effectiveAuthorId, "IN_PROGRESS_SHAPE_CLEAR", {});
      }
    },
    [effectiveAuthorId, effectiveAuthorName]
  );

  const sendAiRequest = useCallback((shapeId: string, payload: any) => {
    if (!clientRef.current) return;
    clientRef.current.sendOp(shapeId, "AI_REQUEST", payload, effectiveAuthorId, lastLamportRef.current);
  }, [effectiveAuthorId]);

  return {
    isConnected,
    cursors: Array.from(cursors.values()),
    activeMembers: Array.from(activeMembers.values()),
    remoteDrafts: Array.from(remoteDrafts.values()),
    streamDraft,
    sendOp,
    sendAiRequest,
    sendCursorPosition,
  };
}
