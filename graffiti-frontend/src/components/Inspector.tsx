import { useState, useRef, type CSSProperties } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  GripHorizontal,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { ColorPickerPopover } from "./ColorPickerPopover";
import type {
  ArrowType,
  Arrowhead,
  CanvasElement,
  ElementStyle,
  FillStyle,
  FontFamily,
  FontSize,
  Roundness,
  StrokeStyle,
  TextAlign,
  ToolId,
} from "../types";

interface InspectorProps {
  activeTool?: ToolId;
  selected: CanvasElement | null;
  style: ElementStyle;
  theme?: "dark" | "light";
  isEditingText?: boolean;
  onStyleChange: (style: ElementStyle) => void;
  onSelectedChange: (patch: Partial<CanvasElement>) => void;
  onDuplicateSelected?: () => void;
  onDeleteSelected?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
}

const defaultStrokePicks = [
  "#1e1e1e",
  "#e03131",
  "#2f9e44",
  "#1971c2",
  "#f08c00",
];

const defaultFillPicks = [
  "transparent",
  "#ffc9c9",
  "#b2f2bb",
  "#a5d8ff",
  "#ffec99",
];

const stickyPalettes = [
  "#fef3c7",
  "#fee2e2",
  "#dcfce7",
  "#e0e7ff",
  "#f3e8ff",
  "#ffedd5",
];

const strokeWidthOptions = [
  { label: "Thin", value: 1.5, stroke: 1.5 },
  { label: "Medium", value: 3, stroke: 3 },
  { label: "Bold", value: 5, stroke: 4.5 },
];

const strokeStyleOptions: Array<{ label: string; value: StrokeStyle }> = [
  { label: "Solid", value: "solid" },
  { label: "Dashed", value: "dashed" },
  { label: "Dotted", value: "dotted" },
];

const fontSizeOptions: Array<{ label: string; value: FontSize; px: number }> = [
  { label: "S", value: "small", px: 14 },
  { label: "M", value: "medium", px: 18 },
  { label: "L", value: "large", px: 24 },
  { label: "XL", value: "xlarge", px: 32 },
];

