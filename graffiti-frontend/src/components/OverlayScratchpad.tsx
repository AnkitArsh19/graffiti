import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { getStroke } from "perfect-freehand";
import {
  GripHorizontal,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  Trash2,
  Undo2,
  X,
  Grid,
  Copy,
  Check,
  Send,
  BookOpen,
  Download,
} from "lucide-react";
import { distanceToSegment } from "../lib/collision";
import { strokePaperGrid } from "../lib/canvasRenderer";
import { PENCIL_CURSOR, ERASER_CURSOR } from "../lib/cursors";
import type { PaperTemplate } from "../types";

export type OverlayTool = "pen" | "highlighter" | "arrow" | "rect" | "circle" | "line" | "eraser";

export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export interface Stroke {
  id: string;
  tool: OverlayTool;
  color: string;
  size: number;
  points: Point[];
}

export interface OverlayScratchpadProps {
  isOpen: boolean;
  onClose: () => void;
  activeTool: OverlayTool;
  activeColor: string;
  strokeSize: number;
  onSendToWhiteboard?: (strokes: Stroke[]) => void;
  onBoundsChange?: (bounds: { x: number; y: number; width: number; height: number } | null) => void;
}

function getSvgPath(stroke: number[][]): string {
  if (!stroke.length) return "";
  const d = stroke.reduce<string>((acc, [x0, y0], i, arr) => {
    const [x1, y1] = arr[(i + 1) % arr.length];
    return `${acc} Q ${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`;
  }, `M ${stroke[0][0]},${stroke[0][1]}`);
  return `${d} Z`;
}

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

  if (stroke.tool === "rect") {
    if (stroke.points.length < 2) return false;
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return x >= minX - tolerance && x <= maxX + tolerance && y >= minY - tolerance && y <= maxY + tolerance;
  }

  if (stroke.tool === "circle") {
    if (stroke.points.length < 2) return false;
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2 + tolerance;
    const ry = Math.abs(end.y - start.y) / 2 + tolerance;
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }

  if (stroke.tool === "arrow" || stroke.tool === "line") {
    if (stroke.points.length < 2) return false;
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    return distanceToSegment(pt, start, end) <= tolerance;
  }

  return false;
}

function renderPadStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  ctx.save();

  if (stroke.tool === "highlighter") {
    const outlinePoints = getStroke(stroke.points, {
      size: stroke.size * 2.8,
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
    if (stroke.points.length < 2) {
      ctx.restore();
      return;
    }
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
    ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (stroke.tool === "line") {
    if (stroke.points.length < 2) {
      ctx.restore();
      return;
    }
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
    if (stroke.points.length < 2) {
      ctx.restore();
      return;
    }
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
    if (stroke.points.length < 2) {
      ctx.restore();
      return;
    }
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

/**
 * Converts strokes from the scratchpad into Graffiti Canvas Elements for the Whiteboard/Notebook
 */
export function convertStrokesToCanvasElements(padStrokes: Stroke[]) {
  return padStrokes.map((s, idx) => {
    const elId = `imported_pad_${Date.now()}_${idx}`;
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
}

/**
 * Saves strokes directly as a new page in the user's notebook
 */
export function savePadToNotebook(padStrokes: Stroke[], template: PaperTemplate): boolean {
  if (padStrokes.length === 0) return false;
  try {
    const raw = localStorage.getItem("graffiti:notebook:v3");
    const notebook = raw ? JSON.parse(raw) : { pages: [], activePageId: "" };
    const elements = convertStrokesToCanvasElements(padStrokes);
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const newPage = {
      id: "page_pad_" + Date.now(),
      title: `Canvas Pad (${timeStr})`,
      template,
      elements,
    };
    const updatedPages = [...(notebook.pages || []), newPage];
    const updatedNotebook = {
      pages: updatedPages,
      activePageId: newPage.id,
    };
    localStorage.setItem("graffiti:notebook:v3", JSON.stringify(updatedNotebook));
    window.dispatchEvent(new Event("storage"));
    return true;
  } catch (err) {
    console.error("Failed to save pad to notebook:", err);
    return false;
  }
}

/**
 * Inserts strokes into the active Whiteboard Canvas
 */
export function insertPadIntoActiveCanvas(padStrokes: Stroke[]): boolean {
  if (padStrokes.length === 0) return false;
  try {
    const elements = convertStrokesToCanvasElements(padStrokes);
    localStorage.setItem("graffiti:overlay_imported_elements", JSON.stringify(elements));
    window.dispatchEvent(new Event("storage"));
    return true;
  } catch (err) {
    console.error("Failed to insert pad into active canvas:", err);
    return false;
  }
}

export function OverlayScratchpad({
  isOpen,
  onClose,
  activeTool,
  activeColor,
  strokeSize,
  onSendToWhiteboard,
  onBoundsChange,
}: OverlayScratchpadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Position & size state
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem("graffiti:overlay_pad_pos");
      if (saved) return JSON.parse(saved);
    } catch { }
    return {
      x: Math.max(24, typeof window !== "undefined" ? window.innerWidth - 560 : 600),
      y: Math.max(24, typeof window !== "undefined" ? window.innerHeight - 440 : 300),
    };
  });

  const [size, setSize] = useState<{ width: number; height: number }>(() => {
    try {
      const saved = localStorage.getItem("graffiti:overlay_pad_size");
      if (saved) return JSON.parse(saved);
    } catch { }
    return { width: 520, height: 380 };
  });

  // Collapsed state
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("graffiti:overlay_pad_collapsed") === "true";
    } catch {
      return false;
    }
  });

  // Canvas theme: white or black (synced with main app theme)
  const [padTheme, setPadTheme] = useState<"white" | "black">(() => {
    try {
      const savedPad = localStorage.getItem("graffiti:overlay_pad_theme");
      if (savedPad === "white" || savedPad === "black") return savedPad;

      const appTheme = localStorage.getItem("graffiti:theme:v3");
      if (appTheme === "light") return "white";
      if (appTheme === "dark") return "black";

      return typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light"
        ? "white"
        : "black";
    } catch {
      return "black";
    }
  });

  // Paper template borrowed directly from desktop app
  const [template, setTemplate] = useState<PaperTemplate>(() => {
    try {
      const saved = (localStorage.getItem("graffiti:overlay_pad_template") as PaperTemplate) || "grid";
      return saved;
    } catch {
      return "grid";
    }
  });

  // Strokes inside the dedicated canvas pad
  const [strokes, setStrokes] = useState<Stroke[]>(() => {
    try {
      const saved = localStorage.getItem("graffiti:overlay_pad_strokes");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [undoStack, setUndoStack] = useState<Stroke[][]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Dragging & resizing refs
  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialPosX: number;
    initialPosY: number;
  } | null>(null);

  const resizeRef = useRef<{
    corner: "nw" | "ne" | "se" | "sw";
    startX: number;
    startY: number;
    initialWidth: number;
    initialHeight: number;
    initialPosX: number;
    initialPosY: number;
  } | null>(null);

  // Persist state changes
  useEffect(() => {
    try {
      localStorage.setItem("graffiti:overlay_pad_pos", JSON.stringify(pos));
    } catch { }
  }, [pos]);

  useEffect(() => {
    try {
      localStorage.setItem("graffiti:overlay_pad_size", JSON.stringify(size));
    } catch { }
  }, [size]);

  useEffect(() => {
    try {
      localStorage.setItem("graffiti:overlay_pad_collapsed", String(isCollapsed));
    } catch { }
  }, [isCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem("graffiti:overlay_pad_theme", padTheme);
      const targetAppTheme = padTheme === "white" ? "light" : "dark";
      localStorage.setItem("graffiti:theme:v3", targetAppTheme);
      document.documentElement.setAttribute("data-theme", targetAppTheme);
    } catch { }
  }, [padTheme]);

  useEffect(() => {
    try {
      localStorage.setItem("graffiti:overlay_pad_template", template);
    } catch { }
  }, [template]);

  useEffect(() => {
    try {
      localStorage.setItem("graffiti:overlay_pad_strokes", JSON.stringify(strokes));
    } catch { }
  }, [strokes]);

  // Report bounds to parent for Tauri passthrough tracking
  useEffect(() => {
    if (!isOpen) {
      onBoundsChange?.(null);
      return;
    }
    const currentHeight = isCollapsed ? 42 : size.height;
    onBoundsChange?.({
      x: pos.x,
      y: pos.y,
      width: size.width,
      height: currentHeight,
    });
  }, [isOpen, pos, size, isCollapsed, onBoundsChange]);

  // Redraw pad canvas borrowing desktop app's exact strokePaperGrid
  const redraw = useCallback(
    (allStrokes: Stroke[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // 1. Solid background
      ctx.fillStyle = padTheme === "white" ? "#ffffff" : "#121316";
      ctx.fillRect(0, 0, width, height);

      // 2. Paper grid renderer
      strokePaperGrid(
        ctx,
        template,
        0,
        0,
        1,
        padTheme === "black" ? "dark" : "light",
        width,
        height
      );

      // 3. Render strokes
      for (const stroke of allStrokes) {
        renderPadStroke(ctx, stroke);
      }
      ctx.restore();
    },
    [padTheme, template]
  );

  // Resize canvas backing store when size or DPR changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isCollapsed) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = size.width;
    const canvasHeight = Math.max(80, size.height - 42);

    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    redraw(strokes);
}, [size.width, size.height, isCollapsed, redraw, strokes]);

// Compute contrast-safe stroke color
const getContrastAdjustedColor = useCallback(
  (color: string) => {
    if (padTheme === "white") {
      if (color.toLowerCase() === "#ffffff" || color.toLowerCase() === "#fff") {
        return "#0f172a";
      }
    } else {
      if (color.toLowerCase() === "#09090b" || color.toLowerCase() === "#000000") {
        return "#f8fafc";
      }
    }
    return color;
  },
  [padTheme]
);

// Erase strokes on pad
const eraseStrokesAtPoint = useCallback((x: number, y: number) => {
  setStrokes((prev) => {
    const remaining = prev.filter((s) => !isPointInStroke(s, x, y));
    if (remaining.length !== prev.length) {
      setUndoStack((u) => [...u, prev]);
    }
    return remaining;
  });
}, []);

// Pointer Down on Pad Canvas
const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
  e.stopPropagation();
  if (e.button !== 0) return;

  const canvas = canvasRef.current;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (activeTool === "eraser") {
    eraseStrokesAtPoint(x, y);
    setIsDrawing(true);
    return;
  }

  const strokeColor = getContrastAdjustedColor(activeColor);
  const newStroke: Stroke = {
    id: "pad_" + Math.random().toString(36).substring(2, 9),
    tool: activeTool,
    color: strokeColor,
    size: strokeSize,
    points: [{ x, y, pressure: e.pressure || 0.5 }],
  };

  currentStrokeRef.current = newStroke;
  setIsDrawing(true);
  setUndoStack((u) => [...u, strokes]);
};

