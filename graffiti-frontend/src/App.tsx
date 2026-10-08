import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Cloud,
  Crosshair,
  Download,
  FileJson,
  FileType2,
  Folder as FolderIcon,
  FolderOpen,
  HardDrive,
  ImageDown,
  FileText,
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
  Sparkles,
  Map as MapIcon,
  Mic,
  Search,
  LayoutDashboard,
  User as UserIcon,
  LogOut,
  Share2,
  WifiOff,
  Wifi,
  Wand2,
  X,
  ExternalLink,
  Monitor,
  Settings as SettingsIcon,
  LogIn,
  Copy,
  Check,
} from "lucide-react";

const DESKTOP_VERSION = "0.2.0";
const DESKTOP_EXE_DOWNLOAD_URL = `https://github.com/AnkitArsh19/graffiti/releases/download/v${DESKTOP_VERSION}/Graffiti_${DESKTOP_VERSION}_x64-setup.exe`;
const RELEASES_PAGE_URL = "https://github.com/AnkitArsh19/graffiti/releases/latest";

import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { useShortcuts, formatShortcut } from "./contexts/ShortcutsContext";
import { useCollaboration } from "./collab/useCollaboration";
import type { AiGhostMessage } from "./collab/StompClient";
import { ShareModal } from "./components/ShareModal";
import { CreateRoomModal } from "./components/CreateRoomModal";
import { JoinRoomModal } from "./components/JoinRoomModal";
import { Minimap } from "./components/Minimap";
import { CanvasSearch } from "./components/CanvasSearch";
import { VoiceCommander } from "./components/VoiceCommander";
import { TextToDiagramPanel } from "./components/TextToDiagramPanel";
import { GoogleDriveExportModal } from "./components/GoogleDriveExportModal";
import { DesktopAuthModal } from "./components/DesktopAuthModal";
import { SettingsModal } from "./components/SettingsModal";
import { isDesktopApp, getLaunchDeepLink, exchangeDesktopHandoffCode } from "./lib/desktopAuth";

import {
  apiGetRoom,
  apiCreateRoom,
  apiSaveRoomContent,
  apiUpdateRoom,
  apiDeleteRoom,
  apiLeaveRoom,
  apiCreateRoomPage,
  apiDeleteRoomPage,
  apiGetRoomPages,
  apiUpdateRoomPage,
  apiExportDrive,
  apiCreateWorkspace,
  apiDeleteWorkspace,
  apiCreateFolder,
  apiUpdateFolder,
  apiDeleteFolder,
} from "./lib/api";

