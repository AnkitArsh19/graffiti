import React, { useCallback, useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Highlighter,
  Minus,
  Pen,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
  Loader2,
  Square,
  Circle as CircleIcon,
  MoveRight,
  Type,
  StickyNote,
  Cloud,
  Maximize2,
  MoveHorizontal,
  Palette,
  Check,
  SlidersHorizontal,
  Minimize2,
  Hand,
  MousePointer2,
  Diamond,
  LayoutDashboard,
  Share2,
} from "lucide-react";
import {
  loadDocument,
  type DocumentFileType,
  type DocumentPage,
} from "../lib/documentLoader";
import { distanceToSegment } from "../lib/collision";
import {
  exportToAnnotatedPdf,
  exportToImages,
  exportToAnnotatedPptx,
  type AnnotatedExportPage,
} from "../lib/documentExporter";
import { GoogleDriveExportModal } from "./GoogleDriveExportModal";
import { Toolbar } from "./Toolbar";
import { Inspector } from "./Inspector";
import type {
  ToolId,
  DockPosition,
  ElementStyle,
  StrokeStyle,
  FillStyle,
  Roundness,
  FontFamily,
  FontSize,
  TextAlign,
  CanvasElement,
  ElementType,
  Arrowhead,
} from "../types";

export type DocumentToolId =
  | "select"
  | "hand"
  | "pen"
  | "highlighter"
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "arrow"
  | "line"
  | "text"
  | "sticky"
  | "eraser";

interface Point {
  x: number;
  y: number;
  pressure: number;
}

export interface DocumentAnnotation {
  id: string;
  tool: DocumentToolId;
  color: string;
  fill?: string;
  size: number;
  strokeStyle?: StrokeStyle;
  fillStyle?: FillStyle;
  roundness?: Roundness;
  opacity?: number;
  startArrowhead?: Arrowhead;
  endArrowhead?: Arrowhead;
  fontSize?: number;
  fontFamily?: FontFamily;
  textAlign?: TextAlign;
  points?: Point[]; // for pen & highlighter
  x?: number; // for shapes, text, sticky
  y?: number;
  width?: number;
  height?: number;
  endX?: number; // for arrow & line
  endY?: number;
  text?: string; // for text & sticky
}

const QUICK_COLORS = [
  { label: "Black", value: "#09090b" },
  { label: "White", value: "#ffffff" },
  { label: "Gold Accent", value: "#d4a359" },
  { label: "Red", value: "#ef4444" },
  { label: "Green", value: "#22c55e" },
  { label: "Zinc Grey", value: "#71717a" },
];

const STROKE_SIZES = [
  { label: "Thin", value: 2 },
  { label: "Medium", value: 4 },
  { label: "Thick", value: 8 },
  { label: "Bold", value: 14 },
];

function getSvgPath(stroke: number[][]): string {
  if (!stroke.length) return "";
  const d = stroke.reduce<string>((acc, [x0, y0], i, arr) => {
    const [x1, y1] = arr[(i + 1) % arr.length];
    return `${acc} Q ${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`;
  }, `M ${stroke[0][0]},${stroke[0][1]}`);
  return `${d} Z`;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) || 250;
  const g = parseInt(clean.substring(2, 4), 16) || 204;
  const b = parseInt(clean.substring(4, 6), 16) || 21;
  return `rgba(${r},${g},${b},${alpha})`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const paragraphs = text.split("\n");
  let currentY = y;

  for (const para of paragraphs) {
    const words = para.split(" ");
    let line = "";
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + " ";
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
    currentY += lineHeight;
  }
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number,
  color: string
) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);
  const headLen = Math.max(12, size * 3.2);

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLen * Math.cos(angle - Math.PI / 6),
    toY - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - headLen * Math.cos(angle + Math.PI / 6),
    toY - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const rx = w < 0 ? x + w : x;
  const ry = h < 0 ? y + h : y;
  const rw = Math.abs(w);
  const rh = Math.abs(h);
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;

  ctx.beginPath();
  ctx.moveTo(cx, ry);
  ctx.lineTo(rx + rw, cy);
  ctx.lineTo(cx, ry + rh);
  ctx.lineTo(rx, cy);
  ctx.closePath();
}

function getAnnotationBounds(ann: DocumentAnnotation): { minX: number; minY: number; maxX: number; maxY: number } {
  if (ann.points && ann.points.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of ann.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = (ann.size || 4) + 6;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }
  if (ann.x !== undefined && ann.endX !== undefined && ann.y !== undefined && ann.endY !== undefined) {
    const minX = Math.min(ann.x, ann.endX) - 8;
    const maxX = Math.max(ann.x, ann.endX) + 8;
    const minY = Math.min(ann.y, ann.endY) - 8;
    const maxY = Math.max(ann.y, ann.endY) + 8;
    return { minX, minY, maxX, maxY };
  }
  if (ann.x !== undefined && ann.y !== undefined) {
    const w = ann.width || (ann.tool === "sticky" ? 180 : 160);
    const h = ann.height || (ann.tool === "sticky" ? 130 : 60);
    const minX = Math.min(ann.x, ann.x + w) - 6;
    const maxX = Math.max(ann.x, ann.x + w) + 6;
    const minY = Math.min(ann.y, ann.y + h) - 6;
    const maxY = Math.max(ann.y, ann.y + h) + 6;
    return { minX, minY, maxX, maxY };
  }
  return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
}

