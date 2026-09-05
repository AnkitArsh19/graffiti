import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  getHandleCursor,
  getHitTransformHandle,
  normalizeBox,
  pointInElement,
  rotatePoint,
  type TransformHandleType,
} from "../lib/collision";
import { applyDarkModeFilter } from "../lib/colors";
import {
  renderCanvasElement,
  renderSelectionBox,
  strokePaperGrid,
} from "../lib/canvasRenderer";
import {
  type AnchorPoint,
  clamp,
  createId,
  createSeed,
  findClosestAnchorPoint,
  doesElementIntersectBox,
  getElementAnchorPoints,
  isElementFullyInsideBox,
  normalizePenElement,
  screenToWorld,
  updateBoundArrows,
} from "../lib/geometry";
import type {
  CanvasElement,
  ElementStyle,
  ElementType,
  FontSize,
  PaperTemplate,
  Point,
  PointBinding,
  TextAlign,
  ToolId,
  Viewport,
} from "../types";

function getFontSizeInPx(fontSize?: FontSize): number {
  switch (fontSize) {
    case "small":
      return 14;
    case "large":
      return 24;
    case "xlarge":
      return 32;
    default:
      return 18;
  }
}

interface EditingTextState {
  id?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text: string;
  fontSize: FontSize;
  textAlign: TextAlign;
  strokeColor: string;
  type?: "text" | "sticky";
  backgroundColor?: string;
  isBounded?: boolean;
}

