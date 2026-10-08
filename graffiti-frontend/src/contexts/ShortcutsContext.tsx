import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type ShortcutCategory = "whiteboard" | "overlay" | "document" | "general";

export interface ShortcutBinding {
  id: string;
  category: ShortcutCategory;
  label: string;
  description: string;
  defaultKey: string;
  key: string; // Display key or mouse string, e.g. "P", "Space", "Ctrl+Z", "Mouse 4"
  isMouse?: boolean;
  mouseButton?: number; // 0=Left, 1=Middle, 2=Right, 3=Back(M4), 4=Forward(M5), 5+=Extra
}

export const DEFAULT_SHORTCUTS: Record<string, ShortcutBinding> = {
  // --- Whiteboard Tools ---
  "wb_select": { id: "wb_select", category: "whiteboard", label: "Select Tool", description: "Select, move, transform elements", defaultKey: "V", key: "V" },
  "wb_hand": { id: "wb_hand", category: "whiteboard", label: "Pan / Hand Tool", description: "Pan and navigate across the infinite canvas", defaultKey: "H", key: "H" },
  "wb_pen": { id: "wb_pen", category: "whiteboard", label: "Pen / Pencil", description: "Freehand drawing with pressure sensitivity", defaultKey: "P", key: "P" },
  "wb_rectangle": { id: "wb_rectangle", category: "whiteboard", label: "Rectangle Box", description: "Draw rectangle shapes and boxes", defaultKey: "R", key: "R" },
  "wb_ellipse": { id: "wb_ellipse", category: "whiteboard", label: "Ellipse / Circle", description: "Draw circles and rounded ellipses", defaultKey: "O", key: "O" },
  "wb_diamond": { id: "wb_diamond", category: "whiteboard", label: "Diamond", description: "Draw flowchart diamond shapes", defaultKey: "D", key: "D" },
  "wb_line": { id: "wb_line", category: "whiteboard", label: "Straight Line", description: "Draw straight connecting lines", defaultKey: "L", key: "L" },
  "wb_arrow": { id: "wb_arrow", category: "whiteboard", label: "Arrow", description: "Draw directional connector arrows", defaultKey: "A", key: "A" },
  "wb_text": { id: "wb_text", category: "whiteboard", label: "Text Tool", description: "Insert rich canvas typography & labels", defaultKey: "T", key: "T" },
  "wb_sticky": { id: "wb_sticky", category: "whiteboard", label: "Sticky Note", description: "Create brainstorming sticky notes", defaultKey: "N", key: "N" },
  "wb_eraser": { id: "wb_eraser", category: "whiteboard", label: "Eraser", description: "Erase elements and stroke paths", defaultKey: "E", key: "E" },
  "wb_undo": { id: "wb_undo", category: "whiteboard", label: "Undo Action", description: "Revert the last whiteboard edit", defaultKey: "Ctrl+Z", key: "Ctrl+Z" },
  "wb_redo": { id: "wb_redo", category: "whiteboard", label: "Redo Action", description: "Re-apply the undone whiteboard edit", defaultKey: "Ctrl+Y", key: "Ctrl+Y" },

  // --- Desktop Overlay Tools ---
  "ov_toggle_draw": { id: "ov_toggle_draw", category: "overlay", label: "Toggle Draw / Click-Through", description: "Switch between drawing and clicking apps underneath", defaultKey: "Space", key: "Space" },
  "ov_pen": { id: "ov_pen", category: "overlay", label: "Overlay Pen", description: "Draw vibrant screen annotations", defaultKey: "P", key: "P" },
  "ov_highlighter": { id: "ov_highlighter", category: "overlay", label: "Screen Highlighter", description: "Highlight code, text, and graphics", defaultKey: "H", key: "H" },
  "ov_arrow": { id: "ov_arrow", category: "overlay", label: "Callout Arrow", description: "Point callout arrows at UI elements", defaultKey: "A", key: "A" },
  "ov_rect": { id: "ov_rect", category: "overlay", label: "Focus Box", description: "Draw bounding boxes around screen areas", defaultKey: "R", key: "R" },
  "ov_circle": { id: "ov_circle", category: "overlay", label: "Focus Ellipse / Circle", description: "Draw circular outlines around screen areas", defaultKey: "C", key: "C" },
  "ov_line": { id: "ov_line", category: "overlay", label: "Straight Line", description: "Draw straight underline or divider lines", defaultKey: "L", key: "L" },
  "ov_eraser": { id: "ov_eraser", category: "overlay", label: "Overlay Eraser", description: "Erase screen annotation marks", defaultKey: "E", key: "E" },
  "ov_undo": { id: "ov_undo", category: "overlay", label: "Undo Stroke", description: "Undo the last screen mark", defaultKey: "Ctrl+Z", key: "Ctrl+Z" },
  "ov_clear": { id: "ov_clear", category: "overlay", label: "Clear Screen", description: "Clear all strokes from the overlay", defaultKey: "Delete", key: "Delete" },
  "ov_close": { id: "ov_close", category: "overlay", label: "Close Overlay", description: "Exit desktop overlay mode", defaultKey: "Escape", key: "Escape" },

  // --- Document / PDF Annotation Tools ---
  "doc_select": { id: "doc_select", category: "document", label: "Select / Highlight Tool", description: "Select annotations and text", defaultKey: "V", key: "V" },
  "doc_pen": { id: "doc_pen", category: "document", label: "Freehand Pen", description: "Annotate document margins and text", defaultKey: "P", key: "P" },
  "doc_highlighter": { id: "doc_highlighter", category: "document", label: "Text Highlighter", description: "Highlight document paragraphs and tables", defaultKey: "H", key: "H" },
  "doc_eraser": { id: "doc_eraser", category: "document", label: "Annotation Eraser", description: "Erase annotations on document", defaultKey: "E", key: "E" },
  "doc_text": { id: "doc_text", category: "document", label: "Text Comment", description: "Insert text annotations on document", defaultKey: "T", key: "T" },
  "doc_next": { id: "doc_next", category: "document", label: "Next Page", description: "Jump to the next document page", defaultKey: "PageDown", key: "PageDown" },
  "doc_prev": { id: "doc_prev", category: "document", label: "Previous Page", description: "Jump to the previous document page", defaultKey: "PageUp", key: "PageUp" },

  // --- General & Global Navigation ---
  "gen_overlay": { id: "gen_overlay", category: "general", label: "Launch Desktop Overlay", description: "Open fullscreen screen annotation overlay", defaultKey: "Ctrl+Shift+D", key: "Ctrl+Shift+D" },
  "gen_sidebar": { id: "gen_sidebar", category: "general", label: "Toggle Workspace Sidebar", description: "Show or collapse the workspace file tree", defaultKey: "Ctrl+B", key: "Ctrl+B" },
  "gen_search": { id: "gen_search", category: "general", label: "Find on Canvas", description: "Search shapes, text, and sticky notes", defaultKey: "Ctrl+F", key: "Ctrl+F" },
  "gen_minimap": { id: "gen_minimap", category: "general", label: "Minimap Radar", description: "Toggle viewport minimap navigator", defaultKey: "Alt+M", key: "Alt+M" },
  "gen_settings": { id: "gen_settings", category: "general", label: "Settings & Controls", description: "Open settings and customize controls", defaultKey: "Ctrl+,", key: "Ctrl+," },
};