// Pointer Move on Pad Canvas
const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
  e.stopPropagation();
  if (!isDrawing) return;

  const canvas = canvasRef.current;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (activeTool === "eraser") {
    eraseStrokesAtPoint(x, y);
    return;
  }

  const current = currentStrokeRef.current;
  if (!current) return;

  if (current.tool === "pen" || current.tool === "highlighter") {
    current.points.push({ x, y, pressure: e.pressure || 0.5 });
  } else {
    if (current.points.length === 1) {
      current.points.push({ x, y, pressure: e.pressure || 0.5 });
    } else {
      current.points[current.points.length - 1] = { x, y, pressure: e.pressure || 0.5 };
    }
  }

  redraw([...strokes, current]);
};

// Pointer Up on Pad Canvas
const handlePointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
  e.stopPropagation();
  if (!isDrawing) return;
  setIsDrawing(false);

  if (activeTool === "eraser") return;

  const current = currentStrokeRef.current;
  if (!current || current.points.length === 0) return;

  let finalPoints = current.points;
  if ((current.tool === "pen" || current.tool === "highlighter") && current.points.length >= 3) {
    finalPoints = smoothPoints(current.points);
  }

  const finished: Stroke = { ...current, points: finalPoints };
  currentStrokeRef.current = null;
  setStrokes((prev) => {
    const next = [...prev, finished];
    redraw(next);
    return next;
  });
};

