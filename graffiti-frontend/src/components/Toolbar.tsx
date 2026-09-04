import {
  ArrowRight,
  Circle,
  Diamond,
  Eraser,
  Hand,
  MousePointer2,
  Minus,
  PenLine,
  Square,
  StickyNote,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { ToolId } from "../types";

interface ToolbarProps {
  activeTool: ToolId;
  onToolChange: (tool: ToolId) => void;
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
  { id: "sticky", label: "Sticky note", shortcut: "N", icon: StickyNote },
  { id: "eraser", label: "Eraser", shortcut: "E", icon: Eraser },
];

export function Toolbar({ activeTool, onToolChange }: ToolbarProps) {
  return (
    <nav className="tool-rail" aria-label="Drawing tools">
      {tools.map(({ id, label, shortcut, icon: Icon }) => (
        <button
          className="tool-button"
          data-active={activeTool === id}
          data-tooltip={`${label} · ${shortcut}`}
          key={id}
          type="button"
          aria-label={`${label} (${shortcut})`}
          aria-pressed={activeTool === id}
          onClick={() => onToolChange(id)}
        >
          <Icon aria-hidden="true" size={19} strokeWidth={1.9} />
        </button>
      ))}
    </nav>
  );
}