export function Inspector({
  activeTool = "select",
  selected,
  style,
  theme = "dark",
  isEditingText = false,
  onStyleChange,
  onSelectedChange,
  onDuplicateSelected,
  onDeleteSelected,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
}: InspectorProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [strokePickerOpen, setStrokePickerOpen] = useState(false);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);

  const inspectorRef = useRef<HTMLDivElement>(null);
  const strokeTriggerRef = useRef<HTMLButtonElement>(null);
  const bgTriggerRef = useRef<HTMLButtonElement>(null);

  // Draggable Inspector panel state
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);

  const handlePointerDownHeader = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const rect = inspectorRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: panelPos ? panelPos.x : rect.left,
      posY: panelPos ? panelPos.y : rect.top,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveHeader = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;
    const newX = Math.max(10, Math.min(window.innerWidth - 270, dragStartRef.current.posX + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 80, dragStartRef.current.posY + dy));
    setPanelPos({ x: newX, y: newY });
  };

  const handlePointerUpHeader = (e: React.PointerEvent) => {
    dragStartRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const currentStyle: ElementStyle = selected
    ? {
        strokeColor: selected.strokeColor,
        backgroundColor: selected.backgroundColor,
        strokeWidth: selected.strokeWidth,
        strokeStyle: selected.strokeStyle || "solid",
        fillStyle: selected.fillStyle || "solid",
        roughness: selected.roughness ?? 0,
        roundness: selected.roundness || "sharp",
        arrowType: selected.arrowType || "straight",
        startArrowhead: selected.startArrowhead || "none",
        endArrowhead:
          selected.endArrowhead || (selected.type === "arrow" ? "arrow" : "none"),
        fontSize: selected.fontSize || "medium",
        customFontSize: selected.customFontSize,
        fontFamily: selected.fontFamily || "rough",
        textAlign: selected.textAlign || "left",
      }
    : style;

  const currentOpacity = selected ? selected.opacity : 100;

  // Update both current selection and default style for persistence
  const updateStyle = (patch: Partial<ElementStyle>) => {
    const next = { ...currentStyle, ...patch };
    onStyleChange(next);
    if (selected) {
      onSelectedChange(patch);
    }
  };

  const effectiveType = selected ? selected.type : activeTool;

  const isTextMode = isEditingText || effectiveType === "text" || activeTool === "text";
  const isStickyMode = effectiveType === "sticky";
  const isArrowMode = !isTextMode && effectiveType === "arrow";
  const isLineMode = !isTextMode && effectiveType === "line";
  const isLinearMode = isArrowMode || isLineMode;
  const isRectangleMode =
    !isTextMode && (effectiveType === "rectangle" || (!selected && activeTool === "rectangle"));
  const isShapeMode =
    !isTextMode &&
    !isStickyMode &&
    (effectiveType === "rectangle" ||
      effectiveType === "ellipse" ||
      effectiveType === "diamond" ||
      (!selected &&
        (activeTool === "rectangle" ||
          activeTool === "ellipse" ||
          activeTool === "diamond" ||
          activeTool === "select" ||
          activeTool === "hand" ||
          activeTool === "eraser")));
  const isPenMode = !isTextMode && effectiveType === "pen";

  const titleText = isEditingText
    ? "Text"
    : selected
    ? selected.type === "sticky"
      ? "Sticky Note"
      : selected.type.charAt(0).toUpperCase() + selected.type.slice(1)
    : activeTool === "text"
    ? "Text Tool"
    : activeTool !== "select" && activeTool !== "hand" && activeTool !== "eraser"
    ? `${activeTool.charAt(0).toUpperCase() + activeTool.slice(1)} Tool`
    : "Tool Defaults";

  // Active arrowheads combination
  const hasStartHead =
    currentStyle.startArrowhead && currentStyle.startArrowhead !== "none";
  const hasEndHead =
    currentStyle.endArrowhead && currentStyle.endArrowhead !== "none";
  const activeArrowheadCombo =
    hasStartHead && hasEndHead
      ? "both"
      : hasStartHead
      ? "start"
      : hasEndHead
      ? "end"
      : "none";

  const activeHeadStyle: Arrowhead =
    (currentStyle.endArrowhead && currentStyle.endArrowhead !== "none"
      ? currentStyle.endArrowhead
      : null) ||
    (currentStyle.startArrowhead && currentStyle.startArrowhead !== "none"
      ? currentStyle.startArrowhead
      : null) ||
    (style.endArrowhead && style.endArrowhead !== "none"
      ? style.endArrowhead
      : null) ||
    "arrow";

  return (
    <aside
      ref={inspectorRef}
      className={`inspector ${isCollapsed ? "collapsed" : ""}`}
      style={
        panelPos
          ? {
              position: "fixed",
              left: `${panelPos.x}px`,
              top: `${panelPos.y}px`,
              right: "auto",
              zIndex: 40,
            }
          : undefined
      }
      aria-label="Properties Inspector"
    >
      <div
        className="inspector-header"
        style={{ cursor: "grab", touchAction: "none" }}
        title="Drag to move panel (Double-click to reset)"
        onPointerDown={handlePointerDownHeader}
        onPointerMove={handlePointerMoveHeader}
        onPointerUp={handlePointerUpHeader}
        onDoubleClick={() => setPanelPos(null)}
      >
        <div className="inspector-title-wrap">
          <GripHorizontal size={14} className="drag-handle-grip" />
          <h2 className="inspector-title">{titleText}</h2>
        </div>
        <button
          type="button"
          className="inspector-toggle-btn"
          aria-label={isCollapsed ? "Expand inspector" : "Collapse inspector"}
          onClick={() => setIsCollapsed((prev) => !prev)}
        >
          {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      <div className="inspector-body">
        {/* Stroke / Text Color */}
        {!isStickyMode && (
          <section className="inspector-section color-section">
            <span className="section-label">
              {isTextMode ? "Text Color" : "Stroke"}
            </span>
            <div className="swatches-row">
              <div className="swatches-quick-picks">
                {defaultStrokePicks.map((color) => {
                  const displayColor =
                    theme === "dark" && color === "#1e1e1e" ? "#ffffff" : color;
                  const isSelected =
                    currentStyle.strokeColor === color ||
                    ((color === "#1e1e1e" || color === "#ffffff") &&
                      (currentStyle.strokeColor === "#1e1e1e" ||
                        currentStyle.strokeColor === "#ffffff" ||
                        currentStyle.strokeColor === "#f5f5f5" ||
                        currentStyle.strokeColor === "#f0f6fc"));

                  return (
                    <button
                      key={color}
                      type="button"
                      className="swatch-btn"
                      data-selected={isSelected}
                      style={{ "--swatch-color": displayColor } as CSSProperties}
                      aria-label={`Set color ${color}`}
                      onClick={() => {
                        updateStyle({ strokeColor: color });
                        setStrokePickerOpen(false);
                      }}
                    />
                  );
                })}
              </div>

              <div className="swatch-separator" aria-hidden="true" />

              {/* Active / Custom Color Swatch with Popover Trigger */}
              <div className="custom-color-trigger-wrap">
                <button
                  ref={strokeTriggerRef}
                  type="button"
                  className="swatch-btn custom-swatch-btn"
                  data-active={strokePickerOpen}
                  style={
                    {
                      "--swatch-color":
                        theme === "dark" &&
                        (currentStyle.strokeColor === "#1e1e1e" ||
                          currentStyle.strokeColor === "#000000")
                          ? "#ffffff"
                          : currentStyle.strokeColor || "#1e1e1e",
                    } as CSSProperties
                  }
                  title="Custom stroke color"
                  aria-label="Open custom stroke color picker"
                  onClick={() => {
                    setStrokePickerOpen((prev) => !prev);
                    setBgPickerOpen(false);
                  }}
                />

                {strokePickerOpen && (
                  <ColorPickerPopover
                    type="stroke"
                    color={currentStyle.strokeColor || "#1e1e1e"}
                    theme={theme}
                    anchorRect={strokeTriggerRef.current?.getBoundingClientRect()}
                    onColorChange={(newColor) => updateStyle({ strokeColor: newColor })}
                    onClose={() => setStrokePickerOpen(false)}
                  />
                )}
              </div>
            </div>
          </section>
        )}

        {/* Fill Color for 2D Shapes */}
        {isShapeMode && (
          <section className="inspector-section color-section">
            <span className="section-label">Background</span>
            <div className="swatches-row">
              <div className="swatches-quick-picks">
                {defaultFillPicks.map((color) => {
                  const isSelected =
                    (currentStyle.backgroundColor || "transparent") === color;

                  return (
                    <button
                      key={color}
                      type="button"
                      className={`swatch-btn ${
                        color === "transparent" ? "transparent-swatch" : ""
                      }`}
                      data-selected={isSelected}
                      style={{ "--swatch-color": color } as CSSProperties}
                      aria-label={`Set background color ${color}`}
                      onClick={() => {
                        updateStyle({ backgroundColor: color });
                        setBgPickerOpen(false);
                      }}
                    />
                  );
                })}
              </div>

              <div className="swatch-separator" aria-hidden="true" />

              {/* Active / Custom Background Swatch */}
              <div className="custom-color-trigger-wrap">
                <button
                  ref={bgTriggerRef}
                  type="button"
                  className={`swatch-btn custom-swatch-btn ${
                    currentStyle.backgroundColor === "transparent"
                      ? "transparent-swatch"
                      : ""
                  }`}
                  data-active={bgPickerOpen}
                  style={
                    {
                      "--swatch-color":
                        currentStyle.backgroundColor || "transparent",
                    } as CSSProperties
                  }
                  title="Custom background color"
                  aria-label="Open custom background color picker"
                  onClick={() => {
                    setBgPickerOpen((prev) => !prev);
                    setStrokePickerOpen(false);
                  }}
                />

                {bgPickerOpen && (
                  <ColorPickerPopover
                    type="background"
                    color={currentStyle.backgroundColor || "transparent"}
                    theme={theme}
                    anchorRect={bgTriggerRef.current?.getBoundingClientRect()}
                    onColorChange={(newColor) =>
                      updateStyle({ backgroundColor: newColor })
                    }
                    onClose={() => setBgPickerOpen(false)}
                  />
                )}
              </div>
            </div>
          </section>
        )}

        {/* Fill Style (Solid, Semi, Hachure, Transparent) */}
        {isShapeMode && currentStyle.backgroundColor !== "transparent" && (
          <section className="inspector-section">
            <span className="section-label">Fill Style</span>
            <div className="segmented-row">
              {(
                [
                  {
                    id: "solid" as FillStyle,
                    label: "Solid",
                    svg: (
                      <svg width="18" height="18" viewBox="0 0 18 18">
                        <rect x="2" y="2" width="14" height="14" rx="2" fill="currentColor" />
                      </svg>
                    ),
                  },
                  {
                    id: "semi" as FillStyle,
                    label: "Semi",
                    svg: (
                      <svg width="18" height="18" viewBox="0 0 18 18">
                        <rect
                          x="2"
                          y="2"
                          width="14"
                          height="14"
                          rx="2"
                          fill="currentColor"
                          fillOpacity="0.4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                    ),
                  },
                  {
                    id: "hachure" as FillStyle,
                    label: "Hachure",
                    svg: (
                      <svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.4">
                        <rect x="2" y="2" width="14" height="14" rx="2" fill="none" />
                        <line x1="4" y1="12" x2="12" y2="4" />
                        <line x1="6" y1="16" x2="16" y2="6" />
                        <line x1="12" y1="16" x2="16" y2="12" />
                      </svg>
                    ),
                  },
                  {
                    id: "cross-hatch" as FillStyle,
                    label: "Cross-Hatch",
                    svg: (
                      <svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.3">
                        <rect x="2" y="2" width="14" height="14" rx="2" fill="none" />
                        <line x1="4" y1="14" x2="14" y2="4" />
                        <line x1="4" y1="4" x2="14" y2="14" />
                      </svg>
                    ),
                  },
                ]
              ).map(({ id, label, svg }) => (
                <button
                  key={id}
                  type="button"
                  className="segmented-btn"
                  data-active={(currentStyle.fillStyle || "solid") === id}
                  title={`Fill style: ${label}`}
                  onClick={() => updateStyle({ fillStyle: id })}
                >
                  {svg}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Sticky Note Color */}
        {isStickyMode && (
          <section className="inspector-section">
            <span className="section-label">Note Color</span>
            <div className="swatches-grid">
              {stickyPalettes.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="swatch-btn"
                  data-selected={currentStyle.backgroundColor === color}
                  style={{ "--swatch-color": color } as CSSProperties}
                  aria-label={`Set sticky color ${color}`}
                  onClick={() => updateStyle({ backgroundColor: color })}
                />
              ))}
            </div>
          </section>
        )}

        {/* Stroke Width */}
        {(isShapeMode || isLinearMode || isPenMode) && (
          <section className="inspector-section">
            <span className="section-label">Stroke Width</span>
            <div className="segmented-row">
              {strokeWidthOptions.map(({ label, value, stroke }) => (
                <button
                  key={label}
                  type="button"
                  className="segmented-btn"
                  data-active={currentStyle.strokeWidth === value}
                  title={`Stroke width: ${label}`}
                  onClick={() => updateStyle({ strokeWidth: value })}
                >
                  <svg width="24" height="12" viewBox="0 0 24 12">
                    <line
                      x1="2"
                      y1="6"
                      x2="22"
                      y2="6"
                      stroke="currentColor"
                      strokeWidth={stroke}
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Stroke Style (Solid / Dashed / Dotted) */}
        {(isShapeMode || isLinearMode) && (
          <section className="inspector-section">
            <span className="section-label">Stroke Style</span>
            <div className="segmented-row">
              {(
                [
                  {
                    id: "solid" as StrokeStyle,
                    label: "Solid",
                    svg: (
                      <svg width="24" height="12" viewBox="0 0 24 12">
                        <line x1="2" y1="6" x2="22" y2="6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                      </svg>
                    ),
                  },
                  {
                    id: "dashed" as StrokeStyle,
                    label: "Dashed",
                    svg: (
                      <svg width="24" height="12" viewBox="0 0 24 12">
                        <line x1="2" y1="6" x2="22" y2="6" stroke="currentColor" strokeWidth="2.2" strokeDasharray="5 3" strokeLinecap="round" />
                      </svg>
                    ),
                  },
                  {
                    id: "dotted" as StrokeStyle,
                    label: "Dotted",
                    svg: (
                      <svg width="24" height="12" viewBox="0 0 24 12">
                        <line x1="2" y1="6" x2="22" y2="6" stroke="currentColor" strokeWidth="2.2" strokeDasharray="1.5 3.5" strokeLinecap="round" />
                      </svg>
                    ),
                  },
                ]
              ).map(({ id, label, svg }) => (
                <button
                  key={id}
                  type="button"
                  className="segmented-btn"
                  data-active={(currentStyle.strokeStyle || "solid") === id}
                  title={`Stroke style: ${label}`}
                  onClick={() => updateStyle({ strokeStyle: id })}
                >
                  {svg}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Sloppiness / Roughness (Architect, Artist, Cartoonist) */}
        {(isShapeMode || isLinearMode) && (
          <section className="inspector-section">
            <span className="section-label">Sloppiness</span>
            <div className="segmented-row">
              {(
                [
                  {
                    value: 0,
                    label: "Architect",
                    svg: (
                      <svg width="24" height="14" viewBox="0 0 24 14" fill="none">
                        <path d="M2 7 C 8 6.5, 16 7.5, 22 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    ),
                  },
                  {
                    value: 1,
                    label: "Artist",
                    svg: (
                      <svg width="24" height="14" viewBox="0 0 24 14" fill="none">
                        <path d="M2 9 C 7 3, 15 12, 22 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    ),
                  },
                  {
                    value: 2,
                    label: "Cartoonist",
                    svg: (
                      <svg width="24" height="14" viewBox="0 0 24 14" fill="none">
                        <path d="M2 10 C 6 2, 10 13, 14 3 C 18 12, 21 6, 22 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    ),
                  },
                ]
              ).map(({ value, label, svg }) => (
                <button
                  key={value}
                  type="button"
                  className="segmented-btn"
                  data-active={(currentStyle.roughness ?? 0) === value}
                  title={`Sloppiness: ${label}`}
                  onClick={() => updateStyle({ roughness: value })}
                >
                  {svg}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Edges (Sharp corners vs Round corners) - for Rectangles */}
        {isRectangleMode && (
          <section className="inspector-section">
            <span className="section-label">Edges</span>
            <div className="segmented-row">
              {(
                [
                  {
                    value: "sharp" as Roundness,
                    label: "Sharp",
                    svg: (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M4 14 L4 5 L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="miter" />
                      </svg>
                    ),
                  },
                  {
                    value: "round" as Roundness,
                    label: "Round",
                    svg: (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M4 14 L4 9 C 4 6, 7 5, 10 5 L14 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ),
                  },
                ]
              ).map(({ value, label, svg }) => (
                <button
                  key={value}
                  type="button"
                  className="segmented-btn"
                  data-active={(currentStyle.roundness || "sharp") === value}
                  title={`Edges: ${label}`}
                  onClick={() => updateStyle({ roundness: value })}
                >
                  {svg}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Arrow Type (Straight, Curved, Elbow) */}
        {isLinearMode && (
          <section className="inspector-section">
            <span className="section-label">Arrow Type</span>
            <div className="segmented-row">
              {(
                [
                  {
                    value: "straight" as ArrowType,
                    label: "Straight",
                    svg: (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M4 14 L14 4 M8 4 L14 4 L14 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ),
                  },
                  {
                    value: "curved" as ArrowType,
                    label: "Curved",
                    svg: (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M4 14 Q 12 14 14 4 M9 5 L14 4 L15 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ),
                  },
                  {
                    value: "elbow" as ArrowType,
                    label: "Elbow",
                    svg: (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M4 14 L10 14 L10 4 L15 4 M11 7 L15 4 L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ),
                  },
                ]
              ).map(({ value, label, svg }) => (
                <button
                  key={value}
                  type="button"
                  className="segmented-btn"
                  data-active={(currentStyle.arrowType || "straight") === value}
                  title={`Type: ${label}`}
                  onClick={() => updateStyle({ arrowType: value })}
                >
                  {svg}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Arrowheads Direction & Style */}
        {isLinearMode && (
          <section className="inspector-section">
            <span className="section-label">Arrowheads</span>
            {/* Direction Selector */}
            <div className="segmented-row">
              {(
                [
                  {
                    id: "none",
                    label: "None",
                    icon: Minus,
                    onClick: () =>
                      updateStyle({
                        startArrowhead: "none",
                        endArrowhead: "none",
                      }),
                  },
                  {
                    id: "end",
                    label: "End",
                    icon: ArrowRight,
                    onClick: () =>
                      updateStyle({
                        startArrowhead: "none",
                        endArrowhead: activeHeadStyle,
                      }),
                  },
                  {
                    id: "start",
                    label: "Start",
                    icon: ArrowLeft,
                    onClick: () =>
                      updateStyle({
                        startArrowhead: activeHeadStyle,
                        endArrowhead: "none",
                      }),
                  },
                  {
                    id: "both",
                    label: "Both",
                    icon: ArrowLeftRight,
                    onClick: () =>
                      updateStyle({
                        startArrowhead: activeHeadStyle,
                        endArrowhead: activeHeadStyle,
                      }),
                  },
                ]
              ).map(({ id, label, icon: Icon, onClick }) => (
                <button
                  key={id}
                  type="button"
                  className="segmented-btn"
                  data-active={activeArrowheadCombo === id}
                  title={`Arrowheads: ${label}`}
                  onClick={onClick}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>

            {/* Arrowhead Shape Options */}
            <div className="segmented-row" style={{ marginTop: "6px" }}>
              {(
                [
                  {
                    id: "arrow" as Arrowhead,
                    label: "Sharp Arrow",
                    svg: (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M4 9 L14 9 M10 5 L14 9 L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ),
                  },
                  {
                    id: "triangle" as Arrowhead,
                    label: "Triangle",
                    svg: (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M3 9 L11 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <polygon points="10,5 16,9 10,13" fill="currentColor" />
                      </svg>
                    ),
                  },
                  {
                    id: "bar" as Arrowhead,
                    label: "Bar",
                    svg: (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <line x1="3" y1="9" x2="14" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <line x1="14" y1="4" x2="14" y2="14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                      </svg>
                    ),
                  },
                  {
                    id: "circle" as Arrowhead,
                    label: "Circle",
                    svg: (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <line x1="3" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="13" cy="9" r="3.5" fill="currentColor" />
                      </svg>
                    ),
                  },
                ]
              ).map(({ id, label, svg }) => (
                <button
                  key={id}
                  type="button"
                  className="segmented-btn"
                  data-active={activeHeadStyle === id}
                  title={`Arrowhead shape: ${label}`}
                  onClick={() => {
                    const patch: Partial<ElementStyle> = {};
                    if (hasStartHead) patch.startArrowhead = id;
                    if (hasEndHead || (!hasStartHead && !hasEndHead)) {
                      patch.endArrowhead = id;
                    }
                    updateStyle(patch);
                  }}
                >
                  {svg}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Typography Controls for Text and Sticky notes */}
        {(isTextMode || isStickyMode) && (
          <>
            {/* Font Family: Rough, Clean, Mono (Eraser style) */}
            <section className="inspector-section">
              <span className="section-label">Font Family</span>
              <div className="segmented-row">
                {[
                  { id: "rough" as FontFamily, label: "Montserrat", font: '"Montserrat", sans-serif' },
                  { id: "clean" as FontFamily, label: "Clean", font: '"Inter", sans-serif' },
                  { id: "mono" as FontFamily, label: "Mono", font: '"JetBrains Mono", monospace' },
                ].map(({ id, label, font }) => (
                  <button
                    key={id}
                    type="button"
                    className="segmented-btn"
                    data-active={(currentStyle.fontFamily || "rough") === id}
                    onClick={() => updateStyle({ fontFamily: id })}
                    title={`Font family: ${label}`}
                  >
                    <span style={{ fontFamily: font, fontSize: "12px" }}>{label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Font Size: Stepper + Presets (Eraser style) */}
            <section className="inspector-section">
              <span className="section-label">Font Size</span>
              {/* Stepper: [ - ] 18px [ + ] */}
              <div className="stepper-segmented-row">
                <button
                  type="button"
                  className="segmented-btn stepper-btn"
                  title="Decrease font size"
                  onClick={() => {
                    const cur =
                      currentStyle.customFontSize ||
                      (currentStyle.fontSize === "small"
                        ? 14
                        : currentStyle.fontSize === "large"
                        ? 24
                        : currentStyle.fontSize === "xlarge"
                        ? 32
                        : 18);
                    const next = Math.max(8, cur - 2);
                    updateStyle({
                      customFontSize: next,
                      fontSize: next <= 14 ? "small" : next <= 20 ? "medium" : next <= 28 ? "large" : "xlarge",
                    });
                  }}
                >
                  <Minus size={14} />
                </button>
                <div className="stepper-value-display">
                  {`${
                    currentStyle.customFontSize ||
                    (currentStyle.fontSize === "small"
                      ? 14
                      : currentStyle.fontSize === "large"
                      ? 24
                      : currentStyle.fontSize === "xlarge"
                      ? 32
                      : 18)
                  }px`}
                </div>
                <button
                  type="button"
                  className="segmented-btn stepper-btn"
                  title="Increase font size"
                  onClick={() => {
                    const cur =
                      currentStyle.customFontSize ||
                      (currentStyle.fontSize === "small"
                        ? 14
                        : currentStyle.fontSize === "large"
                        ? 24
                        : currentStyle.fontSize === "xlarge"
                        ? 32
                        : 18);
                    const next = Math.min(96, cur + 2);
                    updateStyle({
                      customFontSize: next,
                      fontSize: next <= 14 ? "small" : next <= 20 ? "medium" : next <= 28 ? "large" : "xlarge",
                    });
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Presets: S, M, L, XL */}
              <div className="segmented-row" style={{ marginTop: "4px" }}>
                {fontSizeOptions.map(({ label, value, px }) => (
                  <button
                    key={label}
                    type="button"
                    className="segmented-btn"
                    data-active={
                      (!currentStyle.customFontSize && currentStyle.fontSize === value) ||
                      currentStyle.customFontSize === px
                    }
                    onClick={() => updateStyle({ fontSize: value, customFontSize: px })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section className="inspector-section">
              <span className="section-label">Alignment</span>
              <div className="segmented-row">
                {[
                  { id: "left", icon: AlignLeft },
                  { id: "center", icon: AlignCenter },
                  { id: "right", icon: AlignRight },
                ].map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className="segmented-btn"
                    data-active={(currentStyle.textAlign || "left") === id}
                    onClick={() => updateStyle({ textAlign: id as TextAlign })}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Opacity Slider */}
        {selected && (
          <section className="inspector-section">
            <span className="section-label">Opacity</span>
            <div className="slider-control-wrap">
              <input
                type="range"
                className="inspector-slider"
                min={10}
                max={100}
                value={currentOpacity}
                onChange={(e) =>
                  onSelectedChange({ opacity: Number(e.target.value) })
                }
              />
              <span className="slider-val-pill">{currentOpacity}%</span>
            </div>
          </section>
        )}

        {/* Layers & Actions (when an element is selected) */}
        {selected && (
          <section className="inspector-section">
            <span className="section-label">Layers & Actions</span>
            <div className="actions-icon-row">
              <button
                type="button"
                className="action-mini-btn"
                title="Bring Forward"
                onClick={onBringForward}
              >
                <ChevronUp size={15} />
              </button>
              <button
                type="button"
                className="action-mini-btn"
                title="Send Backward"
                onClick={onSendBackward}
              >
                <ChevronDown size={15} />
              </button>
              <button
                type="button"
                className="action-mini-btn"
                title="Bring to Front"
                onClick={onBringToFront}
              >
                <ChevronsUp size={15} />
              </button>
              <button
                type="button"
                className="action-mini-btn"
                title="Send to Back"
                onClick={onSendToBack}
              >
                <ChevronsDown size={15} />
              </button>
              <button
                type="button"
                className="action-mini-btn"
                title="Duplicate (Ctrl+D)"
                onClick={onDuplicateSelected}
              >
                <Copy size={14} />
              </button>
              <button
                type="button"
                className="action-mini-btn danger-action"
                title="Delete (Del)"
                onClick={onDeleteSelected}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