export interface WhiteboardCanvasHandle {
  exportPng: () => void;
  resetView: () => void;
  centerContent: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface WhiteboardCanvasProps {
  pageId: string;
  pageTitle: string;
  template: PaperTemplate;
  elements: CanvasElement[];
  activeTool: ToolId;
  selectedId: string | null;
  selectedIds?: string[];
  elementStyle: ElementStyle;
  isToolLocked?: boolean;
  theme?: "dark" | "light";
  onSelect: (elementId: string | null) => void;
  onSelectMultiple?: (ids: string[]) => void;
  onCommit: (element: CanvasElement) => void;
  onCommitBatch?: (elements: CanvasElement[]) => void;
  onDelete: (elementId: string) => void;
  onToolChange: (tool: ToolId) => void;
  onZoomChange?: (zoom: number) => void;
  onEditingTextChange?: (isEditing: boolean) => void;
  onStyleChange?: (style: Partial<ElementStyle>) => void;
}

type PointerAction =
  | { mode: "pan"; startScreen: Point; startScroll: Point }
  | { mode: "draw"; startWorld: Point }
  | { mode: "move"; startWorld: Point; original: CanvasElement; originals?: CanvasElement[] }
  | {
      mode: "resize";
      handle: TransformHandleType;
      startWorld: Point;
      original: CanvasElement;
    }
  | { mode: "boxSelect"; startWorld: Point }
  | { mode: "erase" };

const DEFAULT_VIEWPORT: Viewport = { scrollX: 100, scrollY: 80, zoom: 1 };

export const WhiteboardCanvas = forwardRef<WhiteboardCanvasHandle, WhiteboardCanvasProps>(
  function WhiteboardCanvas(
    {
      pageId,
      pageTitle,
      template,
      elements,
      activeTool,
      selectedId,
      selectedIds: propSelectedIds,
      elementStyle,
      isToolLocked = false,
      theme = "dark",
      onSelect,
      onSelectMultiple,
      onCommit,
      onCommitBatch,
      onDelete,
      onToolChange,
      onZoomChange,
      onEditingTextChange,
      onStyleChange,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const actionRef = useRef<PointerAction | null>(null);

    const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);

    // Keep parent informed of zoom level
    useEffect(() => {
      onZoomChange?.(viewport.zoom);
    }, [viewport.zoom, onZoomChange]);

    const [draft, setDraft] = useState<CanvasElement | null>(null);
    const [moving, setMoving] = useState<CanvasElement | null>(null);
    const [movingMap, setMovingMap] = useState<Map<string, CanvasElement> | null>(null);
    const [hoveredAnchor, setHoveredAnchor] = useState<AnchorPoint | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Sync selectedIds with prop or selectedId
    useEffect(() => {
      if (propSelectedIds) {
        setSelectedIds(propSelectedIds);
      } else if (selectedId) {
        setSelectedIds((prev) => (prev.includes(selectedId) ? prev : [selectedId]));
      } else {
        setSelectedIds([]);
      }
    }, [propSelectedIds, selectedId]);

    const updateSelection = (ids: string[]) => {
      setSelectedIds(ids);
      onSelectMultiple?.(ids);
      onSelect(ids[0] ?? null);
    };

    const [selectionBox, setSelectionBox] = useState<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null>(null);
    const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({
      width: 0,
      height: 0,
    });
    const [editingText, setEditingText] = useState<EditingTextState | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-focus inline text editor and select existing text on open
    const prevEditingRef = useRef<boolean>(false);
    useEffect(() => {
      const isNowEditing = Boolean(editingText);
      if (isNowEditing && !prevEditingRef.current && textareaRef.current) {
        const textarea = textareaRef.current;
        textarea.focus();
        if (editingText?.text) {
          requestAnimationFrame(() => {
            textarea.select();
          });
        }
      }
      prevEditingRef.current = isNowEditing;
    }, [editingText]);

    // Notify parent about text editing state
    useEffect(() => {
      onEditingTextChange?.(Boolean(editingText));
    }, [editingText, onEditingTextChange]);

    // Live update inline editor when style changes
    useEffect(() => {
      if (editingText) {
        setEditingText((prev) =>
          prev
            ? {
                ...prev,
                fontSize: elementStyle.fontSize || prev.fontSize,
                textAlign: elementStyle.textAlign || prev.textAlign,
                strokeColor: elementStyle.strokeColor || prev.strokeColor,
              }
            : null,
        );
      }
    }, [elementStyle.fontSize, elementStyle.textAlign, elementStyle.strokeColor]);

    // Commit inline text on blur or escape/ctrl+enter
    const commitInlineText = useCallback(() => {
      if (!editingText) return;

      const trimmed = editingText.text.trim();
      if (!trimmed) {
        if (editingText.type !== "sticky") {
          if (editingText.id) {
            onDelete(editingText.id);
          }
          setEditingText(null);
          return;
        }
      }

      const fontSizePx = getFontSizeInPx(editingText.fontSize);
      const lines = editingText.text.split("\n");
      const lineHeight = fontSizePx * 1.35;
      let maxLineWidth = 50;
      lines.forEach((line) => {
        const est = line.length * (fontSizePx * 0.58);
        if (est > maxLineWidth) maxLineWidth = est;
      });

      // Preserve bounded text box width if drawn as a bounded box
      const isBounded = editingText.isBounded || (editingText.width && editingText.width > 60);
      const width = isBounded
        ? Math.max(editingText.width ?? 120, 80)
        : Math.max(maxLineWidth + 18, 60);
      const height = Math.max(lines.length * lineHeight + 8, editingText.height ?? 30, fontSizePx * 1.5);

      if (editingText.id) {
        const existing = elements.find((el) => el.id === editingText.id);
        if (existing) {
          onCommit({
            ...existing,
            text: editingText.text,
            width: existing.type === "sticky" ? existing.width : width,
            height: existing.type === "sticky" ? existing.height : height,
            fontSize: editingText.fontSize,
            textAlign: editingText.textAlign,
            strokeColor: editingText.strokeColor,
          });
          onSelect(existing.id);
        }
      } else {
        const newElement: CanvasElement = {
          id: createId("el"),
          pageId,
          type: "text",
          x: editingText.x,
          y: editingText.y,
          width,
          height,
          text: editingText.text,
          strokeColor: editingText.strokeColor,
          backgroundColor: "transparent",
          strokeWidth: elementStyle.strokeWidth || 2,
          roughness: 0,
          opacity: 100,
          seed: createSeed(),
          fontSize: editingText.fontSize,
          textAlign: editingText.textAlign,
        };
        onCommit(newElement);
        onSelect(newElement.id);
        if (!isToolLocked) {
          onToolChange("select");
        }
      }

      setEditingText(null);
    }, [
      editingText,
      elementStyle.strokeWidth,
      elements,
      isToolLocked,
      onCommit,
      onDelete,
      onSelect,
      onToolChange,
      pageId,
    ]);

    // Imperative methods exposed to parent
    useImperativeHandle(
      ref,
      () => ({
        exportPng() {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const link = document.createElement("a");
          const safeTitle =
            pageTitle.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "graffiti-canvas";
          link.download = `${safeTitle}.png`;
          link.href = canvas.toDataURL("image/png");
          link.click();
        },
        resetView() {
          setViewport(DEFAULT_VIEWPORT);
        },
        zoomIn() {
          setViewport((prev) => {
            const nextZoom = clamp(prev.zoom * 1.25, 0.1, 8);
            const cx = canvasSize.width / 2;
            const cy = canvasSize.height / 2;
            const worldX = cx / prev.zoom - prev.scrollX;
            const worldY = cy / prev.zoom - prev.scrollY;
            return {
              zoom: nextZoom,
              scrollX: cx / nextZoom - worldX,
              scrollY: cy / nextZoom - worldY,
            };
          });
        },
        zoomOut() {
          setViewport((prev) => {
            const nextZoom = clamp(prev.zoom / 1.25, 0.1, 8);
            const cx = canvasSize.width / 2;
            const cy = canvasSize.height / 2;
            const worldX = cx / prev.zoom - prev.scrollX;
            const worldY = cy / prev.zoom - prev.scrollY;
            return {
              zoom: nextZoom,
              scrollX: cx / nextZoom - worldX,
              scrollY: cy / nextZoom - worldY,
            };
          });
        },
        centerContent() {
          if (elements.length === 0 || canvasSize.width === 0) {
            setViewport(DEFAULT_VIEWPORT);
            return;
          }
          const xs = elements.flatMap((el) => [el.x, el.x + el.width]);
          const ys = elements.flatMap((el) => [el.y, el.y + el.height]);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          const contentWidth = Math.max(maxX - minX, 150);
          const contentHeight = Math.max(maxY - minY, 150);

          const padding = 100;
          const zoomX = (canvasSize.width - padding * 2) / contentWidth;
          const zoomY = (canvasSize.height - padding * 2) / contentHeight;
          const targetZoom = clamp(Math.min(zoomX, zoomY), 0.2, 3);

          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;

          setViewport({
            zoom: targetZoom,
            scrollX: canvasSize.width / 2 / targetZoom - centerX,
            scrollY: canvasSize.height / 2 / targetZoom - centerY,
          });
        },
      }),
      [canvasSize.height, canvasSize.width, elements, pageTitle],
    );

    // Resize Observer for physical pixel canvas dimensions
    useLayoutEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const observer = new ResizeObserver(([entry]) => {
        const width = Math.max(1, Math.round(entry.contentRect.width));
        const height = Math.max(1, Math.round(entry.contentRect.height));
        const ratio = window.devicePixelRatio || 1;

        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        setCanvasSize({ width, height });
      });

      observer.observe(container);
      return () => observer.disconnect();
    }, []);