// Dragging Pad Logic
const handleHeaderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
  if (e.button !== 0) return;
  if ((e.target as HTMLElement).closest("button")) return;

  e.preventDefault();
  e.stopPropagation();

  setIsDragging(true);
  dragRef.current = {
    startX: e.clientX,
    startY: e.clientY,
    initialPosX: pos.x,
    initialPosY: pos.y,
  };

  const handlePointerMoveWindow = (moveEvent: PointerEvent) => {
    if (!dragRef.current) return;
    const dx = moveEvent.clientX - dragRef.current.startX;
    const dy = moveEvent.clientY - dragRef.current.startY;

    const nextX = Math.max(8, Math.min(window.innerWidth - 80, dragRef.current.initialPosX + dx));
    const nextY = Math.max(8, Math.min(window.innerHeight - 42, dragRef.current.initialPosY + dy));

    setPos({ x: Math.round(nextX), y: Math.round(nextY) });
  };

  const handlePointerUpWindow = () => {
    dragRef.current = null;
    setIsDragging(false);
    window.removeEventListener("pointermove", handlePointerMoveWindow);
    window.removeEventListener("pointerup", handlePointerUpWindow);
  };

  window.addEventListener("pointermove", handlePointerMoveWindow);
  window.addEventListener("pointerup", handlePointerUpWindow);
};

  // =========================================================================
  // iPad Stage Manager Style 4-Corner Curved Resizing with Pointer Capture
  // Resizing works bi-directionally (horizontally and vertically) from all 4 corners
  // Leaving/releasing locks the window firmly in place with zero jumping or drift
  // =========================================================================
  const handleCornerPointerDown = (
  e: ReactPointerEvent<HTMLDivElement>,
  corner: "nw" | "ne" | "se" | "sw"
) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { }

    setIsResizing(true);
    resizeRef.current = {
      corner,
      startX: e.clientX,
      startY: e.clientY,
      initialWidth: size.width,
      initialHeight: size.height,
      initialPosX: pos.x,
      initialPosY: pos.y,
    };
  };

const handleCornerPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
  if (!resizeRef.current) return;
  e.preventDefault();
  e.stopPropagation();

  const dx = e.clientX - resizeRef.current.startX;
  const dy = e.clientY - resizeRef.current.startY;
  const { corner, initialWidth, initialHeight, initialPosX, initialPosY } = resizeRef.current;

  const minW = 280;
  const minH = 180;
  const maxW = Math.max(minW, window.innerWidth - 32);
  const maxH = Math.max(minH, window.innerHeight - 32);

    let nextW = initialWidth;
    let nextH = initialHeight;
    let nextX = initialPosX;
    let nextY = initialPosY;

    // Bottom-Right Corner (se): expands right and downward
    if (corner === "se") {
      nextW = Math.max(minW, Math.min(maxW, initialWidth + dx));
      nextH = Math.max(minH, Math.min(maxH, initialHeight + dy));
      nextX = initialPosX;
      nextY = initialPosY;
    }
    // Bottom-Left Corner (sw): expands left and downward
    else if (corner === "sw") {
      const clampedW = Math.max(minW, Math.min(maxW, initialWidth - dx));
      nextW = clampedW;
      nextH = Math.max(minH, Math.min(maxH, initialHeight + dy));
      nextX = initialPosX + (initialWidth - clampedW);
      nextY = initialPosY;
    }
    // Top-Right Corner (ne): expands right and upward
    else if (corner === "ne") {
      const clampedH = Math.max(minH, Math.min(maxH, initialHeight - dy));
      nextW = Math.max(minW, Math.min(maxW, initialWidth + dx));
      nextH = clampedH;
      nextX = initialPosX;
      nextY = initialPosY + (initialHeight - clampedH);
    }
    // Top-Left Corner (nw): expands left and upward
    else if (corner === "nw") {
      const clampedW = Math.max(minW, Math.min(maxW, initialWidth - dx));
      const clampedH = Math.max(minH, Math.min(maxH, initialHeight - dy));
      nextW = clampedW;
      nextH = clampedH;
      nextX = initialPosX + (initialWidth - clampedW);
      nextY = initialPosY + (initialHeight - clampedH);
    }

    // Keep within screen
    nextX = Math.max(8, Math.min(window.innerWidth - 80, nextX));
    nextY = Math.max(8, Math.min(window.innerHeight - 80, nextY));

  setSize({ width: Math.round(nextW), height: Math.round(nextH) });
  setPos({ x: Math.round(nextX), y: Math.round(nextY) });
};

const handleCornerPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
  if (!resizeRef.current) return;
  e.preventDefault();
  e.stopPropagation();

  try {
    e.currentTarget.releasePointerCapture(e.pointerId);
  } catch { }

  resizeRef.current = null;
  setIsResizing(false);
};

// Undo
const handleUndo = () => {
  if (undoStack.length === 0) return;
  const previous = undoStack[undoStack.length - 1];
  setUndoStack((u) => u.slice(0, -1));
  setStrokes(previous);
  redraw(previous);
};

// Clear Pad
const handleClear = () => {
  if (strokes.length === 0) return;
  setUndoStack((u) => [...u, strokes]);
  setStrokes([]);
  redraw([]);
};

const triggerToast = (msg: string) => {
  setToastMessage(msg);
  setTimeout(() => setToastMessage(null), 2400);
};

// Copy Image to Clipboard
const handleCopyImage = async () => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  try {
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      triggerToast("Copied PNG to clipboard!");
    });
} catch {
  triggerToast("Clipboard copy failed");
}
  };

// Save to Notebook
const handleSaveToNotebook = () => {
  if (strokes.length === 0) {
    triggerToast("Canvas Pad is empty");
    return;
  }
  const success = savePadToNotebook(strokes, template);
  if (success) {
    triggerToast("Saved as new Notebook Page!");
  } else {
    triggerToast("Failed to save to notebook");
  }
};

// Insert to active Whiteboard Canvas
const handleInsertToCanvas = () => {
  if (strokes.length === 0) {
    triggerToast("Canvas Pad is empty");
    return;
  }
  const success = insertPadIntoActiveCanvas(strokes);
  if (onSendToWhiteboard) {
    onSendToWhiteboard(strokes);
  }
  if (success) {
    triggerToast("Inserted into Whiteboard Canvas!");
  }
};

// Download image
const handleDownloadImage = () => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  try {
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `graffiti-pad-${Date.now()}.png`;
    link.href = url;
    link.click();
    triggerToast("Exported PNG image!");
  } catch {
    triggerToast("Export failed");
  }
};

// Cycle Template through Desktop App Presets
const handleCycleTemplate = () => {
  const sequence: PaperTemplate[] = ["blank", "grid", "ruled", "dotted", "cornell"];
  const nextIdx = (sequence.indexOf(template) + 1) % sequence.length;
  setTemplate(sequence[nextIdx]);
};

const isLight = padTheme === "white";

