import { useState, useRef, useEffect } from "react";
import {
  ArrowRight,
  Circle,
  Diamond,
  Eraser,
  GripVertical,
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
  isToolLocked?: boolean;
  onToggleLock?: () => void;
  onToolChange: (tool: ToolId) => void;
  onDockChange: (dock: DockPosition) => void;
}

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
  isToolLocked = false,
  onToggleLock,
  onToolChange,
  onDockChange,
}: ToolbarProps) {
  const [isDockMenuOpen, setIsDockMenuOpen] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  const dockMenuRef = useRef<HTMLDivElement>(null);

  // Free-floating draggable toolbar state
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem("graffiti:dock_pos:v1");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);

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
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return;
    const curX = floatingPos ? floatingPos.x : rect.left;
    const curY = floatingPos ? floatingPos.y : rect.top;

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: curX,
      posY: curY,
    };
    // Immediately set position so it does NOT jump to top-left corner
    setFloatingPos({ x: curX, y: curY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (dockPosition !== "floating") {
      onDockChange("floating");
    }
  };

  const handlePointerMoveGrip = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;
    const rect = railRef.current?.getBoundingClientRect();
    const width = rect?.width || 380;
    const height = rect?.height || 50;
    const newX = Math.max(10, Math.min(window.innerWidth - width - 10, dragStartRef.current.posX + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - height - 10, dragStartRef.current.posY + dy));
    setFloatingPos({ x: newX, y: newY });
  };

  const handlePointerUpGrip = (e: React.PointerEvent) => {
    dragStartRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <nav
      ref={railRef}
      className="tool-rail"
      data-dock={dockPosition}
      style={
        dockPosition === "floating"
          ? {
              position: "fixed",
              left: `${floatingPos?.x ?? (railRef.current?.getBoundingClientRect().left || 100)}px`,
              top: `${floatingPos?.y ?? (railRef.current?.getBoundingClientRect().top || 60)}px`,
              transform: "none",
              zIndex: 50,
              transition: "none",
            }
          : undefined
      }
      aria-label="Drawing tools rail"
    >
      {/* Draggable Grip Handle */}
      <div
        className="tool-rail-drag-handle"
        title="Drag toolbar anywhere (Double-click to reset to top)"
        onPointerDown={handlePointerDownGrip}
        onPointerMove={handlePointerMoveGrip}
        onPointerUp={handlePointerUpGrip}
        onDoubleClick={() => {
          setFloatingPos(null);
          onDockChange("top");
        }}
      >
        <GripVertical size={14} />
      </div>

      {/* Tool Lock Button (keep tool active after drawing) */}
      <button
        type="button"
        className="tool-button"
        data-active={isToolLocked}
        aria-label={`Keep selected tool active after drawing (${isToolLocked ? "Locked" : "Unlocked"}) (Q)`}
        aria-pressed={isToolLocked}
        title={`Keep selected tool active after drawing (${isToolLocked ? "Locked" : "Unlocked"}) (Q)`}
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

      {tools.map(({ id, label, shortcut, icon: Icon }) => {
        const isActive = activeTool === id;
        return (
          <button
            key={id}
            type="button"
            className="tool-button"
            data-active={isActive}
            aria-label={`${label} tool (${shortcut})`}
            aria-pressed={isActive}
            onClick={() => onToolChange(id)}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={isActive ? 2.2 : 1.8} />
            <span className="tool-tooltip">
              {label} ({shortcut})
            </span>
          </button>
        );
      })}

      <div className="tool-rail-divider" aria-hidden="true" />

      {/* Dock Position Switcher */}
      <div className="dock-changer-container" ref={dockMenuRef}>
        <button
          type="button"
          className="dock-changer-btn"
          aria-label="Change toolbar dock position"
          title="Change dock position"
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
          </div>
        ) : null}
      </div>
    </nav>
  );
}
