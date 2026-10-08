import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowRight,
  Circle,
  Diamond,
  Eraser,
  GripVertical,
  GripHorizontal,
  Hand,
  LayoutGrid,
  Lock,
  Minus,
  MousePointer2,
  Move,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  PenLine,
  RotateCw,
  Square,
  StickyNote,
  Type,
  Unlock,
  type LucideIcon,
} from "lucide-react";
import type { DockPosition, ToolId } from "../types";

interface ToolbarProps {
  activeTool: ToolId;
  dockPosition: DockPosition;
  mode?: "whiteboard" | "document";
  isToolLocked?: boolean;
  onToggleLock?: () => void;
  onToolChange: (tool: ToolId) => void;
  onDockChange: (dock: DockPosition) => void;
}

import { useShortcuts } from "../contexts/ShortcutsContext";

const WB_SHORTCUT_IDS: Partial<Record<ToolId, string>> = {
  select: "wb_select",
  hand: "wb_hand",
  pen: "wb_pen",
  rectangle: "wb_rectangle",
  ellipse: "wb_ellipse",
  diamond: "wb_diamond",
  line: "wb_line",
  arrow: "wb_arrow",
  text: "wb_text",
  sticky: "wb_sticky",
  eraser: "wb_eraser",
};

const DOC_SHORTCUT_IDS: Partial<Record<ToolId, string>> = {
  select: "doc_select",
  pen: "doc_pen",
  eraser: "doc_eraser",
  text: "doc_text",
};

const tools: Array<{ id: ToolId; label: string; shortcut: string; icon: LucideIcon }> = [
  { id: "select", label: "Select", shortcut: "V", icon: MousePointer2 },
  { id: "hand", label: "Pan", shortcut: "H", icon: Hand },
  { id: "pen", label: "Pen", shortcut: "P", icon: PenLine },
  { id: "rectangle", label: "Rectangle", shortcut: "R", icon: Square },
  { id: "ellipse", label: "Ellipse", shortcut: "O", icon: Circle },
  { id: "diamond", label: "Diamond", shortcut: "D", icon: Diamond },
  { id: "line", label: "Line", shortcut: "L", icon: Minus },
  { id: "arrow", label: "Arrow", shortcut: "A", icon: ArrowRight },
  { id: "text", label: "Text", shortcut: "T", icon: Type },
  { id: "sticky", label: "Sticky Note", shortcut: "N", icon: StickyNote },
  { id: "eraser", label: "Eraser", shortcut: "E", icon: Eraser },
];

const dockOptions: Array<{ id: DockPosition; label: string; icon: LucideIcon }> = [
  { id: "top", label: "Top", icon: PanelTop },
  { id: "bottom", label: "Bottom", icon: PanelBottom },
  { id: "left", label: "Left", icon: PanelLeft },
  { id: "right", label: "Right", icon: PanelRight },
  { id: "floating", label: "Float", icon: Move },
];

