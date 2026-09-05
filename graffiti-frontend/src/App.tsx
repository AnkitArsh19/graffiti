import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Cloud,
  Crosshair,
  Download,
  FileJson,
  FileType2,
  Folder as FolderIcon,
  FolderOpen,
  HardDrive,
  ImageDown,
  Layers,
  Menu,
  Minus,
  Moon,
  PanelLeft,
  Plus,
  Redo2,
  RotateCcw,
  Sun,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Inspector } from "./components/Inspector";
import { PageBar } from "./components/PageBar";
import { Toolbar } from "./components/Toolbar";
import { WhiteboardCanvas, type WhiteboardCanvasHandle } from "./components/WhiteboardCanvas";
import { WorkspaceSidebar } from "./components/WorkspaceSidebar";
import { MoveModal } from "./components/MoveModal";
import {
  getStorageAdapter,
  type StorageAdapter,
  type Workspace,
  type Folder,
  type WhiteboardSummary,
  type WhiteboardPageData,
} from "./storage";
import { applyDarkModeFilter } from "./lib/colors";
import { getFreedrawOutline, getSvgPathFromStroke } from "./lib/canvasRenderer";
import {
  createId,
  createSeed,
  moveElement,
  normalizePenElement,
  updateBoundArrows,
} from "./lib/geometry";
import type {
  CanvasElement,
  DockPosition,
  ElementStyle,
  NotebookPage,
  PaperTemplate,
  ToolId,
} from "./types";

interface NotebookState {
  pages: NotebookPage[];
  activePageId: string;
}

interface HistoryState {
  past: NotebookState[];
  present: NotebookState;
  future: NotebookState[];
}

const STORAGE_NOTEBOOK_KEY = "graffiti:notebook:v3";
const STORAGE_THEME_KEY = "graffiti:theme:v3";
const STORAGE_DOCK_KEY = "graffiti:dock:v3";
const STORAGE_STYLE_KEY = "graffiti:style:v3";

const defaultStyle: ElementStyle = {
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  strokeWidth: 2,
  strokeStyle: "solid",
  fillStyle: "solid",
  roughness: 0, // Clean Architect mode by default
  roundness: "sharp",
  arrowType: "straight",
  startArrowhead: "none",
  endArrowhead: "arrow",
  fontSize: "medium",
  textAlign: "left",
};

function createPage(title: string, template: PaperTemplate = "grid"): NotebookPage {
  return { id: createId("page"), title, template, elements: [] };
}

