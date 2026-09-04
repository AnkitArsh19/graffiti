import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import rough from "roughjs/bin/rough";
import { clamp, createId, createSeed, moveElement, normalizeBox, pointInElement, screenToWorld } from "../lib/geometry";
import type { CanvasElement, ElementStyle, ElementType, PaperTemplate, Point, ToolId, Viewport } from "../types";

export interface WhiteboardCanvasHandle {
  exportPng: () => void;
  resetView: () => void;
}

interface WhiteboardCanvasProps {
  pageId: string;
  pageTitle: string;
  template: PaperTemplate;
  elements: CanvasElement[];
  activeTool: ToolId;
  selectedId: string | null;
  elementStyle: ElementStyle;
  onSelect: (elementId: string | null) => void;
  onCommit: (element: CanvasElement) => void;
  onDelete: (elementId: string) => void;
  onToolChange: (tool: ToolId) => void;
}

interface PointerAction {
  mode: "draw" | "move" | "pan";
  startWorld: Point;
  startScreen: Point;
  original?: CanvasElement;
}

const DEFAULT_VIEWPORT: Viewport = { x: 120, y: 80, zoom: 1 };

function getEventPoint(event: ReactPointerEvent<HTMLCanvasElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines.slice(0, 8);
}

function drawPaper(context: CanvasRenderingContext2D, template: PaperTemplate, viewport: Viewport, size: Point) {
  const left = -viewport.x / viewport.zoom;
  const top = -viewport.y / viewport.zoom;
  const right = left + size.x / viewport.zoom;
  const bottom = top + size.y / viewport.zoom;

  context.save();
  context.lineWidth = 1 / viewport.zoom;

  if (template === "grid") {
    context.strokeStyle = "#dce6f4";
    context.beginPath();
    for (let x = Math.floor(left / 24) * 24; x <= right; x += 24) {
      context.moveTo(x, top);
      context.lineTo(x, bottom);
    }
    for (let y = Math.floor(top / 24) * 24; y <= bottom; y += 24) {
      context.moveTo(left, y);
      context.lineTo(right, y);
    }
    context.stroke();
  }

  if (template === "ruled" || template === "cornell") {
    context.strokeStyle = "#d9e5f3";
    context.beginPath();
    for (let y = Math.floor(top / 30) * 30; y <= bottom; y += 30) {
      context.moveTo(left, y);
      context.lineTo(right, y);
    }
    context.stroke();
  }

  if (template === "dotted") {
    context.fillStyle = "#c7d2e2";
    for (let x = Math.floor(left / 24) * 24; x <= right; x += 24) {
      for (let y = Math.floor(top / 24) * 24; y <= bottom; y += 24) {
        context.beginPath();
        context.arc(x, y, 1.15 / viewport.zoom, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  if (template === "cornell") {
    context.strokeStyle = "#ef9a9a";
    context.beginPath();
    context.moveTo(185, top);
    context.lineTo(185, bottom);
    context.moveTo(left, 620);
    context.lineTo(right, 620);
    context.stroke();
  }
  context.restore();
}

function drawElement(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  element: CanvasElement,
) {
  const generator = rough.canvas(canvas);
  const options = {
    seed: element.seed,
    stroke: element.strokeColor,
    strokeWidth: element.strokeWidth,
    roughness: element.roughness,
    fill: element.backgroundColor === "transparent" ? undefined : element.backgroundColor,
    fillStyle: "solid" as const,
  };

  context.save();
  context.globalAlpha = element.opacity / 100;
  switch (element.type) {
    case "rectangle":
    case "sticky":
      generator.rectangle(element.x, element.y, element.width, element.height, options);
      break;
    case "ellipse":
      generator.ellipse(
        element.x + element.width / 2,
        element.y + element.height / 2,
        element.width,
        element.height,
        options,
      );
      break;
    case "diamond": {
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;
      generator.polygon(
        [
          [centerX, element.y],
          [element.x + element.width, centerY],
          [centerX, element.y + element.height],
          [element.x, centerY],
        ],
        options,
      );
      break;
    }
    case "line":
      if (element.points?.length === 2) {
        generator.line(
          element.points[0].x,
          element.points[0].y,
          element.points[1].x,
          element.points[1].y,
          options,
        );
      }
      break;
    case "arrow":
      if (element.points?.length === 2) {
        const [start, end] = element.points;
        generator.line(start.x, start.y, end.x, end.y, options);
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const head = 13 + element.strokeWidth * 2;
        generator.line(end.x, end.y, end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6), options);
        generator.line(end.x, end.y, end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6), options);
      }
      break;
    case "pen":
      if (element.points && element.points.length > 1) {
        context.beginPath();
        context.strokeStyle = element.strokeColor;
        context.lineWidth = element.strokeWidth;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.moveTo(element.points[0].x, element.points[0].y);
        element.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        context.stroke();
      }
      break;
    case "text":
      break;
  }

  if (element.text) {
    context.fillStyle = element.strokeColor;
    context.font = `${element.type === "sticky" ? 18 : 20}px Inter, ui-sans-serif, system-ui`;
    context.textBaseline = "top";
    const padding = element.type === "sticky" ? 18 : 2;
    wrapText(context, element.text, Math.max(40, element.width - padding * 2)).forEach((line, index) => {
      context.fillText(line, element.x + padding, element.y + padding + index * 25);
    });
  }
  context.restore();
}

export const WhiteboardCanvas = forwardRef<WhiteboardCanvasHandle, WhiteboardCanvasProps>(
  function WhiteboardCanvas(
    {
      pageId,
      pageTitle,
      template,
      elements,
      activeTool,
      selectedId,
      elementStyle,
      onSelect,
      onCommit,
      onDelete,
      onToolChange,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const actionRef = useRef<PointerAction | null>(null);
    const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
    const [draft, setDraft] = useState<CanvasElement | null>(null);
    const [moving, setMoving] = useState<CanvasElement | null>(null);
    const [size, setSize] = useState<Point>({ x: 0, y: 0 });

    useImperativeHandle(ref, () => ({
      exportPng() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement("a");
        link.download = `${pageTitle.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "graffiti-page"}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      },
      resetView() {
        setViewport(DEFAULT_VIEWPORT);
      },
    }), [pageTitle]);

    useLayoutEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const observer = new ResizeObserver(([entry]) => {
        const width = Math.max(1, entry.contentRect.width);
        const height = Math.max(1, entry.contentRect.height);
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(width * ratio);
        canvas.height = Math.floor(height * ratio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        setSize({ x: width, y: height });
      });
      observer.observe(container);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || size.x === 0 || size.y === 0) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      const ratio = window.devicePixelRatio || 1;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#fbfcfe";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.setTransform(
        ratio * viewport.zoom,
        0,
        0,
        ratio * viewport.zoom,
        ratio * viewport.x,
        ratio * viewport.y,
      );

      drawPaper(context, template, viewport, size);
      const movingId = moving?.id;
      elements.forEach((element) => {
        if (element.id !== movingId) drawElement(context, canvas, element);
      });
      if (moving) drawElement(context, canvas, moving);
      if (draft) drawElement(context, canvas, draft);

      const selected = moving ?? elements.find((element) => element.id === selectedId);
      if (selected) {
        context.save();
        context.strokeStyle = "#2563eb";
        context.lineWidth = 1.5 / viewport.zoom;
        context.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
        context.strokeRect(
          selected.x - 7 / viewport.zoom,
          selected.y - 7 / viewport.zoom,
          selected.width + 14 / viewport.zoom,
          selected.height + 14 / viewport.zoom,
        );
        context.restore();
      }
    }, [draft, elements, moving, selectedId, size, template, viewport]);

    const createDraft = (type: ElementType, start: Point, end: Point): CanvasElement => {
      const box = normalizeBox(start, end);
      const isPointBased = type === "line" || type === "arrow" || type === "pen";
      return {
        id: createId("element"),
        pageId,
        type,
        x: isPointBased ? Math.min(start.x, end.x) : box.x,
        y: isPointBased ? Math.min(start.y, end.y) : box.y,
        width: Math.max(box.width, type === "text" ? 180 : 1),
        height: Math.max(box.height, type === "text" ? 36 : 1),
        points: isPointBased ? [start, end] : undefined,
        text: type === "text" ? "Text" : type === "sticky" ? "New note" : undefined,
        strokeColor: elementStyle.strokeColor,
        backgroundColor: type === "sticky" ? "#fef3c7" : elementStyle.backgroundColor,
        strokeWidth: elementStyle.strokeWidth,
        roughness: elementStyle.roughness,
        opacity: 100,
        seed: createSeed(),
      };
    };

    const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      const screen = getEventPoint(event);
      const world = screenToWorld(screen, viewport);
      const hit = [...elements].reverse().find((element) => pointInElement(world, element, 8 / viewport.zoom));

      if (event.button === 1 || activeTool === "hand") {
        actionRef.current = { mode: "pan", startWorld: world, startScreen: screen };
        return;
      }

      if (activeTool === "eraser") {
        if (hit) onDelete(hit.id);
        return;
      }

      if (activeTool === "select") {
        onSelect(hit?.id ?? null);
        if (hit) {
          actionRef.current = { mode: "move", startWorld: world, startScreen: screen, original: hit };
          setMoving(hit);
        }
        return;
      }

      const nextDraft = createDraft(activeTool, world, world);
      if (activeTool === "sticky") {
        nextDraft.width = 190;
        nextDraft.height = 140;
      }
      setDraft(nextDraft);
      actionRef.current = { mode: "draw", startWorld: world, startScreen: screen };
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const action = actionRef.current;
      if (!action) return;
      const screen = getEventPoint(event);
      const world = screenToWorld(screen, viewport);

      if (action.mode === "pan") {
        const dx = screen.x - action.startScreen.x;
        const dy = screen.y - action.startScreen.y;
        setViewport((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
        action.startScreen = screen;
        return;
      }

      if (action.mode === "move" && action.original) {
        setMoving(moveElement(action.original, world.x - action.startWorld.x, world.y - action.startWorld.y));
        return;
      }

      setDraft((current) => {
        if (!current) return null;
        if (current.type === "pen") {
          const points = [...(current.points ?? [action.startWorld]), world];
          const xs = points.map((point) => point.x);
          const ys = points.map((point) => point.y);
          return {
            ...current,
            points,
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys),
          };
        }
        return { ...createDraft(current.type, action.startWorld, world), id: current.id, seed: current.seed };
      });
    };

    const finishPointerAction = () => {
      if (moving) onCommit(moving);
      if (draft) {
        const canCommit = draft.type === "text" || draft.type === "sticky" || draft.width > 3 || draft.height > 3;
        if (canCommit) {
          onCommit(draft);
          onSelect(draft.id);
          if (draft.type === "text" || draft.type === "sticky") onToolChange("select");
        }
      }
      setDraft(null);
      setMoving(null);
      actionRef.current = null;
    };

    const onWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const screen = getEventPoint(event as unknown as ReactPointerEvent<HTMLCanvasElement>);
      const before = screenToWorld(screen, viewport);
      const zoom = clamp(viewport.zoom * Math.exp(-event.deltaY * 0.0012), 0.1, 5);
      setViewport({
        zoom,
        x: screen.x - before.x * zoom,
        y: screen.y - before.y * zoom,
      });
    };

    return (
      <div className="canvas-shell" ref={containerRef} data-tool={activeTool}>
        <canvas
          ref={canvasRef}
          className="whiteboard-canvas"
          tabIndex={0}
          aria-label={`${pageTitle} whiteboard canvas`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishPointerAction}
          onPointerCancel={finishPointerAction}
          onWheel={onWheel}
          onContextMenu={(event) => event.preventDefault()}
        />
        {elements.length === 0 ? (
          <div className="canvas-empty" aria-hidden="true">
            <div className="empty-mark">G</div>
            <p>Choose a tool and start sketching</p>
            <span>Scroll to zoom · Hand tool to pan</span>
          </div>
        ) : null}
        <div className="zoom-pill" aria-live="polite">{Math.round(viewport.zoom * 100)}%</div>
      </div>
    );
  },
);