const STORAGE_KEY = "graffiti:shortcuts:v1";

export const isMac =
  typeof navigator !== "undefined" &&
  (/Mac|iPhone|iPad|iPod/.test(navigator.platform) ||
    /Macintosh/.test(navigator.userAgent));

/**
 * Formats a key combo string into an elegant, platform-native shortcut.
 * On macOS: Ctrl+Shift+N -> ⌘⇧N, Alt+M -> ⌥M, Esc -> ⎋
 * On Windows/Linux: Ctrl+Shift+N, Alt+M, Esc
 */
export function formatShortcut(key: string, mac = isMac): string {
  if (!key) return "";
  if (mac) {
    return key
      .replace(/Ctrl\+/gi, "⌘")
      .replace(/Control\+/gi, "⌘")
      .replace(/Meta\+/gi, "⌘")
      .replace(/Shift\+/gi, "⇧")
      .replace(/Alt\+/gi, "⌥")
      .replace(/Option\+/gi, "⌥")
      .replace(/Escape|Esc/gi, "⎋")
      .replace(/Delete/gi, "⌫")
      .replace(/Backspace/gi, "⌫")
      .replace(/Enter/gi, "↵")
      .replace(/Space/gi, "␣");
  }
  return key;
}

interface ShortcutsContextType {
  shortcuts: Record<string, ShortcutBinding>;
  isMac: boolean;
  getShortcut: (id: string) => string;
  getShortcutDisplay: (id: string) => string;
  formatKey: (key: string) => string;
  updateShortcut: (id: string, newKey: string, isMouse?: boolean, mouseButton?: number) => void;
  resetCategory: (category: ShortcutCategory) => void;
  resetAll: () => void;
  isSettingsOpen: boolean;
  activeSettingsCategory: ShortcutCategory;
  setActiveSettingsCategory: (category: ShortcutCategory) => void;
  openSettings: (initialCategory?: ShortcutCategory) => void;
  closeSettings: () => void;
}