function loadNotebook(): NotebookState {
  try {
    const saved = localStorage.getItem(STORAGE_NOTEBOOK_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as NotebookState;
      if (parsed.pages?.length && parsed.pages.some((page) => page.id === parsed.activePageId)) {
        return {
          ...parsed,
          pages: parsed.pages.map((p) => ({
            ...p,
            elements: (p.elements || []).map(normalizePenElement),
          })),
        };
      }
    }
  } catch {
    // Fall back to new notebook if corrupted
  }
  const firstPage = createPage("Canvas 1", "grid");
  return { pages: [firstPage], activePageId: firstPage.id };
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

function toSvg(elements: CanvasElement[], theme: "dark" | "light") {
  const isDark = theme === "dark";
  const bg = isDark ? "#121212" : "#ffffff";
  const defaultStroke = isDark ? "#f5f5f5" : "#1e1e1e";

  const content = elements.map((element) => {
    const strokeColor = applyDarkModeFilter(element.strokeColor, isDark, false);
    const fillColor =
      element.backgroundColor === "transparent"
        ? "transparent"
        : applyDarkModeFilter(element.backgroundColor, isDark, true);

    const common = `stroke="${escapeXml(strokeColor)}" stroke-width="${element.strokeWidth}" fill="${escapeXml(fillColor)}" opacity="${element.opacity / 100}"`;

    if (element.type === "rectangle" || element.type === "sticky") {
      return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="${element.type === "sticky" ? 10 : 4}" ${common}/>`;
    }
    if (element.type === "ellipse") {
      return `<ellipse cx="${element.x + element.width / 2}" cy="${element.y + element.height / 2}" rx="${element.width / 2}" ry="${element.height / 2}" ${common}/>`;
    }
    if (element.type === "diamond") {
      const points = `${element.x + element.width / 2},${element.y} ${element.x + element.width},${element.y + element.height / 2} ${element.x + element.width / 2},${element.y + element.height} ${element.x},${element.y + element.height / 2}`;
      return `<polygon points="${points}" ${common}/>`;
    }
    if ((element.type === "line" || element.type === "arrow") && element.points?.length === 2) {
      const [start, end] = element.points;
      return `<line x1="${element.x + start.x}" y1="${element.y + start.y}" x2="${element.x + end.x}" y2="${element.y + end.y}" ${common} marker-end="${element.type === "arrow" ? "url(#arrow)" : ""}"/>`;
    }
    if (element.type === "pen" && element.points && element.points.length > 0) {
      const strokePoints = getFreedrawOutline(element.points, element.strokeWidth);
      const pathData = getSvgPathFromStroke(strokePoints);
      return `<g transform="translate(${element.x}, ${element.y})"><path d="${pathData}" fill="${escapeXml(strokeColor)}" opacity="${element.opacity / 100}"/></g>`;
    }
    return "";
  }).join("");

  const labels = elements
    .filter((element) => element.text)
    .map((element) => {
      const textColor = applyDarkModeFilter(element.strokeColor, isDark, false);
      return `<text x="${element.x + 14}" y="${element.y + 26}" fill="${escapeXml(textColor)}" font-family="Montserrat, sans-serif" font-size="18">${escapeXml(element.text ?? "")}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${defaultStroke}"/></marker></defs><rect width="100%" height="100%" fill="${bg}"/>${content}${labels}</svg>`;
}

function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function App() {
  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: loadNotebook(),
    future: [],
  }));

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    return saved === "light" ? "light" : "dark";
  });

  const [dockPosition, setDockPosition] = useState<DockPosition>(() => {
    const saved = localStorage.getItem(STORAGE_DOCK_KEY);
    if (
      saved === "top" ||
      saved === "bottom" ||
      saved === "left" ||
      saved === "right" ||
      saved === "floating"
    ) {
      return saved;
    }
    return "top";
  });

  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [isToolLocked, setIsToolLocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isEditingText, setIsEditingText] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [elementStyle, setElementStyle] = useState<ElementStyle>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_STYLE_KEY);
      if (saved) {
        return { ...defaultStyle, ...JSON.parse(saved) };
      }
    } catch {}
    return defaultStyle;
  });
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Offline Local Storage & Workspace State
  const [storage, setStorage] = useState<StorageAdapter | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [whiteboards, setWhiteboards] = useState<WhiteboardSummary[]>([]);
  const [activeWhiteboardId, setActiveWhiteboardId] = useState<string>("");
  const [activeWhiteboardName, setActiveWhiteboardName] = useState<string>("Welcome to Graffiti");
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [moveModalBoardId, setMoveModalBoardId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const canvasRef = useRef<WhiteboardCanvasHandle>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStyleChange = useCallback((newStyle: Partial<ElementStyle>) => {
    setElementStyle((prev) => {
      const updated = { ...prev, ...newStyle };
      try {
        localStorage.setItem(STORAGE_STYLE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const { present } = history;
  const activePage =
    present.pages.find((page) => page.id === present.activePageId) ?? present.pages[0];
  const selectedElement = activePage.elements.find((el) => el.id === selectedId) ?? null;

  // Apply theme class and data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_THEME_KEY, theme);
  }, [theme]);

  // Persist dock position
  useEffect(() => {
    localStorage.setItem(STORAGE_DOCK_KEY, dockPosition);
  }, [dockPosition]);

  // Persist notebook
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      localStorage.setItem(STORAGE_NOTEBOOK_KEY, JSON.stringify(present));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [present]);

  // Close export menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    }
    if (isExportOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExportOpen]);

  // Load local storage on mount
  useEffect(() => {
    let mounted = true;
    async function initStorage() {
      try {
        const adapter = await getStorageAdapter();
        if (!mounted) return;
        setStorage(adapter);
        const wsList = await adapter.listWorkspaces();
        if (!mounted) return;
        setWorkspaces(wsList);
        if (wsList.length > 0) {
          const currentWs = wsList[0];
          setActiveWorkspaceId(currentWs.id);
          const fList = await adapter.listFolders(currentWs.id);
          if (!mounted) return;
          setFolders(fList);
          const wbList = await adapter.listWhiteboards(currentWs.id);
          if (!mounted) return;
          setWhiteboards(wbList);

          if (wbList.length > 0) {
            const firstWb = wbList[0];
            const wbDetail = await adapter.getWhiteboard(firstWb.id);
            if (wbDetail && wbDetail.pages.length > 0 && mounted) {
              setActiveWhiteboardId(wbDetail.id);
              setActiveWhiteboardName(wbDetail.name);
              setActiveFolderId(wbDetail.folderId);
              setHistory({
                past: [],
                present: {
                  pages: wbDetail.pages.map((p) => ({
                    id: p.id,
                    title: p.title,
                    template: p.template,
                    elements: (p.elements || []).map(normalizePenElement),
                  })),
                  activePageId: wbDetail.activePageId || wbDetail.pages[0].id,
                },
                future: [],
              });
            }
          }
        }
      } catch (err) {
        console.error("Failed to initialize local offline storage:", err);
      }
    }
    initStorage();
    return () => {
      mounted = false;
    };
  }, []);

  // Online / Offline connectivity listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Auto-save active whiteboard to local storage
  useEffect(() => {
    if (!storage || !activeWhiteboardId) return;

    const timeout = window.setTimeout(async () => {
      try {
        const existing = await storage.getWhiteboard(activeWhiteboardId);
        if (existing) {
          const updatedPages: WhiteboardPageData[] = present.pages.map((p, idx) => ({
            id: p.id,
            whiteboardId: activeWhiteboardId,
            title: p.title,
            template: p.template,
            pageOrder: idx,
            elements: p.elements,
            createdAt: Date.now(),
          }));
          await storage.saveWhiteboard({
            ...existing,
            name: activeWhiteboardName,
            folderId: activeFolderId,
            activePageId: present.activePageId,
            pages: updatedPages,
            updatedAt: Date.now(),
          });
          setWhiteboards((prev) =>
            prev.map((wb) =>
              wb.id === activeWhiteboardId
                ? {
                    ...wb,
                    name: activeWhiteboardName,
                    pageCount: present.pages.length,
                    updatedAt: Date.now(),
                  }
                : wb
            )
          );
        }
      } catch (err) {
        console.error("Auto-save to storage failed:", err);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [present, activeWhiteboardId, activeWhiteboardName, activeFolderId, storage]);

  // Handler: Select a whiteboard from sidebar
  const handleSelectWhiteboard = useCallback(
    async (id: string) => {
      if (!storage || id === activeWhiteboardId) return;
      try {
        const wbDetail = await storage.getWhiteboard(id);
        if (wbDetail && wbDetail.pages.length > 0) {
          setActiveWhiteboardId(wbDetail.id);
          setActiveWhiteboardName(wbDetail.name);
          setActiveFolderId(wbDetail.folderId);
          setHistory({
            past: [],
            present: {
              pages: wbDetail.pages.map((p) => ({
                id: p.id,
                title: p.title,
                template: p.template,
                elements: (p.elements || []).map(normalizePenElement),
              })),
              activePageId: wbDetail.activePageId || wbDetail.pages[0].id,
            },
            future: [],
          });
          setSelectedId(null);
          setSelectedIds([]);
        }
      } catch (err) {
        console.error("Failed to select whiteboard:", err);
      }
    },
    [storage, activeWhiteboardId]
  );

  // Handler: Create a whiteboard
  const handleCreateWhiteboard = useCallback(
    async (folderId: string | null = null) => {
      if (!storage || !activeWorkspaceId) return;
      try {
        const newBoard = await storage.createWhiteboard(
          activeWorkspaceId,
          folderId,
          "Untitled Board"
        );
        const wbList = await storage.listWhiteboards(activeWorkspaceId);
        setWhiteboards(wbList);
        setActiveWhiteboardId(newBoard.id);
        setActiveWhiteboardName(newBoard.name);
        setActiveFolderId(newBoard.folderId);
        setHistory({
          past: [],
          present: {
            pages: newBoard.pages.map((p) => ({
              id: p.id,
              title: p.title,
              template: p.template,
              elements: [],
            })),
            activePageId: newBoard.activePageId,
          },
          future: [],
        });
        setSelectedId(null);
        setSelectedIds([]);
      } catch (err) {
        console.error("Failed to create whiteboard:", err);
      }
    },
    [storage, activeWorkspaceId]
  );

  // Handler: Rename whiteboard
  const handleRenameWhiteboard = useCallback(
    async (id: string, name: string) => {
      if (!storage) return;
      try {
        await storage.renameWhiteboard(id, name);
        if (id === activeWhiteboardId) {
          setActiveWhiteboardName(name);
        }
        setWhiteboards((prev) =>
          prev.map((wb) => (wb.id === id ? { ...wb, name } : wb))
        );
      } catch (err) {
        console.error("Failed to rename whiteboard:", err);
      }
    },
    [storage, activeWhiteboardId]
  );

  // Handler: Delete whiteboard
  const handleDeleteWhiteboard = useCallback(
    async (id: string) => {
      if (!storage) return;
      try {
        await storage.deleteWhiteboard(id);
        const wbList = await storage.listWhiteboards(activeWorkspaceId);
        setWhiteboards(wbList);
        if (id === activeWhiteboardId) {
          if (wbList.length > 0) {
            handleSelectWhiteboard(wbList[0].id);
          } else {
            handleCreateWhiteboard(null);
          }
        }
      } catch (err) {
        console.error("Failed to delete whiteboard:", err);
      }
    },
    [storage, activeWorkspaceId, activeWhiteboardId, handleSelectWhiteboard, handleCreateWhiteboard]
  );

  // Handler: Create folder
  const handleCreateFolder = useCallback(
    async (name: string, parentFolderId: string | null = null) => {
      if (!storage || !activeWorkspaceId) return;
      try {
        await storage.createFolder(activeWorkspaceId, name, parentFolderId);
        const fList = await storage.listFolders(activeWorkspaceId);
        setFolders(fList);
      } catch (err) {
        console.error("Failed to create folder:", err);
      }
    },
    [storage, activeWorkspaceId]
  );

  // Handler: Rename folder
  const handleRenameFolder = useCallback(
    async (id: string, name: string) => {
      if (!storage) return;
      try {
        await storage.updateFolder(id, { name });
        setFolders((prev) =>
          prev.map((f) => (f.id === id ? { ...f, name } : f))
        );
      } catch (err) {
        console.error("Failed to rename folder:", err);
      }
    },
    [storage]
  );

  // Handler: Delete folder
  const handleDeleteFolder = useCallback(
    async (id: string) => {
      if (!storage || !activeWorkspaceId) return;
      try {
        await storage.deleteFolder(id);
        const fList = await storage.listFolders(activeWorkspaceId);
        setFolders(fList);
        const wbList = await storage.listWhiteboards(activeWorkspaceId);
        setWhiteboards(wbList);
        if (activeFolderId === id) {
          setActiveFolderId(null);
        }
      } catch (err) {
        console.error("Failed to delete folder:", err);
      }
    },
    [storage, activeWorkspaceId, activeFolderId]
  );

  // Handler: Select workspace
  const handleSelectWorkspace = useCallback(
    async (workspaceId: string) => {
      if (!storage || workspaceId === activeWorkspaceId) return;
      try {
        setActiveWorkspaceId(workspaceId);
        const fList = await storage.listFolders(workspaceId);
        setFolders(fList);
        const wbList = await storage.listWhiteboards(workspaceId);
        setWhiteboards(wbList);
        if (wbList.length > 0) {
          handleSelectWhiteboard(wbList[0].id);
        } else {
          handleCreateWhiteboard(null);
        }
      } catch (err) {
        console.error("Failed to select workspace:", err);
      }
    },
    [storage, activeWorkspaceId, handleSelectWhiteboard, handleCreateWhiteboard]
  );

  // Handler: Create workspace
  const handleCreateWorkspace = useCallback(
    async (name: string) => {
      if (!storage) return;
      try {
        const ws = await storage.createWorkspace(name);
        const wsList = await storage.listWorkspaces();
        setWorkspaces(wsList);
        handleSelectWorkspace(ws.id);
      } catch (err) {
        console.error("Failed to create workspace:", err);
      }
    },
    [storage, handleSelectWorkspace]
  );

  // Handler: Move whiteboard
  const handleMoveWhiteboard = useCallback(
    async (targetWorkspaceId: string, targetFolderId: string | null) => {
      if (!storage || !moveModalBoardId) return;
      try {
        await storage.moveWhiteboard(moveModalBoardId, targetWorkspaceId, targetFolderId);
        if (targetWorkspaceId === activeWorkspaceId) {
          const wbList = await storage.listWhiteboards(activeWorkspaceId);
          setWhiteboards(wbList);
          if (moveModalBoardId === activeWhiteboardId) {
            setActiveFolderId(targetFolderId);
          }
        } else {
          const wbList = await storage.listWhiteboards(activeWorkspaceId);
          setWhiteboards(wbList);
          if (moveModalBoardId === activeWhiteboardId) {
            if (wbList.length > 0) {
              handleSelectWhiteboard(wbList[0].id);
            } else {
              handleCreateWhiteboard(null);
            }
          }
        }
      } catch (err) {
        console.error("Failed to move whiteboard:", err);
      }
    },
    [storage, moveModalBoardId, activeWorkspaceId, activeWhiteboardId, handleSelectWhiteboard, handleCreateWhiteboard]
  );

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const activeFolder = folders.find((f) => f.id === activeFolderId);

  const commitState = useCallback((recipe: (state: NotebookState) => NotebookState) => {
    setHistory((current) => {
      const next = recipe(current.present);
      if (next === current.present) return current;
      return {
        past: [...current.past.slice(-79), current.present],
        present: next,
        future: [],
      };
    });
  }, []);

  const updateActivePage = useCallback(
    (recipe: (page: NotebookPage) => NotebookPage) => {
      commitState((state) => ({
        ...state,
        pages: state.pages.map((page) =>
          page.id === state.activePageId ? recipe(page) : page,
        ),
      }));
    },
    [commitState],
  );

  const commitElement = useCallback(
    (element: CanvasElement) => {
      updateActivePage((page) => {
        const exists = page.elements.some((item) => item.id === element.id);
        const updated = exists
          ? page.elements.map((item) => (item.id === element.id ? element : item))
          : [...page.elements, element];
        return {
          ...page,
          elements: updateBoundArrows(updated, element),
        };
      });
    },
    [updateActivePage],
  );

  const commitElements = useCallback(
    (newElements: CanvasElement[]) => {
      updateActivePage((page) => {
        const idMap = new Map(newElements.map((el) => [el.id, el]));
        const updated = page.elements.map((item) => idMap.get(item.id) ?? item);
        let finalElements = updated;
        newElements.forEach((el) => {
          finalElements = updateBoundArrows(finalElements, el);
        });
        return {
          ...page,
          elements: finalElements,
        };
      });
    },
    [updateActivePage],
  );

  const deleteElement = useCallback(
    (elementId: string) => {
      updateActivePage((page) => ({
        ...page,
        elements: page.elements.filter((element) => element.id !== elementId),
      }));
      setSelectedId((current) => (current === elementId ? null : current));
      setSelectedIds((current) => current.filter((id) => id !== elementId));
    },
    [updateActivePage],
  );

  const deleteSelectedElements = useCallback(() => {
    if (selectedIds.length > 0) {
      updateActivePage((page) => ({
        ...page,
        elements: page.elements.filter((element) => !selectedIds.includes(element.id)),
      }));
      setSelectedIds([]);
      setSelectedId(null);
    } else if (selectedId) {
      deleteElement(selectedId);
    }
  }, [deleteElement, selectedId, selectedIds, updateActivePage]);

  const updateSelected = useCallback(
    (patch: Partial<CanvasElement>) => {
      const targetIds = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
      if (targetIds.length === 0) return;
      updateActivePage((page) => ({
        ...page,
        elements: page.elements.map((element) =>
          targetIds.includes(element.id) ? { ...element, ...patch } : element,
        ),
      }));
    },
    [selectedId, selectedIds, updateActivePage],
  );

  const undo = useCallback(() => {
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });
    setSelectedId(null);
  }, []);

  const redo = useCallback(() => {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      return {
        past: [...current.past, current.present],
        present: next,
        future: current.future.slice(1),
      };
    });
    setSelectedId(null);
  }, []);

  const addPage = useCallback(() => {
    const page = createPage(`Canvas ${present.pages.length + 1}`, activePage.template);
    commitState((state) => ({
      ...state,
      pages: [...state.pages, page],
      activePageId: page.id,
    }));
    setSelectedId(null);
  }, [activePage.template, commitState, present.pages.length]);

  const duplicatePage = useCallback(() => {
    const page = createPage(`${activePage.title} Copy`, activePage.template);
    page.elements = activePage.elements.map((element) => ({
      ...element,
      id: createId("el"),
      pageId: page.id,
      seed: createSeed(),
    }));
    commitState((state) => ({
      ...state,
      pages: [...state.pages, page],
      activePageId: page.id,
    }));
    setSelectedId(null);
  }, [activePage, commitState]);

  const renamePage = useCallback(
    (pageId: string, title: string) => {
      commitState((state) => ({
        ...state,
        pages: state.pages.map((page) =>
          page.id === pageId ? { ...page, title } : page,
        ),
      }));
    },
    [commitState],
  );

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length > 0) {
      const duplicates = activePage.elements
        .filter((el) => selectedIds.includes(el.id))
        .map((el) => moveElement({ ...el, id: createId("el"), seed: createSeed() }, 24, 24));
      commitElements(duplicates);
      setSelectedIds(duplicates.map((d) => d.id));
      setSelectedId(duplicates[0]?.id ?? null);
      return;
    }
    if (!selectedElement) return;
    const duplicate = moveElement(
      { ...selectedElement, id: createId("el"), seed: createSeed() },
      24,
      24,
    );
    commitElement(duplicate);
    setSelectedId(duplicate.id);
  }, [activePage.elements, commitElement, commitElements, selectedElement, selectedIds]);

  const deletePage = useCallback(
    (pageId?: string) => {
      if (present.pages.length <= 1) return;
      const targetId = pageId || activePage.id;
      const index = present.pages.findIndex((page) => page.id === targetId);
      if (index === -1) return;

      commitState((state) => {
        const pages = state.pages.filter((page) => page.id !== targetId);
        const nextActiveId =
          state.activePageId === targetId
            ? pages[Math.max(0, Math.min(index, pages.length - 1))].id
            : state.activePageId;
        return {
          ...state,
          pages,
          activePageId: nextActiveId,
        };
      });
      setSelectedId(null);
      setSelectedIds([]);
    },
    [activePage.id, commitState, present.pages],
  );

  const selectPage = useCallback((pageId: string) => {
    setHistory((current) => ({
      ...current,
      present: { ...current.present, activePageId: pageId },
    }));
    setSelectedId(null);
  }, []);

  // Layer reordering
  const bringForward = useCallback(() => {
    if (!selectedId) return;
    updateActivePage((page) => {
      const index = page.elements.findIndex((el) => el.id === selectedId);
      if (index < 0 || index === page.elements.length - 1) return page;
      const next = [...page.elements];
      const [item] = next.splice(index, 1);
      next.splice(index + 1, 0, item);
      return { ...page, elements: next };
    });
  }, [selectedId, updateActivePage]);

  const sendBackward = useCallback(() => {
    if (!selectedId) return;
    updateActivePage((page) => {
      const index = page.elements.findIndex((el) => el.id === selectedId);
      if (index <= 0) return page;
      const next = [...page.elements];
      const [item] = next.splice(index, 1);
      next.splice(index - 1, 0, item);
      return { ...page, elements: next };
    });
  }, [selectedId, updateActivePage]);

  const bringToFront = useCallback(() => {
    if (!selectedId) return;
    updateActivePage((page) => {
      const index = page.elements.findIndex((el) => el.id === selectedId);
      if (index < 0 || index === page.elements.length - 1) return page;
      const next = [...page.elements];
      const [item] = next.splice(index, 1);
      next.push(item);
      return { ...page, elements: next };
    });
  }, [selectedId, updateActivePage]);

  const sendToBack = useCallback(() => {
    if (!selectedId) return;
    updateActivePage((page) => {
      const index = page.elements.findIndex((el) => el.id === selectedId);
      if (index <= 0) return page;
      const next = [...page.elements];
      const [item] = next.splice(index, 1);
      next.unshift(item);
      return { ...page, elements: next };
    });
  }, [selectedId, updateActivePage]);

  const clearCanvas = useCallback(() => {
    updateActivePage((page) => ({ ...page, elements: [] }));
    setSelectedId(null);
    setIsMenuOpen(false);
  }, [updateActivePage]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === "d") {
        event.preventDefault();
        event.shiftKey ? duplicatePage() : duplicateSelected();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "n") {
        event.preventDefault();
        addPage();
        return;
      }
      if (key === "q" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setIsToolLocked((prev) => !prev);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === "b") {
        event.preventDefault();
        setIsSidebarOpen((prev) => !prev);
        return;
      }
      if (event.shiftKey && key === "m" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        if (activeWhiteboardId) {
          setMoveModalBoardId(activeWhiteboardId);
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setIsSidebarOpen(false);
        setMoveModalBoardId(null);
        setSelectedId(null);
        setSelectedIds([]);
        setActiveTool("select");
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedIds.length > 0 || selectedId) {
          event.preventDefault();
          deleteSelectedElements();
          return;
        }
      }

      const toolByKey: Partial<Record<string, ToolId>> = {
        v: "select",
        "1": "select",
        h: "hand",
        r: "rectangle",
        "2": "rectangle",
        o: "ellipse",
        "3": "ellipse",
        d: "diamond",
        "4": "diamond",
        l: "line",
        "5": "line",
        a: "arrow",
        "6": "arrow",
        p: "pen",
        "7": "pen",
        t: "text",
        "8": "text",
        n: "sticky",
        "9": "sticky",
        e: "eraser",
        "0": "eraser",
      };
      const nextTool = toolByKey[key];
      if (nextTool && !event.ctrlKey && !event.metaKey && !event.altKey) {
        setActiveTool(nextTool);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addPage, deleteElement, duplicatePage, duplicateSelected, redo, selectedId, undo]);

  const exportSvg = () => {
    downloadFile(
      `${activePage.title || "graffiti-canvas"}.svg`,
      toSvg(activePage.elements, theme),
      "image/svg+xml",
    );
    setIsExportOpen(false);
  };

  const exportJson = () => {
    downloadFile(
      "graffiti-notebook.graffiti",
      JSON.stringify(present, null, 2),
      "application/json",
    );
    setIsExportOpen(false);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as NotebookState;
        if (parsed.pages?.length) {
          commitState(() => parsed);
        }
      } catch {
        // Corrupt file fallback
      }
    };
    reader.readAsText(file);
    setIsMenuOpen(false);
    e.target.value = "";
  };

  return (
    <main className="app-shell">
      <input
        ref={fileInputRef}
        type="file"
        accept=".graffiti,.json"
        style={{ display: "none" }}
        onChange={handleImportJson}
      />

      {/* Top Navigation Bar */}
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="menu-trigger-btn"
            aria-label="Open application menu"
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu size={18} />
          </button>

          <button
            type="button"
            className={`icon-action-btn ${isSidebarOpen ? "active" : ""}`}
            title="Toggle Workspaces & Folders Sidebar (Ctrl+B)"
            aria-label="Toggle Workspaces & Folders Sidebar (Ctrl+B)"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
          >
            <PanelLeft size={18} />
          </button>

          <div
            className="brand-lockup"
            onClick={() => canvasRef.current?.resetView()}
            style={{ cursor: "pointer" }}
            title="Reset canvas view"
          >
            <img
              src={theme === "dark" ? "/graffiti-logo-dark.png" : "/graffiti-logo.png"}
              alt="Graffiti"
              className="brand-full-logo"
            />
          </div>

          <div className="topbar-breadcrumbs" aria-label="Breadcrumb hierarchy">
            {activeWorkspace && (
              <span className="crumb workspace" title={`Workspace: ${activeWorkspace.name}`}>
                <Layers size={13} color={activeWorkspace.color || "#4dabf7"} />
                <span>{activeWorkspace.name}</span>
              </span>
            )}
            {activeFolder && (
              <>
                <ChevronRight size={12} className="crumb-separator" />
                <span className="crumb folder" title={`Folder: ${activeFolder.name}`}>
                  <FolderIcon size={13} color={activeFolder.color || "#4dabf7"} />
                  <span>{activeFolder.name}</span>
                </span>
              </>
            )}
            <ChevronRight size={12} className="crumb-separator" />
            <span className="crumb whiteboard" title={`Whiteboard: ${activeWhiteboardName}`}>
              <span>{activeWhiteboardName}</span>
            </span>
          </div>
        </div>

        <div className="topbar-center">
          <div className="document-title-wrap">
            <input
              className="document-title-input"
              value={activePage.title}
              aria-label="Canvas Name"
              placeholder="Untitled Canvas"
              onFocus={(e) => {
                const el = e.currentTarget;
                requestAnimationFrame(() => el.select());
              }}
              onClick={(e) => {
                e.currentTarget.select();
              }}
              onChange={(e) =>
                updateActivePage((page) => ({ ...page, title: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="topbar-right">
          <div className="topbar-status-pill storage" title="All boards and folders are stored locally on your device in AppData">
            <HardDrive size={13} className="storage-icon" />
            <span>Local AppData</span>
          </div>

          <div
            className={`topbar-status-pill cloud ${isOnline ? "online" : "offline"}`}
            title={isOnline ? "Online: Cloud sync & AI ready" : "Offline: Drawings stored safely on your machine without cloud dependency"}
          >
            <Cloud size={13} />
            <span>{isOnline ? "Cloud Sync Ready" : "Offline"}</span>
          </div>

          <button
            type="button"
            className="icon-action-btn"
            aria-label="Undo (Ctrl+Z)"
            title="Undo (Ctrl+Z)"
            disabled={history.past.length === 0}
            onClick={undo}
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="icon-action-btn"
            aria-label="Redo (Ctrl+Y)"
            title="Redo (Ctrl+Y)"
            disabled={history.future.length === 0}
            onClick={redo}
          >
            <Redo2 size={16} />
          </button>

          <div className="history-divider" aria-hidden="true" />

          {/* Theme switcher: Pitch-Black Dark / Studio Light */}
          <button
            type="button"
            className="icon-action-btn"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={() =>
              setTheme((current) => (current === "dark" ? "light" : "dark"))
            }
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Export Menu */}
          <div className="export-menu-container" ref={exportMenuRef}>
            <button
              type="button"
              className="export-trigger-btn"
              aria-label="Export canvas options"
              aria-expanded={isExportOpen}
              onClick={() => setIsExportOpen((prev) => !prev)}
            >
              <Download size={15} />
              <span>Export</span>
            </button>

            {isExportOpen ? (
              <div className="dropdown-popover" role="menu">
                <button
                  type="button"
                  className="dropdown-item-btn"
                  role="menuitem"
                  onClick={() => {
                    canvasRef.current?.exportPng();
                    setIsExportOpen(false);
                  }}
                >
                  <ImageDown size={16} />
                  <span>PNG Image</span>
                </button>
                <button
                  type="button"
                  className="dropdown-item-btn"
                  role="menuitem"
                  onClick={exportSvg}
                >
                  <FileType2 size={16} />
                  <span>SVG Vector</span>
                </button>
                <div className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-item-btn"
                  role="menuitem"
                  onClick={exportJson}
                >
                  <FileJson size={16} />
                  <span>Graffiti Document</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Hamburger Drawer */}
      {isMenuOpen ? (
        <div className="drawer-overlay" onClick={() => setIsMenuOpen(false)}>
          <aside
            className="menu-drawer"
            role="dialog"
            aria-label="Application Menu"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div
                className="brand-lockup"
                onClick={() => {
                  canvasRef.current?.resetView();
                  setIsMenuOpen(false);
                }}
                style={{ cursor: "pointer" }}
                title="Graffiti"
              >
                <img
                  src={theme === "dark" ? "/graffiti-logo-dark.png" : "/graffiti-logo.png"}
                  alt="Graffiti"
                  className="brand-full-logo"
                />
              </div>
              <button
                type="button"
                className="icon-action-btn"
                aria-label="Close menu"
                onClick={() => setIsMenuOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="drawer-body">
              <div className="drawer-section">
                <div className="drawer-section-title">File</div>
                <button
                  type="button"
                  className="drawer-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FolderOpen size={16} />
                  <span>Open File</span>
                </button>
                <button
                  type="button"
                  className="drawer-btn"
                  onClick={() => {
                    exportJson();
                    setIsMenuOpen(false);
                  }}
                >
                  <Download size={16} />
                  <span>Save / Export</span>
                </button>
                <button
                  type="button"
                  className="drawer-btn danger"
                  onClick={clearCanvas}
                >
                  <Trash2 size={16} />
                  <span>Reset Canvas</span>
                </button>
              </div>

              <div className="drawer-section">
                <div className="drawer-section-title">Appearance</div>
                <div className="theme-options-grid">
                  <button
                    type="button"
                    className="theme-toggle-option"
                    data-active={theme === "dark"}
                    onClick={() => setTheme("dark")}
                  >
                    <Moon size={15} />
                    <span>Dark</span>
                  </button>
                  <button
                    type="button"
                    className="theme-toggle-option"
                    data-active={theme === "light"}
                    onClick={() => setTheme("light")}
                  >
                    <Sun size={15} />
                    <span>Light</span>
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Canvas Workspace */}
      <section className="workspace" data-dock={dockPosition}>
        {/* 4-Sided Dockable Toolbar */}
        <Toolbar
          activeTool={activeTool}
          isToolLocked={isToolLocked}
          onToggleLock={() => setIsToolLocked((prev) => !prev)}
          dockPosition={dockPosition}
          onToolChange={setActiveTool}
          onDockChange={setDockPosition}
        />

        {/* Vector Canvas Engine */}
        <WhiteboardCanvas
          ref={canvasRef}
          pageId={activePage.id}
          pageTitle={activePage.title}
          template={activePage.template}
          elements={activePage.elements}
          activeTool={activeTool}
          selectedId={selectedId}
          selectedIds={selectedIds}
          elementStyle={elementStyle}
          isToolLocked={isToolLocked}
          theme={theme}
          onSelect={setSelectedId}
          onSelectMultiple={setSelectedIds}
          onCommit={commitElement}
          onCommitBatch={commitElements}
          onDelete={deleteElement}
          onToolChange={setActiveTool}
          onZoomChange={setZoom}
          onEditingTextChange={setIsEditingText}
          onStyleChange={handleStyleChange}
        />

        {/* Contextual Floating Inspector */}
        <Inspector
          activeTool={activeTool}
          selected={selectedElement ?? (selectedIds.length > 0 ? activePage.elements.find((el) => selectedIds.includes(el.id)) ?? null : null)}
          style={elementStyle}
          theme={theme}
          isEditingText={isEditingText || activeTool === "text" || selectedElement?.type === "text"}
          onStyleChange={handleStyleChange}
          onSelectedChange={updateSelected}
          onDuplicateSelected={duplicateSelected}
          onDeleteSelected={deleteSelectedElements}
          onBringForward={bringForward}
          onSendBackward={sendBackward}
          onBringToFront={bringToFront}
          onSendToBack={sendToBack}
        />

        {/* Bottom Viewport HUD */}
        <div className="bottom-hud" aria-label="Viewport Controls">
          <div className="hud-group">
            <button
              type="button"
              className="hud-btn"
              title="Zoom Out"
              aria-label="Zoom Out"
              onClick={() => canvasRef.current?.zoomOut()}
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              className="hud-btn zoom-percent-btn"
              title="Click to reset zoom to 100%"
              aria-label="Reset Zoom to 100%"
              onClick={() => canvasRef.current?.resetView()}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="hud-btn"
              title="Zoom In"
              aria-label="Zoom In"
              onClick={() => canvasRef.current?.zoomIn()}
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="hud-divider" />

          <div className="hud-group">
            <button
              type="button"
              className="hud-btn"
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              disabled={history.past.length === 0}
              onClick={undo}
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              className="hud-btn"
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
              disabled={history.future.length === 0}
              onClick={redo}
            >
              <Redo2 size={14} />
            </button>
          </div>

          <div className="hud-divider" />

          <div className="hud-group">
            <button
              type="button"
              className="hud-btn"
              title="Center Content"
              aria-label="Center Content"
              onClick={() => canvasRef.current?.centerContent()}
            >
              <Crosshair size={14} />
            </button>
            <button
              type="button"
              className="hud-btn"
              title="Reset View"
              aria-label="Reset View"
              onClick={() => canvasRef.current?.resetView()}
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* Notebook Page Tabs Bar */}
      <PageBar
        pages={present.pages}
        activePageId={present.activePageId}
        onSelect={selectPage}
        onAdd={addPage}
        onDuplicate={duplicatePage}
        onDelete={deletePage}
        onRenamePage={renamePage}
        onTemplateChange={(template) =>
          updateActivePage((page) => ({ ...page, template }))
        }
      />

      {/* Workspaces & Hierarchical Folders Sidebar (Ctrl+B) */}
      <WorkspaceSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspace={handleCreateWorkspace}
        onDeleteWorkspace={async (id) => {
          if (!storage) return;
          await storage.deleteWorkspace(id);
          const wsList = await storage.listWorkspaces();
          setWorkspaces(wsList);
          if (id === activeWorkspaceId && wsList.length > 0) {
            handleSelectWorkspace(wsList[0].id);
          }
        }}
        folders={folders}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        whiteboards={whiteboards}
        activeWhiteboardId={activeWhiteboardId}
        onSelectWhiteboard={handleSelectWhiteboard}
        onCreateWhiteboard={handleCreateWhiteboard}
        onRenameWhiteboard={handleRenameWhiteboard}
        onDeleteWhiteboard={handleDeleteWhiteboard}
        onOpenMoveModal={(id) => setMoveModalBoardId(id)}
      />

      {/* Move Whiteboard Modal (Shift + M) */}
      <MoveModal
        isOpen={moveModalBoardId !== null}
        whiteboardId={moveModalBoardId}
        whiteboardName={
          whiteboards.find((b) => b.id === moveModalBoardId)?.name || activeWhiteboardName
        }
        currentWorkspaceId={activeWorkspaceId}
        currentFolderId={activeFolderId}
        workspaces={workspaces}
        folders={folders}
        onClose={() => setMoveModalBoardId(null)}
        onMove={handleMoveWhiteboard}
      />
    </main>
  );
}