return (
  <div
    ref={containerRef}
    style={{
      position: "fixed",
      left: pos.x,
      top: pos.y,
      width: size.width,
      height: isCollapsed ? 42 : size.height,
      borderRadius: 18,
      background: isLight ? "#ffffff" : "#121316",
      border: isLight ? "1px solid #cbd5e1" : "1px solid #27272a",
      boxShadow: isLight
        ? "0 22px 50px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.06)"
        : "0 24px 55px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.14)",
      display: "flex",
      flexDirection: "column",
      overflow: "visible",
      zIndex: 999990,
      userSelect: "none",
      fontFamily: '"Montserrat", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      opacity: isOpen ? 1 : 0,
      transform: isOpen ? "scale(1)" : "scale(0.92) translateY(8px)",
      pointerEvents: isOpen ? "auto" : "none",
      transition:
        isResizing || isDragging || isDrawing
          ? "none"
          : "opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), height 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
    }}
  >
    {/* --- HEADER BAR (Draggable) --- */}
    <div
      onPointerDown={handleHeaderPointerDown}
      onDoubleClick={() => setIsCollapsed((c) => !c)}
      style={{
        height: 42,
        minHeight: 42,
        background: isLight ? "#f8fafc" : "#18181b",
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: isCollapsed ? 18 : 0,
        borderBottomRightRadius: isCollapsed ? 18 : 0,
        borderBottom: isCollapsed ? "none" : isLight ? "1px solid #e2e8f0" : "1px solid #27272a",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        cursor: isDragging ? "grabbing" : "grab",
        color: isLight ? "#0f172a" : "#f1f5f9",
        userSelect: "none",
      }}
    >
      {/* Left: Grip & Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <GripHorizontal size={14} style={{ opacity: 0.5, cursor: "grab" }} />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>
          Canvas Pad
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 10,
            background: isLight ? "#e2e8f0" : "#27272a",
            color: isLight ? "#334155" : "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {padTheme}
        </span>
        {strokes.length > 0 && (
          <span
            style={{
              fontSize: 11,
              color: isLight ? "#64748b" : "#94a3b8",
              fontWeight: 600,
            }}
          >
            ({strokes.length})
          </span>
        )}
      </div>

        {/* Right: Controls & Actions with Instant Tooltips */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Theme Switcher: Whiteboard <-> Blackboard (Carries across app) */}
          <div className="overlay-tooltip-container" data-placement="bottom">
            <button
              type="button"
              onClick={() => setPadTheme((t) => (t === "white" ? "black" : "white"))}
              style={{
                width: 27,
                height: 27,
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                background: isLight ? "#e2e8f0" : "#27272a",
                color: isLight ? "#0f172a" : "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {padTheme === "white" ? <Moon size={13} /> : <Sun size={13} />}
            </button>
            <span className="overlay-tooltip">
              {padTheme === "white" ? "Switch to Blackboard" : "Switch to Whiteboard"}
            </span>
          </div>

          {!isCollapsed && (
            <>
              {/* Paper Template Switcher (Desktop app authentic presets) */}
              <div className="overlay-tooltip-container" data-placement="bottom">
                <button
                  type="button"
                  onClick={handleCycleTemplate}
                  style={{
                    width: 27,
                    height: 27,
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    background: isLight ? "#e2e8f0" : "#27272a",
                    color: isLight ? "#0f172a" : "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Grid size={13} />
                </button>
                <span className="overlay-tooltip">
                  Paper: {template.toUpperCase()}
                </span>
              </div>

              {/* Undo */}
              <div className="overlay-tooltip-container" data-placement="bottom">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  style={{
                    width: 27,
                    height: 27,
                    borderRadius: 6,
                    border: "none",
                    cursor: undoStack.length > 0 ? "pointer" : "default",
                    opacity: undoStack.length > 0 ? 1 : 0.4,
                    background: isLight ? "#e2e8f0" : "#27272a",
                    color: isLight ? "#0f172a" : "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Undo2 size={13} />
                </button>
                <span className="overlay-tooltip">Undo Stroke</span>
              </div>

              {/* Copy Image to Clipboard */}
              <div className="overlay-tooltip-container" data-placement="bottom">
                <button
                  type="button"
                  onClick={handleCopyImage}
                  style={{
                    width: 27,
                    height: 27,
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    background: isLight ? "#e2e8f0" : "#27272a",
                    color: isLight ? "#0f172a" : "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Copy size={13} />
                </button>
                <span className="overlay-tooltip">Copy PNG to Clipboard</span>
              </div>

                {/* Save Directly to Notebook as New Page */ }
                < div className="overlay-tooltip-container" data-placement="bottom">
              <button
                type="button"
                onClick={handleSaveToNotebook}
                disabled={strokes.length === 0}
                style={{
                  width: 27,
                  height: 27,
                  borderRadius: 6,
                  border: "none",
                  cursor: strokes.length > 0 ? "pointer" : "default",
                  opacity: strokes.length > 0 ? 1 : 0.4,
                  background: "rgba(212, 163, 89, 0.2)",
                  color: "var(--accent-primary, #d4a359)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BookOpen size={13} />
              </button>
              <span className="overlay-tooltip">Save as new Notebook Page</span>
            </div>

          {/* Insert / Send to Main Desktop Whiteboard Canvas */}
          <div className="overlay-tooltip-container" data-placement="bottom">
            <button
              type="button"
              onClick={handleInsertToCanvas}
              disabled={strokes.length === 0}
              style={{
                width: 27,
                height: 27,
                borderRadius: 6,
                border: "none",
                cursor: strokes.length > 0 ? "pointer" : "default",
                opacity: strokes.length > 0 ? 1 : 0.4,
                background: "rgba(34, 197, 94, 0.2)",
                color: "#22c55e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Send size={13} />
            </button>
            <span className="overlay-tooltip">Insert into Whiteboard Canvas</span>
          </div>

          {/* Download / Export PNG */}
          <div className="overlay-tooltip-container" data-placement="bottom">
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={strokes.length === 0}
              style={{
                width: 27,
                height: 27,
                borderRadius: 6,
                border: "none",
                cursor: strokes.length > 0 ? "pointer" : "default",
                opacity: strokes.length > 0 ? 1 : 0.4,
                background: isLight ? "#e2e8f0" : "#27272a",
                color: isLight ? "#0f172a" : "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Download size={13} />
            </button>
            <span className="overlay-tooltip">Download PNG Image</span>
          </div>

          {/* Clear Pad */}
          <div className="overlay-tooltip-container" data-placement="bottom">
            <button
              type="button"
              onClick={handleClear}
              disabled={strokes.length === 0}
              style={{
                width: 27,
                height: 27,
                borderRadius: 6,
                border: "none",
                cursor: strokes.length > 0 ? "pointer" : "default",
                opacity: strokes.length > 0 ? 1 : 0.4,
                background: isLight ? "#fee2e2" : "rgba(239, 68, 68, 0.2)",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Trash2 size={13} />
            </button>
            <span className="overlay-tooltip">Clear Pad Canvas</span>
          </div>
        </>
          )}

        {/* Collapse / Expand */}
        <div className="overlay-tooltip-container" data-placement="bottom">
          <button
            type="button"
            onClick={() => setIsCollapsed((c) => !c)}
            style={{
              width: 27,
              height: 27,
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: isLight ? "#e2e8f0" : "#27272a",
              color: isLight ? "#0f172a" : "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
          <span className="overlay-tooltip">
            {isCollapsed ? "Expand Canvas Pad" : "Collapse into compact pill"}
          </span>
        </div>

        {/* Close */}
        <div className="overlay-tooltip-container" data-placement="bottom">
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 27,
              height: 27,
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: "transparent",
              color: isLight ? "#64748b" : "#94a3b8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={14} />
          </button>
          <span className="overlay-tooltip">Close Pad (N)</span>
        </div>
      </div>
    </div>

    {/* --- DEDICATED CANVAS BODY --- */}
    {!isCollapsed && (
      <div
        style={{
          position: "relative",
          flex: 1,
          width: "100%",
          height: "calc(100% - 42px)",
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
          overflow: "hidden",
          cursor: activeTool === "eraser" ? ERASER_CURSOR : PENCIL_CURSOR,
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            touchAction: "none",
            cursor: activeTool === "eraser" ? ERASER_CURSOR : PENCIL_CURSOR,
          }}
        />

        {/* Toast feedback */}
          { toastMessage && (
            <div
              style={{
                position: "absolute",
                bottom: 16,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(18, 18, 24, 0.96)",
                border: "1px solid rgba(212, 163, 89, 0.5)",
                color: "#ffffff",
                padding: "6px 16px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                pointerEvents: "none",
                boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                zIndex: 50,
                animation: "fadeInDown 140ms ease",
              }}
            >
              <Check size={14} color="#22c55e" />
              <span>{toastMessage}</span>
            </div>
          )}
      </div>
    )}

    {/* ===================================================================== */}
    {/* IPAD STAGE MANAGER STYLE CURVED CORNER ARC RESIZE HANDLES             */}
    {/* Authentic sleek concentric quarter arcs at all 4 corners              */}
    {/* Bi-directional horizontal & vertical resize with pointer capture      */}
    {/* ===================================================================== */}
    {!isCollapsed && (
      <>
        {/* 1. BOTTOM-RIGHT CORNER (se-resize) */}
        <div
          onPointerDown={(e) => handleCornerPointerDown(e, "se")}
          onPointerMove={handleCornerPointerMove}
          onPointerUp={handleCornerPointerUp}
          onPointerCancel={handleCornerPointerUp}
          style={{
            position: "absolute",
            right: -3,
            bottom: -3,
            cursor: "nwse-resize",
            color: isLight ? "#334155" : "#ffffff",
          }}
          className="scratchpad-ipad-arc-handle"
        >
            <svg width="28" height="28" viewBox="0 0 28 28">
              <path
                d="M 6 24 A 18 18 0 0 0 24 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                opacity="0.88"
              />
            </svg>
        </div>

        {/* 2. BOTTOM-LEFT CORNER (sw-resize) */}
        <div
          onPointerDown={(e) => handleCornerPointerDown(e, "sw")}
          onPointerMove={handleCornerPointerMove}
          onPointerUp={handleCornerPointerUp}
          onPointerCancel={handleCornerPointerUp}
          style={{
            position: "absolute",
            left: -3,
            bottom: -3,
            cursor: "nesw-resize",
            color: isLight ? "#334155" : "#ffffff",
          }}
          className="scratchpad-ipad-arc-handle"
        >
            <svg width="28" height="28" viewBox="0 0 28 28">
              <path
                d="M 22 24 A 18 18 0 0 1 4 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                opacity="0.88"
              />
            </svg>
        </div>

        {/* 3. TOP-RIGHT CORNER (ne-resize) */}
        <div
          onPointerDown={(e) => handleCornerPointerDown(e, "ne")}
          onPointerMove={handleCornerPointerMove}
          onPointerUp={handleCornerPointerUp}
          onPointerCancel={handleCornerPointerUp}
          style={{
            position: "absolute",
            right: -3,
            top: -3,
            cursor: "nesw-resize",
            color: isLight ? "#334155" : "#ffffff",
          }}
          className="scratchpad-ipad-arc-handle"
        >
            <svg width="28" height="28" viewBox="0 0 28 28">
              <path
                d="M 6 4 A 18 18 0 0 1 24 22"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                opacity="0.88"
              />
            </svg>
        </div>

        {/* 4. TOP-LEFT CORNER (nw-resize) */}
        <div
          onPointerDown={(e) => handleCornerPointerDown(e, "nw")}
          onPointerMove={handleCornerPointerMove}
          onPointerUp={handleCornerPointerUp}
          onPointerCancel={handleCornerPointerUp}
          style={{
            position: "absolute",
            left: -3,
            top: -3,
            cursor: "nwse-resize",
            color: isLight ? "#334155" : "#ffffff",
          }}
          className="scratchpad-ipad-arc-handle"
        >
            <svg width="28" height="28" viewBox="0 0 28 28">
              <path
                d="M 22 4 A 18 18 0 0 0 4 22"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                opacity="0.88"
              />
            </svg>
        </div>
  </>
)}
    </div >
  );
}