import { Inspector } from "./components/Inspector";
import { PageBar } from "./components/PageBar";
import { Toolbar } from "./components/Toolbar";
import { WhiteboardCanvas, type WhiteboardCanvasHandle } from "./components/WhiteboardCanvas";
import { WorkspaceSidebar, getFolderColor } from "./components/WorkspaceSidebar";
import { MoveModal } from "./components/MoveModal";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { DocumentViewer } from "./components/DocumentViewer";
import { LandscapePrompt } from "./components/LandscapePrompt";
import {
  saveActiveDocumentToCache,
  getActiveDocumentFromCache,
  clearActiveDocumentCache,
} from "./lib/documentCache";
import {
  getStorageAdapter,
  type StorageAdapter,
  type Workspace,
  type Folder,
  type WhiteboardSummary,
  type WhiteboardPageData,
} from "./storage";
import { applyDarkModeFilter } from "./lib/colors";
import { getFreedrawOutline, getSvgPathFromStroke, renderCanvasElement } from "./lib/canvasRenderer";
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
  Viewport,
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
  const bg = isDark ? "#09090b" : "#ffffff";
  const defaultStroke = isDark ? "#f4f4f5" : "#18181b";

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

  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { shortcuts, getShortcut, getShortcutDisplay, openSettings } = useShortcuts();
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isMinimapOpen, setIsMinimapOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, scrollX: 0, scrollY: 0 });

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLiveMenuOpen, setIsLiveMenuOpen] = useState(false);
  const [isJoinRoomModalOpen, setIsJoinRoomModalOpen] = useState(false);
  const [isCopiedCode, setIsCopiedCode] = useState(false);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [ghostElements, setGhostElements] = useState<CanvasElement[]>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const liveMenuRef = useRef<HTMLDivElement>(null);

  // Close user and live dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (liveMenuRef.current && !liveMenuRef.current.contains(e.target as Node)) {
        setIsLiveMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Save current active room slug for desktop overlay
  useEffect(() => {
    if (slug) {
      try {
        localStorage.setItem("graffiti:current_room_slug", slug);
      } catch {}
    }
  }, [slug]);

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
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [driveModalMode, setDriveModalMode] = useState<"export" | "import">("export");
  const [isDesktopAuthOpen, setIsDesktopAuthOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

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
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const [annotatingFile, setAnnotatingFile] = useState<File | null>(null);

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

  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
  const isRoomLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    isRoomLoadedRef.current = false;
  }, [slug]);

  const handleOpenShare = useCallback(() => {
    if (slug) {
      setIsShareOpen(true);
      return;
    }
    setIsCreateRoomModalOpen(true);
  }, [slug]);

  const handleConfirmStartRoom = useCallback(
    async (option: "current" | "new") => {
      try {
        setIsCreateRoomModalOpen(false);
        let targetSnapshot: any;
        let targetName: string;

        if (option === "current") {
          targetSnapshot = {
            activePageId: present.activePageId,
            pages: present.pages,
          };
          targetName = activeWhiteboardName;
        } else {
          const freshPage = createPage("Canvas 1", "grid");
          targetSnapshot = {
            activePageId: freshPage.id,
            pages: [freshPage],
          };
          targetName = "New Collaborative Canvas";
          setActiveWhiteboardName(targetName);
          setHistory({
            past: [],
            present: targetSnapshot,
            future: [],
          });
        }

        const room = await apiCreateRoom({
          name: targetName,
          snapshotState: targetSnapshot,
        });

        if (targetSnapshot) {
          await apiSaveRoomContent(room.slug, {
            name: targetName,
            snapshotState: targetSnapshot,
          }).catch((err) => console.warn("Initial sync to room failed:", err));
        }

        try {
          localStorage.setItem(
            `graffiti:room_cache:${room.slug}`,
            JSON.stringify({
              name: targetName,
              snapshotState: targetSnapshot,
            })
          );
        } catch {}

        isRoomLoadedRef.current = true;
        navigate(`/room/${room.slug}`);
        setIsShareOpen(true);
      } catch (e) {
        console.error("Failed to create room for sharing:", e);
        setIsShareOpen(true);
      }
    },
    [navigate, activeWhiteboardName, present]
  );

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
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setIsToolsOpen(false);
      }
    }
    if (isExportOpen || isToolsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExportOpen, isToolsOpen]);

  // Check if desktop app was launched via deep link (e.g. graffiti://auth/callback?code=...)
  useEffect(() => {
    if (!isDesktopApp()) return;
    getLaunchDeepLink().then((deepLink) => {
      if (deepLink && deepLink.includes("code=")) {
        exchangeDesktopHandoffCode(deepLink).catch((err) => {
          console.warn("Failed to exchange launch deep link:", err);
        });
      }
    });
  }, []);

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
            let targetWb = wbList[0];
            try {
              const savedWbId = localStorage.getItem("graffiti:active_whiteboard_id");
              if (savedWbId) {
                const found = wbList.find((wb) => wb.id === savedWbId);
                if (found) targetWb = found;
              }
            } catch {}
            const wbDetail = await adapter.getWhiteboard(targetWb.id);
            // Only switch canvas to local whiteboard if we are NOT visiting a shared/cloud room slug!
            if (!slug && wbDetail && wbDetail.pages.length > 0 && mounted) {
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

  // Persist active whiteboard ID
  useEffect(() => {
    if (activeWhiteboardId) {
      try {
        localStorage.setItem("graffiti:active_whiteboard_id", activeWhiteboardId);
      } catch {}
    }
  }, [activeWhiteboardId]);

  // Restore cached active document on app mount
  useEffect(() => {
    let active = true;
    getActiveDocumentFromCache().then((cachedFile) => {
      if (active && cachedFile) {
        setAnnotatingFile(cachedFile);
      }
    });
    return () => {
      active = false;
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

  // Auto-save active whiteboard to local storage and server
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

          // If authenticated, also save full whiteboard content to Graffiti backend server
          if (isAuthenticated) {
            apiSaveRoomContent(existing.slug, {
              name: activeWhiteboardName,
              workspaceId: activeWorkspaceId,
              folderId: activeFolderId,
              snapshotState: {
                activePageId: present.activePageId,
                pages: updatedPages,
              },
            }).catch((err) => {
              console.warn("Auto-sync to cloud server error:", err);
            });
          }
        }
      } catch (err) {
        console.error("Auto-save to storage failed:", err);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [present, activeWhiteboardId, activeWhiteboardName, activeFolderId, activeWorkspaceId, storage, isAuthenticated]);

  // Cloud Room auto-sync: When collaborating in a room (/room/:slug), sync canvas snapshot to server & cache locally
  useEffect(() => {
    if (!slug || !isRoomLoadedRef.current) return;
    if (present.pages.length > 0) {
      try {
        localStorage.setItem(
          `graffiti:room_cache:${slug}`,
          JSON.stringify({
            name: activeWhiteboardName,
            snapshotState: {
              activePageId: present.activePageId,
              pages: present.pages,
            },
          })
        );
      } catch {}
    }

    const timeout = window.setTimeout(() => {
      if (present.pages.length > 0 && isRoomLoadedRef.current) {
        apiSaveRoomContent(slug, {
          name: activeWhiteboardName,
          snapshotState: {
            activePageId: present.activePageId,
            pages: present.pages,
          },
        }).catch((err) => {
          console.warn("Auto-sync cloud room content error:", err);
        });
      }
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [slug, present, activeWhiteboardName]);

  // Immediate flush on beforeunload / visibility change so user closing/refreshing tab loses 0 changes
  useEffect(() => {
    const flushSave = () => {
      if (!storage || !activeWhiteboardId) return;
      try {
        const updatedPages: WhiteboardPageData[] = present.pages.map((p, idx) => ({
          id: p.id,
          whiteboardId: activeWhiteboardId,
          title: p.title,
          template: p.template,
          pageOrder: idx,
          elements: p.elements,
          createdAt: Date.now(),
        }));
        storage.saveWhiteboard({
          id: activeWhiteboardId,
          workspaceId: activeWorkspaceId || "",
          folderId: activeFolderId,
          name: activeWhiteboardName,
          slug: "",
          activePageId: present.activePageId,
          pages: updatedPages,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }).catch(() => {});
      } catch {}
    };

    window.addEventListener("beforeunload", flushSave);
    const handleVis = () => {
      if (document.visibilityState === "hidden") {
        flushSave();
      }
    };
    document.addEventListener("visibilitychange", handleVis);

    return () => {
      window.removeEventListener("beforeunload", flushSave);
      document.removeEventListener("visibilitychange", handleVis);
    };
  }, [storage, activeWhiteboardId, activeWorkspaceId, activeFolderId, activeWhiteboardName, present]);

  // Background sync: Ensure all existing local whiteboards are uploaded to server when authenticated
  useEffect(() => {
    if (!isAuthenticated || !storage) return;
    const activeStorage = storage;

    let cancelled = false;
    async function syncLocalToCloud(s: StorageAdapter) {
      try {
        const wsList = await s.listWorkspaces();
        for (const ws of wsList) {
          const wbList = await s.listWhiteboards(ws.id);
          for (const wb of wbList) {
            if (cancelled) return;
            const detail = await s.getWhiteboard(wb.id);
            if (detail) {
              apiSaveRoomContent(detail.slug, {
                name: detail.name,
                workspaceId: detail.workspaceId,
                folderId: detail.folderId,
                snapshotState: {
                  activePageId: detail.activePageId,
                  pages: detail.pages,
                },
              }).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.warn("Background cloud sync error:", e);
      }
    }

    syncLocalToCloud(activeStorage);

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, storage]);

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

        if (isAuthenticated) {
          apiSaveRoomContent(newBoard.slug, {
            name: newBoard.name,
            workspaceId: activeWorkspaceId,
            folderId: folderId,
            snapshotState: {
              activePageId: newBoard.activePageId,
              pages: newBoard.pages,
            },
          }).catch((e) => console.warn("Failed to create room on server:", e));
        }

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
    [storage, activeWorkspaceId, isAuthenticated]
  );

  // Handler: Rename whiteboard
  const handleRenameWhiteboard = useCallback(
    async (id: string, name: string) => {
      if (!storage) return;
      try {
        const existing = await storage.getWhiteboard(id);
        if (existing && isAuthenticated) {
          apiUpdateRoom(existing.slug, { name }).catch((e) =>
            console.warn("Failed to rename room on server:", e)
          );
        }
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
    [storage, activeWhiteboardId, isAuthenticated]
  );

  // Handler: Delete whiteboard
  const handleDeleteWhiteboard = useCallback(
    async (id: string) => {
      if (!storage) return;
      try {
        const existing = await storage.getWhiteboard(id);
        if (existing && isAuthenticated) {
          apiDeleteRoom(existing.slug).catch((e) =>
            console.warn("Failed to delete room on server:", e)
          );
        }
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
    [storage, activeWorkspaceId, activeWhiteboardId, handleSelectWhiteboard, handleCreateWhiteboard, isAuthenticated]
  );

  // Handler: Create folder
  const handleCreateFolder = useCallback(
    async (name: string, parentFolderId: string | null = null) => {
      if (!storage || !activeWorkspaceId) return;
      try {
        if (isAuthenticated) {
          apiCreateFolder({ workspaceId: activeWorkspaceId, name, parentFolderId }).catch((e) =>
            console.warn("Failed to create folder on server:", e)
          );
        }
        await storage.createFolder(activeWorkspaceId, name, parentFolderId);
        const fList = await storage.listFolders(activeWorkspaceId);
        setFolders(fList);
      } catch (err) {
        console.error("Failed to create folder:", err);
      }
    },
    [storage, activeWorkspaceId, isAuthenticated]
  );

  // Handler: Rename folder
  const handleRenameFolder = useCallback(
    async (id: string, name: string) => {
      if (!storage) return;
      try {
        if (isAuthenticated) {
          apiUpdateFolder(id, { name }).catch((e) =>
            console.warn("Failed to rename folder on server:", e)
          );
        }
        await storage.updateFolder(id, { name });
        setFolders((prev) =>
          prev.map((f) => (f.id === id ? { ...f, name } : f))
        );
      } catch (err) {
        console.error("Failed to rename folder:", err);
      }
    },
    [storage, isAuthenticated]
  );

  // Handler: Delete folder
  const handleDeleteFolder = useCallback(
    async (id: string) => {
      if (!storage || !activeWorkspaceId) return;
      try {
        if (isAuthenticated) {
          apiDeleteFolder(id).catch((e) => console.warn("Failed to delete folder on server:", e));
        }
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
    [storage, activeWorkspaceId, activeFolderId, isAuthenticated]
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
        if (isAuthenticated) {
          apiCreateWorkspace({ name }).catch((e) =>
            console.warn("Failed to create workspace on server:", e)
          );
        }
        const ws = await storage.createWorkspace(name);
        const wsList = await storage.listWorkspaces();
        setWorkspaces(wsList);
        handleSelectWorkspace(ws.id);
      } catch (err) {
        console.error("Failed to create workspace:", err);
      }
    },
    [storage, handleSelectWorkspace, isAuthenticated]
  );

  // Handler: Move whiteboard
  const handleMoveWhiteboard = useCallback(
    async (targetWorkspaceId: string, targetFolderId: string | null) => {
      if (!storage || !moveModalBoardId) return;
      try {
        const existing = await storage.getWhiteboard(moveModalBoardId);
        if (existing && isAuthenticated) {
          apiUpdateRoom(existing.slug, {
            workspaceId: targetWorkspaceId,
            folderId: targetFolderId,
          }).catch((e) => console.warn("Failed to update room location on server:", e));
        }
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
        setMoveModalBoardId(null);
      } catch (err) {
        console.error("Failed to move whiteboard:", err);
      }
    },
    [
      storage,
      moveModalBoardId,
      activeWorkspaceId,
      activeWhiteboardId,
      handleSelectWhiteboard,
      handleCreateWhiteboard,
      isAuthenticated,
    ]
  );

  // Direct move handler for drag-and-drop
  const handleDirectMoveWhiteboard = useCallback(
    async (whiteboardId: string, targetFolderId: string | null) => {
      if (!storage || !activeWorkspaceId) return;
      try {
        const existing = whiteboards.find((b) => b.id === whiteboardId);
        if (existing && isAuthenticated) {
          apiUpdateRoom(existing.slug, {
            workspaceId: activeWorkspaceId,
            folderId: targetFolderId,
          }).catch((e) => console.warn("Failed to update room location on server:", e));
        }
        await storage.moveWhiteboard(whiteboardId, activeWorkspaceId, targetFolderId);
        const wbList = await storage.listWhiteboards(activeWorkspaceId);
        setWhiteboards(wbList);
        if (whiteboardId === activeWhiteboardId) {
          setActiveFolderId(targetFolderId);
        }
      } catch (err) {
        console.error("Failed to move whiteboard:", err);
      }
    },
    [storage, activeWorkspaceId, whiteboards, isAuthenticated, activeWhiteboardId]
  );

  const handleMoveFolder = useCallback(
    async (folderId: string, targetParentFolderId: string | null) => {
      if (!storage || !activeWorkspaceId || folderId === targetParentFolderId) return;
      try {
        if (isAuthenticated) {
          apiUpdateFolder(folderId, { parentFolderId: targetParentFolderId }).catch((e) =>
            console.warn("Failed to update folder parent on server:", e)
          );
        }
        await storage.updateFolder(folderId, { parentFolderId: targetParentFolderId });
        const fList = await storage.listFolders(activeWorkspaceId);
        setFolders(fList);
      } catch (err) {
        console.error("Failed to move folder:", err);
      }
    },
    [storage, activeWorkspaceId, isAuthenticated]
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

  const commitRemoteState = useCallback((recipe: (state: NotebookState) => NotebookState) => {
    setHistory((current) => {
      const next = recipe(current.present);
      if (next === current.present) return current;
      return {
        ...current,
        present: next,
      };
    });
  }, []);

  const [lastRemoteDocOp, setLastRemoteDocOp] = useState<any>(null);

  const handleRemoteOp = useCallback(
    (op: any | AiGhostMessage) => {
      if (op.type === "AI_GHOST_OP") {
        const proposed = op.payload?.proposedElements;
        setGhostElements(Array.isArray(proposed) ? proposed.map(normalizePenElement) : []);
        return;
      }

      // Route document annotations to DocumentViewer
      if (op.payload?.__isDocAnnotation) {
        setLastRemoteDocOp(op);
        return;
      }

      // Handle collaborative multi-page synchronization
      if (op.payload?.__isPageOp) {
        const { opAction, page, pageId, title, template } = op.payload;
        if (opAction === "ADD_PAGE" && page) {
          commitRemoteState((state) => {
            if (state.pages.some((p) => p.id === page.id)) return state;
            return {
              ...state,
              pages: [...state.pages, page],
            };
          });
        } else if (opAction === "DELETE_PAGE" && pageId) {
          commitRemoteState((state) => {
            if (state.pages.length <= 1) return state;
            const remaining = state.pages.filter((p) => p.id !== pageId);
            const nextActive = state.activePageId === pageId ? remaining[0]?.id : state.activePageId;
            return {
              ...state,
              pages: remaining,
              activePageId: nextActive,
            };
          });
        } else if (opAction === "RENAME_PAGE" && pageId && title) {
          commitRemoteState((state) => ({
            ...state,
            pages: state.pages.map((p) => (p.id === pageId ? { ...p, title } : p)),
          }));
        } else if (opAction === "UPDATE_PAGE_TEMPLATE" && pageId && template) {
          commitRemoteState((state) => ({
            ...state,
            pages: state.pages.map((p) => (p.id === pageId ? { ...p, template } : p)),
          }));
        }
        return;
      }

      // Handle OWNER_CHANGED presence event
      if ((op as any).type === "PRESENCE" && (op as any).presenceType === "OWNER_CHANGED") {
        const payload = (op as any).payload;
        if (payload?.newOwnerId !== undefined) {
          setRoomInfo((prev: any) => (prev ? { ...prev, ownerId: payload.newOwnerId || null } : prev));
        }
        return;
      }

      if (op.opType === "CREATE_OR_UPDATE" && op.payload) {
        let payload = op.payload;
        // Normalize overlay strokes into whiteboard elements if originating from desktop overlay
        if (!payload.type && payload.tool) {
          const tool = payload.tool || "pen";
          const size = payload.size || 4;
          const color = payload.color || "#ffffff";
          if (tool === "rect") {
            const p0 = payload.points?.[0] || { x: 0, y: 0 };
            const p1 = payload.points?.[payload.points.length - 1] || p0;
            payload = {
              id: payload.id,
              type: "rectangle",
              x: Math.min(p0.x, p1.x),
              y: Math.min(p0.y, p1.y),
              width: Math.abs(p1.x - p0.x) || 10,
              height: Math.abs(p1.y - p0.y) || 10,
              strokeColor: color,
              strokeWidth: size,
              fillColor: "transparent",
              opacity: 100,
            };
          } else if (tool === "circle") {
            const p0 = payload.points?.[0] || { x: 0, y: 0 };
            const p1 = payload.points?.[payload.points.length - 1] || p0;
            payload = {
              id: payload.id,
              type: "ellipse",
              x: Math.min(p0.x, p1.x),
              y: Math.min(p0.y, p1.y),
              width: Math.abs(p1.x - p0.x) || 10,
              height: Math.abs(p1.y - p0.y) || 10,
              strokeColor: color,
              strokeWidth: size,
              fillColor: "transparent",
              opacity: 100,
            };
          } else if (tool === "arrow" || tool === "line") {
            const p0 = payload.points?.[0] || { x: 0, y: 0 };
            const p1 = payload.points?.[payload.points.length - 1] || p0;
            payload = {
              id: payload.id,
              type: tool === "arrow" ? "arrow" : "line",
              x: p0.x,
              y: p0.y,
              points: [
                { x: 0, y: 0 },
                { x: p1.x - p0.x, y: p1.y - p0.y },
              ],
              strokeColor: color,
              strokeWidth: size,
              opacity: 100,
            };
          } else {
            payload = {
              id: payload.id,
              type: "pen",
              x: 0,
              y: 0,
              points: (payload.points || []).map((p: any) => ({ x: p.x, y: p.y })),
              strokeColor: color,
              strokeWidth: size,
              opacity: tool === "highlighter" ? 35 : 100,
              roundness: "sharp",
            };
          }
        }

        const shape = normalizePenElement(payload as CanvasElement);
        commitRemoteState((state) => {
          const targetPageId = shape.pageId || state.activePageId;
          const targetPageExists = state.pages.some((p) => p.id === targetPageId);
          const normalizedShape = targetPageExists ? shape : { ...shape, pageId: state.activePageId };

          return {
            ...state,
            pages: state.pages.map((page) => {
              const isTarget = targetPageExists ? page.id === targetPageId : page.id === state.activePageId;
              if (!isTarget) return page;
              const exists = page.elements.some((el) => el.id === op.shapeId);
              const updated = exists ? page.elements.map((el) => (el.id === op.shapeId ? normalizedShape : el)) : [...page.elements, normalizedShape];
              return { ...page, elements: updateBoundArrows(updated, normalizedShape) };
            }),
          };
        });
      } else if (op.opType === "DELETE") {
        commitRemoteState((state) => ({
          ...state,
          pages: state.pages.map((page) => ({
            ...page,
            elements: page.elements.filter((el) => el.id !== op.shapeId),
          })),
        }));
      }
    },
    [commitRemoteState]
  );

  const handleCollabReconnect = useCallback(() => {
    if (!slug || !isRoomLoadedRef.current) return;
    // Auto-save changes to server on reconnect to ensure everything is synced
    apiSaveRoomContent(slug, {
      name: activeWhiteboardName,
      snapshotState: {
        activePageId: present.activePageId,
        pages: present.pages,
      },
    }).catch((err) => console.warn("Auto-sync on reconnect failed:", err));
  }, [slug, activeWhiteboardName, present]);

  const {
    isConnected: isCollabConnected,
    cursors,
    activeMembers,
    remoteDrafts,
    streamDraft,
    sendOp,
    sendAiRequest,
    sendCursorPosition,
  } = useCollaboration(slug || null, handleRemoteOp, handleCollabReconnect);

  const isRoomOwner = Boolean(
    user?.userId && roomInfo?.ownerId && user.userId === roomInfo.ownerId
  );

  const handleLeaveRoom = useCallback(async () => {
    if (!slug) return;
    try {
      const otherActiveMember = activeMembers.find(
        (m) => m.authorId !== (user?.userId || "")
      );
      await apiLeaveRoom(slug, otherActiveMember?.authorId);
    } catch (err) {
      console.warn("Leave room error:", err);
    }
    setIsLiveMenuOpen(false);
    navigate("/");
  }, [slug, activeMembers, user, navigate]);

  const handleJoinRoom = useCallback((roomCode: string) => {
    const clean = roomCode.trim();
    if (!clean) return;
    navigate(`/room/${clean}`);
  }, [navigate]);

  const commitElement = useCallback(
    (element: CanvasElement) => {
      const elWithPage = element.pageId ? element : { ...element, pageId: present.activePageId };
      updateActivePage((page) => {
        const exists = page.elements.some((item) => item.id === elWithPage.id);
        const updated = exists
          ? page.elements.map((item) => (item.id === elWithPage.id ? elWithPage : item))
          : [...page.elements, elWithPage];
        return {
          ...page,
          elements: updateBoundArrows(updated, elWithPage),
        };
      });
      sendOp(elWithPage.id, "CREATE_OR_UPDATE", elWithPage);
    },
    [updateActivePage, sendOp, present.activePageId],
  );

  const commitElements = useCallback(
    (newElements: CanvasElement[]) => {
      const elementsWithPage = newElements.map((el) => (el.pageId ? el : { ...el, pageId: present.activePageId }));
      updateActivePage((page) => {
        const idMap = new Map(elementsWithPage.map((el) => [el.id, el]));
        const updated = page.elements.map((item) => idMap.get(item.id) ?? item);
        let finalElements = updated;
        elementsWithPage.forEach((el) => {
          finalElements = updateBoundArrows(finalElements, el);
        });
        return {
          ...page,
          elements: finalElements,
        };
      });
      elementsWithPage.forEach((el) => sendOp(el.id, "CREATE_OR_UPDATE", el));
    },
    [updateActivePage, sendOp, present.activePageId],
  );

  // Automatically import strokes transferred from Desktop Overlay
  useEffect(() => {
    const checkImportedOverlayElements = () => {
      try {
        const raw = localStorage.getItem("graffiti:overlay_imported_elements");
        if (raw) {
          localStorage.removeItem("graffiti:overlay_imported_elements");
          const imported = JSON.parse(raw);
          if (Array.isArray(imported) && imported.length > 0) {
            updateActivePage((page) => ({
              ...page,
              elements: [...page.elements, ...imported],
            }));
            setAnnotatingFile(null);
          }
        }
      } catch (err) {
        console.error("Failed to import overlay elements:", err);
      }
    };

    window.addEventListener("focus", checkImportedOverlayElements);
    window.addEventListener("storage", checkImportedOverlayElements);
    checkImportedOverlayElements();
    return () => {
      window.removeEventListener("focus", checkImportedOverlayElements);
      window.removeEventListener("storage", checkImportedOverlayElements);
    };
  }, [updateActivePage]);

  const acceptGhosts = useCallback(() => {
    if (!ghostElements.length) return;
    commitElements(ghostElements.map((element) => ({ ...element, customData: { ...element.customData, ghostPreview: false, aiGenerated: true } })));
    setGhostElements([]);
  }, [commitElements, ghostElements]);

  const dismissGhosts = useCallback(() => setGhostElements([]), []);

  // Load initial room data if opening a collaborative room
  useEffect(() => {
    if (!slug) return;

    // Fast rehydrate from local room cache if available
    try {
      const cached = localStorage.getItem(`graffiti:room_cache:${slug}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.snapshotState?.pages?.length > 0) {
          setActiveWhiteboardName(parsed.name || "Collaborative Canvas");
          setHistory((current) => ({
            ...current,
            present: {
              pages: parsed.snapshotState.pages.map((p: any) => ({
                id: p.id,
                title: p.title || "Page 1",
                template: p.template || "grid",
                elements: (p.elements || []).map(normalizePenElement),
              })),
              activePageId: parsed.snapshotState.activePageId || parsed.snapshotState.pages[0]?.id || current.present.activePageId,
            },
          }));
        }
      }
    } catch {}

    apiGetRoom(slug)
      .then((res) => {
        setRoomInfo(res);
        setActiveWhiteboardName(res.name || res.slug || "Collaborative Canvas");
        const snapshotState = res.snapshotState ?? res.state;
        if (snapshotState) {
          try {
            const parsed = typeof snapshotState === "string" ? JSON.parse(snapshotState) : snapshotState;
            if (parsed && typeof parsed === "object" && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
              setHistory((current) => {
                const currentTotalElements = current.present.pages.reduce((sum, p) => sum + (p.elements?.length || 0), 0);
                const remoteTotalElements = parsed.pages.reduce((sum: number, p: any) => sum + (p.elements?.length || 0), 0);
                if (
                  isRoomLoadedRef.current &&
                  currentTotalElements > 0 &&
                  currentTotalElements >= remoteTotalElements &&
                  current.present.pages.length >= parsed.pages.length
                ) {
                  return current;
                }
                return {
                  ...current,
                  present: {
                    pages: parsed.pages.map((p: any) => ({
                      id: p.id,
                      title: p.title || "Page 1",
                      template: p.template || "grid",
                      elements: (p.elements || []).map(normalizePenElement),
                    })),
                    activePageId: parsed.activePageId || parsed.pages[0]?.id || current.present.activePageId,
                  },
                };
              });
            } else {
              const elemList = Array.isArray(parsed)
                ? parsed
                : typeof parsed === "object"
                ? Object.values(parsed)
                : [];
              if (elemList.length > 0) {
                updateActivePage((page) => ({
                  ...page,
                  elements: elemList.map(normalizePenElement),
                }));
              }
            }
          } catch (err) {
            console.error("Failed to parse room elements:", err);
          }
        }
        isRoomLoadedRef.current = true;
        const ops = res.opsSinceSnapshot ?? res.ops ?? [];
        if (Array.isArray(ops) && ops.length) ops.forEach((op) => handleRemoteOp({ type: "OP", ...op }));
      })
      .catch((err) => {
        isRoomLoadedRef.current = true;
        console.warn("Could not fetch remote room details (offline or network error), continuing with local cache:", err);
      });
  }, [slug, updateActivePage, handleRemoteOp]);

  const deleteElement = useCallback(
    (elementId: string) => {
      updateActivePage((page) => ({
        ...page,
        elements: page.elements.filter((element) => element.id !== elementId),
      }));
      setSelectedId((current) => (current === elementId ? null : current));
      setSelectedIds((current) => current.filter((id) => id !== elementId));
      sendOp(elementId, "DELETE", null);
    },
    [updateActivePage, sendOp],
  );

  const deleteSelectedElements = useCallback(() => {
    if (selectedIds.length > 0) {
      updateActivePage((page) => ({
        ...page,
        elements: page.elements.filter((element) => !selectedIds.includes(element.id)),
      }));
      selectedIds.forEach((id) => sendOp(id, "DELETE", null));
      setSelectedIds([]);
      setSelectedId(null);
    } else if (selectedId) {
      deleteElement(selectedId);
    }
  }, [deleteElement, selectedId, selectedIds, updateActivePage, sendOp]);

  const updateSelected = useCallback(
    (patch: Partial<CanvasElement>) => {
      const targetIds = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
      if (targetIds.length === 0) return;
      updateActivePage((page) => {
        const updated = page.elements.map((element) =>
          targetIds.includes(element.id) ? { ...element, ...patch } : element,
        );
        targetIds.forEach((id) => {
          const el = updated.find((e) => e.id === id);
          if (el) sendOp(el.id, "CREATE_OR_UPDATE", el);
        });
        return {
          ...page,
          elements: updated,
        };
      });
    },
    [selectedId, selectedIds, updateActivePage, sendOp],
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
    if (slug) {
      sendOp(page.id, "CREATE_OR_UPDATE", { __isPageOp: true, opAction: "ADD_PAGE", page });
      if (isAuthenticated) {
        apiCreateRoomPage(slug, { title: page.title, template: page.template, pageOrder: present.pages.length })
          .then((remote) => setHistory((current) => ({ ...current, present: { ...current.present, pages: current.present.pages.map((p) => p.id === page.id ? { ...p, id: remote.id } : p), activePageId: remote.id } })))
          .catch((error) => console.error("Failed to create cloud page", error));
      }
    }
    setSelectedId(null);
  }, [activePage.template, commitState, isAuthenticated, present.pages.length, slug, sendOp]);

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
    if (slug) {
      sendOp(page.id, "CREATE_OR_UPDATE", { __isPageOp: true, opAction: "ADD_PAGE", page });
      page.elements.forEach((el) => sendOp(el.id, "CREATE_OR_UPDATE", el));
    }
    setSelectedId(null);
  }, [activePage, commitState, slug, sendOp]);

  const renamePage = useCallback(
    (pageId: string, title: string) => {
      commitState((state) => ({
        ...state,
        pages: state.pages.map((page) =>
          page.id === pageId ? { ...page, title } : page,
        ),
      }));
      if (slug) {
        sendOp(pageId, "CREATE_OR_UPDATE", { __isPageOp: true, opAction: "RENAME_PAGE", pageId, title });
        if (isAuthenticated) apiUpdateRoomPage(slug, pageId, { title }).catch((error) => console.error("Failed to rename cloud page", error));
      }
    },
    [commitState, isAuthenticated, slug, sendOp],
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
      if (slug) {
        sendOp(targetId, "DELETE", { __isPageOp: true, opAction: "DELETE_PAGE", pageId: targetId });
        if (isAuthenticated) apiDeleteRoomPage(slug, targetId).catch((error) => console.error("Failed to delete cloud page", error));
      }
      setSelectedId(null);
      setSelectedIds([]);
    },
    [activePage.id, commitState, isAuthenticated, present.pages, slug, sendOp],
  );

  const updateActivePageTemplate = useCallback((template: PaperTemplate) => {
    const pageId = activePage.id;
    updateActivePage((page) => ({ ...page, template }));
    if (slug) {
      sendOp(pageId, "CREATE_OR_UPDATE", { __isPageOp: true, opAction: "UPDATE_PAGE_TEMPLATE", pageId, template });
      if (isAuthenticated) apiUpdateRoomPage(slug, pageId, { template }).catch((error) => console.error("Failed to update cloud page", error));
    }
  }, [activePage.id, isAuthenticated, slug, updateActivePage, sendOp]);

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

  const handleToggleOverlay = useCallback(() => {
    if (isTauri()) {
      invoke("open_overlay_window").catch(console.error);
      setIsMenuOpen(false);
    } else {
      alert("Screen Overlay is a Desktop feature. Run Graffiti Desktop to draw over any application.");
    }
  }, []);

  function matchesKeyShortcut(e: KeyboardEvent, bindingKey: string | undefined): boolean {
    if (!bindingKey) return false;
    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.metaKey) parts.push("Meta");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey && e.key !== "Shift") parts.push("Shift");
    let k = e.key;
    if (k === " ") k = "Space";
    if (k.length === 1) k = k.toUpperCase();
    if (!["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
      if (!parts.includes(k)) parts.push(k);
    }
    const combo = parts.join("+");
    return combo.toLowerCase() === bindingKey.toLowerCase();
  }

  // Keyboard and multi-button mouse shortcuts
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();

      // Settings shortcut
      if (matchesKeyShortcut(event, shortcuts.gen_settings?.key)) {
        event.preventDefault();
        openSettings("whiteboard");
        return;
      }

      // Overlay shortcut
      if (matchesKeyShortcut(event, shortcuts.gen_overlay?.key)) {
        event.preventDefault();
        handleToggleOverlay();
        return;
      }

      // Undo / Redo
      if (matchesKeyShortcut(event, shortcuts.wb_undo?.key) || ((event.ctrlKey || event.metaKey) && key === "z" && !event.shiftKey)) {
        event.preventDefault();
        undo();
        return;
      }
      if (matchesKeyShortcut(event, shortcuts.wb_redo?.key) || ((event.ctrlKey || event.metaKey) && (key === "y" || (key === "z" && event.shiftKey)))) {
        event.preventDefault();
        redo();
        return;
      }

      // Duplicate
      if ((event.ctrlKey || event.metaKey) && key === "d") {
        event.preventDefault();
        event.shiftKey ? duplicatePage() : duplicateSelected();
        return;
      }
      
      // Search
      if (matchesKeyShortcut(event, shortcuts.gen_search?.key) || ((event.ctrlKey || event.metaKey) && key === "f")) {
        event.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // Minimap
      if (matchesKeyShortcut(event, shortcuts.gen_minimap?.key) || (event.altKey && key === "m")) {
        event.preventDefault();
        setIsMinimapOpen((prev) => !prev);
        return;
      }

      // Sidebar
      if (matchesKeyShortcut(event, shortcuts.gen_sidebar?.key) || ((event.ctrlKey || event.metaKey) && key === "b")) {
        event.preventDefault();
        setIsSidebarOpen((prev) => !prev);
        return;
      }

      // Voice
      if (event.altKey && key === "v") {
        event.preventDefault();
        setIsVoiceListening((prev) => !prev);
        return;
      }

      // Add page
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "n") {
        event.preventDefault();
        addPage();
        return;
      }

      // Lock tool
      if (key === "q" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setIsToolLocked((prev) => !prev);
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
        if (ghostElements.length) { event.preventDefault(); dismissGhosts(); return; }
        event.preventDefault();
        setIsSidebarOpen(false);
        setMoveModalBoardId(null);
        setSelectedId(null);
        setSelectedIds([]);
        setActiveTool("select");
        return;
      }

      if (event.key === "Enter" && ghostElements.length) {
        event.preventDefault(); acceptGhosts(); return;
      }

      if (event.key === "=" && selectedElement && (selectedElement.type === "pen" || selectedElement.type === "text")) {
        event.preventDefault();
        sendAiRequest(selectedElement.id, selectedElement.type === "text" ? { feature: "math", equation: selectedElement.text, anchor: { x: selectedElement.x, y: selectedElement.y } } : { feature: "beautify", shapeId: selectedElement.id, points: selectedElement.points || [] });
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedIds.length > 0 || selectedId) {
          event.preventDefault();
          deleteSelectedElements();
          return;
        }
      }

      // Check dynamic bindings from user shortcuts
      const toolBindings: Array<[string, ToolId]> = [
        ["wb_select", "select"],
        ["wb_hand", "hand"],
        ["wb_pen", "pen"],
        ["wb_rectangle", "rectangle"],
        ["wb_ellipse", "ellipse"],
        ["wb_diamond", "diamond"],
        ["wb_line", "line"],
        ["wb_arrow", "arrow"],
        ["wb_text", "text"],
        ["wb_sticky", "sticky"],
        ["wb_eraser", "eraser"],
      ];

      for (const [bindingId, toolId] of toolBindings) {
        if (matchesKeyShortcut(event, shortcuts[bindingId]?.key)) {
          event.preventDefault();
          setActiveTool(toolId);
          return;
        }
      }

      // Fallback number and standard keys
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

    // Custom mouse buttons (supports Mouse 4, Mouse 5, middle-click, and custom gaming mouse buttons)
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 0) return; // Leave primary click alone
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;

      for (const [id, binding] of Object.entries(shortcuts)) {
        if (binding.isMouse && binding.mouseButton === event.button) {
          event.preventDefault();
          event.stopPropagation();
          if (id === "wb_pen") setActiveTool("pen");
          else if (id === "wb_eraser") setActiveTool("eraser");
          else if (id === "wb_select") setActiveTool("select");
          else if (id === "wb_hand") setActiveTool("hand");
          else if (id === "wb_rectangle") setActiveTool("rectangle");
          else if (id === "wb_ellipse") setActiveTool("ellipse");
          else if (id === "wb_diamond") setActiveTool("diamond");
          else if (id === "wb_line") setActiveTool("line");
          else if (id === "wb_arrow") setActiveTool("arrow");
          else if (id === "wb_text") setActiveTool("text");
          else if (id === "wb_sticky") setActiveTool("sticky");
          else if (id === "wb_undo") undo();
          else if (id === "wb_redo") redo();
          else if (id === "gen_overlay") handleToggleOverlay();
          else if (id === "gen_settings") openSettings("whiteboard");
          else if (id === "gen_minimap") setIsMinimapOpen((p) => !p);
          else if (id === "gen_sidebar") setIsSidebarOpen((p) => !p);
          else if (id === "gen_search") setIsSearchOpen(true);
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [acceptGhosts, addPage, deleteSelectedElements, dismissGhosts, duplicatePage, duplicateSelected, ghostElements.length, redo, selectedElement, selectedId, selectedIds.length, sendAiRequest, undo, shortcuts, openSettings, handleToggleOverlay]);

  const exportSvg = () => {
    downloadFile(
      `${activePage.title || "graffiti-canvas"}.svg`,
      toSvg(activePage.elements, theme),
      "image/svg+xml",
    );
    setIsExportOpen(false);
  };


  const createMultiPagePdf = async (): Promise<Blob | null> => {
    try {
      const { PDFDocument } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.create();
      for (const notebookPage of present.pages) {
        const canvas = document.createElement("canvas"); canvas.width = 1600; canvas.height = 1000;
        const context = canvas.getContext("2d"); if (!context) continue;
        context.fillStyle = theme === "dark" ? "#09090b" : "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
        notebookPage.elements.forEach((element) => renderCanvasElement(context, canvas, element, theme === "dark"));
        const imageBytes = Uint8Array.from(atob(canvas.toDataURL("image/png").split(",")[1]), (c) => c.charCodeAt(0));
        const pngImage = await pdfDoc.embedPng(imageBytes);
        const pdfPage = pdfDoc.addPage([canvas.width, canvas.height]);
        pdfPage.drawImage(pngImage, { x: 0, y: 0, width: canvas.width, height: canvas.height });
      }
      const pdfBytes = await pdfDoc.save();
      return new Blob([pdfBytes as any], { type: "application/pdf" });
    } catch (err) { console.error("Failed to create PDF:", err); return null; }
  };

  const exportPdf = async () => {
    try {
      const blob = await createMultiPagePdf(); if (!blob) return;
      const safeTitle = activePage.title.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "whiteboard";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeTitle}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setIsExportOpen(false);
    }
  };

  const exportToGoogleDrive = () => {
    setIsExportOpen(false);
    setDriveModalMode("export");
    setIsDriveModalOpen(true);
  };

  const importFromGoogleDrive = () => {
    setIsMenuOpen(false);
    setDriveModalMode("import");
    setIsDriveModalOpen(true);
  };

  const handleGoogleDriveImport = (file: File) => {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".graffiti") || lower.endsWith(".json")) {
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
      return;
    }
    setAnnotatingFile(file);
    saveActiveDocumentToCache(file).catch((err) => console.warn("Failed to cache document:", err));
  };

  const exportJson = () => {
    downloadFile(
      "graffiti-notebook.graffiti",
      JSON.stringify(present, null, 2),
      "application/json",
    );
    setIsExportOpen(false);
  };

  const exportMarkdown = () => {
    const markdown = present.pages.map((page, index) => {
      const notes = page.elements.flatMap((element) => {
        const ocr = element.customData?.ocrText;
        return [element.text, typeof ocr === "string" ? ocr : ""].filter(Boolean) as string[];
      });
      return `# ${index + 1}. ${page.title}\n\n${notes.length ? notes.map((note) => `- ${note}`).join("\n") : "_No text notes on this page._"}`;
    }).join("\n\n");
    downloadFile("graffiti-notes.md", markdown + "\n", "text/markdown");
    setIsExportOpen(false);
  };

  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnnotatingFile(file);
    saveActiveDocumentToCache(file).catch((err) => console.warn("Failed to cache document:", err));
    e.target.value = "";
    setIsMenuOpen(false);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf") || lower.endsWith(".docx") || lower.endsWith(".pptx")) {
      setAnnotatingFile(file);
      saveActiveDocumentToCache(file).catch((err) => console.warn("Failed to cache document:", err));
      e.target.value = "";
      setIsMenuOpen(false);
      return;
    }
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
        accept=".graffiti,.json,.pdf,.docx,.pptx"
        style={{ display: "none" }}
        onChange={handleImportJson}
      />
      <input
        ref={docFileInputRef}
        type="file"
        accept=".pdf,.docx,.pptx"
        style={{ display: "none" }}
        onChange={handleDocumentFileChange}
      />

      {/* Top Navigation Bar */}
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className={`menu-trigger-btn ${isMenuOpen ? "active" : ""}`}
            aria-label="Toggle application menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((prev) => !prev)}
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

          {activeFolder && (
            <div className="topbar-breadcrumbs" aria-label="Breadcrumb hierarchy">
              <span className="crumb folder" title={`Folder: ${activeFolder.name}`}>
                <FolderIcon size={12} color={getFolderColor(activeFolder.color)} />
                <span>{activeFolder.name}</span>
              </span>
            </div>
          )}
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
          {/* AI Studio Popover */}
          <div className="tools-menu-container" ref={toolsMenuRef} style={{ position: "relative" }}>
            <button
              type="button"
              className={`tools-trigger-btn ${isToolsOpen ? "active" : ""}`}
              onClick={() => setIsToolsOpen((prev) => !prev)}
              aria-label="AI Studio"
              aria-expanded={isToolsOpen}
              title="AI Studio"
            >
              <Sparkles size={14} style={{ color: "var(--accent-primary)" }} />
              <span>AI Studio</span>
              <ChevronDown size={13} className={`chevron-icon ${isToolsOpen ? "rotated" : ""}`} />
            </button>

            {isToolsOpen && (
              <div
                className="dropdown-popover tools-popover"
                role="menu"
                style={{ width: 220, padding: 6 }}
              >
                <div style={{ padding: "4px 8px 2px", fontSize: 10, fontWeight: 700, color: "var(--text-muted, #71717a)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  AI Capabilities
                </div>

                <button
                  type="button"
                  className="dropdown-item-btn"
                  role="menuitem"
                  onClick={() => {
                    setIsDiagramOpen(true);
                    setIsToolsOpen(false);
                  }}
                >
                  <Sparkles size={14} style={{ color: "var(--accent-primary)" }} />
                  <span>Text-to-Diagram AI</span>
                </button>

                <button
                  type="button"
                  className="dropdown-item-btn"
                  role="menuitem"
                  onClick={() => {
                    setIsVoiceListening((prev) => !prev);
                    setIsToolsOpen(false);
                  }}
                >
                  <Mic size={14} style={{ color: isVoiceListening ? "var(--color-danger)" : "var(--accent-primary)" }} />
                  <span>Voice Commander</span>
                  <kbd className="shortcut-badge">Alt+V</kbd>
                </button>

                <button
                  type="button"
                  className="dropdown-item-btn"
                  role="menuitem"
                  disabled={!selectedElement}
                  onClick={() => {
                    if (selectedElement) {
                      sendAiRequest(selectedElement.id, {
                        feature: "beautify",
                        shapeId: selectedElement.id,
                        points: selectedElement.points || [],
                      });
                    }
                    setIsToolsOpen(false);
                  }}
                  title={selectedElement ? "Beautify selected shape" : "Select a shape to beautify"}
                >
                  <Wand2 size={14} style={{ color: selectedElement ? "var(--accent-primary)" : "var(--text-muted)" }} />
                  <span>Beautify Selection</span>
                </button>
              </div>
            )}
          </div>

          {/* Real-time Collaboration Status Dropdown */}
          {slug && (
            <div className="live-status-dropdown-wrap" ref={liveMenuRef} style={{ position: "relative" }}>
              <button
                type="button"
                className={`topbar-status-pill ${isCollabConnected ? "online" : "offline"} live-status-btn`}
                onClick={() => setIsLiveMenuOpen((prev) => !prev)}
                title="Room status & collaboration options"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  cursor: "pointer",
                  border: isCollabConnected ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid var(--border-default)",
                  background: isCollabConnected ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                  color: isCollabConnected ? "#22c55e" : "#ef4444",
                  fontWeight: 600,
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 20,
                }}
              >
                {isCollabConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
                <span>{isCollabConnected ? `Live (${activeMembers.length + 1})` : "Connecting..."}</span>
                <ChevronDown size={12} style={{ opacity: 0.7, marginLeft: 2 }} />
              </button>

              {isLiveMenuOpen && (
                <div
                  className="dropdown-popover live-popover"
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 8,
                    width: 270,
                    background: "var(--bg-panel)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 12,
                    padding: 12,
                    boxShadow: "var(--shadow-lg)",
                    zIndex: 120,
                  }}
                >
                  {/* Room Code Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid var(--border-subtle)" }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>
                        Room Code
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "var(--accent-primary)" }}>
                        {slug}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="icon-action-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(slug);
                        setIsCopiedCode(true);
                        setTimeout(() => setIsCopiedCode(false), 2000);
                      }}
                      title="Copy Room Code"
                      style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {isCopiedCode ? <Check size={14} style={{ color: "#22c55e" }} /> : <Copy size={13} />}
                    </button>
                  </div>

                  {/* Active Collaborators Section */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                      Active Participants ({activeMembers.length + 1})
                    </div>
                    <div style={{ maxHeight: 130, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
                      {/* Current user */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "2px 4px" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {user?.name || user?.email || "You"}
                        </span>
                        {isRoomOwner && (
                          <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "rgba(212, 163, 89, 0.2)", color: "var(--accent-primary)", fontWeight: 700 }}>
                            OWNER
                          </span>
                        )}
                      </div>
                      {/* Remote members */}
                      {activeMembers.map((m) => (
                        <div key={m.authorId} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "2px 4px" }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color || "var(--accent-primary)", flexShrink: 0 }} />
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {m.name || m.authorId.slice(0, 8)}
                          </span>
                          {roomInfo?.ownerId === m.authorId && (
                            <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "rgba(212, 163, 89, 0.2)", color: "var(--accent-primary)", fontWeight: 700 }}>
                              OWNER
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dropdown Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--border-subtle)", paddingTop: 8 }}>
                    <button
                      type="button"
                      className="dropdown-item-btn"
                      onClick={() => {
                        setIsLiveMenuOpen(false);
                        handleOpenShare();
                      }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 6, background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 12 }}
                    >
                      <Share2 size={14} />
                      <span>Invite & Share Link</span>
                    </button>

                    <button
                      type="button"
                      className="dropdown-item-btn"
                      onClick={() => {
                        setIsLiveMenuOpen(false);
                        setIsJoinRoomModalOpen(true);
                      }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 6, background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 12 }}
                    >
                      <LogIn size={14} />
                      <span>Switch / Join Another Room</span>
                    </button>

                    <button
                      type="button"
                      className="dropdown-item-btn danger"
                      onClick={handleLeaveRoom}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 6, background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "var(--color-danger, #ef4444)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                    >
                      <LogOut size={14} />
                      <span>Leave Room</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!slug && isAuthenticated && (
            <div
              className="topbar-status-pill online"
              title={`All changes are securely saved to Graffiti cloud servers (${user?.email})`}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <Cloud size={13} style={{ color: "#22c55e" }} />
              <span>Saved to Server</span>
            </div>
          )}

          {/* Share / Collab Button */}
          {slug ? (
            <button
              type="button"
              className="collab-share-btn"
              title="Share Room & Manage Members"
              aria-label="Share Room"
              onClick={handleOpenShare}
            >
              <Share2 size={14} />
              <span>Share</span>
            </button>
          ) : (
            <button
              type="button"
              className="collab-share-btn"
              title="Start Collaborative Session & Share"
              aria-label="Start Collaborative Session & Share"
              onClick={handleOpenShare}
            >
              <Share2 size={14} />
              <span>Share</span>
            </button>
          )}

          {/* User Account / Profile */}
          {isAuthenticated && user ? (
            <div className="user-menu-container" ref={userMenuRef} style={{ position: "relative" }}>
              <button
                type="button"
                className="user-avatar-btn"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                title={user.name || user.email}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "1.5px solid var(--border-default)",
                  background: "var(--accent-primary)",
                  color: "var(--accent-text)",
                  fontWeight: 600,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {user.name
                  ? user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
                  : user.email.slice(0, 2).toUpperCase()}
              </button>
              {isUserMenuOpen && (
                <div
                  className="dropdown-popover user-dropdown"
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 8,
                    width: 220,
                    background: "var(--bg-panel)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 10,
                    padding: 8,
                    boxShadow: "var(--shadow-lg)",
                    zIndex: 100,
                  }}
                >
                  <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{user.name || "User"}</div>
                    <div style={{ fontSize: 11, opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
                  </div>
                  <button
                    type="button"
                    className="dropdown-item-btn"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate("/dashboard");
                    }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 13 }}
                  >
                    <LayoutDashboard size={15} />
                    <span>My Whiteboards</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item-btn"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setDriveModalMode("export");
                      setIsDriveModalOpen(true);
                    }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 13 }}
                  >
                    <Cloud size={15} />
                    <span>Google Drive Accounts</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item-btn"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsJoinRoomModalOpen(true);
                    }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 13 }}
                  >
                    <LogIn size={15} />
                    <span>Join with Room Code</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item-btn"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, background: "transparent", border: "none", color: "var(--color-danger)", cursor: "pointer", fontSize: 13 }}
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : isDesktopApp() ? (
            <button
              type="button"
              className="icon-action-btn"
              title="Sign In with Browser"
              onClick={() => setIsDesktopAuthOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 12px", width: "auto", height: 34, borderRadius: 8, background: "var(--accent-subtle)", border: "1px solid var(--accent-ring)", color: "var(--accent-primary)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
            >
              <UserIcon size={14} />
              <span>Sign In</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="icon-action-btn"
              title="Sign In to account"
              style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 5, padding: "0 12px", width: "auto", height: 34, borderRadius: 8, background: "var(--accent-subtle)", border: "1px solid var(--accent-ring)", color: "var(--accent-primary)", fontSize: 12, fontWeight: 500 }}
            >
              <UserIcon size={14} />
              <span>Sign In</span>
            </Link>
          )}

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
                <button
                  type="button"
                  className="dropdown-item-btn"
                  role="menuitem"
                  onClick={exportPdf}
                >
                  <FileText size={16} />
                  <span>PDF Document</span>
                </button>
                <button type="button" className="dropdown-item-btn" role="menuitem" onClick={exportMarkdown}>
                  <FileText size={16} />
                  <span>Markdown Notes</span>
                </button>
                <button
                  type="button"
                  className="dropdown-item-btn"
                  role="menuitem"
                  onClick={exportToGoogleDrive}
                >
                  <Cloud size={16} />
                  <span>Save to Drive</span>
                </button>

              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Application Menu Dropdown (Figma / macOS Style) */}
      {isMenuOpen ? (
        <>
          <div className="app-menu-backdrop" onClick={() => setIsMenuOpen(false)} />
          <nav
            className="app-menu-popover"
            role="menu"
            aria-label="Application Menu"
            onClick={(e) => e.stopPropagation()}
          >
            {/* File Section */}
            <button
              type="button"
              className="app-menu-item"
              onClick={() => {
                addPage();
                setIsMenuOpen(false);
              }}
            >
              <Plus size={14} />
              <span>New Page</span>
              <span className="app-menu-shortcut">{formatShortcut("Ctrl+Shift+N")}</span>
            </button>
            <button
              type="button"
              className="app-menu-item"
              onClick={() => {
                fileInputRef.current?.click();
                setIsMenuOpen(false);
              }}
            >
              <FolderOpen size={14} />
              <span>Open File</span>
              <span className="app-menu-shortcut">{formatShortcut("Ctrl+O")}</span>
            </button>
            <button
              type="button"
              className="app-menu-item"
              onClick={() => {
                docFileInputRef.current?.click();
                setIsMenuOpen(false);
              }}
            >
              <FileText size={14} />
              <span>Annotate Document</span>
              <span className="app-menu-shortcut">{formatShortcut("Ctrl+D")}</span>
            </button>
            <button
              type="button"
              className="app-menu-item"
              onClick={importFromGoogleDrive}
              title="Import from Drive"
            >
              <Cloud size={14} />
              <span>Import from Drive</span>
              <span className="app-menu-shortcut">{formatShortcut("Ctrl+Shift+G")}</span>
            </button>
            <button
              type="button"
              className="app-menu-item danger"
              onClick={() => {
                clearCanvas();
                setIsMenuOpen(false);
              }}
            >
              <Trash2 size={14} />
              <span>Clear Canvas</span>
              <span className="app-menu-shortcut">{formatShortcut("Esc")}</span>
            </button>
            <button
              type="button"
              className="app-menu-item"
              onClick={() => {
                setIsMenuOpen(false);
                handleOpenShare();
              }}
              title="Start a collaborative room or manage members"
            >
              <Share2 size={14} />
              <span>{slug ? "Share & Room Details" : "Start Collaborative Room"}</span>
            </button>
            <button
              type="button"
              className="app-menu-item"
              onClick={() => {
                setIsMenuOpen(false);
                setIsJoinRoomModalOpen(true);
              }}
              title="Join an existing room using room code or link"
            >
              <LogIn size={14} />
              <span>Join with Room Code</span>
            </button>

            <div className="app-menu-divider" />

            {/* Tools Section */}
            <button
              type="button"
              className="app-menu-item"
              onClick={() => {
                setIsSearchOpen(true);
                setIsMenuOpen(false);
              }}
            >
              <Search size={14} />
              <span>Find on Canvas</span>
              <span className="app-menu-shortcut">{getShortcutDisplay("gen_search") || formatShortcut("Ctrl+F")}</span>
            </button>
            <button
              type="button"
              className="app-menu-item"
              onClick={() => {
                handleToggleOverlay();
                setIsMenuOpen(false);
              }}
            >
              <Layers size={14} />
              <span>Screen Overlay</span>
              <span className="app-menu-shortcut">{getShortcutDisplay("gen_overlay") || formatShortcut("Ctrl+Shift+D")}</span>
            </button>
            <button
              type="button"
              className="app-menu-item"
              onClick={() => {
                setIsMinimapOpen((prev) => !prev);
                setIsMenuOpen(false);
              }}
            >
              <MapIcon size={14} />
              <span>Minimap Radar</span>
              <span className="app-menu-shortcut">{getShortcutDisplay("gen_minimap") || formatShortcut("Alt+M")}</span>
            </button>
            <button
              type="button"
              className="app-menu-item"
              onClick={() => {
                setIsVoiceListening((prev) => !prev);
                setIsMenuOpen(false);
              }}
            >
              <Mic size={14} />
              <span>Voice Commander</span>
              <span className="app-menu-shortcut">{formatShortcut("Alt+V")}</span>
            </button>

            <div className="app-menu-divider" />

            {/* Preferences Section */}
            <button
              type="button"
              className="app-menu-item"
              onClick={() => {
                openSettings("whiteboard");
                setIsMenuOpen(false);
              }}
            >
              <SettingsIcon size={14} />
              <span>Settings & Controls</span>
              <span className="app-menu-shortcut">{getShortcutDisplay("gen_settings") || formatShortcut("Ctrl+,")}</span>
            </button>

            <div className="app-menu-divider" />

            {/* Appearance / Theme Row */}
            <div className="app-menu-appearance-row">
              <span className="app-menu-appearance-label">Appearance</span>
              <div className="app-menu-theme-segmented">
                <button
                  type="button"
                  className={`theme-seg-btn ${theme === "dark" ? "active" : ""}`}
                  onClick={() => setTheme("dark")}
                  title="Dark Theme"
                >
                  <Moon size={12} />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  className={`theme-seg-btn ${theme === "light" ? "active" : ""}`}
                  onClick={() => setTheme("light")}
                  title="Light Theme"
                >
                  <Sun size={12} />
                  <span>Light</span>
                </button>
              </div>
            </div>

            {/* Desktop App status / Updates footer */}
            <div className="app-menu-divider" />
            <div className="app-menu-footer-row">
              {isDesktopApp() ? (
                <>
                  <span>Graffiti Desktop v{DESKTOP_VERSION}</span>
                  <a
                    href={RELEASES_PAGE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Check Updates
                  </a>
                </>
              ) : (
                <>
                  <span>Graffiti Web</span>
                  <a
                    href={DESKTOP_EXE_DOWNLOAD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Get Desktop App
                  </a>
                </>
              )}
            </div>
          </nav>
        </>
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
          pages={present.pages}
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
          cursors={cursors}
          onPointerWorldMove={sendCursorPosition}
          ghostElements={ghostElements}
          remoteDrafts={remoteDrafts}
          onStreamDraft={(draft) => streamDraft(draft, activePage.id)}
        />

        {ghostElements.length > 0 && (
          <div className="ai-ghost-toolbar" role="status">
            <span>AI suggestion ready</span>
            <button type="button" onClick={acceptGhosts}>Accept <kbd>Enter</kbd></button>
            <button type="button" onClick={dismissGhosts}>Dismiss <kbd>Esc</kbd></button>
          </div>
        )}

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
        onTemplateChange={updateActivePageTemplate}
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
          if (isAuthenticated) {
            apiDeleteWorkspace(id).catch((e) => console.warn("Failed to delete workspace on server:", e));
          }
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
        onMoveFolder={handleMoveFolder}
        onMoveWhiteboard={handleDirectMoveWhiteboard}
        onOpenMoveModal={(id) => setMoveModalBoardId(id)}
        isAuthenticated={!!isAuthenticated}
        userEmail={user?.email}
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
      {/* Document Annotation Viewer */}
      {annotatingFile && (
        <DocumentViewer
          file={annotatingFile}
          onClose={() => {
            setAnnotatingFile(null);
            clearActiveDocumentCache().catch(() => {});
          }}
          onSendToWhiteboard={(elements) => {
            updateActivePage((page) => ({
              ...page,
              elements: [...page.elements, ...elements],
            }));
            setAnnotatingFile(null);
            clearActiveDocumentCache().catch(() => {});
          }}
          onShare={handleOpenShare}
          roomSlug={slug || undefined}
          sendOp={sendOp}
          lastRemoteOp={lastRemoteDocOp}
        />
      )}

      {/* Landscape Orientation Prompt for Mobile Devices */}
      <LandscapePrompt />

      {/* Create / Start Room Choice Modal */}
      <CreateRoomModal
        isOpen={isCreateRoomModalOpen}
        onClose={() => setIsCreateRoomModalOpen(false)}
        currentBoardName={activeWhiteboardName || activePage.title || "Untitled Board"}
        pageCount={present.pages.length}
        elementCount={present.pages.reduce((acc, p) => acc + (p.elements?.length || 0), 0)}
        onConfirm={handleConfirmStartRoom}
      />

      {/* Join Room with Code Modal */}
      <JoinRoomModal
        isOpen={isJoinRoomModalOpen}
        onClose={() => setIsJoinRoomModalOpen(false)}
        onJoin={handleJoinRoom}
      />

      {/* Share Modal */}
      {isShareOpen && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          slug={slug || "main"}
          roomName={activeWhiteboardName || activePage.title || "Whiteboard"}
          isOwner={roomInfo?.ownerId === user?.userId}
          isLoggedIn={!!isAuthenticated}
          onRoomClaimed={() => {
            if (slug) apiGetRoom(slug).then(setRoomInfo);
          }}
        />
      )}

      {/* Minimap (Alt+M) */}
      <Minimap
        isOpen={isMinimapOpen}
        onToggle={() => setIsMinimapOpen((prev) => !prev)}
        elements={activePage.elements}
        viewport={viewport}
        onPanTo={(wx, wy) => canvasRef.current?.panTo(wx, wy)}
        theme={theme}
        dockPosition={dockPosition}
      />

      {/* Canvas Search (Ctrl+F) */}
      <CanvasSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        pages={present.pages}
        onSelectResult={(pageId, elementId, element) => {
          if (pageId !== present.activePageId) {
            selectPage(pageId);
          }
          setSelectedId(elementId);
          setSelectedIds([elementId]);
          canvasRef.current?.panTo(element.x + element.width / 2, element.y + element.height / 2);
        }}
      />

      {/* Voice Commander (Alt+V) */}
      <VoiceCommander
        isListening={isVoiceListening}
        onToggle={() => setIsVoiceListening((prev) => !prev)}
        onSelectTool={setActiveTool}
        onUndo={undo}
        onRedo={redo}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onResetView={() => canvasRef.current?.resetView()}
        onNewPage={addPage}
        onBeautify={() => {
          if (selectedElement) {
            sendAiRequest(selectedElement.id, {
              feature: "beautify",
              shapeId: selectedElement.id,
              points: selectedElement.points || [],
            });
          }
        }}
      />

      {/* Text-to-Diagram Panel */}
      <TextToDiagramPanel
        isOpen={isDiagramOpen}
        pageId={activePage.id}
        onClose={() => setIsDiagramOpen(false)}
        onInsertElements={commitElements}
        onRequestAiDiagram={(p) => {
          sendAiRequest(createId("diagram"), { feature: "diagram", prompt: p });
        }}
      />

      {/* Google Drive Multi-Account Export & Import Modal */}
      <GoogleDriveExportModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        getPdfBlob={createMultiPagePdf}
        roomSlug={slug}
        initialMode={driveModalMode}
        onImportFile={handleGoogleDriveImport}
      />

      {/* Desktop App Browser Sign-In & Handoff Modal */}
      <DesktopAuthModal
        isOpen={isDesktopAuthOpen}
        onClose={() => setIsDesktopAuthOpen(false)}
      />

      {/* Global & Multi-Mode Settings Modal */}
      <SettingsModal />
    </main>
  );
}
