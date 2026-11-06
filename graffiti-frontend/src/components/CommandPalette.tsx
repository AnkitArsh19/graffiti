import { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  MousePointer2,
  PenLine,
  Square,
  Circle,
  Diamond,
  ArrowRight,
  Layers,
  Table2,
  Code2,
  Laptop,
  Shapes,
  StickyNote,
  Eraser,
  Sparkles,
  Play,
  Palette,
  FileText,
  Mic,
  Share2,
  Download,
  Grid,
  Columns,
  Maximize2,
  Moon,
  Sun,
  LayoutGrid,
} from "lucide-react";
import type { ToolId } from "../types";

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Tools" | "AI Agents" | "Layout & View" | "Export & Share";
  shortcut?: string;
  icon: any;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (tool: ToolId) => void;
  onAlign?: (type: any) => void;
  onDistribute?: (dir: any) => void;
  onTidyUp?: () => void;
  onToggleSplitMode?: () => void;
  onToggleTheme?: () => void;
  onOpenMindMap?: () => void;
  onOpenFlowchartToCode?: () => void;
  onOpenFlowSimulator?: () => void;
  onOpenThemeMorph?: () => void;
  onOpenBriefing?: () => void;
  onOpenVoiceHUD?: () => void;
  onExportPdf?: () => void;
  onExportSvg?: () => void;
  onShareRoom?: () => void;
  theme?: "dark" | "light";
  enableCircleQuery?: boolean;
  onToggleCircleQuery?: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelectTool,
  onAlign,
  onDistribute,
  onTidyUp,
  onToggleSplitMode,
  onToggleTheme,
  onOpenMindMap,
  onOpenFlowchartToCode,
  onOpenFlowSimulator,
  onOpenThemeMorph,
  onOpenBriefing,
  onOpenVoiceHUD,
  onExportPdf,
  onExportSvg,
  onShareRoom,
  theme = "dark",
  enableCircleQuery = false,
  onToggleCircleQuery,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = useMemo(() => [
    // Tools
    {
      id: "tool-select",
      title: "Select Tool",
      subtitle: "Select, transform, and move shapes",
      category: "Tools",
      shortcut: "V",
      icon: MousePointer2,
      action: () => onSelectTool("select"),
    },
    {
      id: "tool-pen",
      title: "Pen Tool",
      subtitle: "Freehand vector ink drawing",
      category: "Tools",
      shortcut: "P",
      icon: PenLine,
      action: () => onSelectTool("pen"),
    },
    {
      id: "tool-rect",
      title: "Rectangle Box",
      subtitle: "Draw architectural boxes",
      category: "Tools",
      shortcut: "R",
      icon: Square,
      action: () => onSelectTool("rectangle"),
    },
    {
      id: "tool-ellipse",
      title: "Ellipse / Circle",
      subtitle: "Draw circular containers",
      category: "Tools",
      shortcut: "O",
      icon: Circle,
      action: () => onSelectTool("ellipse"),
    },
    {
      id: "tool-diamond",
      title: "Diamond Decision",
      subtitle: "Draw conditional logic diamonds",
      category: "Tools",
      shortcut: "D",
      icon: Diamond,
      action: () => onSelectTool("diamond"),
    },
    {
      id: "tool-arrow",
      title: "Directional Arrow",
      subtitle: "Connect diagram elements",
      category: "Tools",
      shortcut: "A",
      icon: ArrowRight,
      action: () => onSelectTool("arrow"),
    },
    {
      id: "tool-card",
      title: "Architecture Service Card",
      subtitle: "Insert microservice component with bullet points",
      category: "Tools",
      shortcut: "C",
      icon: Layers,
      action: () => onSelectTool("card"),
    },
    {
      id: "tool-table",
      title: "ERD Schema Table",
      subtitle: "Database schema table with PK/FK indicators",
      category: "Tools",
      shortcut: "Shift+T",
      icon: Table2,
      action: () => onSelectTool("table"),
    },
    {
      id: "tool-code",
      title: "Code Block",
      subtitle: "Insert syntax-highlighted code snippet",
      category: "Tools",
      shortcut: "Shift+C",
      icon: Code2,
      action: () => onSelectTool("code"),
    },
    {
      id: "tool-device",
      title: "Device Mockup Frame",
      subtitle: "Insert browser window or mobile phone mockup",
      category: "Tools",
      shortcut: "Shift+D",
      icon: Laptop,
      action: () => onSelectTool("deviceFrame"),
    },
    {
      id: "tool-icon",
      title: "Vector Icon",
      subtitle: "Insert cloud, server, or database vector icon",
      category: "Tools",
      shortcut: "I",
      icon: Shapes,
      action: () => onSelectTool("icon"),
    },
    {
      id: "tool-sticky",
      title: "Sticky Note",
      subtitle: "Brainstorming note with pastel preset",
      category: "Tools",
      shortcut: "N",
      icon: StickyNote,
      action: () => onSelectTool("sticky"),
    },
    {
      id: "tool-eraser",
      title: "Eraser",
      subtitle: "Erase shapes and freehand strokes",
      category: "Tools",
      shortcut: "E",
      icon: Eraser,
      action: () => onSelectTool("eraser"),
    },

    // AI Agents
    {
      id: "ai-mindmap",
      title: "Generate Mind-Map from Topic",
      subtitle: "AI hierarchical tree synthesis with Markmap bounding",
      category: "AI Agents",
      shortcut: "AI",
      icon: Sparkles,
      action: () => onOpenMindMap?.(),
    },
    {
      id: "ai-flowchart",
      title: "Flowchart to Executable Code",
      subtitle: "Convert whiteboard diagram into Python/JS code",
      category: "AI Agents",
      shortcut: "AI",
      icon: Code2,
      action: () => onOpenFlowchartToCode?.(),
    },
    {
      id: "ai-simulator",
      title: "Behavioral Flow Simulator",
      subtitle: "Step through discrete state token execution",
      category: "AI Agents",
      shortcut: "AI",
      icon: Play,
      action: () => onOpenFlowSimulator?.(),
    },
    {
      id: "ai-theme",
      title: "AI Theme Morpher",
      subtitle: "Morph canvas colors, pastel palettes & aesthetics",
      category: "AI Agents",
      shortcut: "AI",
      icon: Palette,
      action: () => onOpenThemeMorph?.(),
    },
    {
      id: "ai-briefing",
      title: "Executive Notebook Briefing",
      subtitle: "Synthesize multi-page canvas summary report",
      category: "AI Agents",
      shortcut: "AI",
      icon: FileText,
      action: () => onOpenBriefing?.(),
    },
    {
      id: "ai-voice",
      title: "Voice Commander HUD",
      subtitle: "Speech-to-canvas voice storyboard actions",
      category: "AI Agents",
      shortcut: "AI",
      icon: Mic,
      action: () => onOpenVoiceHUD?.(),
    },
    {
      id: "ai-circle-query",
      title: `Circle to Ask AI Gesture (${enableCircleQuery ? "ON" : "OFF"})`,
      subtitle: enableCircleQuery ? "Disable automatic circle gesture detection" : "Enable circling elements with pen to query AI",
      category: "AI Agents",
      shortcut: "AI",
      icon: Sparkles,
      action: () => onToggleCircleQuery?.(),
    },

    // Layout & View
    {
      id: "layout-tidy",
      title: "Tidy Up Grid",
      subtitle: "Auto-arrange selected shapes into neat 24px grid",
      category: "Layout & View",
      shortcut: "Alt+T",
      icon: LayoutGrid,
      action: () => onTidyUp?.(),
    },
    {
      id: "view-split",
      title: "Toggle Split View Mode",
      subtitle: "Side-by-side Document and Whiteboard Canvas",
      category: "Layout & View",
      shortcut: "Ctrl+\\",
      icon: Columns,
      action: () => onToggleSplitMode?.(),
    },
    {
      id: "view-theme",
      title: "Toggle Light / Dark Theme",
      subtitle: "Switch appearance mode across application",
      category: "Layout & View",
      shortcut: "Theme",
      icon: theme === "dark" ? Sun : Moon,
      action: () => onToggleTheme?.(),
    },

    // Export & Share
    {
      id: "export-pdf",
      title: "Export Multi-Page PDF",
      subtitle: "Compile high-res vector PDF document",
      category: "Export & Share",
      shortcut: "PDF",
      icon: Download,
      action: () => onExportPdf?.(),
    },
    {
      id: "export-svg",
      title: "Export SVG Vector Image",
      subtitle: "Export canvas as scalable vector graphics",
      category: "Export & Share",
      shortcut: "SVG",
      icon: Download,
      action: () => onExportSvg?.(),
    },
    {
      id: "share-room",
      title: "Share Live Collaboration Room",
      subtitle: "Generate invite link for real-time multiplayer",
      category: "Export & Share",
      shortcut: "Share",
      icon: Share2,
      action: () => onShareRoom?.(),
    },
  ], [
    onSelectTool,
    onTidyUp,
    onToggleSplitMode,
    onToggleTheme,
    onOpenMindMap,
    onOpenFlowchartToCode,
    onOpenFlowSimulator,
    onOpenThemeMorph,
    onOpenBriefing,
    onOpenVoiceHUD,
    onExportPdf,
    onExportSvg,
    onShareRoom,
    theme,
  ]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.subtitle?.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.shortcut?.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((idx) => (idx + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((idx) => (idx - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filtered[selectedIndex];
      if (selected) {
        selected.action();
        onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  const isLight = theme === "light";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "14vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "90%",
          maxWidth: 580,
          background: isLight ? "#ffffff" : "#18181b",
          border: isLight ? "1px solid #cbd5e1" : "1px solid #27272a",
          borderRadius: 14,
          boxShadow: isLight
            ? "0 25px 60px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)"
            : "0 28px 65px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.12)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderBottom: isLight ? "1px solid #e2e8f0" : "1px solid #27272a",
          }}
        >
          <Search size={18} style={{ opacity: 0.5, color: isLight ? "#0f172a" : "#f8fafc" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search tools, AI agents, layout..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 14,
              color: isLight ? "#0f172a" : "#f8fafc",
              fontFamily: "inherit",
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 4,
              background: isLight ? "#f1f5f9" : "#27272a",
              color: isLight ? "#64748b" : "#94a3b8",
            }}
          >
            ESC to close
          </span>
        </div>

        {/* Command Results List */}
        <div
          style={{
            maxHeight: 380,
            overflowY: "auto",
            padding: "8px",
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                fontSize: 13,
                color: isLight ? "#64748b" : "#94a3b8",
              }}
            >
              No commands matching "{query}"
            </div>
          ) : (
            filtered.map((item, index) => {
              const isSelected = index === selectedIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: isSelected
                      ? isLight
                        ? "rgba(212, 163, 89, 0.15)"
                        : "rgba(212, 163, 89, 0.2)"
                      : "transparent",
                    transition: "background 80ms ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: isLight ? "#f1f5f9" : "#27272a",
                        color: isSelected ? "var(--accent-primary, #d4a359)" : isLight ? "#334155" : "#cbd5e1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={15} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: isLight ? "#0f172a" : "#f8fafc",
                        }}
                      >
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div
                          style={{
                            fontSize: 11,
                            color: isLight ? "#64748b" : "#94a3b8",
                          }}
                        >
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  {item.shortcut && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: isLight ? "#e2e8f0" : "#27272a",
                        color: isLight ? "#475569" : "#a1a1aa",
                        fontFamily: "monospace",
                      }}
                    >
                      {item.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