function drawSelectionBox(ctx: CanvasRenderingContext2D, ann: DocumentAnnotation) {
  const b = getAnnotationBounds(ann);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "#d4a359";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(b.minX, b.minY, w, h);

  // Accent Corner handles
  ctx.setLineDash([]);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#d4a359";
  ctx.lineWidth = 1.5;
  const handleSize = 6;
  const corners = [
    [b.minX, b.minY],
    [b.maxX, b.minY],
    [b.minX, b.maxY],
    [b.maxX, b.maxY],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
  }
  ctx.restore();
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

function isPointInAnnotation(ann: DocumentAnnotation, x: number, y: number): boolean {
  if (ann.points && ann.points.length > 0) {
    const thresh = Math.max(12, (ann.size || 4) + 8);
    const pt = { x, y };
    if (ann.points.length === 1) {
      return Math.hypot(ann.points[0].x - x, ann.points[0].y - y) <= thresh;
    }
    for (let i = 1; i < ann.points.length; i++) {
      if (distanceToSegment(pt, ann.points[i - 1], ann.points[i]) <= thresh) {
        return true;
      }
    }
    return false;
  }
  if (ann.x !== undefined && ann.endX !== undefined && ann.y !== undefined && ann.endY !== undefined) {
    const pt = { x, y };
    const p0 = { x: ann.x, y: ann.y };
    const p1 = { x: ann.endX, y: ann.endY };
    return distanceToSegment(pt, p0, p1) <= Math.max(12, (ann.size || 4) + 6);
  }
  if (ann.x !== undefined && ann.y !== undefined) {
    const w = ann.width || (ann.tool === "sticky" ? 180 : 160);
    const h = ann.height || (ann.tool === "sticky" ? 130 : 60);
    const minX = Math.min(ann.x, ann.x + w);
    const maxX = Math.max(ann.x, ann.x + w);
    const minY = Math.min(ann.y, ann.y + h);
    const maxY = Math.max(ann.y, ann.y + h);
    return x >= minX - 8 && x <= maxX + 8 && y >= minY - 8 && y <= maxY + 8;
  }
  return false;
}

function annotationToCanvasElement(ann: DocumentAnnotation): CanvasElement {
  const typeMap: Record<string, ElementType> = {
    pen: "pen",
    highlighter: "pen",
    rectangle: "rectangle",
    ellipse: "ellipse",
    diamond: "diamond",
    line: "line",
    arrow: "arrow",
    text: "text",
    sticky: "sticky",
  };

  const elementType: ElementType = typeMap[ann.tool] || "rectangle";
  const w = ann.width ?? (ann.endX !== undefined && ann.x !== undefined ? ann.endX - ann.x : 100);
  const h = ann.height ?? (ann.endY !== undefined && ann.y !== undefined ? ann.endY - ann.y : 100);

  return {
    id: ann.id,
    pageId: "doc_page",
    type: elementType,
    x: ann.x ?? 0,
    y: ann.y ?? 0,
    width: w,
    height: h,
    points: ann.points,
    strokeColor: ann.color || "#d4a359",
    backgroundColor: ann.fill || "transparent",
    strokeWidth: ann.size || 3,
    strokeStyle: ann.strokeStyle || "solid",
    fillStyle: ann.fillStyle || "solid",
    roughness: 0,
    roundness: ann.roundness || "sharp",
    arrowType: "straight",
    startArrowhead: ann.startArrowhead || "none",
    endArrowhead: ann.endArrowhead || (ann.tool === "arrow" ? "arrow" : "none"),
    opacity: ann.opacity ?? 100,
    fontSize: ann.fontSize ? (ann.fontSize <= 14 ? "small" : ann.fontSize <= 18 ? "medium" : ann.fontSize <= 24 ? "large" : "xlarge") : "medium",
    customFontSize: ann.fontSize,
    fontFamily: ann.fontFamily || "clean",
    textAlign: ann.textAlign || "left",
    text: ann.text,
    seed: 1,
  };
}

function renderAnnotation(
  ctx: CanvasRenderingContext2D,
  ann: DocumentAnnotation,
  isSelected: boolean = false
) {
  ctx.save();

  // Opacity
  if (ann.opacity !== undefined && ann.opacity !== 100) {
    ctx.globalAlpha = Math.max(0.05, Math.min(1, ann.opacity / 100));
  }

  // Stroke Style
  if (ann.strokeStyle === "dashed") {
    ctx.setLineDash([Math.max(6, ann.size * 2.5), Math.max(4, ann.size * 1.5)]);
  } else if (ann.strokeStyle === "dotted") {
    ctx.setLineDash([Math.max(2, ann.size), Math.max(3, ann.size * 1.2)]);
  } else {
    ctx.setLineDash([]);
  }

  const getFillColor = (fill?: string, style?: FillStyle, strokeColor?: string) => {
    if (!fill || fill === "transparent" || fill === "none" || style === "transparent") return null;
    if (style === "semi") return hexToRgba(fill, 0.25);
    if (style === "hachure" || style === "cross-hatch") return hexToRgba(fill, 0.4);
    return fill === "tint" ? hexToRgba(strokeColor || fill, 0.2) : fill;
  };

  if (ann.tool === "pen" && ann.points && ann.points.length >= 2) {
    const outline = getStroke(ann.points, {
      size: ann.size,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    });
    const path = new Path2D(getSvgPath(outline));
    ctx.fillStyle = ann.color;
    ctx.fill(path);
  } else if (ann.tool === "highlighter" && ann.points && ann.points.length >= 2) {
    const outline = getStroke(ann.points, {
      size: ann.size * 3.5,
      thinning: 0,
      smoothing: 0.5,
      streamline: 0.5,
    });
    const path = new Path2D(getSvgPath(outline));
    ctx.fillStyle = hexToRgba(ann.color, 0.35);
    ctx.fill(path);
  } else if (
    ann.tool === "rectangle" &&
    ann.x !== undefined &&
    ann.y !== undefined &&
    ann.width !== undefined &&
    ann.height !== undefined
  ) {
    const rx = ann.width < 0 ? ann.x + ann.width : ann.x;
    const ry = ann.height < 0 ? ann.y + ann.height : ann.y;
    const rw = Math.abs(ann.width);
    const rh = Math.abs(ann.height);

    const fillColor = getFillColor(ann.fill, ann.fillStyle, ann.color);
    if (fillColor) {
      ctx.fillStyle = fillColor;
      if (ann.roundness === "round" && ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, Math.min(12, rw / 4, rh / 4));
        ctx.fill();
      } else {
        ctx.fillRect(rx, ry, rw, rh);
      }
    }
    ctx.strokeStyle = ann.color;
    ctx.lineWidth = ann.size;
    if (ann.roundness === "round" && ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, Math.min(12, rw / 4, rh / 4));
      ctx.stroke();
    } else {
      ctx.strokeRect(rx, ry, rw, rh);
    }
  } else if (
    ann.tool === "ellipse" &&
    ann.x !== undefined &&
    ann.y !== undefined &&
    ann.width !== undefined &&
    ann.height !== undefined
  ) {
    const radX = Math.abs(ann.width / 2);
    const radY = Math.abs(ann.height / 2);
    const cx = ann.x + ann.width / 2;
    const cy = ann.y + ann.height / 2;

    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, radX), Math.max(1, radY), 0, 0, 2 * Math.PI);
    const fillColor = getFillColor(ann.fill, ann.fillStyle, ann.color);
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    ctx.strokeStyle = ann.color;
    ctx.lineWidth = ann.size;
    ctx.stroke();
  } else if (
    ann.tool === "diamond" &&
    ann.x !== undefined &&
    ann.y !== undefined &&
    ann.width !== undefined &&
    ann.height !== undefined
  ) {
    drawDiamond(ctx, ann.x, ann.y, ann.width, ann.height);
    const fillColor = getFillColor(ann.fill, ann.fillStyle, ann.color);
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    ctx.strokeStyle = ann.color;
    ctx.lineWidth = ann.size;
    ctx.stroke();
  } else if (
    ann.tool === "line" &&
    ann.x !== undefined &&
    ann.y !== undefined &&
    ann.endX !== undefined &&
    ann.endY !== undefined
  ) {
    ctx.strokeStyle = ann.color;
    ctx.lineWidth = ann.size;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ann.x, ann.y);
    ctx.lineTo(ann.endX, ann.endY);
    ctx.stroke();

    if (ann.startArrowhead === "arrow" || ann.startArrowhead === "triangle") {
      drawArrowhead(ctx, ann.endX, ann.endY, ann.x, ann.y, ann.size, ann.color);
    }
    if (ann.endArrowhead === "arrow" || ann.endArrowhead === "triangle") {
      drawArrowhead(ctx, ann.x, ann.y, ann.endX, ann.endY, ann.size, ann.color);
    }
  } else if (
    ann.tool === "arrow" &&
    ann.x !== undefined &&
    ann.y !== undefined &&
    ann.endX !== undefined &&
    ann.endY !== undefined
  ) {
    ctx.strokeStyle = ann.color;
    ctx.lineWidth = ann.size;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ann.x, ann.y);
    ctx.lineTo(ann.endX, ann.endY);
    ctx.stroke();

    if (ann.startArrowhead === "arrow" || ann.startArrowhead === "triangle") {
      drawArrowhead(ctx, ann.endX, ann.endY, ann.x, ann.y, ann.size, ann.color);
    }
    drawArrowhead(ctx, ann.x, ann.y, ann.endX, ann.endY, ann.size, ann.color);
  } else if (ann.tool === "text" && ann.x !== undefined && ann.y !== undefined && ann.text) {
    const fontSize = ann.fontSize || 16;
    const fontFamily = ann.fontFamily === "mono" ? "monospace" : ann.fontFamily === "rough" ? "Comic Sans MS, cursive, sans-serif" : "Inter, system-ui, sans-serif";
    ctx.font = `600 ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = ann.color;
    wrapText(ctx, ann.text, ann.x, ann.y, 400, fontSize * 1.35);
  } else if (ann.tool === "sticky" && ann.x !== undefined && ann.y !== undefined && ann.text) {
    const w = ann.width || 180;
    const h = ann.height || 130;
    const fill = ann.fill || "#fef08a";

    // Soft drop shadow
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = fill;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(ann.x, ann.y, w, h, 8);
      ctx.fill();
    } else {
      ctx.fillRect(ann.x, ann.y, w, h);
    }
    ctx.shadowColor = "transparent";

    // Border
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Text inside sticky note
    const fontSize = ann.fontSize || 14;
    const fontFamily = ann.fontFamily === "mono" ? "monospace" : "Inter, system-ui, sans-serif";
    ctx.font = `500 ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = "#1e293b";
    wrapText(ctx, ann.text, ann.x + 12, ann.y + 24, w - 24, fontSize * 1.3);
  }

  // Draw Selection Highlight and Handles
  if (isSelected) {
    drawSelectionBox(ctx, ann);
  }

  ctx.restore();
}