export function Toolbar({
  activeTool,
  dockPosition,
  mode = "whiteboard",
  isToolLocked = false,
  onToggleLock,
  onToolChange,
  onDockChange,
}: ToolbarProps) {
  const { getShortcut } = useShortcuts();
  const [isDockMenuOpen, setIsDockMenuOpen] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  const dockMenuRef = useRef<HTMLDivElement>(null);

  // Floating orientation state (preserves vertical when dragged from left/right)
  const [floatingOrientation, setFloatingOrientation] = useState<"horizontal" | "vertical">(() => {
    if (dockPosition === "left" || dockPosition === "right") return "vertical";
    try {
      const saved = localStorage.getItem("graffiti:dock_orient:v1");
      if (saved === "vertical" || saved === "horizontal") return saved;
    } catch {}
    return "horizontal";
  });

  // Free-floating draggable toolbar coordinates
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem("graffiti:dock_pos:v1");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [snapTarget, setSnapTarget] = useState<"top" | "bottom" | "left" | "right" | null>(null);

  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startLeft: number;
    startTop: number;
    width: number;
    height: number;
  } | null>(null);

  // Determine current active orientation
  const isVertical =
    dockPosition === "left" ||
    dockPosition === "right" ||
    (dockPosition === "floating" && floatingOrientation === "vertical");

  useEffect(() => {
    if (floatingPos && dockPosition === "floating") {
      try {
        localStorage.setItem("graffiti:dock_pos:v1", JSON.stringify(floatingPos));
      } catch {}
    } else if (dockPosition !== "floating") {
      localStorage.removeItem("graffiti:dock_pos:v1");
    }
  }, [floatingPos, dockPosition]);

  useEffect(() => {
    try {
      localStorage.setItem("graffiti:dock_orient:v1", floatingOrientation);
    } catch {}
  }, [floatingOrientation]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dockMenuRef.current && !dockMenuRef.current.contains(event.target as Node)) {
        setIsDockMenuOpen(false);
      }
    }
    if (isDockMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDockMenuOpen]);

  const handlePointerDownGrip = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Preserve orientation based on current dock position
    const orient = (dockPosition === "left" || dockPosition === "right") ? "vertical" : "horizontal";
    setFloatingOrientation(orient);

    setIsDragging(true);
    setSnapTarget(null);

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      width: rect.width,
      height: rect.height,
    };

    setFloatingPos({ x: rect.left, y: rect.top });
    if (dockPosition !== "floating") {
      onDockChange("floating");
    }

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMoveGrip = (e: React.PointerEvent) => {
    if (!dragStartRef.current || !isDragging) return;
    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;

    const width = dragStartRef.current.width || 380;
    const height = dragStartRef.current.height || 50;

    const rawX = dragStartRef.current.startLeft + dx;
    const rawY = dragStartRef.current.startTop + dy;

    const clampedX = Math.max(8, Math.min(window.innerWidth - width - 8, rawX));
    const clampedY = Math.max(8, Math.min(window.innerHeight - height - 8, rawY));

    setFloatingPos({ x: clampedX, y: clampedY });

    // Edge snapping thresholds
    if (e.clientY < 65) {
      setSnapTarget("top");
    } else if (e.clientY > window.innerHeight - 80) {
      setSnapTarget("bottom");
    } else if (e.clientX < 80) {
      setSnapTarget("left");
    } else if (e.clientX > window.innerWidth - 80) {
      setSnapTarget("right");
    } else {
      setSnapTarget(null);
    }
  };

  const handlePointerUpGrip = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (snapTarget) {
      setFloatingPos(null);
      onDockChange(snapTarget);
      if (snapTarget === "left" || snapTarget === "right") {
        setFloatingOrientation("vertical");
      } else {
        setFloatingOrientation("horizontal");
      }
    }

    dragStartRef.current = null;
    setSnapTarget(null);
  };

  const toggleOrientation = useCallback(() => {
    setFloatingOrientation((prev) => (prev === "vertical" ? "horizontal" : "vertical"));
  }, []);

  return (
    <>
      {/* Snap Preview Glowing Guideline */}
      {isDragging && snapTarget && (
        <div
          className={`dock-snap-indicator dock-snap-${snapTarget}`}
          aria-hidden="true"
        />
      )}

      <nav
        ref={railRef}
        className="tool-rail"
        data-dock={dockPosition}
        data-orientation={isVertical ? "vertical" : "horizontal"}
        data-dragging={isDragging ? "true" : "false"}
        style={
          dockPosition === "floating" && floatingPos
            ? {
                position: "fixed",
                left: `${floatingPos.x}px`,
                top: `${floatingPos.y}px`,
                transform: "none",
                zIndex: 35,
              }
            : undefined
        }
        aria-label="Drawing tools rail"
      >
        {/* Draggable Grip Handle */}
        <div
          className="tool-rail-drag-handle"
          title="Drag toolbar to float or snap to screen edges (Double-click to reset)"
          onPointerDown={handlePointerDownGrip}
          onPointerMove={handlePointerMoveGrip}
          onPointerUp={handlePointerUpGrip}
          onDoubleClick={() => {
            if (dockPosition === "floating") {
              setFloatingPos(null);
              onDockChange("top");
              setFloatingOrientation("horizontal");
            } else if (dockPosition === "top" || dockPosition === "bottom") {
              onDockChange("left");
              setFloatingOrientation("vertical");
            } else {
              onDockChange("top");
              setFloatingOrientation("horizontal");
            }
          }}
        >
          {isVertical ? <GripHorizontal size={14} /> : <GripVertical size={14} />}
        </div>

        {/* Tool Lock Button (keep tool active after drawing) */}
        <button
          type="button"
          className="tool-button"
          data-active={isToolLocked}
          aria-label={`Keep selected tool active after drawing (${isToolLocked ? "Locked" : "Unlocked"}) (Q)`}
          aria-pressed={isToolLocked}
          onClick={onToggleLock}
        >
          {isToolLocked ? (
            <Lock aria-hidden="true" size={16} strokeWidth={2.2} />
          ) : (
            <Unlock aria-hidden="true" size={16} strokeWidth={1.8} />
          )}
          <span className="tool-tooltip">
            {isToolLocked ? "Tool locked (Q)" : "Keep tool active (Q)"}
          </span>
        </button>

        <div className="tool-rail-divider" aria-hidden="true" />

        {/* Main Drawing Tools */}
        {tools.map(({ id, label, shortcut, icon: Icon }) => {
          const isActive = activeTool === id;
          const shortcutKey = (mode === "document" && DOC_SHORTCUT_IDS[id] ? DOC_SHORTCUT_IDS[id] : WB_SHORTCUT_IDS[id]) || "";
          const currentShortcut = (shortcutKey ? getShortcut(shortcutKey) : "") || shortcut;
          return (
            <button
              key={id}
              type="button"
              className="tool-button"
              data-active={isActive}
              aria-label={`${label} tool (${currentShortcut})`}
              aria-pressed={isActive}
              onClick={() => onToolChange(id)}
            >
              <Icon aria-hidden="true" size={17} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="tool-shortcut-badge" aria-hidden="true">
                {currentShortcut}
              </span>
              <span className="tool-tooltip">
                {label} ({currentShortcut})
              </span>
            </button>
          );
        })}

        <div className="tool-rail-divider" aria-hidden="true" />

        {/* Dock Position Switcher & Popover */}
        <div className="dock-changer-container" ref={dockMenuRef}>
          <button
            type="button"
            className="dock-changer-btn"
            aria-label="Change toolbar dock position"
            aria-expanded={isDockMenuOpen}
            onClick={() => setIsDockMenuOpen((prev) => !prev)}
          >
            <LayoutGrid size={16} strokeWidth={1.8} />
            <span className="tool-tooltip">Dock position</span>
          </button>

          {isDockMenuOpen ? (
            <div className="dock-popover" role="menu" aria-label="Dock positions">
              <div className="dock-popover-title">Dock Position</div>
              <div className="dock-options-grid">
                {dockOptions.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className="dock-option-btn"
                    data-active={dockPosition === id}
                    role="menuitem"
                    onClick={() => {
                      if (id === "floating") {
                        if (!floatingPos) {
                          const rect = railRef.current?.getBoundingClientRect();
                          if (rect) {
                            setFloatingPos({ x: rect.left, y: rect.top });
                          }
                        }
                      } else {
                        setFloatingPos(null);
                        if (id === "left" || id === "right") {
                          setFloatingOrientation("vertical");
                        } else {
                          setFloatingOrientation("horizontal");
                        }
                      }
                      onDockChange(id);
                      setIsDockMenuOpen(false);
                    }}
                  >
                    <Icon size={14} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Rotate Orientation Toggle (available when floating) */}
              {dockPosition === "floating" && (
                <button
                  type="button"
                  className="dock-option-btn"
                  onClick={toggleOrientation}
                  style={{
                    width: "100%",
                    marginTop: 4,
                    gridColumn: "span 2",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    justifyContent: "center",
                  }}
                  title="Toggle between horizontal and vertical layout"
                >
                  <RotateCw size={13} />
                  <span>Rotate: {floatingOrientation === "vertical" ? "Vertical" : "Horizontal"}</span>
                </button>
              )}
            </div>
          ) : null}
        </div>
      </nav>
    </>
  );
}
