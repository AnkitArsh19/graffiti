import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getStroke } from "perfect-freehand";
import {
  X,
  Eraser,
  Highlighter,
  Pen,
  Trash2,
  Minus,
  Plus,
  Circle,
  Square,
  ArrowUpRight,
  Undo2,
  MousePointer,
  RotateCw,
  GripVertical,
  GripHorizontal,
  Layers,
  LayoutDashboard,
  Share2,
  Check,
  Copy,
  Mail,
} from "lucide-react";
import { useShortcuts } from "../contexts/ShortcutsContext";
import { distanceToSegment } from "../lib/collision";
import { apiCreateRoom, apiSaveRoomContent, apiGetRoom } from "../lib/api";
import { StompClient, CollabOp } from "../collab/StompClient";

// ---- types ----
export type OverlayTool = "pen" | "highlighter" | "arrow" | "rect" | "circle" | "line" | "eraser";
export type BackgroundMode = "transparent" | "dim" | "whiteboard" | "blackboard";

interface Point {
  x: number;
  y: number;
  pressure: number;
}

interface Stroke {
  id: string;
  tool: OverlayTool;
  color: string;
  size: number;
  points: Point[];
}

const COLOR_PRESETS = [
  { label: "Radiant Red", value: "#ef4444" },
  { label: "Golden Accent", value: "#d4a359" },
  { label: "Emerald Green", value: "#22c55e" },
  { label: "Pure White", value: "#ffffff" },
  { label: "Deep Black", value: "#09090b" },
];

function getSvgPath(stroke: number[][]): string {
  if (!stroke.length) return "";
  const d = stroke.reduce<string>((acc, [x0, y0], i, arr) => {
    const [x1, y1] = arr[(i + 1) % arr.length];
    return `${acc} Q ${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`;
  }, `M ${stroke[0][0]},${stroke[0][1]}`);
  return `${d} Z`;
}

/**
 * Smoothing algorithm for freehand strokes
 * Keeps vertices clean and ready for AI shape-recognition / curve beautification
 */
function smoothPoints(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const smoothed: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    smoothed.push({
      x: (points[i - 1].x + points[i].x * 2 + points[i + 1].x) / 4,
      y: (points[i - 1].y + points[i].y * 2 + points[i + 1].y) / 4,
      pressure: points[i].pressure,
    });
  }
  smoothed.push(points[points.length - 1]);
  return smoothed;
}

/**
 * Object-level hit-testing: checks if a point hits any part of a stroke/shape.
 * Eraser uses this to remove entire stroke objects on touch instead of raster bite-marks.
 */
function isPointInStroke(stroke: Stroke, x: number, y: number): boolean {
  const tolerance = Math.max(14, stroke.size + 8);
  const pt = { x, y };

  if (stroke.tool === "pen" || stroke.tool === "highlighter") {
    if (stroke.points.length === 0) return false;
    if (stroke.points.length === 1) {
      return Math.hypot(stroke.points[0].x - x, stroke.points[0].y - y) <= tolerance;
    }
    for (let i = 1; i < stroke.points.length; i++) {
      if (distanceToSegment(pt, stroke.points[i - 1], stroke.points[i]) <= tolerance) {
        return true;
      }
    }
    return false;
  }

  if (stroke.tool === "arrow" || stroke.tool === "line") {
    if (stroke.points.length < 2) return false;
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    return distanceToSegment(pt, start, end) <= tolerance;
  }

  if (stroke.tool === "rect") {
    if (stroke.points.length < 2) return false;
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return (
      x >= minX - tolerance &&
      x <= maxX + tolerance &&
      y >= minY - tolerance &&
      y <= maxY + tolerance
    );
  }

  if (stroke.tool === "circle") {
    if (stroke.points.length < 2) return false;
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    if (rx < 2 || ry < 2) return false;
    const normDist = Math.hypot((x - cx) / rx, (y - cy) / ry);
    return normDist <= 1 + tolerance / Math.min(rx, ry);
  }

  return false;
}