interface DocumentViewerProps {
  file: File;
  onClose: () => void;
  onSendToWhiteboard?: (elements: CanvasElement[]) => void;
  onShare?: () => void;
  roomSlug?: string;
  sendOp?: (shapeId: string, opType: "CREATE_OR_UPDATE" | "DELETE", payload: any) => void;
  lastRemoteOp?: any;
}

export function DocumentViewer({
  file,
  onClose,
  onSendToWhiteboard,
  onShare,
  roomSlug,
  sendOp,
  lastRemoteOp,
}: DocumentViewerProps) {
  const [activeFile, setActiveFile] = useState<File>(file);
  const [docType, setDocType] = useState<DocumentFileType>("pdf");
  const [pages, setPages] = useState<DocumentPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActiveFile(file);
  }, [file]);

  // Annotations state per page
  const [annotationsByPage, setAnnotationsByPage] = useState<{
    [page: number]: DocumentAnnotation[];
  }>({});
  const [historyByPage, setHistoryByPage] = useState<{
    [page: number]: { past: DocumentAnnotation[][]; future: DocumentAnnotation[][] };
  }>({});

  // Active tools & whiteboard expanded state
  const [isToolsExpanded, setIsToolsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem("graffiti:doc_tools_expanded") !== "false";
    } catch {
      return true;
    }
  });
  const [dockPosition, setDockPosition] = useState<DockPosition>("top");
  const [isToolLocked, setIsToolLocked] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<DocumentToolId>("pen");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Whiteboard styling state
  const [elementStyle, setElementStyle] = useState<ElementStyle>({
    strokeColor: "#d4a359",
    backgroundColor: "transparent",
    strokeWidth: 4,
    strokeStyle: "solid",
    fillStyle: "solid",
    roughness: 0,
    roundness: "sharp",
    arrowType: "straight",
    startArrowhead: "none",
    endArrowhead: "arrow",
    fontSize: "medium",
    fontFamily: "clean",
    textAlign: "left",
  });

  const [activeColor, setActiveColor] = useState("#d4a359");
  const [activeFill, setActiveFill] = useState("transparent");
  const [strokeSize, setStrokeSize] = useState(4);
  const [fillMode, setFillMode] = useState<"none" | "tint">("none");
  const [fontSize, setFontSize] = useState<number>(18);

  // Viewport & Zoom
  const [zoom, setZoom] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);

  // Inline text editing state
  const [editingText, setEditingText] = useState<{
    x: number;
    y: number;
    text: string;
    isSticky: boolean;
  } | null>(null);

  // Drag drawing & pan & select states
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const draftAnnotation = useRef<DocumentAnnotation | null>(null);
  const panStartRef = useRef<{ clientX: number; clientY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const dragSelectRef = useRef<{
    startX: number;
    startY: number;
    origX?: number;
    origY?: number;
    origEndX?: number;
    origEndY?: number;
    origPoints?: Point[];
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const baseCanvasContainerRef = useRef<HTMLDivElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);

  const currentPage = pages[currentPageIndex];
  const currentAnnotations = annotationsByPage[currentPageIndex] || [];

  const selectedAnnotation = selectedId ? currentAnnotations.find((a) => a.id === selectedId) || null : null;
  const selectedCanvasElement = selectedAnnotation ? annotationToCanvasElement(selectedAnnotation) : null;

  // Redraw all annotations on drawing canvas
  const redrawDrawingCanvas = useCallback(
    (annotations: DocumentAnnotation[], draft?: DocumentAnnotation | null, activeSelectedId?: string | null) => {
      const canvas = drawingCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const targetSelId = activeSelectedId !== undefined ? activeSelectedId : selectedId;

      for (const ann of annotations) {
        renderAnnotation(ctx, ann, ann.id === targetSelId);
      }
      if (draft) {
        renderAnnotation(ctx, draft, false);
      }
    },
    [selectedId]
  );

  // Auto-fit page to viewport
  const handleFitPage = useCallback(() => {
    if (!currentPage || !scrollContainerRef.current) return;
    const availH = scrollContainerRef.current.clientHeight - 80;
    const availW = scrollContainerRef.current.clientWidth - 48;
    const scaleH = availH / currentPage.height;
    const scaleW = availW / currentPage.width;
    const fit = Math.min(1.2, Math.max(0.2, Math.min(scaleH, scaleW)));
    setZoom(Number(fit.toFixed(2)));
  }, [currentPage]);

  const handleFitWidth = useCallback(() => {
    if (!currentPage || !scrollContainerRef.current) return;
    const availW = scrollContainerRef.current.clientWidth - 64;
    const fit = Math.min(1.5, Math.max(0.2, availW / currentPage.width));
    setZoom(Number(fit.toFixed(2)));
  }, [currentPage]);

  // Auto-persist annotations on change
  useEffect(() => {
    if (!activeFile || Object.keys(annotationsByPage).length === 0) return;
    const storageKey = `graffiti:doc_annotations:${activeFile.name}_${activeFile.size}`;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(annotationsByPage));
      } catch {}
    }, 250);
    return () => clearTimeout(timer);
  }, [activeFile, annotationsByPage]);

  // Persist current page index
  useEffect(() => {
    if (!activeFile) return;
    try {
      localStorage.setItem(`graffiti:doc_page:${activeFile.name}`, String(currentPageIndex));
    } catch {}
  }, [activeFile, currentPageIndex]);

  // Load document on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadDocument(activeFile)
      .then((res) => {
        if (cancelled) return;
        setDocType(res.type);
        setPages(res.pages);

        // Restore last viewed page index
        let startPage = 0;
        try {
          const savedPage = localStorage.getItem(`graffiti:doc_page:${activeFile.name}`);
          if (savedPage) {
            const parsed = parseInt(savedPage, 10);
            if (!isNaN(parsed) && parsed >= 0 && parsed < res.pages.length) {
              startPage = parsed;
            }
          }
        } catch {}
        setCurrentPageIndex(startPage);

        // Restore cached annotations for this document
        try {
          const savedAnns = localStorage.getItem(
            `graffiti:doc_annotations:${activeFile.name}_${activeFile.size}`
          );
          if (savedAnns) {
            const parsed = JSON.parse(savedAnns);
            if (parsed && typeof parsed === "object") {
              setAnnotationsByPage(parsed);
            }
          }
        } catch {}

        setLoading(false);

        // Auto-fit zoom on initial load so the entire page is visible from top to bottom
        setTimeout(() => {
          if (scrollContainerRef.current && res.pages.length > 0) {
            const firstPage = res.pages[startPage] || res.pages[0];
            const availH = scrollContainerRef.current.clientHeight - 80;
            const availW = scrollContainerRef.current.clientWidth - 48;
            const scaleH = availH / firstPage.height;
            const scaleW = availW / firstPage.width;
            const fit = Math.min(1.0, Math.max(0.3, Math.min(scaleH, scaleW)));
            setZoom(Number(fit.toFixed(2)));
          }
        }, 50);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Failed to load document");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeFile]);

  // Update base canvas when page changes
  useEffect(() => {
    if (!currentPage || !baseCanvasContainerRef.current) return;
    const container = baseCanvasContainerRef.current;
    container.innerHTML = "";
    currentPage.canvas.style.display = "block";
    currentPage.canvas.style.width = "100%";
    currentPage.canvas.style.height = "100%";
    container.appendChild(currentPage.canvas);

    if (drawingCanvasRef.current) {
      drawingCanvasRef.current.width = currentPage.width;
      drawingCanvasRef.current.height = currentPage.height;
      redrawDrawingCanvas(annotationsByPage[currentPageIndex] || [], null, selectedId);
    }
  }, [currentPage, currentPageIndex, redrawDrawingCanvas, annotationsByPage, selectedId]);

  // Sync style changes from Inspector
  const handleStyleChange = (style: ElementStyle) => {
    setElementStyle(style);
    if (style.strokeColor) setActiveColor(style.strokeColor);
    if (style.backgroundColor) setActiveFill(style.backgroundColor);
    if (style.strokeWidth) setStrokeSize(style.strokeWidth);
    if (style.fontSize) {
      const fsMap: Record<string, number> = { small: 14, medium: 18, large: 24, xlarge: 32 };
      setFontSize(fsMap[style.fontSize] || 18);
    }
  };

  const handleSelectedElementChange = (patch: Partial<CanvasElement>) => {
    if (!selectedId) return;
    const updated = currentAnnotations.map((ann) => {
      if (ann.id !== selectedId) return ann;
      const next = { ...ann };
      if (patch.strokeColor !== undefined) next.color = patch.strokeColor;
      if (patch.backgroundColor !== undefined) next.fill = patch.backgroundColor;
      if (patch.strokeWidth !== undefined) next.size = patch.strokeWidth;
      if (patch.strokeStyle !== undefined) next.strokeStyle = patch.strokeStyle;
      if (patch.fillStyle !== undefined) next.fillStyle = patch.fillStyle;
      if (patch.roundness !== undefined) next.roundness = patch.roundness;
      if (patch.opacity !== undefined) next.opacity = patch.opacity;
      if (patch.startArrowhead !== undefined) next.startArrowhead = patch.startArrowhead;
      if (patch.endArrowhead !== undefined) next.endArrowhead = patch.endArrowhead;
      if (patch.fontSize !== undefined) {
        const fsMap: Record<string, number> = { small: 14, medium: 18, large: 24, xlarge: 32 };
        next.fontSize = fsMap[patch.fontSize] || 18;
      }
      if (patch.customFontSize !== undefined) next.fontSize = patch.customFontSize;
      if (patch.fontFamily !== undefined) next.fontFamily = patch.fontFamily;
      if (patch.textAlign !== undefined) next.textAlign = patch.textAlign;
      if (patch.text !== undefined) next.text = patch.text;
      return next;
    });
    commitAnnotationsChange(updated);
  };

  const handleDuplicateSelected = () => {
    if (!selectedId) return;
    const target = currentAnnotations.find((a) => a.id === selectedId);
    if (!target) return;
    const clone: DocumentAnnotation = {
      ...target,
      id: "ann_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      x: target.x !== undefined ? target.x + 20 : undefined,
      y: target.y !== undefined ? target.y + 20 : undefined,
      endX: target.endX !== undefined ? target.endX + 20 : undefined,
      endY: target.endY !== undefined ? target.endY + 20 : undefined,
      points: target.points?.map((p) => ({ ...p, x: p.x + 20, y: p.y + 20 })),
    };
    commitAnnotationsChange([...currentAnnotations, clone]);
    setSelectedId(clone.id);
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    const next = currentAnnotations.filter((a) => a.id !== selectedId);
    commitAnnotationsChange(next);
    setSelectedId(null);
  };

  const handleBringForward = () => {
    if (!selectedId) return;
    const idx = currentAnnotations.findIndex((a) => a.id === selectedId);
    if (idx < 0 || idx >= currentAnnotations.length - 1) return;
    const next = [...currentAnnotations];
    const [item] = next.splice(idx, 1);
    next.splice(idx + 1, 0, item);
    commitAnnotationsChange(next);
  };

  const handleSendBackward = () => {
    if (!selectedId) return;
    const idx = currentAnnotations.findIndex((a) => a.id === selectedId);
    if (idx <= 0) return;
    const next = [...currentAnnotations];
    const [item] = next.splice(idx, 1);
    next.splice(idx - 1, 0, item);
    commitAnnotationsChange(next);
  };

  const handleBringToFront = () => {
    if (!selectedId) return;
    const idx = currentAnnotations.findIndex((a) => a.id === selectedId);
    if (idx < 0 || idx === currentAnnotations.length - 1) return;
    const next = [...currentAnnotations];
    const [item] = next.splice(idx, 1);
    next.push(item);
    commitAnnotationsChange(next);
  };

  const handleSendToBack = () => {
    if (!selectedId) return;
    const idx = currentAnnotations.findIndex((a) => a.id === selectedId);
    if (idx <= 0) return;
    const next = [...currentAnnotations];
    const [item] = next.splice(idx, 1);
    next.unshift(item);
    commitAnnotationsChange(next);
  };

  // Keyboard shortcuts (Undo, Redo, Whiteboard Tools)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        editingText ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        handleRedo();
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        handleDuplicateSelected();
        e.preventDefault();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          handleDeleteSelected();
          e.preventDefault();
        }
      } else if (e.key === "Escape") {
        if (selectedId) {
          setSelectedId(null);
        } else {
          onClose();
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === "v") { setActiveTool("select"); }
        else if (key === "h") { setActiveTool("hand"); setSelectedId(null); }
        else if (key === "p") { setActiveTool("pen"); setSelectedId(null); }
        else if (key === "r") { setActiveTool("rectangle"); setSelectedId(null); }
        else if (key === "o") { setActiveTool("ellipse"); setSelectedId(null); }
        else if (key === "d") { setActiveTool("diamond"); setSelectedId(null); }
        else if (key === "l") { setActiveTool("line"); setSelectedId(null); }
        else if (key === "a") { setActiveTool("arrow"); setSelectedId(null); }
        else if (key === "t") { setActiveTool("text"); setSelectedId(null); }
        else if (key === "n") { setActiveTool("sticky"); setSelectedId(null); }
        else if (key === "e") { setActiveTool("eraser"); setSelectedId(null); }
        else if (key === "q") { setIsToolLocked((prev) => !prev); }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Pointer interactions
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || !drawingCanvasRef.current || !currentPage) return;
    const rect = drawingCanvasRef.current.getBoundingClientRect();
    const scaleX = currentPage.width / rect.width;
    const scaleY = currentPage.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (activeTool === "hand") {
      setIsPanning(true);
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        scrollLeft: scrollContainerRef.current?.scrollLeft || 0,
        scrollTop: scrollContainerRef.current?.scrollTop || 0,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (activeTool === "select") {
      const hit = [...currentAnnotations].reverse().find((ann) => isPointInAnnotation(ann, x, y));
      if (hit) {
        setSelectedId(hit.id);
        dragSelectRef.current = {
          startX: x,
          startY: y,
          origX: hit.x,
          origY: hit.y,
          origEndX: hit.endX,
          origEndY: hit.endY,
          origPoints: hit.points ? hit.points.map((p) => ({ ...p })) : undefined,
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } else {
        setSelectedId(null);
      }
      redrawDrawingCanvas(currentAnnotations, null, hit ? hit.id : null);
      return;
    }

    if (activeTool === "text" || activeTool === "sticky") {
      setEditingText({
        x,
        y,
        text: "",
        isSticky: activeTool === "sticky",
      });
      return;
    }

    if (activeTool === "eraser") {
      const filtered = currentAnnotations.filter((ann) => !isPointInAnnotation(ann, x, y));
      if (filtered.length !== currentAnnotations.length) {
        commitAnnotationsChange(filtered);
        if (selectedId && !filtered.some((a) => a.id === selectedId)) {
          setSelectedId(null);
        }
      }
      return;
    }

    setIsDrawing(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const id = "ann_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    const curOpacity = elementStyle.opacity ?? 100;

    if (activeTool === "pen" || activeTool === "highlighter") {
      draftAnnotation.current = {
        id,
        tool: activeTool,
        color: activeColor,
        size: strokeSize,
        opacity: curOpacity,
        points: [{ x, y, pressure: e.pressure || 0.5 }],
      };
    } else if (activeTool === "rectangle" || activeTool === "ellipse" || activeTool === "diamond") {
      draftAnnotation.current = {
        id,
        tool: activeTool,
        color: activeColor,
        fill: activeFill !== "transparent" ? activeFill : fillMode === "tint" ? "tint" : "none",
        size: strokeSize,
        strokeStyle: elementStyle.strokeStyle || "solid",
        fillStyle: elementStyle.fillStyle || (fillMode === "tint" ? "semi" : "solid"),
        roundness: elementStyle.roundness || "sharp",
        opacity: curOpacity,
        x,
        y,
        width: 0,
        height: 0,
      };
    } else if (activeTool === "line" || activeTool === "arrow") {
      draftAnnotation.current = {
        id,
        tool: activeTool,
        color: activeColor,
        size: strokeSize,
        strokeStyle: elementStyle.strokeStyle || "solid",
        startArrowhead: elementStyle.startArrowhead || "none",
        endArrowhead: elementStyle.endArrowhead || (activeTool === "arrow" ? "arrow" : "none"),
        opacity: curOpacity,
        x,
        y,
        endX: x,
        endY: y,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === "hand" && panStartRef.current && scrollContainerRef.current) {
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      scrollContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      scrollContainerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
      return;
    }

    if (!drawingCanvasRef.current || !currentPage) return;
    const rect = drawingCanvasRef.current.getBoundingClientRect();
    const scaleX = currentPage.width / rect.width;
    const scaleY = currentPage.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (activeTool === "eraser" && e.buttons > 0) {
      const filtered = currentAnnotations.filter((ann) => !isPointInAnnotation(ann, x, y));
      if (filtered.length !== currentAnnotations.length) {
        commitAnnotationsChange(filtered);
        if (selectedId && !filtered.some((a) => a.id === selectedId)) {
          setSelectedId(null);
        }
      }
      return;
    }

    if (activeTool === "select" && dragSelectRef.current && selectedId) {
      const dx = x - dragSelectRef.current.startX;
      const dy = y - dragSelectRef.current.startY;
      const updated = currentAnnotations.map((ann) => {
        if (ann.id !== selectedId) return ann;
        const orig = dragSelectRef.current!;
        const moved = { ...ann };
        if (orig.origX !== undefined) moved.x = orig.origX + dx;
        if (orig.origY !== undefined) moved.y = orig.origY + dy;
        if (orig.origEndX !== undefined) moved.endX = orig.origEndX + dx;
        if (orig.origEndY !== undefined) moved.endY = orig.origEndY + dy;
        if (orig.origPoints) {
          moved.points = orig.origPoints.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
        }
        return moved;
      });
      redrawDrawingCanvas(updated, null, selectedId);
      return;
    }

    if (!isDrawing || !draftAnnotation.current) return;
    const draft = draftAnnotation.current;

    if (draft.tool === "pen" || draft.tool === "highlighter") {
      draft.points?.push({ x, y, pressure: e.pressure || 0.5 });
    } else if (draft.tool === "rectangle" || draft.tool === "ellipse" || draft.tool === "diamond") {
      if (draft.x !== undefined && draft.y !== undefined) {
        draft.width = x - draft.x;
        draft.height = y - draft.y;
      }
    } else if (draft.tool === "line" || draft.tool === "arrow") {
      draft.endX = x;
      draft.endY = y;
    }

    redrawDrawingCanvas(currentAnnotations, draft, selectedId);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === "hand") {
      setIsPanning(false);
      panStartRef.current = null;
      return;
    }

    if (activeTool === "select" && dragSelectRef.current && selectedId) {
      const rect = drawingCanvasRef.current?.getBoundingClientRect();
      if (rect && currentPage) {
        const scaleX = currentPage.width / rect.width;
        const scaleY = currentPage.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        const dx = x - dragSelectRef.current.startX;
        const dy = y - dragSelectRef.current.startY;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          const updated = currentAnnotations.map((ann) => {
            if (ann.id !== selectedId) return ann;
            const orig = dragSelectRef.current!;
            const moved = { ...ann };
            if (orig.origX !== undefined) moved.x = orig.origX + dx;
            if (orig.origY !== undefined) moved.y = orig.origY + dy;
            if (orig.origEndX !== undefined) moved.endX = orig.origEndX + dx;
            if (orig.origEndY !== undefined) moved.endY = orig.origEndY + dy;
            if (orig.origPoints) {
              moved.points = orig.origPoints.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
            }
            return moved;
          });
          commitAnnotationsChange(updated);
        }
      }
      dragSelectRef.current = null;
      return;
    }

    if (!isDrawing || !draftAnnotation.current) return;
    const finished = { ...draftAnnotation.current };
    if ((finished.tool === "pen" || finished.tool === "highlighter") && finished.points) {
      finished.points = smoothPoints(finished.points);
    }
    draftAnnotation.current = null;
    setIsDrawing(false);

    // Filter tiny clicks on shapes
    if (
      (finished.tool === "rectangle" || finished.tool === "ellipse" || finished.tool === "diamond") &&
      Math.abs(finished.width || 0) < 4 &&
      Math.abs(finished.height || 0) < 4
    ) {
      redrawDrawingCanvas(currentAnnotations, null, selectedId);
      return;
    }

    const nextAnnotations = [...currentAnnotations, finished];
    commitAnnotationsChange(nextAnnotations);

    if (!isToolLocked) {
      setActiveTool("select");
      setSelectedId(finished.id);
    }
  };

    // Listen for collaborative annotations from other room participants
  useEffect(() => {
    if (!lastRemoteOp || !lastRemoteOp.payload?.__isDocAnnotation) return;
    const { pageIndex } = lastRemoteOp.payload;
    if (pageIndex === undefined) return;

    if (lastRemoteOp.opType === "CREATE_OR_UPDATE") {
      const ann = lastRemoteOp.payload as DocumentAnnotation;
      setAnnotationsByPage((prev) => {
        const pageAnns = prev[pageIndex] || [];
        const exists = pageAnns.some((a) => a.id === ann.id);
        const next = exists ? pageAnns.map((a) => (a.id === ann.id ? ann : a)) : [...pageAnns, ann];
        if (pageIndex === currentPageIndex) redrawDrawingCanvas(next);
        return { ...prev, [pageIndex]: next };
      });
    } else if (lastRemoteOp.opType === "DELETE") {
      const shapeId = lastRemoteOp.shapeId;
      setAnnotationsByPage((prev) => {
        const pageAnns = prev[pageIndex] || [];
        const next = pageAnns.filter((a) => a.id !== shapeId);
        if (pageIndex === currentPageIndex) redrawDrawingCanvas(next);
        return { ...prev, [pageIndex]: next };
      });
    }
  }, [lastRemoteOp, currentPageIndex, redrawDrawingCanvas]);

  const commitAnnotationsChange = (next: DocumentAnnotation[]) => {
    const pageHistory = historyByPage[currentPageIndex] || { past: [], future: [] };
    setHistoryByPage((prev) => ({
      ...prev,
      [currentPageIndex]: {
        past: [...pageHistory.past, currentAnnotations],
        future: [],
      },
    }));

    setAnnotationsByPage((prev) => ({
      ...prev,
      [currentPageIndex]: next,
    }));

    redrawDrawingCanvas(next);

    // Relay changes to live collaborative room
    if (sendOp) {
      const nextIds = new Set(next.map((a) => a.id));
      currentAnnotations.forEach((oldAnn) => {
        if (!nextIds.has(oldAnn.id)) {
          sendOp(oldAnn.id, "DELETE", { __isDocAnnotation: true, pageIndex: currentPageIndex });
        }
      });
      next.forEach((newAnn) => {
        const oldAnn = currentAnnotations.find((a) => a.id === newAnn.id);
        if (!oldAnn || oldAnn !== newAnn) {
          sendOp(newAnn.id, "CREATE_OR_UPDATE", {
            ...newAnn,
            __isDocAnnotation: true,
            pageIndex: currentPageIndex,
            docName: activeFile.name,
          });
        }
      });
    }
  };

  // Undo / Redo
  const handleUndo = () => {
    const pageHistory = historyByPage[currentPageIndex];
    if (!pageHistory || pageHistory.past.length === 0) return;

    const previousState = pageHistory.past[pageHistory.past.length - 1];
    const newPast = pageHistory.past.slice(0, -1);

    setHistoryByPage((prev) => ({
      ...prev,
      [currentPageIndex]: {
        past: newPast,
        future: [currentAnnotations, ...pageHistory.future],
      },
    }));

    setAnnotationsByPage((prev) => ({
      ...prev,
      [currentPageIndex]: previousState,
    }));

    redrawDrawingCanvas(previousState);
  };

  const handleRedo = () => {
    const pageHistory = historyByPage[currentPageIndex];
    if (!pageHistory || pageHistory.future.length === 0) return;

    const nextState = pageHistory.future[0];
    const newFuture = pageHistory.future.slice(1);

    setHistoryByPage((prev) => ({
      ...prev,
      [currentPageIndex]: {
        past: [...pageHistory.past, currentAnnotations],
        future: newFuture,
      },
    }));

    setAnnotationsByPage((prev) => ({
      ...prev,
      [currentPageIndex]: nextState,
    }));

    redrawDrawingCanvas(nextState);
  };

  const handleClearCurrentPage = () => {
    if (currentAnnotations.length === 0) return;
    commitAnnotationsChange([]);
  };

  // Inline text commitment
  const handleCommitText = () => {
    if (!editingText || !editingText.text.trim()) {
      setEditingText(null);
      return;
    }

    const id = "ann_" + Date.now();
    const newAnn: DocumentAnnotation = {
      id,
      tool: editingText.isSticky ? "sticky" : "text",
      color: activeColor,
      size: strokeSize,
      x: editingText.x,
      y: editingText.y,
      text: editingText.text,
      fontSize: editingText.isSticky ? 14 : fontSize,
      fill: editingText.isSticky ? (activeColor === "#1a1a1a" ? "#fef08a" : activeColor) : undefined,
      width: editingText.isSticky ? 180 : undefined,
      height: editingText.isSticky ? 130 : undefined,
    };

    setEditingText(null);
    commitAnnotationsChange([...currentAnnotations, newAnn]);
  };

  // Build export pages with merged annotations
  const buildExportPages = (): AnnotatedExportPage[] => {
    return pages.map((p, idx) => {
      const pageAnns = annotationsByPage[idx] || [];
      const drawCanvas = document.createElement("canvas");
      drawCanvas.width = p.width;
      drawCanvas.height = p.height;
      const ctx = drawCanvas.getContext("2d");
      if (ctx) {
        for (const ann of pageAnns) {
          renderAnnotation(ctx, ann);
        }
      }
      return {
        index: idx,
        baseCanvas: p.canvas,
        drawingCanvas: drawCanvas,
        width: p.width,
        height: p.height,
        originalWidth: p.originalWidth,
        originalHeight: p.originalHeight,
      };
    });
  };

  const handleExportPdf = async () => {
    setShowExportMenu(false);
    setIsExporting(true);
    try {
      const exportPages = buildExportPages();
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      await exportToAnnotatedPdf(exportPages, `${baseName}-annotated.pdf`);
    } catch (e) {
      console.error("Export PDF error:", e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportImages = async () => {
    setShowExportMenu(false);
    setIsExporting(true);
    try {
      const exportPages = buildExportPages();
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      await exportToImages(exportPages, `${baseName}-annotated`);
    } catch (e) {
      console.error("Export Images error:", e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPptx = async () => {
    setShowExportMenu(false);
    setIsExporting(true);
    try {
      const exportPages = buildExportPages();
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      await exportToAnnotatedPptx(exportPages, `${baseName}-annotated.pptx`);
    } catch (e) {
      console.error("Export PPTX error:", e);
    } finally {
      setIsExporting(false);
    }
  };

  const getDocumentPdfBlob = async (): Promise<Blob | null> => {
    const exportPages = buildExportPages();
    return await exportToAnnotatedPdf(exportPages, "");
  };

  const canUndo = (historyByPage[currentPageIndex]?.past.length || 0) > 0;
  const canRedo = (historyByPage[currentPageIndex]?.future.length || 0) > 0;

  const handleSendToWhiteboard = () => {
    const canvasElements = currentAnnotations.map(annotationToCanvasElement);
    if (onSendToWhiteboard) {
      onSendToWhiteboard(canvasElements);
    } else {
      try {
        localStorage.setItem("graffiti:overlay_imported_elements", JSON.stringify(canvasElements));
        window.dispatchEvent(new Event("storage"));
      } catch {}
      onClose();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5000,
        background: "var(--bg-app)",
        display: "flex",
        flexDirection: "column",
        color: "var(--text-primary)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          height: 56,
          borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
          background: "var(--bg-panel)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          gap: 12,
          flexShrink: 0,
        }}
      >
        {/* Left: Back & Document Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onClose}
            title="Return to Whiteboard Canvas (Esc)"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-default, rgba(255,255,255,0.12))",
              background: "var(--bg-subtle, rgba(255,255,255,0.04))",
              color: "inherit",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {docType === "pdf" && <FileText size={18} color="var(--accent-primary)" />}
            {docType === "docx" && <FileCheck size={18} color="var(--accent-primary)" />}
            {docType === "pptx" && <FileSpreadsheet size={18} color="var(--accent-primary)" />}
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                maxWidth: 280,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {file.name}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: "2px 7px",
                borderRadius: 12,
                background: "var(--bg-surface)",
                color: "var(--text-muted)",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              {docType}
            </span>
          </div>
        </div>

        {/* Center: Tools Expand Toggle & Annotation Controls */}
        {!loading && !error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Expand / Collapse Full Whiteboard Tools button */}
            <button
              type="button"
              onClick={() => {
                setIsToolsExpanded((prev) => {
                  const next = !prev;
                  try {
                    localStorage.setItem("graffiti:doc_tools_expanded", String(next));
                  } catch {}
                  return next;
                });
              }}
              title={
                isToolsExpanded
                  ? "Collapse whiteboard tools (Show compact top toolbar)"
                  : "Expand tools: Show full dockable toolbar & properties inspector like Whiteboard"
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                border: isToolsExpanded ? "1px solid var(--accent-primary)" : "1px solid var(--border-default)",
                background: isToolsExpanded ? "var(--accent-subtle)" : "var(--bg-subtle)",
                color: isToolsExpanded ? "var(--accent-primary)" : "var(--text-primary)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                boxShadow: "none",
                transition: "all 140ms ease",
              }}
            >
              {isToolsExpanded ? <Minimize2 size={14} /> : <SlidersHorizontal size={14} />}
              <span>{isToolsExpanded ? "Collapse Tools" : "Expand Tools"}</span>
            </button>

            {/* Quick Undo / Redo / Clear Controls */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                background: "var(--bg-surface)",
                padding: "3px 6px",
                borderRadius: 8,
                border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
              }}
            >
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: "none",
                  background: "transparent",
                  color: canUndo ? "inherit" : "rgba(255,255,255,0.25)",
                  cursor: canUndo ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Undo2 size={15} />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: "none",
                  background: "transparent",
                  color: canRedo ? "inherit" : "rgba(255,255,255,0.25)",
                  cursor: canRedo ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Redo2 size={15} />
              </button>
              <button
                type="button"
                onClick={handleClearCurrentPage}
                title="Clear current page annotations"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: "none",
                  background: "transparent",
                  color: currentAnnotations.length > 0 ? "var(--color-danger)" : "rgba(255,255,255,0.25)",
                  cursor: currentAnnotations.length > 0 ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* When collapsed, also show the compact tool selectors in header */}
            {!isToolsExpanded && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: "var(--bg-surface)",
                  padding: "4px 8px",
                  borderRadius: 10,
                  border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
                }}
              >
                {[
                  { id: "select", icon: <MousePointer2 size={15} />, label: "Select (V)" },
                  { id: "hand", icon: <Hand size={15} />, label: "Pan / Hand (H)" },
                  { id: "pen", icon: <Pen size={15} />, label: "Pen (P)" },
                  { id: "highlighter", icon: <Highlighter size={15} />, label: "Highlighter" },
                  { id: "eraser", icon: <Eraser size={15} />, label: "Eraser (E)" },
                  { id: "rectangle", icon: <Square size={15} />, label: "Rectangle Box (R)" },
                  { id: "ellipse", icon: <CircleIcon size={15} />, label: "Circle / Ellipse (O)" },
                  { id: "diamond", icon: <Diamond size={15} />, label: "Diamond (D)" },
                  { id: "arrow", icon: <MoveRight size={15} />, label: "Arrow (A)" },
                  { id: "line", icon: <Minus size={15} />, label: "Line (L)" },
                  { id: "text", icon: <Type size={15} />, label: "Text Note (T)" },
                  { id: "sticky", icon: <StickyNote size={15} />, label: "Sticky Note (N)" },
                ].map(({ id, icon, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActiveTool(id as DocumentToolId);
                      if (id !== "select") setSelectedId(null);
                    }}
                    title={label}
                    style={{
                      width: 30,
                      height: 30,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      background: activeTool === id ? "var(--accent-subtle)" : "transparent",
                      color: activeTool === id ? "var(--accent-primary)" : "var(--text-secondary)",
                    }}
                  >
                    {icon}
                  </button>
                ))}

                <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.15)", margin: "0 3px" }} />

                {/* Colors */}
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  {QUICK_COLORS.slice(0, 6).map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        if (activeTool === "eraser" || activeTool === "select" || activeTool === "hand") {
                          setActiveTool("pen");
                        }
                        setActiveColor(value);
                        if (selectedId) {
                          handleSelectedElementChange({ strokeColor: value });
                        }
                      }}
                      title={label}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: activeColor === value ? "2px solid #ffffff" : "2px solid transparent",
                        background: value,
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>

                <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.15)", margin: "0 3px" }} />

                {/* Size Selector */}
                <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  {STROKE_SIZES.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setStrokeSize(value);
                        if (selectedId) {
                          handleSelectedElementChange({ strokeWidth: value });
                        }
                      }}
                      title={`${label} Stroke (${value}px)`}
                      style={{
                        padding: "2px 5px",
                        borderRadius: 4,
                        border: "none",
                        background: strokeSize === value ? "rgba(255,255,255,0.15)" : "transparent",
                        color: strokeSize === value ? "#fff" : "rgba(255,255,255,0.5)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right: Viewport Controls & Export */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
          {/* Zoom & View Presets */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              background: "var(--bg-surface)",
              borderRadius: 8,
              padding: "2px 6px",
              border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
            }}
          >
            <button
              onClick={handleFitPage}
              title="Fit entire page vertically"
              style={{
                background: "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                padding: "4px 6px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
              }}
            >
              <Maximize2 size={13} />
              Fit Page
            </button>

            <button
              onClick={handleFitWidth}
              title="Fit page width to window"
              style={{
                background: "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                padding: "4px 6px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
              }}
            >
              <MoveHorizontal size={13} />
              Fit Width
            </button>

            <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.15)", margin: "0 2px" }} />

            <button
              onClick={() => setZoom((z) => Math.max(0.2, Number((z - 0.1).toFixed(1))))}
              title="Zoom out"
              style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", padding: 4 }}
            >
              <ZoomOut size={14} />
            </button>

            <span
              onClick={() => setZoom(1)}
              style={{ fontSize: 12, minWidth: 38, textAlign: "center", cursor: "pointer", userSelect: "none" }}
              title="Reset Zoom (100%)"
            >
              {Math.round(zoom * 100)}%
            </span>

            <button
              onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(1))))}
              title="Zoom in"
              style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", padding: 4 }}
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <button
            onClick={handleSendToWhiteboard}
            title="Transfer annotations into Whiteboard Canvas"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 8,
              background: "rgba(34, 197, 94, 0.15)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              color: "var(--color-success)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              transition: "all 120ms ease",
            }}
          >
            <LayoutDashboard size={15} />
            <span>Transfer to Canvas</span>
          </button>

          {onShare && (
            <button
              onClick={onShare}
              title="Share Room & Invite Collaborators"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 8,
                background: "rgba(212, 163, 89, 0.15)",
                border: "1px solid rgba(212, 163, 89, 0.3)",
                color: "var(--accent-primary)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                transition: "all 120ms ease",
              }}
            >
              <Share2 size={15} />
              <span>Share</span>
            </button>
          )}

          {/* Export Dropdown Trigger */}
          <button
            onClick={() => setShowExportMenu((v) => !v)}
            disabled={loading || pages.length === 0 || isExporting}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 8,
              background: "var(--accent-primary)",
              color: "var(--accent-text)",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {isExporting ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
            {isExporting ? "Exporting..." : "Export"}
          </button>

          {/* Export Menu Dropdown */}
          {showExportMenu && (
            <div
              style={{
                position: "absolute",
                top: 44,
                right: 0,
                width: 240,
                background: "var(--bg-popover)",
                border: "1px solid var(--border-default)",
                borderRadius: 10,
                boxShadow: "var(--shadow-lg)",
                padding: "6px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                zIndex: 9999,
              }}
            >
              <button
                onClick={handleExportPdf}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 6,
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: 13,
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <FileText size={16} color="var(--accent-primary)" />
                <div>
                  <div style={{ fontWeight: 600 }}>Save Annotated PDF</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Preserves original dimensions</div>
                </div>
              </button>

              <button
                onClick={handleExportImages}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 6,
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: 13,
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Download size={16} color="var(--accent-primary)" />
                <div>
                  <div style={{ fontWeight: 600 }}>Save Images (PNG/ZIP)</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>High-resolution page images</div>
                </div>
              </button>

              <button
                onClick={handleExportPptx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 6,
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: 13,
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <FileSpreadsheet size={16} color="var(--accent-primary)" />
                <div>
                  <div style={{ fontWeight: 600 }}>Save Slides (.pptx)</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Portrait/Landscape matching</div>
                </div>
              </button>

              <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "4px 0" }} />

              <button
                onClick={() => {
                  setShowExportMenu(false);
                  setShowDriveModal(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 6,
                  background: "var(--accent-subtle)",
                  border: "1px solid var(--accent-ring)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: 13,
                  textAlign: "left",
                }}
              >
                <Cloud size={16} color="var(--accent-primary)" />
                <div>
                  <div style={{ fontWeight: 600 }}>Export to Google Drive</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Direct cloud upload (Guests OK)</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Workspace Area with Dockable Toolbar & Inspector */}
      <section
        className="workspace"
        data-dock={dockPosition}
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          width: "100%",
        }}
      >
        {isToolsExpanded && (
          <Toolbar
            mode="document"
            activeTool={activeTool === "highlighter" ? "pen" : (activeTool as ToolId)}
            dockPosition={dockPosition}
            isToolLocked={isToolLocked}
            onToggleLock={() => setIsToolLocked((prev) => !prev)}
            onToolChange={(tool) => {
              setActiveTool(tool as DocumentToolId);
              if (tool !== "select") setSelectedId(null);
            }}
            onDockChange={setDockPosition}
          />
        )}

        {/* Main Canvas Scroll Area (alignItems: flex-start ensures full top view of portrait page) */}
        <div
          ref={scrollContainerRef}
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "32px 16px 64px 16px",
            background: "var(--bg-app)",
            position: "relative",
            width: "100%",
            height: "100%",
          }}
          onClick={() => {
            if (showExportMenu) setShowExportMenu(false);
          }}
        >
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 120 }}>
              <Loader2 size={36} className="spin" color="var(--accent-primary)" />
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                Rendering {file.name}...
              </span>
            </div>
          )}

          {error && (
            <div style={{ textAlign: "center", maxWidth: 440, marginTop: 120 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-danger)", marginBottom: 8 }}>
                Failed to load document
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{error}</div>
            </div>
          )}

          {!loading && !error && currentPage && (
            <div
              style={{
                position: "relative",
                width: currentPage.width * zoom,
                height: currentPage.height * zoom,
                boxShadow: "0 16px 48px rgba(0,0,0,0.75)",
                borderRadius: 4,
                overflow: "hidden",
                background: "#ffffff",
                transition: "width 80ms ease, height 80ms ease",
                flexShrink: 0,
              }}
            >
              {/* Base rendered document layer */}
              <div
                ref={baseCanvasContainerRef}
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                }}
              />

              {/* Drawing overlay canvas */}
              <canvas
                ref={drawingCanvasRef}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  cursor:
                    activeTool === "hand"
                      ? isPanning
                        ? "grabbing"
                        : "grab"
                      : activeTool === "select"
                      ? "default"
                      : activeTool === "eraser"
                      ? "cell"
                      : activeTool === "text" || activeTool === "sticky"
                      ? "text"
                      : "crosshair",
                  touchAction: "none",
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />

              {/* Inline Text / Sticky Note Input Overlay */}
              {editingText && (
                <div
                  style={{
                    position: "absolute",
                    left: editingText.x * zoom,
                    top: editingText.y * zoom,
                    zIndex: 20,
                    transform: "translate(0, 0)",
                  }}
                >
                  {editingText.isSticky ? (
                    <div
                      style={{
                        width: 180 * zoom,
                        height: 130 * zoom,
                        background: activeColor === "#1a1a1a" ? "#fef08a" : activeColor,
                        padding: 10 * zoom,
                        borderRadius: 8,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <textarea
                        autoFocus
                        placeholder="Sticky note text..."
                        value={editingText.text}
                        onChange={(e) => setEditingText({ ...editingText, text: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleCommitText();
                          }
                        }}
                        onBlur={handleCommitText}
                        style={{
                          flex: 1,
                          background: "transparent",
                          border: "none",
                          outline: "none",
                          resize: "none",
                          fontFamily: "Inter, sans-serif",
                          fontSize: 14 * zoom,
                          color: "#1e293b",
                          lineHeight: 1.3,
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        minWidth: 160 * zoom,
                        background: "var(--bg-popover)",
                        border: "1px solid var(--accent-primary)",
                        borderRadius: 6,
                        padding: 6 * zoom,
                        boxShadow: "var(--shadow-md)",
                      }}
                    >
                      <textarea
                        autoFocus
                        placeholder="Type note (Enter to save)..."
                        value={editingText.text}
                        onChange={(e) => setEditingText({ ...editingText, text: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleCommitText();
                          }
                        }}
                        onBlur={handleCommitText}
                        style={{
                          width: "100%",
                          minHeight: 40 * zoom,
                          background: "transparent",
                          border: "none",
                          outline: "none",
                          resize: "none",
                          color: activeColor,
                          fontFamily: "Inter, sans-serif",
                          fontSize: fontSize * zoom,
                          fontWeight: 600,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Contextual Inspector (matching Whiteboard) */}
        {isToolsExpanded && (
          <Inspector
            activeTool={activeTool === "highlighter" ? "pen" : (activeTool as ToolId)}
            selected={selectedCanvasElement}
            style={elementStyle}
            theme="dark"
            isEditingText={!!editingText || activeTool === "text"}
            onStyleChange={handleStyleChange}
            onSelectedChange={handleSelectedElementChange}
            onDuplicateSelected={handleDuplicateSelected}
            onDeleteSelected={handleDeleteSelected}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
          />
        )}
      </section>

      {/* Bottom Page Navigator */}
      {!loading && !error && pages.length > 0 && (
        <div
          style={{
            height: 48,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            background: "var(--bg-panel)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
            disabled={currentPageIndex === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 12px",
              borderRadius: 6,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              color: currentPageIndex === 0 ? "rgba(255,255,255,0.25)" : "inherit",
              cursor: currentPageIndex === 0 ? "default" : "pointer",
              fontSize: 12,
            }}
          >
            <ChevronLeft size={14} />
            Previous
          </button>

          <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>
            Page {currentPageIndex + 1} of {pages.length}
          </span>

          <button
            onClick={() => setCurrentPageIndex((p) => Math.min(pages.length - 1, p + 1))}
            disabled={currentPageIndex === pages.length - 1}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 12px",
              borderRadius: 6,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              color: currentPageIndex === pages.length - 1 ? "rgba(255,255,255,0.25)" : "inherit",
              cursor: currentPageIndex === pages.length - 1 ? "default" : "pointer",
              fontSize: 12,
            }}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Google Drive Export & Import Modal */}
      {showDriveModal && (
        <GoogleDriveExportModal
          isOpen={showDriveModal}
          onClose={() => setShowDriveModal(false)}
          getPdfBlob={getDocumentPdfBlob}
          onImportFile={(newFile) => setActiveFile(newFile)}
        />
      )}
    </div>
  );
}