const ShortcutsContext = createContext<ShortcutsContextType | null>(null);

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Record<string, ShortcutBinding>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SHORTCUTS, ...parsed };
      }
    } catch {}
    return DEFAULT_SHORTCUTS;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsCategory, setActiveSettingsCategory] = useState<ShortcutCategory>("whiteboard");

  const saveToStorage = (updated: Record<string, ShortcutBinding>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const getShortcut = useCallback(
    (id: string): string => {
      const binding = shortcuts[id];
      if (!binding) return "";
      return binding.key || binding.defaultKey;
    },
    [shortcuts]
  );

  const getShortcutDisplay = useCallback(
    (id: string): string => {
      const binding = shortcuts[id];
      if (!binding) return "";
      const raw = binding.key || binding.defaultKey;
      return formatShortcut(raw, isMac);
    },
    [shortcuts]
  );

  const formatKey = useCallback(
    (rawKey: string): string => {
      return formatShortcut(rawKey, isMac);
    },
    []
  );

  const updateShortcut = useCallback(
    (id: string, newKey: string, isMouse = false, mouseButton?: number) => {
      setShortcuts((prev) => {
        const existing = prev[id];
        if (!existing) return prev;
        const updated = {
          ...prev,
          [id]: {
            ...existing,
            key: newKey,
            isMouse,
            mouseButton,
          },
        };
        saveToStorage(updated);
        return updated;
      });
    },
    []
  );

  const resetCategory = useCallback((category: ShortcutCategory) => {
    setShortcuts((prev) => {
      const updated = { ...prev };
      for (const [key, def] of Object.entries(DEFAULT_SHORTCUTS)) {
        if (def.category === category) {
          updated[key] = { ...def };
        }
      }
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const resetAll = useCallback(() => {
    setShortcuts(DEFAULT_SHORTCUTS);
    saveToStorage(DEFAULT_SHORTCUTS);
  }, []);

  const openSettings = useCallback((initialCategory: ShortcutCategory = "whiteboard") => {
    setActiveSettingsCategory(initialCategory);
    setIsSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  // Listen for global Ctrl+, shortcut to open settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <ShortcutsContext.Provider
      value={{
        shortcuts,
        isMac,
        getShortcut,
        getShortcutDisplay,
        formatKey,
        updateShortcut,
        resetCategory,
        resetAll,
        isSettingsOpen,
        activeSettingsCategory,
        setActiveSettingsCategory,
        openSettings,
        closeSettings,
      }}
    >
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useShortcuts() {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) {
    // Fallback safe dummy implementation if accessed outside provider
    return {
      shortcuts: DEFAULT_SHORTCUTS,
      isMac,
      getShortcut: (id: string) => DEFAULT_SHORTCUTS[id]?.key || "",
      getShortcutDisplay: (id: string) => formatShortcut(DEFAULT_SHORTCUTS[id]?.key || "", isMac),
      formatKey: (key: string) => formatShortcut(key, isMac),
      updateShortcut: () => {},
      resetCategory: () => {},
      resetAll: () => {},
      isSettingsOpen: false,
      activeSettingsCategory: "whiteboard" as ShortcutCategory,
      setActiveSettingsCategory: () => {},
      openSettings: () => {},
      closeSettings: () => {},
    };
  }
  return ctx;
}