    // Non-passive wheel event listener: PREVENTS browser whole-page zoom
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const handleWheel = (event: WheelEvent) => {
        event.preventDefault(); // Stop browser page zoom completely

        const rect = canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;

        // Zoom if ctrlKey or metaKey (pinch-to-zoom on trackpad or ctrl+wheel)
        if (event.ctrlKey || event.metaKey) {
          setViewport((prev) => {
            const worldX = screenX / prev.zoom - prev.scrollX;
            const worldY = screenY / prev.zoom - prev.scrollY;

            const zoomFactor = Math.exp(-event.deltaY * 0.002);
            const nextZoom = clamp(prev.zoom * zoomFactor, 0.1, 8);

            const nextScrollX = screenX / nextZoom - worldX;
            const nextScrollY = screenY / nextZoom - worldY;

            return {
              zoom: nextZoom,
              scrollX: nextScrollX,
              scrollY: nextScrollY,
            };
          });
        } else {
          // Regular wheel: pan canvas
          setViewport((prev) => ({
            ...prev,
            scrollX: prev.scrollX - event.deltaX / prev.zoom,
            scrollY: prev.scrollY - event.deltaY / prev.zoom,
          }));
        }
      };

      canvas.addEventListener("wheel", handleWheel, { passive: false });

      const preventWindowZoom = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
        }
      };
      window.addEventListener("wheel", preventWindowZoom, { passive: false });

      return () => {
        canvas.removeEventListener("wheel", handleWheel);
        window.removeEventListener("wheel", preventWindowZoom);
      };
    }, []);

    // Redraw Canvas
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || canvasSize.width === 0 || canvasSize.height === 0) return;
      const context = canvas.getContext("2d");
      if (!context) return;

      const ratio = window.devicePixelRatio || 1;
      const { width, height } = canvasSize;

      // Reset transform and scale to CSS pixel space
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(ratio, ratio);

      // (1) Background (pure black in dark mode, pure white in light mode)
      context.fillStyle = theme === "dark" ? "#121212" : "#ffffff";
      context.fillRect(0, 0, width, height);

      // (2) Subpixel paper grid in SCREEN space (Zero blur)
      strokePaperGrid(
        context,
        template,
        viewport.scrollX,
        viewport.scrollY,
        viewport.zoom,
        theme,
        width,
        height,
      );

      // (3) World transform for vector elements
      context.save();
      context.scale(viewport.zoom, viewport.zoom);
      context.translate(viewport.scrollX, viewport.scrollY);

      const movingId = moving?.id;
      const editingId = editingText?.id;
      const renderedElements = moving ? updateBoundArrows(elements, moving) : elements;

      renderedElements.forEach((rawEl) => {
        if (rawEl.id !== movingId && rawEl.id !== editingId) {
          const el = movingMap?.get(rawEl.id) ?? rawEl;
          const normalized = el.type === "pen" ? normalizePenElement(el) : el;
          renderCanvasElement(context, canvas, normalized, theme === "dark");
        }
      });

      if (moving) {
        const normalized = moving.type === "pen" ? normalizePenElement(moving) : moving;
        renderCanvasElement(context, canvas, normalized, theme === "dark");
      }

      if (draft) {
        const normalized = draft.type === "pen" ? normalizePenElement(draft) : draft;
        renderCanvasElement(context, canvas, normalized, theme === "dark");
      }

      // Multi-selection box or single element selection box with transform handles
      if (selectedIds.length > 1 && activeTool === "select") {
        const selectedElements = elements
          .filter((el) => selectedIds.includes(el.id))
          .map((el) => movingMap?.get(el.id) ?? (el.type === "pen" ? normalizePenElement(el) : el));

        if (selectedElements.length > 1) {
          const xs = selectedElements.flatMap((el) => [el.x, el.x + el.width]);
          const ys = selectedElements.flatMap((el) => [el.y, el.y + el.height]);
          const minX = Math.min(...xs) - 8;
          const minY = Math.min(...ys) - 8;
          const maxX = Math.max(...xs) + 8;
          const maxY = Math.max(...ys) + 8;

          context.save();
          context.strokeStyle = theme === "dark" ? "#38bdf8" : "#2563eb";
          context.lineWidth = 1.5 / viewport.zoom;
          context.setLineDash([4 / viewport.zoom, 4 / viewport.zoom]);
          context.strokeRect(minX, minY, maxX - minX, maxY - minY);
          context.restore();
        }
      } else {
        const rawSelected = moving ?? elements.find((el) => el.id === (selectedId || selectedIds[0]));
        const selected = rawSelected ? (rawSelected.type === "pen" ? normalizePenElement(rawSelected) : rawSelected) : null;
        if (selected && activeTool === "select") {
          renderSelectionBox(context, selected, viewport.zoom, theme);
        }
      }

      // Draw anchor hints when drawing arrow/line
      const isDrawingConnector =
        (activeTool === "arrow" || activeTool === "line") &&
        actionRef.current?.mode === "draw";

      if (isDrawingConnector) {
        context.save();
        elements.forEach((el) => {
          if (draft && el.id === draft.id) return;
          const anchors = getElementAnchorPoints(el);
          anchors.forEach((anc) => {
            if (
              hoveredAnchor &&
              hoveredAnchor.elementId === anc.elementId &&
              hoveredAnchor.id === anc.id
            ) {
              return;
            }
            context.fillStyle =
              theme === "dark" ? "rgba(56, 189, 248, 0.45)" : "rgba(37, 99, 235, 0.45)";
            context.beginPath();
            context.arc(anc.x, anc.y, 3.5 / viewport.zoom, 0, Math.PI * 2);
            context.fill();
          });
        });
        context.restore();
      }

      // Glowing snap indicator
      if (hoveredAnchor) {
        context.save();
        context.strokeStyle = theme === "dark" ? "#38bdf8" : "#2563eb";
        context.fillStyle =
          theme === "dark" ? "rgba(56, 189, 248, 0.28)" : "rgba(37, 99, 235, 0.22)";
        context.lineWidth = 2 / viewport.zoom;
        context.beginPath();
        context.arc(hoveredAnchor.x, hoveredAnchor.y, 8 / viewport.zoom, 0, Math.PI * 2);
        context.fill();
        context.stroke();

        context.fillStyle = theme === "dark" ? "#38bdf8" : "#2563eb";
        context.beginPath();
        context.arc(hoveredAnchor.x, hoveredAnchor.y, 3 / viewport.zoom, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }

      // Marquee box selection
      if (selectionBox) {
        context.fillStyle =
          theme === "dark" ? "rgba(56, 189, 248, 0.12)" : "rgba(37, 99, 235, 0.1)";
        context.fillRect(
          selectionBox.x,
          selectionBox.y,
          selectionBox.width,
          selectionBox.height,
        );
        context.strokeStyle = theme === "dark" ? "#38bdf8" : "#2563eb";
        context.lineWidth = 1 / viewport.zoom;
        context.setLineDash([4 / viewport.zoom, 4 / viewport.zoom]);
        context.strokeRect(
          selectionBox.x,
          selectionBox.y,
          selectionBox.width,
          selectionBox.height,
        );
      }

      context.restore(); // Restore world transform
    }, [
      activeTool,
      canvasSize,
      draft,
      elements,
      hoveredAnchor,
      moving,
      movingMap,
      selectedId,
      selectedIds,
      selectionBox,
      template,
      theme,
      viewport,
    ]);

    const getScreenPoint = useCallback((event: ReactPointerEvent<HTMLCanvasElement>): Point => {
      const rect = event.currentTarget.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        pressure: event.pressure > 0 ? event.pressure : 0.5,
      };
    }, []);

    const createNewDraft = (type: ElementType, startWorld: Point): CanvasElement => {
      const isPointBased = type === "line" || type === "arrow" || type === "pen";
      let initialX = startWorld.x;
      let initialY = startWorld.y;
      let startBinding: PointBinding | undefined;

      if (type === "arrow" || type === "line") {
        const snap = findClosestAnchorPoint(startWorld, elements, undefined, 24);
        if (snap) {
          initialX = snap.anchor.x;
          initialY = snap.anchor.y;
          startBinding = { elementId: snap.anchor.elementId, pointId: snap.anchor.id };
          setHoveredAnchor(snap.anchor);
        }
      }

      return {
        id: createId("el"),
        pageId,
        type,
        x: initialX,
        y: initialY,
        width: 1,
        height: 1,
        points: isPointBased
          ? type === "pen"
            ? [{ x: 0, y: 0, pressure: startWorld.pressure }]
            : [
                { x: 0, y: 0 },
                { x: 0.5, y: 0.5 },
                { x: 1, y: 1 },
              ]
          : undefined,
        text: type === "text" || type === "sticky" ? "" : undefined,
        strokeColor:
          elementStyle.strokeColor || (theme === "dark" ? "#f5f5f5" : "#1e1e1e"),
        backgroundColor:
          type === "sticky" ? "#fef3c7" : elementStyle.backgroundColor || "transparent",
        strokeWidth: elementStyle.strokeWidth || 2,
        strokeStyle: elementStyle.strokeStyle || "solid",
        fillStyle: elementStyle.fillStyle || "solid",
        roughness: elementStyle.roughness ?? 0,
        roundness: elementStyle.roundness || "sharp",
        arrowType: elementStyle.arrowType || "straight",
        startArrowhead: elementStyle.startArrowhead || "none",
        endArrowhead:
          elementStyle.endArrowhead || (type === "arrow" ? "arrow" : "none"),
        opacity: 100,
        seed: createSeed(),
        fontSize: elementStyle.fontSize || "medium",
        customFontSize: elementStyle.customFontSize,
        fontFamily: elementStyle.fontFamily || "rough",
        textAlign: elementStyle.textAlign || "left",
        startBinding,
      };
    };

    const eraseElementsAtPoint = useCallback(
      (worldPoint: Point) => {
        const hit = [...elements]
          .reverse()
          .find((el) => pointInElement(worldPoint, el, 12 / viewport.zoom));
        if (hit) {
          onDelete(hit.id);
        }
      },
      [elements, onDelete, viewport.zoom],
    );

    const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);

      const screen = getScreenPoint(event);
      const world = screenToWorld(
        screen,
        viewport.scrollX,
        viewport.scrollY,
        viewport.zoom,
      );

      // Middle click or Hand tool initiates canvas pan
      if (event.button === 1 || activeTool === "hand") {
        actionRef.current = {
          mode: "pan",
          startScreen: screen,
          startScroll: { x: viewport.scrollX, y: viewport.scrollY },
        };
        return;
      }

      // Eraser tool: erase on down and continue erasing while dragging
      if (activeTool === "eraser") {
        actionRef.current = { mode: "erase" };
        eraseElementsAtPoint(world);
        return;
      }

      // Select tool
      if (activeTool === "select") {
        const currentSelectedId = selectedId || selectedIds[0];
        const selected = elements.find((el) => el.id === currentSelectedId);

        // Check if clicked on a drag/transform handle
        if (selected) {
          const hitHandle = getHitTransformHandle(world, selected, viewport.zoom);
          if (hitHandle) {
            actionRef.current = {
              mode: "resize",
              handle: hitHandle,
              startWorld: world,
              original: selected,
            };
            setMoving(selected);
            return;
          }
        }

        // Check if clicked inside multi-selection bounding box!
        let multiBoxHit = false;
        if (selectedIds.length > 1) {
          const selectedEls = elements.filter((el) => selectedIds.includes(el.id));
          if (selectedEls.length > 1) {
            const normEls = selectedEls.map((el) =>
              el.type === "pen" ? normalizePenElement(el) : el,
            );
            const xs = normEls.flatMap((el) => [el.x, el.x + el.width]);
            const ys = normEls.flatMap((el) => [el.y, el.y + el.height]);
            const pad = 8 / viewport.zoom;
            const minX = Math.min(...xs) - pad;
            const minY = Math.min(...ys) - pad;
            const maxX = Math.max(...xs) + pad;
            const maxY = Math.max(...ys) + pad;
            if (world.x >= minX && world.x <= maxX && world.y >= minY && world.y <= maxY) {
              multiBoxHit = true;
            }
          }
        }

        // Check if clicked inside single selected element bounding box!
        let singleBoxHit = false;
        if (selected && selectedIds.length <= 1) {
          const norm = selected.type === "pen" ? normalizePenElement(selected) : selected;
          if (norm.type === "line" || norm.type === "arrow") {
            singleBoxHit = pointInElement(world, norm, 12 / viewport.zoom);
          } else {
            const cx = norm.x + norm.width / 2;
            const cy = norm.y + norm.height / 2;
            const [testPtX, testPtY] = norm.angle
              ? rotatePoint([world.x, world.y], [cx, cy], -norm.angle)
              : [world.x, world.y];
            const pad = 8 / viewport.zoom;
            singleBoxHit =
              testPtX >= norm.x - pad &&
              testPtX <= norm.x + norm.width + pad &&
              testPtY >= norm.y - pad &&
              testPtY <= norm.y + norm.height + pad;
          }
        }

        // Check if clicked on an element
        const hit = [...elements]
          .reverse()
          .find((el) => pointInElement(world, el, 8 / viewport.zoom));

        if (multiBoxHit || singleBoxHit || (hit && selectedIds.includes(hit.id))) {
          if (event.shiftKey && hit) {
            const nextIds = selectedIds.filter((id) => id !== hit.id);
            updateSelection(nextIds);
            return;
          }

          const selectedEls = elements.filter((el) => selectedIds.includes(el.id));
          const targetEls = selectedEls.length > 0 ? selectedEls : (selected ? [selected] : []);
          const primary = hit || selected || targetEls[0];
          if (!primary) return;

          const normPrimary = primary.type === "pen" ? normalizePenElement(primary) : primary;
          const normTargets = targetEls.map((el) =>
            el.type === "pen" ? normalizePenElement(el) : el,
          );

          actionRef.current = {
            mode: "move",
            startWorld: world,
            original: normPrimary,
            originals: normTargets,
          };
          if (canvasRef.current) {
            canvasRef.current.style.cursor = "move";
          }
          if (normTargets.length > 1) {
            const map = new Map<string, CanvasElement>();
            normTargets.forEach((el) => map.set(el.id, el));
            setMovingMap(map);
            setMoving(null);
          } else {
            setMoving(normPrimary);
            setMovingMap(null);
          }
          return;
        }

        if (hit) {
          if (event.shiftKey) {
            const nextIds = selectedIds.includes(hit.id)
              ? selectedIds.filter((id) => id !== hit.id)
              : [...selectedIds, hit.id];
            updateSelection(nextIds);
            return;
          }

          updateSelection([hit.id]);
          const normHit = hit.type === "pen" ? normalizePenElement(hit) : hit;
          actionRef.current = {
            mode: "move",
            startWorld: world,
            original: normHit,
            originals: [normHit],
          };
          setMoving(normHit);
          setMovingMap(null);
          if (canvasRef.current) {
            canvasRef.current.style.cursor = "move";
          }
          return;
        }

        // Clicked on empty canvas: deselect and start box selection
        updateSelection([]);
        actionRef.current = { mode: "boxSelect", startWorld: world };
        return;
      }

      // Text tool: drag to create bounded box, or click for auto-resize text!
      if (activeTool === "text") {
        if (editingText) {
          commitInlineText();
        }
        actionRef.current = { mode: "draw", startWorld: world };
        const nextDraft = createNewDraft("text", world);
        nextDraft.text = "";
        setDraft(nextDraft);
        return;
      }

      // Drawing mode for shapes / pen
      const nextDraft = createNewDraft(activeTool, world);
      if (activeTool === "sticky") {
        nextDraft.width = 160;
        nextDraft.height = 120;
      }
      setDraft(nextDraft);
      actionRef.current = { mode: "draw", startWorld: world };
    };

    const onDoubleClick = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const screen = getScreenPoint(event);
      const world = screenToWorld(
        screen,
        viewport.scrollX,
        viewport.scrollY,
        viewport.zoom,
      );

      const hit = [...elements]
        .reverse()
        .find((el) => pointInElement(world, el, 8 / viewport.zoom));

      if (hit) {
        setEditingText({
          id: hit.id,
          x: hit.x,
          y: hit.y,
          width: hit.width,
          height: hit.height,
          text: hit.text === "Sticky note" ? "" : (hit.text ?? ""),
          fontSize: hit.fontSize || "medium",
          textAlign: hit.textAlign || (hit.type === "sticky" ? "left" : "center"),
          strokeColor: hit.type === "sticky" ? "#1e1e1e" : hit.strokeColor,
          type: hit.type === "sticky" ? "sticky" : "text",
          backgroundColor: hit.backgroundColor,
          isBounded: hit.width > 60,
        });
      }
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const action = actionRef.current;
      const screen = getScreenPoint(event);
      const world = screenToWorld(
        screen,
        viewport.scrollX,
        viewport.scrollY,
        viewport.zoom,
      );

      if (!action) {
        // Dynamic hover cursor updates
        const canvas = canvasRef.current;
        if (!canvas) return;

        if (activeTool === "select") {
          const currentSelectedId = selectedId || selectedIds[0];
          const selected = elements.find((el) => el.id === currentSelectedId);
          if (selected) {
            const handle = getHitTransformHandle(world, selected, viewport.zoom);
            if (handle) {
              canvas.style.cursor = getHandleCursor(handle);
              return;
            }
          }

          // Hovering inside multi-selection bounding box -> 4-arrow move cursor
          if (selectedIds.length > 1) {
            const selectedEls = elements.filter((el) => selectedIds.includes(el.id));
            if (selectedEls.length > 1) {
              const normEls = selectedEls.map((el) =>
                el.type === "pen" ? normalizePenElement(el) : el,
              );
              const xs = normEls.flatMap((el) => [el.x, el.x + el.width]);
              const ys = normEls.flatMap((el) => [el.y, el.y + el.height]);
              const pad = 8 / viewport.zoom;
              const minX = Math.min(...xs) - pad;
              const minY = Math.min(...ys) - pad;
              const maxX = Math.max(...xs) + pad;
              const maxY = Math.max(...ys) + pad;
              if (world.x >= minX && world.x <= maxX && world.y >= minY && world.y <= maxY) {
                canvas.style.cursor = "move";
                return;
              }
            }
          }

          // Hovering inside single selected element bounding box -> 4-arrow move cursor
          if (selected && selectedIds.length <= 1) {
            const norm = selected.type === "pen" ? normalizePenElement(selected) : selected;
            if (norm.type === "line" || norm.type === "arrow") {
              if (pointInElement(world, norm, 12 / viewport.zoom)) {
                canvas.style.cursor = "move";
                return;
              }
            } else {
              const cx = norm.x + norm.width / 2;
              const cy = norm.y + norm.height / 2;
              const [testPtX, testPtY] = norm.angle
                ? rotatePoint([world.x, world.y], [cx, cy], -norm.angle)
                : [world.x, world.y];
              const pad = 8 / viewport.zoom;
              if (
                testPtX >= norm.x - pad &&
                testPtX <= norm.x + norm.width + pad &&
                testPtY >= norm.y - pad &&
                testPtY <= norm.y + norm.height + pad
              ) {
                canvas.style.cursor = "move";
                return;
              }
            }
          }

          const hit = [...elements]
            .reverse()
            .find((el) => pointInElement(world, el, 8 / viewport.zoom));
          if (hit) {
            canvas.style.cursor = "move";
            return;
          }
          canvas.style.cursor = "default";
        } else if (activeTool === "text") {
          canvas.style.cursor = "text";
        } else if (activeTool === "hand") {
          canvas.style.cursor = "grab";
        } else {
          canvas.style.cursor = "crosshair";
        }
        return;
      }

      if (action.mode === "pan") {
        const dx = (screen.x - action.startScreen.x) / viewport.zoom;
        const dy = (screen.y - action.startScreen.y) / viewport.zoom;
        setViewport((prev) => ({
          ...prev,
          scrollX: action.startScroll.x + dx,
          scrollY: action.startScroll.y + dy,
        }));
        return;
      }

      // Dragging eraser: erase anything passing under cursor
      if (action.mode === "erase") {
        eraseElementsAtPoint(world);
        return;
      }

      if (action.mode === "move") {
        if (canvasRef.current) {
          canvasRef.current.style.cursor = "move";
        }
        const dx = world.x - action.startWorld.x;
        const dy = world.y - action.startWorld.y;

        if (action.originals && action.originals.length > 1) {
          const map = new Map<string, CanvasElement>();
          action.originals.forEach((orig) => {
            map.set(orig.id, {
              ...orig,
              x: orig.x + dx,
              y: orig.y + dy,
            });
          });
          setMovingMap(map);
        } else if (action.original) {
          setMoving({
            ...action.original,
            x: action.original.x + dx,
            y: action.original.y + dy,
          });
        }
        return;
      }

      if (action.mode === "resize" && action.original) {
        const orig = action.original;
        const dx = world.x - action.startWorld.x;
        const dy = world.y - action.startWorld.y;

        // Line and Arrow: endpoint & midpoint drag handles
        if (orig.type === "line" || orig.type === "arrow") {
          const p0 = orig.points?.[0] ?? { x: 0, y: 0 };
          const p1 = orig.points?.[orig.points.length - 1] ?? { x: orig.width, y: orig.height };
          const pMid =
            orig.points && orig.points.length >= 3
              ? orig.points[1]
              : { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
          const nextPoints = [{ ...p0 }, { ...pMid }, { ...p1 }];

          let nextStartBinding = orig.startBinding;
          let nextEndBinding = orig.endBinding;

          if (action.handle === "p0") {
            let targetWorld = { x: orig.x + p0.x + dx, y: orig.y + p0.y + dy };
            const snap = findClosestAnchorPoint(targetWorld, elements, orig.id, 24);
            if (snap) {
              targetWorld = { x: snap.anchor.x, y: snap.anchor.y };
              nextStartBinding = { elementId: snap.anchor.elementId, pointId: snap.anchor.id };
              setHoveredAnchor(snap.anchor);
            } else {
              nextStartBinding = undefined;
              setHoveredAnchor(null);
            }
            nextPoints[0] = { x: targetWorld.x - orig.x, y: targetWorld.y - orig.y };
          } else if (action.handle === "pMid") {
            nextPoints[1] = { x: pMid.x + dx, y: pMid.y + dy };
          } else if (action.handle === "p1") {
            let targetWorld = { x: orig.x + p1.x + dx, y: orig.y + p1.y + dy };
            const snap = findClosestAnchorPoint(targetWorld, elements, orig.id, 24);
            if (snap) {
              targetWorld = { x: snap.anchor.x, y: snap.anchor.y };
              nextEndBinding = { elementId: snap.anchor.elementId, pointId: snap.anchor.id };
              setHoveredAnchor(snap.anchor);
            } else {
              nextEndBinding = undefined;
              setHoveredAnchor(null);
            }
            nextPoints[2] = { x: targetWorld.x - orig.x, y: targetWorld.y - orig.y };
          }

          setMoving({
            ...orig,
            points: nextPoints,
            startBinding: nextStartBinding,
            endBinding: nextEndBinding,
          });
          return;
        }

        // Top circle rotation handle
        if (action.handle === "rotation") {
          const cx = orig.x + orig.width / 2;
          const cy = orig.y + orig.height / 2;
          const rad = Math.atan2(world.y - cy, world.x - cx) + Math.PI / 2;
          let angle = rad;
          const snapInterval = Math.PI / 12; // 15 degrees snap
          const snapped = Math.round(angle / snapInterval) * snapInterval;
          if (Math.abs(angle - snapped) < 0.08) {
            angle = snapped;
          }
          setMoving({
            ...orig,
            angle,
          });
          return;
        }

        // 2D Shapes resize (accounting for element angle)
        let effDx = dx;
        let effDy = dy;
        if (orig.angle) {
          const cos = Math.cos(-orig.angle);
          const sin = Math.sin(-orig.angle);
          effDx = dx * cos - dy * sin;
          effDy = dx * sin + dy * cos;
        }

        let newX = orig.x;
        let newY = orig.y;
        let newW = orig.width;
        let newH = orig.height;

        if (action.handle === "se") {
          newW = Math.max(10, orig.width + effDx);
          newH = Math.max(10, orig.height + effDy);
        } else if (action.handle === "ne") {
          const h = orig.height - effDy;
          if (h >= 10) {
            newY = orig.y + effDy;
            newH = h;
          } else {
            newY = orig.y + orig.height - 10;
            newH = 10;
          }
          newW = Math.max(10, orig.width + effDx);
        } else if (action.handle === "sw") {
          const w = orig.width - effDx;
          if (w >= 10) {
            newX = orig.x + effDx;
            newW = w;
          } else {
            newX = orig.x + orig.width - 10;
            newW = 10;
          }
          newH = Math.max(10, orig.height + effDy);
        } else if (action.handle === "nw") {
          const w = orig.width - effDx;
          const h = orig.height - effDy;
          if (w >= 10) {
            newX = orig.x + effDx;
            newW = w;
          } else {
            newX = orig.x + orig.width - 10;
            newW = 10;
          }
          if (h >= 10) {
            newY = orig.y + effDy;
            newH = h;
          } else {
            newY = orig.y + orig.height - 10;
            newH = 10;
          }
        } else if (action.handle === "e") {
          newW = Math.max(10, orig.width + effDx);
        } else if (action.handle === "s") {
          newH = Math.max(10, orig.height + effDy);
        } else if (action.handle === "w") {
          const w = orig.width - effDx;
          if (w >= 10) {
            newX = orig.x + effDx;
            newW = w;
          } else {
            newX = orig.x + orig.width - 10;
            newW = 10;
          }
        } else if (action.handle === "n") {
          const h = orig.height - effDy;
          if (h >= 10) {
            newY = orig.y + effDy;
            newH = h;
          } else {
            newY = orig.y + orig.height - 10;
            newH = 10;
          }
        }

        if (orig.angle) {
          const origCx = orig.x + orig.width / 2;
          const origCy = orig.y + orig.height / 2;
          const localCenterShiftX = newX + newW / 2 - origCx;
          const localCenterShiftY = newY + newH / 2 - origCy;
          const cos = Math.cos(orig.angle);
          const sin = Math.sin(orig.angle);
          const rotShiftX = localCenterShiftX * cos - localCenterShiftY * sin;
          const rotShiftY = localCenterShiftX * sin + localCenterShiftY * cos;
          const finalCx = origCx + rotShiftX;
          const finalCy = origCy + rotShiftY;
          newX = finalCx - newW / 2;
          newY = finalCy - newH / 2;
        }

        setMoving({
          ...orig,
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        });
        return;
      }

      if (action.mode === "boxSelect") {
        setSelectionBox(normalizeBox(action.startWorld, world));
        return;
      }

      if (action.mode === "draw") {
        setDraft((current) => {
          if (!current) return null;

          if (current.type === "pen") {
            const localPoint = {
              x: world.x - action.startWorld.x,
              y: world.y - action.startWorld.y,
              pressure: world.pressure,
            };
            const rawPoints = [...(current.points ?? []), localPoint];
            const xs = rawPoints.map((p) => p.x);
            const ys = rawPoints.map((p) => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);

            return {
              ...current,
              points: rawPoints,
              width: Math.max(maxX - minX, 2),
              height: Math.max(maxY - minY, 2),
            };
          }

          if (current.type === "line" || current.type === "arrow") {
            let targetWorld = world;
            let endBinding = current.endBinding;
            const snap = findClosestAnchorPoint(world, elements, current.id, 24);
            if (snap) {
              targetWorld = { x: snap.anchor.x, y: snap.anchor.y };
              endBinding = { elementId: snap.anchor.elementId, pointId: snap.anchor.id };
              setHoveredAnchor(snap.anchor);
            } else {
              endBinding = undefined;
              setHoveredAnchor(null);
            }

            const dx = targetWorld.x - current.x;
            const dy = targetWorld.y - current.y;
            return {
              ...current,
              endBinding,
              width: Math.max(Math.abs(dx), 1),
              height: Math.max(Math.abs(dy), 1),
              points: [
                { x: 0, y: 0 },
                { x: dx / 2, y: dy / 2 },
                { x: dx, y: dy },
              ],
            };
          }

          // Box shapes (rectangle, ellipse, diamond)
          const box = normalizeBox(action.startWorld, world);
          return {
            ...current,
            x: box.x,
            y: box.y,
            width: Math.max(box.width, 1),
            height: Math.max(box.height, 1),
          };
        });
      }
    };

    const finishPointerAction = (event?: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event?.currentTarget && event?.pointerId !== undefined) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {}
      }

      if (movingMap && movingMap.size > 0) {
        const movedList = Array.from(movingMap.values()).map((el) =>
          el.type === "pen" ? normalizePenElement(el) : el,
        );
        if (onCommitBatch) {
          onCommitBatch(movedList);
        } else {
          movedList.forEach((el) => onCommit(el));
        }
        setMovingMap(null);
      } else if (moving) {
        const normalized = moving.type === "pen" ? normalizePenElement(moving) : moving;
        onCommit(normalized);
        const updatedArrows = updateBoundArrows(elements, normalized);
        updatedArrows.forEach((el) => {
          if (
            el.id !== normalized.id &&
            (el.startBinding?.elementId === normalized.id ||
              el.endBinding?.elementId === normalized.id)
          ) {
            onCommit(el);
          }
        });
        setMoving(null);
      }

      if (draft) {
        // Pen tool pointer-up: commit stroke, KEEP pen active without switching to select
        if (draft.type === "pen") {
          if ((draft.points?.length ?? 0) > 1) {
            const normalized = normalizePenElement(draft);
            onCommit(normalized);
          }
          setDraft(null);
          setMoving(null);
          setMovingMap(null);
          setSelectionBox(null);
          setHoveredAnchor(null);
          actionRef.current = null;
          return;
        }

        // Text tool pointer-up: bounded text box if dragged, single click if clicked
        if (draft.type === "text") {
          const isBounded = draft.width > 20 && draft.height > 20;
          setEditingText({
            x: draft.x,
            y: draft.y,
            width: isBounded ? Math.max(draft.width, 100) : undefined,
            height: isBounded ? Math.max(draft.height, 40) : undefined,
            text: "",
            fontSize: elementStyle.fontSize || "medium",
            textAlign: elementStyle.textAlign || "left",
            strokeColor:
              elementStyle.strokeColor || (theme === "dark" ? "#f5f5f5" : "#1e1e1e"),
            type: "text",
            isBounded,
          });
          setDraft(null);
          setMoving(null);
          setSelectionBox(null);
          setHoveredAnchor(null);
          actionRef.current = null;
          if (!isToolLocked) {
            onToolChange("select");
          }
          return;
        }

        const canCommit =
          draft.type === "sticky" ||
          draft.width > 4 ||
          draft.height > 4;

        if (canCommit) {
          onCommit(draft);
          updateSelection([draft.id]);
          if (!isToolLocked) {
            onToolChange("select");
          }
          if (draft.type === "sticky") {
            setEditingText({
              id: draft.id,
              x: draft.x,
              y: draft.y,
              width: draft.width,
              height: draft.height,
              text: draft.text ?? "",
              fontSize: draft.fontSize || "medium",
              textAlign: draft.textAlign || "left",
              strokeColor: draft.strokeColor,
              type: "sticky",
              backgroundColor: draft.backgroundColor,
              isBounded: true,
            });
          }
        }
      }

      if (selectionBox) {
        const normBox = {
          x: Math.min(selectionBox.x, selectionBox.x + selectionBox.width),
          y: Math.min(selectionBox.y, selectionBox.y + selectionBox.height),
          width: Math.abs(selectionBox.width),
          height: Math.abs(selectionBox.height),
        };

        if (normBox.width > 5 || normBox.height > 5) {
          // Select elements that intersect or are inside the selection box
          const contained = elements.filter((el) => doesElementIntersectBox(el, normBox));
          if (contained.length > 0) {
            updateSelection(contained.map((e) => e.id));
          } else {
            updateSelection([]);
          }
        } else {
          updateSelection([]);
        }
      }

      setDraft(null);
      setMoving(null);
      setMovingMap(null);
      setSelectionBox(null);
      setHoveredAnchor(null);
      actionRef.current = null;
    };

    const selectedElement = elements.find((el) => el.id === (selectedId || selectedIds[0])) ?? null;

    return (
      <div className="canvas-shell" ref={containerRef} data-tool={activeTool}>
        <canvas
          ref={canvasRef}
          className="whiteboard-canvas"
          tabIndex={0}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          aria-label={`${pageTitle} whiteboard canvas`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishPointerAction}
          onPointerCancel={finishPointerAction}
          onDoubleClick={onDoubleClick}
          onContextMenu={(event) => event.preventDefault()}
        />

        {editingText ? (
          <textarea
            ref={textareaRef}
            className="inline-canvas-editor"
            style={{
              position: "absolute",
              left: `${(editingText.x + viewport.scrollX) * viewport.zoom}px`,
              top: `${(editingText.y + viewport.scrollY) * viewport.zoom}px`,
              width: editingText.width ? `${editingText.width * viewport.zoom}px` : "auto",
              height: editingText.height ? `${editingText.height * viewport.zoom}px` : "auto",
              fontSize: `${getFontSizeInPx(editingText.fontSize) * viewport.zoom}px`,
              lineHeight: 1.35,
              textAlign: editingText.textAlign,
              color: applyDarkModeFilter(editingText.strokeColor, theme === "dark", false),
              minWidth: `${Math.max(editingText.width ? editingText.width * viewport.zoom : 80, 80)}px`,
              minHeight: `${Math.max(editingText.height ? editingText.height * viewport.zoom : 36, 36)}px`,
              background:
                editingText.type === "sticky"
                  ? editingText.backgroundColor || "#fef3c7"
                  : "transparent",
            }}
            value={editingText.text}
            placeholder={editingText.type === "sticky" ? "Write sticky note..." : "Type text..."}
            onChange={(e) => {
              const val = e.target.value;
              setEditingText((prev) => (prev ? { ...prev, text: val } : null));
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                commitInlineText();
              } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                commitInlineText();
              }
            }}
            onBlur={commitInlineText}
          />
        ) : null}
      </div>
    );
  },
);