function canvasElementToStroke(el: any): Stroke {
  if (el.points && el.tool) return el as Stroke;
  const tool = el.type === "rectangle" ? "rect" : el.type === "ellipse" ? "circle" : el.type === "arrow" ? "arrow" : el.type === "line" ? "line" : (el.type === "highlighter" ? "highlighter" : "pen");
  const color = el.strokeColor || "#ffffff";
  const size = el.strokeWidth || 4;

  if (tool === "rect" || tool === "circle") {
    return {
      id: el.id,
      tool,
      color,
      size,
      points: [
        { x: el.x || 0, y: el.y || 0, pressure: 0.5 },
        { x: (el.x || 0) + (el.width || 100), y: (el.y || 0) + (el.height || 100), pressure: 0.5 },
      ],
    };
  }

  if (tool === "arrow" || tool === "line") {
    const pts = el.points || [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    return {
      id: el.id,
      tool,
      color,
      size,
      points: pts.map((p: any) => ({ x: (el.x || 0) + (p.x || 0), y: (el.y || 0) + (p.y || 0), pressure: 0.5 })),
    };
  }

  return {
    id: el.id,
    tool: "pen",
    color,
    size,
    points: (el.points || []).map((p: any) => ({
      x: (el.x || 0) + (p.x || 0),
      y: (el.y || 0) + (p.y || 0),
      pressure: p.pressure || 0.5,
    })),
  };
}

function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 0) return;

  ctx.save();

  if (stroke.tool === "highlighter") {
    if (stroke.points.length < 2) return;
    const outlinePoints = getStroke(stroke.points, {
      size: stroke.size * 3.5,
      thinning: 0,
      smoothing: 0.6,
      streamline: 0.5,
    });
    const path = new Path2D(getSvgPath(outlinePoints));
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = stroke.color;
    ctx.fill(path);
    ctx.restore();
    return;
  }

  if (stroke.tool === "arrow") {
    if (stroke.points.length < 2) return;
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLen = Math.max(12, stroke.size * 3);

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLen * Math.cos(angle - Math.PI / 6),
      end.y - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLen * Math.cos(angle + Math.PI / 6),
      end.y - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (stroke.tool === "line") {
    if (stroke.points.length < 2) return;
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (stroke.tool === "rect") {
    if (stroke.points.length < 2) return;
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineJoin = "round";
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    ctx.restore();
    return;
  }

  if (stroke.tool === "circle") {
    if (stroke.points.length < 2) return;
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Regular freehand pen
  const outlinePoints = getStroke(stroke.points, {
    size: stroke.size,
    thinning: 0.3,
    smoothing: 0.5,
    streamline: 0.5,
  });

  const path = new Path2D(getSvgPath(outlinePoints));
  ctx.fillStyle = stroke.color;
  ctx.fill(path);
  ctx.restore();
}

export function OverlayCanvas() {
  const { shortcuts, getShortcut } = useShortcuts();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(() => {
    try {
      const saved = localStorage.getItem("graffiti:overlay_strokes");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeTool, setActiveTool] = useState<OverlayTool>("pen");
  const [activeColor, setActiveColor] = useState("#d4a359");
  const [strokeSize, setStrokeSize] = useState(5);
  const [isDrawing, setIsDrawing] = useState(false);
  const [bgMode, setBgMode] = useState<BackgroundMode>("transparent");
  const [isClickThrough, setIsClickThrough] = useState(false);

  // Orientation: horizontal or vertical
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">(() => {
    try {
      return (localStorage.getItem("graffiti:overlay_orient") as any) || "horizontal";
    } catch {
      return "horizontal";
    }
  });

  // Draggable toolbar coordinates
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem("graffiti:overlay_pos");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      x: Math.max(16, Math.round(window.innerWidth / 2 - 380)),
      y: 16,
    };
  });

  // Persist strokes on change
  useEffect(() => {
    try {
      localStorage.setItem("graffiti:overlay_strokes", JSON.stringify(strokes));
    } catch {}
  }, [strokes]);

  // Persist orientation and position on change
  useEffect(() => {
    try {
      localStorage.setItem("graffiti:overlay_orient", orientation);
    } catch {}
  }, [orientation]);

  useEffect(() => {
    try {
      localStorage.setItem("graffiti:overlay_pos", JSON.stringify(pos));
    } catch {}
  }, [pos]);
  const [isDragging, setIsDragging] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [overlayRoomSlug, setOverlayRoomSlug] = useState<string>(() => {
    try {
      return localStorage.getItem("graffiti:current_room_slug") || "";
    } catch {
      return "";
    }
  });
  const [isCollabConnected, setIsCollabConnected] = useState(false);
  const stompClientRef = useRef<StompClient | null>(null);
  const authorIdRef = useRef<string>((() => {
    try {
      let id = sessionStorage.getItem("graffiti:overlay_author_id");
      if (!id) {
        id = "ov_" + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem("graffiti:overlay_author_id", id);
      }
      return id;
    } catch {
      return "ov_" + Math.random().toString(36).substring(2, 9);
    }
  })());

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const currentStroke = useRef<Stroke | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Redraw canvas
  const redraw = useCallback((allStrokes: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of allStrokes) {
      renderStroke(ctx, s);
    }
  }, []);

  // STOMP Live Collaboration for Desktop Overlay
  useEffect(() => {
    if (!overlayRoomSlug) return;
    const token = localStorage.getItem("graffiti:auth:token");

    const handleRemoteCollabOp = (msg: any) => {
      if (msg.type !== "OP") return;
      const op = msg as CollabOp;
      if (op.authorId === authorIdRef.current) return;

      if (op.opType === "CREATE_OR_UPDATE" && op.payload) {
        const remoteStroke = canvasElementToStroke(op.payload);
        setStrokes((prev) => {
          const exists = prev.some((s) => s.id === remoteStroke.id);
          const next = exists
            ? prev.map((s) => (s.id === remoteStroke.id ? remoteStroke : s))
            : [...prev, remoteStroke];
          redraw(next);
          return next;
        });
      } else if (op.opType === "DELETE") {
        setStrokes((prev) => {
          const remaining = prev.filter((s) => s.id !== op.shapeId);
          redraw(remaining);
          return remaining;
        });
      }
    };

    // Load initial room details & snapshot
    apiGetRoom(overlayRoomSlug)
      .then((roomData) => {
        const snapshot = roomData.snapshotState ?? (roomData as any).state;
        if (snapshot && Array.isArray(snapshot.strokes)) {
          setStrokes(snapshot.strokes);
          redraw(snapshot.strokes);
        } else if (snapshot && Array.isArray(snapshot.pages) && snapshot.pages[0]?.elements) {
          const loadedStrokes = snapshot.pages[0].elements.map(canvasElementToStroke);
          setStrokes(loadedStrokes);
          redraw(loadedStrokes);
        }
        const ops = roomData.opsSinceSnapshot ?? (roomData as any).ops ?? [];
        if (Array.isArray(ops)) {
          ops.forEach(handleRemoteCollabOp);
        }
      })
      .catch(() => {});

    const client = new StompClient(
      overlayRoomSlug,
      token,
      handleRemoteCollabOp,
      setIsCollabConnected
    );
    stompClientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      stompClientRef.current = null;
      setIsCollabConnected(false);
    };
  }, [overlayRoomSlug, redraw]);

  // Window resize sync
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      redraw(strokes);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [strokes, redraw]);

  // Synchronize toolbar bounding box with Tauri Rust backend
  const syncToolbarBounds = useCallback(() => {
    if (!toolbarRef.current) return;
    const rect = toolbarRef.current.getBoundingClientRect();
    invoke("set_overlay_toolbar_bounds", {
      bounds: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      },
      clickThrough: isClickThrough,
    }).catch(() => {});
  }, [isClickThrough]);

  useEffect(() => {
    syncToolbarBounds();
    const timer = setTimeout(syncToolbarBounds, 80);
    return () => clearTimeout(timer);
  }, [pos, orientation, isClickThrough, syncToolbarBounds]);

  // Close overlay
  const closeOverlay = useCallback(() => {
    invoke("close_overlay_window").catch(() => {});
  }, []);

  const getOverlayShareUrl = useCallback(() => {
    const slug = overlayRoomSlug || "main";
    const origin =
      import.meta.env.VITE_PUBLIC_URL ||
      (typeof window !== "undefined" && window.location.hostname.includes("ankitarsh.me")
        ? window.location.origin
        : "https://graffiti.ankitarsh.me");
    return `${origin}/room/${slug}`;
  }, [overlayRoomSlug]);

  const handleOverlayShare = useCallback(async () => {
    let slug = overlayRoomSlug;
    if (!slug) {
      try {
        const snapshotState = {
          strokes,
        };
        const room = await apiCreateRoom({ name: "Desktop Overlay", snapshotState });
        slug = room.slug;
        setOverlayRoomSlug(slug);
        try {
          localStorage.setItem("graffiti:current_room_slug", slug);
        } catch {}
        await apiSaveRoomContent(slug, {
          name: "Desktop Overlay",
          snapshotState,
        }).catch(() => {});
      } catch {
        slug = "main";
      }
    } else {
      apiSaveRoomContent(slug, {
        name: "Desktop Overlay",
        snapshotState: { strokes },
      }).catch(() => {});
    }
    const origin =
      import.meta.env.VITE_PUBLIC_URL ||
      (typeof window !== "undefined" && window.location.hostname.includes("ankitarsh.me")
        ? window.location.origin
        : "https://graffiti.ankitarsh.me");
    const url = `${origin}/room/${slug}`;

    try {
      await navigator.clipboard.writeText(url);
    } catch {}

    setCopiedShare(true);
    setShareToast("Invite link copied to clipboard!");
    setIsClickThrough(false);
    setShowShareModal(true);
    setTimeout(() => setShareToast(null), 3000);
    setTimeout(() => setCopiedShare(false), 2000);
  }, [overlayRoomSlug, strokes]);

  const undo = useCallback(() => {
    setStrokes((prev) => {
      const last = prev[prev.length - 1];
      if (last && stompClientRef.current?.isConnected && overlayRoomSlug) {
        stompClientRef.current.sendOp(last.id, "DELETE", null, authorIdRef.current);
      }
      const next = prev.slice(0, -1);
      redraw(next);
      return next;
    });
  }, [redraw, overlayRoomSlug]);

  const clearAll = useCallback(() => {
    if (stompClientRef.current?.isConnected && overlayRoomSlug) {
      strokes.forEach((s) => {
        stompClientRef.current?.sendOp(s.id, "DELETE", null, authorIdRef.current);
      });
    }
    setStrokes([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [strokes, overlayRoomSlug]);

  // Eraser: remove entire stroke object on touch
  const eraseStrokesAtPoint = useCallback((x: number, y: number) => {
    setStrokes((prev) => {
      const erased = prev.filter((s) => isPointInStroke(s, x, y));
      if (erased.length > 0 && stompClientRef.current?.isConnected && overlayRoomSlug) {
        erased.forEach((s) => {
          stompClientRef.current?.sendOp(s.id, "DELETE", null, authorIdRef.current);
        });
      }
      const remaining = prev.filter((s) => !isPointInStroke(s, x, y));
      if (remaining.length !== prev.length) {
        redraw(remaining);
        return remaining;
      }
      return prev;
    });
  }, [redraw, overlayRoomSlug]);

  // Pull up full Whiteboard integration: send overlay drawings to Whiteboard canvas
  const handleSendToWhiteboard = useCallback(() => {
    if (strokes.length > 0) {
      const converted = strokes.map((s, idx) => {
        const elId = `imported_ov_${Date.now()}_${idx}`;
        if (s.tool === "pen" || s.tool === "highlighter") {
          return {
            id: elId,
            type: "pen",
            x: 0,
            y: 0,
            points: s.points.map((p) => ({ x: p.x, y: p.y })),
            strokeColor: s.color,
            strokeWidth: s.size,
            opacity: s.tool === "highlighter" ? 35 : 100,
            roundness: "sharp",
          };
        }
        if (s.tool === "rect") {
          const p0 = s.points[0];
          const p1 = s.points[s.points.length - 1];
          return {
            id: elId,
            type: "rectangle",
            x: Math.min(p0.x, p1.x),
            y: Math.min(p0.y, p1.y),
            width: Math.abs(p1.x - p0.x),
            height: Math.abs(p1.y - p0.y),
            strokeColor: s.color,
            strokeWidth: s.size,
            fillColor: "transparent",
            opacity: 100,
          };
        }
        if (s.tool === "circle") {
          const p0 = s.points[0];
          const p1 = s.points[s.points.length - 1];
          return {
            id: elId,
            type: "ellipse",
            x: Math.min(p0.x, p1.x),
            y: Math.min(p0.y, p1.y),
            width: Math.abs(p1.x - p0.x),
            height: Math.abs(p1.y - p0.y),
            strokeColor: s.color,
            strokeWidth: s.size,
            fillColor: "transparent",
            opacity: 100,
          };
        }
        const p0 = s.points[0];
        const p1 = s.points[s.points.length - 1];
        return {
          id: elId,
          type: s.tool === "arrow" ? "arrow" : "line",
          x: p0.x,
          y: p0.y,
          points: [
            { x: 0, y: 0 },
            { x: p1.x - p0.x, y: p1.y - p0.y },
          ],
          strokeColor: s.color,
          strokeWidth: s.size,
          opacity: 100,
        };
      });

      try {
        localStorage.setItem("graffiti:overlay_imported_elements", JSON.stringify(converted));
      } catch {}
    }

    invoke("focus_main_window").catch(() => {});
    invoke("close_overlay_window").catch(() => {});
  }, [strokes]);

  // Cycle background mode
  const cycleBgMode = useCallback(() => {
    setBgMode((prev) => {
      switch (prev) {
        case "transparent":
          return "dim";
        case "dim":
          return "whiteboard";
        case "whiteboard":
          return "blackboard";
        case "blackboard":
        default:
          return "transparent";
      }
    });
  }, []);

  function matchesShortcut(e: KeyboardEvent, bindingKey: string | undefined): boolean {
    if (!bindingKey) return false;
    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.metaKey) parts.push("Meta");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey && e.key !== "Shift") parts.push("Shift");
    let k = e.key;
    if (k === " ") k = "Space";
    if (k.length === 1) k = k.toUpperCase();
    if (!["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
      if (!parts.includes(k)) parts.push(k);
    }
    const combo = parts.join("+");
    return combo.toLowerCase() === bindingKey.toLowerCase();
  }

  // Keyboard & Mouse Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesShortcut(e, shortcuts.ov_close?.key) || e.key === "Escape") {
        e.preventDefault();
        closeOverlay();
      } else if (matchesShortcut(e, shortcuts.ov_toggle_draw?.key) || e.key === "Tab" || e.code === "Space") {
        e.preventDefault();
        setIsClickThrough((prev) => !prev);
      } else if (matchesShortcut(e, shortcuts.ov_pen?.key) || e.key.toLowerCase() === "p") {
        setActiveTool("pen");
        setIsClickThrough(false);
      } else if (matchesShortcut(e, shortcuts.ov_highlighter?.key) || e.key.toLowerCase() === "h") {
        setActiveTool("highlighter");
        setIsClickThrough(false);
      } else if (matchesShortcut(e, shortcuts.ov_arrow?.key) || e.key.toLowerCase() === "a") {
        setActiveTool("arrow");
        setIsClickThrough(false);
      } else if (matchesShortcut(e, shortcuts.ov_rect?.key) || e.key.toLowerCase() === "r") {
        setActiveTool("rect");
        setIsClickThrough(false);
      } else if (matchesShortcut(e, shortcuts.ov_circle?.key) || e.key.toLowerCase() === "c") {
        setActiveTool("circle");
        setIsClickThrough(false);
      } else if (matchesShortcut(e, shortcuts.ov_line?.key) || e.key.toLowerCase() === "l") {
        setActiveTool("line");
        setIsClickThrough(false);
      } else if (matchesShortcut(e, shortcuts.ov_eraser?.key) || e.key.toLowerCase() === "e") {
        setActiveTool("eraser");
        setIsClickThrough(false);
      } else if (e.key.toLowerCase() === "b") {
        cycleBgMode();
      } else if (e.key.toLowerCase() === "o") {
        setOrientation((prev) => (prev === "horizontal" ? "vertical" : "horizontal"));
      } else if (matchesShortcut(e, shortcuts.ov_undo?.key) || (e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        undo();
      } else if (matchesShortcut(e, shortcuts.ov_clear?.key) || e.key === "Delete") {
        e.preventDefault();
        clearAll();
      }
    };

    const handleWindowMouseDown = (e: MouseEvent) => {
      if (e.button === 0) return;
      for (const [id, binding] of Object.entries(shortcuts)) {
        if (binding.isMouse && binding.mouseButton === e.button) {
          e.preventDefault();
          e.stopPropagation();
          if (id === "ov_toggle_draw") {
            setIsClickThrough((prev) => !prev);
          } else if (id === "ov_pen") {
            setActiveTool("pen");
            setIsClickThrough(false);
          } else if (id === "ov_highlighter") {
            setActiveTool("highlighter");
            setIsClickThrough(false);
          } else if (id === "ov_arrow") {
            setActiveTool("arrow");
            setIsClickThrough(false);
          } else if (id === "ov_rect") {
            setActiveTool("rect");
            setIsClickThrough(false);
          } else if (id === "ov_circle") {
            setActiveTool("circle");
            setIsClickThrough(false);
          } else if (id === "ov_line") {
            setActiveTool("line");
            setIsClickThrough(false);
          } else if (id === "ov_eraser") {
            setActiveTool("eraser");
            setIsClickThrough(false);
          } else if (id === "ov_undo") {
            undo();
          } else if (id === "ov_clear") {
            clearAll();
          } else if (id === "ov_close") {
            closeOverlay();
          }
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleWindowMouseDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleWindowMouseDown);
    };
  }, [closeOverlay, clearAll, undo, shortcuts, cycleBgMode]);

  // Dragging handlers for toolbar
  const handleGripMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const newX = Math.max(8, Math.min(window.innerWidth - 80, dragStartRef.current.startX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - 80, dragStartRef.current.startY + dy));
      setPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Pointer interactions on canvas
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || isClickThrough) return;

    if (activeTool === "eraser") {
      eraseStrokesAtPoint(e.clientX, e.clientY);
      return;
    }

    setIsDrawing(true);

    const newStroke: Stroke = {
      id: "ov_stroke_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      tool: activeTool,
      color: activeColor,
      size: strokeSize,
      points: [{ x: e.clientX, y: e.clientY, pressure: e.pressure || 0.5 }],
    };
    currentStroke.current = newStroke;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [activeTool, activeColor, strokeSize, isClickThrough, eraseStrokesAtPoint]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isClickThrough) return;

    // Continuous drag-erasing
    if (activeTool === "eraser" && e.buttons > 0) {
      eraseStrokesAtPoint(e.clientX, e.clientY);
      return;
    }

    if (!isDrawing || !currentStroke.current) return;
    currentStroke.current.points.push({
      x: e.clientX,
      y: e.clientY,
      pressure: e.pressure || 0.5,
    });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes) {
      renderStroke(ctx, s);
    }
    renderStroke(ctx, currentStroke.current);
  }, [isDrawing, strokes, activeTool, isClickThrough, eraseStrokesAtPoint]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawing || !currentStroke.current) return;
    const finished = { ...currentStroke.current };
    // Apply smoothing for freehand pen / highlighter strokes
    if (finished.tool === "pen" || finished.tool === "highlighter") {
      finished.points = smoothPoints(finished.points);
    }
    currentStroke.current = null;
    setIsDrawing(false);

    if (stompClientRef.current?.isConnected && overlayRoomSlug) {
      stompClientRef.current.sendOp(finished.id, "CREATE_OR_UPDATE", finished, authorIdRef.current);
    }

    setStrokes((prev) => {
      const next = [...prev, finished];
      redraw(next);
      return next;
    });
  }, [isDrawing, redraw, overlayRoomSlug]);

  const getBgStyle = () => {
    switch (bgMode) {
      case "dim":
        return "rgba(0, 0, 0, 0.55)";
      case "whiteboard":
        return "#ffffff";
      case "blackboard":
        return "#09090b";
      default:
        return "transparent";
    }
  };

  const isVertical = orientation === "vertical";

  // Shortcuts labels
  const penKey = getShortcut("ov_pen") || "P";
  const hlKey = getShortcut("ov_highlighter") || "H";
  const arrowKey = getShortcut("ov_arrow") || "A";
  const rectKey = getShortcut("ov_rect") || "R";
  const circleKey = getShortcut("ov_circle") || "C";
  const lineKey = getShortcut("ov_line") || "L";
  const eraserKey = getShortcut("ov_eraser") || "E";
  const toggleKey = getShortcut("ov_toggle_draw") || "Space";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: getBgStyle(),
        transition: "background 180ms ease",
        userSelect: "none",
      }}
    >
      {/* Drawing Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          cursor: isClickThrough ? "default" : activeTool === "eraser" ? "cell" : "crosshair",
          pointerEvents: isClickThrough ? "none" : "auto",
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Fully Opaque, Draggable, Orientation-Switching Toolbar */}
      <div
        ref={toolbarRef}
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          display: "flex",
          flexDirection: isVertical ? "column" : "row",
          alignItems: "center",
          gap: 6,
          padding: isVertical ? "12px 8px" : "6px 14px",
          background: "rgba(18, 18, 24, 0.98)", // Solid, completely opaque
          border: "1px solid rgba(255, 255, 255, 0.16)",
          borderRadius: isVertical ? 20 : 28,
          boxShadow: "0 12px 48px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.1)",
          zIndex: 999999,
          pointerEvents: "auto",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Drag Handle */}
        <div
          onMouseDown={handleGripMouseDown}
          title="Drag toolbar anywhere"
          style={{
            cursor: isDragging ? "grabbing" : "grab",
            padding: "4px 2px",
            color: "rgba(255, 255, 255, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isVertical ? <GripHorizontal size={14} /> : <GripVertical size={14} />}
        </div>

        {/* Click-through toggle */}
        <button
          type="button"
          onClick={() => setIsClickThrough((prev) => !prev)}
          title={isClickThrough ? `Interact Mode (Clicking apps underneath) - Toggle (${toggleKey})` : `Draw Mode active - Click to pass-through (${toggleKey})`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 10px",
            borderRadius: 14,
            border: "none",
            cursor: "pointer",
            background: isClickThrough ? "var(--accent-primary)" : "rgba(255, 255, 255, 0.12)",
            color: isClickThrough ? "var(--accent-text)" : "#ffffff",
            fontSize: 11,
            fontWeight: 700,
            transition: "all 150ms ease",
            position: "relative",
          }}
        >
          <MousePointer size={13} />
          {!isVertical && <span>{isClickThrough ? "Click-Through" : "Draw"}</span>}
          <span style={{ fontSize: 8.5, opacity: 0.75, marginLeft: 2, background: "rgba(0,0,0,0.3)", padding: "1px 4px", borderRadius: 4 }}>
            {toggleKey}
          </span>
        </button>

        <div style={{ width: isVertical ? "80%" : 1, height: isVertical ? 1 : 20, background: "rgba(255,255,255,0.15)", margin: "1px 2px" }} />

        {/* Tool buttons with small shortcut badges */}
        {([
          { id: "pen" as OverlayTool, label: "Pen", shortcut: penKey, icon: <Pen size={14} /> },
          { id: "highlighter" as OverlayTool, label: "Highlighter", shortcut: hlKey, icon: <Highlighter size={14} /> },
          { id: "arrow" as OverlayTool, label: "Arrow", shortcut: arrowKey, icon: <ArrowUpRight size={15} /> },
          { id: "rect" as OverlayTool, label: "Box", shortcut: rectKey, icon: <Square size={13} /> },
          { id: "circle" as OverlayTool, label: "Circle", shortcut: circleKey, icon: <Circle size={13} /> },
          { id: "line" as OverlayTool, label: "Line", shortcut: lineKey, icon: <Minus size={14} /> },
          { id: "eraser" as OverlayTool, label: "Eraser", shortcut: eraserKey, icon: <Eraser size={14} /> },
        ]).map(({ id, label, shortcut, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setActiveTool(id);
              setIsClickThrough(false);
            }}
            title={`${label} (${shortcut}) - Entire stroke object`}
            style={{
              width: 32,
              height: 32,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: activeTool === id && !isClickThrough ? "rgba(255, 255, 255, 0.22)" : "transparent",
              color: activeTool === id && !isClickThrough ? "#ffffff" : "rgba(255, 255, 255, 0.65)",
              transition: "all 120ms ease",
            }}
          >
            {icon}
            <span
              style={{
                position: "absolute",
                bottom: 2,
                right: 3,
                fontSize: 8,
                fontWeight: 800,
                lineHeight: 1,
                opacity: 0.7,
                pointerEvents: "none",
                color: activeTool === id ? "#ffffff" : "rgba(255, 255, 255, 0.5)",
              }}
            >
              {shortcut}
            </span>
          </button>
        ))}

        <div style={{ width: isVertical ? "80%" : 1, height: isVertical ? 1 : 20, background: "rgba(255,255,255,0.15)", margin: "1px 2px" }} />

        {/* Color swatches */}
        <div style={{ display: "flex", flexDirection: isVertical ? "column" : "row", gap: 4 }}>
          {COLOR_PRESETS.slice(0, 5).map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                if (activeTool === "eraser") setActiveTool("pen");
                setActiveColor(value);
                setIsClickThrough(false);
              }}
              title={label}
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: activeColor === value ? "2px solid #ffffff" : "1.5px solid rgba(255,255,255,0.25)",
                background: value,
                cursor: "pointer",
                flexShrink: 0,
                boxShadow: activeColor === value ? "0 0 0 2px rgba(255,255,255,0.6)" : "none",
                transition: "all 120ms ease",
              }}
            />
          ))}
        </div>

        <div style={{ width: isVertical ? "80%" : 1, height: isVertical ? 1 : 20, background: "rgba(255,255,255,0.15)", margin: "1px 2px" }} />

        {/* Size controls */}
        <div style={{ display: "flex", flexDirection: isVertical ? "column" : "row", alignItems: "center", gap: 2 }}>
          <button
            type="button"
            onClick={() => setStrokeSize((s) => Math.max(2, s - 2))}
            title="Thinner"
            style={{ width: 22, height: 22, borderRadius: 5, border: "none", cursor: "pointer", background: "transparent", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Minus size={11} />
          </button>
          <div style={{ width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Circle size={Math.min(12, Math.max(5, strokeSize * 1.3))} fill={activeColor} color={activeColor} />
          </div>
          <button
            type="button"
            onClick={() => setStrokeSize((s) => Math.min(24, s + 2))}
            title="Thicker"
            style={{ width: 22, height: 22, borderRadius: 5, border: "none", cursor: "pointer", background: "transparent", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Plus size={11} />
          </button>
        </div>

        <div style={{ width: isVertical ? "80%" : 1, height: isVertical ? 1 : 20, background: "rgba(255,255,255,0.15)", margin: "1px 2px" }} />

        {/* Backdrop Switcher (Transparent / Dim / Whiteboard / Blackboard) */}
        <button
          type="button"
          onClick={cycleBgMode}
          title={`Backdrop: ${bgMode.toUpperCase()} (B) - Click to cycle: Transparent -> Dim -> Whiteboard -> Blackboard`}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: "none",
            cursor: "pointer",
            background: bgMode !== "transparent" ? "var(--accent-subtle)" : "transparent",
            color: bgMode !== "transparent" ? "var(--accent-primary)" : "rgba(255, 255, 255, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <Layers size={13} />
          <span style={{ position: "absolute", bottom: 1, right: 2, fontSize: 7, opacity: 0.7, fontWeight: 700 }}>B</span>
        </button>

        {/* Send to Whiteboard / Pull up full canvas */}
        <button
          type="button"
          onClick={handleSendToWhiteboard}
          title="Open in Whiteboard Canvas / Collaborate (Transfers screen drawings)"
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: "none",
            cursor: "pointer",
            background: "rgba(34, 197, 94, 0.2)",
            color: "#22c55e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <LayoutDashboard size={13} />
        </button>

        {/* Share Room / Invite */}
        <button
          type="button"
          onClick={handleOverlayShare}
          title={overlayRoomSlug ? `Live room: ${overlayRoomSlug} (${isCollabConnected ? "Connected" : "Reconnecting..."})` : "Share Room & Invite Collaborators"}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: isCollabConnected ? "1px solid rgba(34, 197, 94, 0.5)" : "none",
            cursor: "pointer",
            background: isCollabConnected ? "rgba(34, 197, 94, 0.2)" : "rgba(212, 163, 89, 0.2)",
            color: isCollabConnected ? "#22c55e" : "var(--accent-primary, #d4a359)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <Share2 size={13} />
          {isCollabConnected && (
            <span
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 6px #22c55e",
              }}
            />
          )}
        </button>

        {/* Orientation Switcher */}
        <button
          type="button"
          onClick={() => setOrientation((prev) => (prev === "horizontal" ? "vertical" : "horizontal"))}
          title={isVertical ? "Switch to Horizontal layout (O)" : "Switch to Vertical layout (O)"}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: "none",
            cursor: "pointer",
            background: "transparent",
            color: "rgba(255, 255, 255, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <RotateCw size={13} />
          <span style={{ position: "absolute", bottom: 1, right: 2, fontSize: 7, opacity: 0.6, fontWeight: 700 }}>O</span>
        </button>

        {/* Undo */}
        <button
          type="button"
          onClick={undo}
          title="Undo stroke (Ctrl+Z)"
          style={{ width: 28, height: 28, borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Undo2 size={13} />
        </button>

        {/* Clear All */}
        <button
          type="button"
          onClick={clearAll}
          title="Clear screen annotations"
          style={{ width: 28, height: 28, borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Trash2 size={13} />
        </button>

        {/* Close Button */}
        <button
          type="button"
          onClick={closeOverlay}
          title="Close overlay (Esc)"
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: "none",
            cursor: "pointer",
            background: "rgba(239, 68, 68, 0.2)",
            color: "#ef4444",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <X size={13} />
          <span style={{ position: "absolute", bottom: 1, right: 2, fontSize: 7, opacity: 0.8, fontWeight: 700 }}>Esc</span>
        </button>
      </div>

      {/* Floating Feedback Toast */}
      {shareToast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(18, 18, 24, 0.95)",
            border: "1px solid rgba(212, 163, 89, 0.4)",
            borderRadius: 10,
            padding: "8px 16px",
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.6)",
            zIndex: 9999999,
            display: "flex",
            alignItems: "center",
            gap: 8,
            pointerEvents: "none",
          }}
        >
          <Check size={15} color="#22c55e" />
          <span>{shareToast}</span>
        </div>
      )}

      {/* Floating Share Modal Dialog in Overlay */}
      {showShareModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999998,
            pointerEvents: "auto",
          }}
          onClick={() => setShowShareModal(false)}
        >
          <div
            style={{
              width: 440,
              maxWidth: "92vw",
              background: "#18181b",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 14,
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.8)",
              padding: 20,
              color: "#f4f4f5",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Share2 size={16} color="var(--accent-primary, #d4a359)" />
                <span style={{ fontSize: 15, fontWeight: 600 }}>Share Whiteboard Room</span>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                style={{ background: "transparent", border: "none", color: "#a1a1aa", cursor: "pointer", padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#a1a1aa", lineHeight: 1.4 }}>
              Invite collaborators to join and annotate this canvas in real time.
            </p>

            {/* Link Input & Copy */}
            <div
              style={{
                display: "flex",
                gap: 8,
                background: "rgba(0,0,0,0.4)",
                padding: "6px 8px 6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <input
                readOnly
                value={getOverlayShareUrl()}
                style={{ background: "transparent", border: "none", color: "inherit", flex: 1, fontSize: 12, outline: "none" }}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(getOverlayShareUrl());
                  setCopiedShare(true);
                  setTimeout(() => setCopiedShare(false), 2000);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: copiedShare ? "#22c55e" : "var(--accent-primary, #d4a359)",
                  color: "#09090b",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {copiedShare ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedShare ? "Copied!" : "Copy"}</span>
              </button>
            </div>

            {/* Direct Email / Open Main Window Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const url = getOverlayShareUrl();
                  const subject = encodeURIComponent("Collaborate on Graffiti Whiteboard");
                  const body = encodeURIComponent(`Hi,\n\nI'd like to invite you to collaborate with me on Graffiti:\n${url}\n`);
                  window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
                }}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "9px 12px",
                  borderRadius: 8,
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <Mail size={14} />
                <span>Send by Mail</span>
              </button>

              <button
                type="button"
                onClick={handleSendToWhiteboard}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "9px 12px",
                  borderRadius: 8,
                  background: "var(--accent-primary, #d4a359)",
                  border: "none",
                  color: "#09090b",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <LayoutDashboard size={14} />
                <span>Open in Canvas</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
