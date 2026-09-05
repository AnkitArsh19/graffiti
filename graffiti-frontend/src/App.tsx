import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cloud,
  Download,
  FileJson,
  FileType2,
  ImageDown,
  Redo2,
  RotateCcw,
  Sparkles,
  Undo2,
} from "lucide-react";
import { Inspector } from "./components/Inspector";
import { PageBar } from "./components/PageBar";
import { Toolbar } from "./components/Toolbar";
import { WhiteboardCanvas, type WhiteboardCanvasHandle } from "./components/WhiteboardCanvas";
import { createId, createSeed, moveElement } from "./lib/geometry";
import type { CanvasElement, ElementStyle, NotebookPage, PaperTemplate, ToolId } from "./types";

interface NotebookState {
  pages: NotebookPage[];
  activePageId: string;
}

interface HistoryState {
  past: NotebookState[];
  present: NotebookState;
  future: NotebookState[];
}

const STORAGE_KEY = "graffiti:notebook:v1";
const defaultStyle: ElementStyle = {
  strokeColor: "#111827",
  backgroundColor: "transparent",
  strokeWidth: 2,
  roughness: 1,
};

function createPage(title: string, template: PaperTemplate = "blank"): NotebookPage {
  return { id: createId("page"), title, template, elements: [] };
}

function loadNotebook(): NotebookState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as NotebookState;
      if (parsed.pages?.length && parsed.pages.some((page) => page.id === parsed.activePageId)) {
        return parsed;
      }
    }
  } catch {
    // A corrupt local draft should never prevent the editor from opening.
  }
  const firstPage = createPage("Untitled page");
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

function toSvg(elements: CanvasElement[]) {
  const content = elements.map((element) => {
    const common = `stroke="${escapeXml(element.strokeColor)}" stroke-width="${element.strokeWidth}" fill="${escapeXml(element.backgroundColor)}" opacity="${element.opacity / 100}"`;
    if (element.type === "rectangle" || element.type === "sticky") {
      return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="${element.type === "sticky" ? 12 : 4}" ${common}/>`;
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
      return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" ${common} marker-end="${element.type === "arrow" ? "url(#arrow)" : ""}"/>`;
    }
    if (element.type === "pen" && element.points?.length) {
      return `<polyline points="${element.points.map((point) => `${point.x},${point.y}`).join(" ")}" ${common} fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return "";
  }).join("");

  const labels = elements.filter((element) => element.text).map((element) =>
    `<text x="${element.x + 12}" y="${element.y + 28}" fill="${escapeXml(element.strokeColor)}" font-family="Inter, sans-serif" font-size="18">${escapeXml(element.text ?? "")}</text>`,
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#111827"/></marker></defs><rect width="100%" height="100%" fill="#fbfcfe"/>${content}${labels}</svg>`;
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
  const [history, setHistory] = useState<HistoryState>(() => ({ past: [], present: loadNotebook(), future: [] }));
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [elementStyle, setElementStyle] = useState<ElementStyle>(defaultStyle);
  const canvasRef = useRef<WhiteboardCanvasHandle>(null);
  const { present } = history;
  const activePage = (present.pages.find((page) => page.id === present.activePageId) ?? present.pages[0])!;
  const selectedElement = activePage.elements.find((element) => element.id === selectedId) ?? null;

  const commitState = useCallback((recipe: (state: NotebookState) => NotebookState) => {
    setHistory((current) => {
      const next = recipe(current.present);
      if (next === current.present) return current;
      return { past: [...current.past.slice(-79), current.present], present: next, future: [] };
    });
  }, []);

  const updateActivePage = useCallback((recipe: (page: NotebookPage) => NotebookPage) => {
    commitState((state) => ({
      ...state,
      pages: state.pages.map((page) => page.id === state.activePageId ? recipe(page) : page),
    }));
  }, [commitState]);

  const commitElement = useCallback((element: CanvasElement) => {
    updateActivePage((page) => {
      const exists = page.elements.some((item) => item.id === element.id);
      return {
        ...page,
        elements: exists
          ? page.elements.map((item) => item.id === element.id ? element : item)
          : [...page.elements, element],
      };
    });
  }, [updateActivePage]);

  const deleteElement = useCallback((elementId: string) => {
    updateActivePage((page) => ({ ...page, elements: page.elements.filter((element) => element.id !== elementId) }));
    setSelectedId((current) => current === elementId ? null : current);
  }, [updateActivePage]);

  const updateSelected = useCallback((patch: Partial<CanvasElement>) => {
    if (!selectedId) return;
    updateActivePage((page) => ({
      ...page,
      elements: page.elements.map((element) => element.id === selectedId ? { ...element, ...patch } : element),
    }));
  }, [selectedId, updateActivePage]);

  const undo = useCallback(() => {
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      return { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] };
    });
    setSelectedId(null);
  }, []);

  const redo = useCallback(() => {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      return { past: [...current.past, current.present], present: next, future: current.future.slice(1) };
    });
    setSelectedId(null);
  }, []);

  const addPage = useCallback(() => {
    const page = createPage(`Page ${present.pages.length + 1}`);
    commitState((state) => ({ ...state, pages: [...state.pages, page], activePageId: page.id }));
    setSelectedId(null);
  }, [commitState, present.pages.length]);

  const duplicatePage = useCallback(() => {
    const page = createPage(`${activePage.title} copy`, activePage.template);
    page.elements = activePage.elements.map((element) => ({ ...element, id: createId("element"), pageId: page.id, seed: createSeed() }));
    commitState((state) => ({ ...state, pages: [...state.pages, page], activePageId: page.id }));
    setSelectedId(null);
  }, [activePage, commitState]);

  const duplicateSelected = useCallback(() => {
    if (!selectedElement) return;
    const duplicate = moveElement({ ...selectedElement, id: createId("element"), seed: createSeed() }, 24, 24);
    commitElement(duplicate);
    setSelectedId(duplicate.id);
  }, [commitElement, selectedElement]);

  const deletePage = useCallback(() => {
    if (present.pages.length === 1) return;
    const index = present.pages.findIndex((page) => page.id === activePage.id);
    commitState((state) => {
      const pages = state.pages.filter((page) => page.id !== activePage.id);
      return { ...state, pages, activePageId: pages[Math.max(0, index - 1)].id };
    });
    setSelectedId(null);
  }, [activePage.id, commitState, present.pages]);

  const selectPage = useCallback((pageId: string) => {
    setHistory((current) => ({ ...current, present: { ...current.present, activePageId: pageId } }));
    setSelectedId(null);
  }, []);

  const switchPage = useCallback((offset: number) => {
    const index = present.pages.findIndex((page) => page.id === present.activePageId);
    const next = present.pages[Math.min(Math.max(index + offset, 0), present.pages.length - 1)];
    if (next) selectPage(next.id);
  }, [present, selectPage]);

  useEffect(() => {
    const timeout = window.setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(present)), 250);
    return () => window.clearTimeout(timeout);
  }, [present]);

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
      if (event.altKey && event.key === "PageDown") {
        event.preventDefault();
        switchPage(1);
        return;
      }
      if (event.altKey && event.key === "PageUp") {
        event.preventDefault();
        switchPage(-1);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        deleteElement(selectedId);
        return;
      }

      const toolByKey: Partial<Record<string, ToolId>> = {
        v: "select", h: "hand", p: "pen", r: "rectangle", o: "ellipse",
        d: "diamond", l: "line", a: "arrow", t: "text", n: "sticky", e: "eraser",
      };
      const nextTool = toolByKey[key];
      if (nextTool && !event.ctrlKey && !event.metaKey && !event.altKey) setActiveTool(nextTool);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addPage, deleteElement, duplicatePage, duplicateSelected, redo, selectedId, switchPage, undo]);

  const savedStatus = useMemo(() => `${activePage.elements.length} element${activePage.elements.length === 1 ? "" : "s"}`, [activePage.elements.length]);

  const exportSvg = () => downloadFile(`${activePage.title || "graffiti-page"}.svg`, toSvg(activePage.elements), "image/svg+xml");
  const exportJson = () => downloadFile("graffiti-notebook.graffiti", JSON.stringify(present, null, 2), "application/json");

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup" aria-label="Graffiti home">
          <div className="brand-mark"><span>G</span></div>
          <div>
            <strong>Graffiti</strong>
            <span>Canvas workspace</span>
          </div>
        </div>

        <div className="document-title">
          <input
            value={activePage.title}
            aria-label="Page title"
            onChange={(event) => updateActivePage((page) => ({ ...page, title: event.target.value }))}
          />
          <span>{savedStatus} · Saved locally</span>
        </div>

        <div className="topbar-actions">
          <div className="history-actions">
            <button type="button" aria-label="Undo" disabled={history.past.length === 0} onClick={undo}>
              <Undo2 aria-hidden="true" size={17} />
            </button>
            <button type="button" aria-label="Redo" disabled={history.future.length === 0} onClick={redo}>
              <Redo2 aria-hidden="true" size={17} />
            </button>
            <button type="button" aria-label="Reset canvas view" onClick={() => canvasRef.current?.resetView()}>
              <RotateCcw aria-hidden="true" size={16} />
            </button>
          </div>

          <div className="mode-badge"><Cloud aria-hidden="true" size={15} /> Local mode</div>

          <details className="export-menu">
            <summary><Download aria-hidden="true" size={16} /> Export</summary>
            <div className="export-popover">
              <button type="button" onClick={() => canvasRef.current?.exportPng()}><ImageDown aria-hidden="true" size={17} /> PNG image</button>
              <button type="button" onClick={exportSvg}><FileType2 aria-hidden="true" size={17} /> SVG vector</button>
              <button type="button" onClick={exportJson}><FileJson aria-hidden="true" size={17} /> Graffiti file</button>
            </div>
          </details>

          <button className="ai-button" type="button" disabled title="AI assistance will be connected in a later integration phase">
            <Sparkles aria-hidden="true" size={16} /> Ask AI
          </button>
        </div>
      </header>

      <section className="workspace">
        <Toolbar activeTool={activeTool} onToolChange={setActiveTool} />
        <WhiteboardCanvas
          ref={canvasRef}
          pageId={activePage.id}
          pageTitle={activePage.title}
          template={activePage.template}
          elements={activePage.elements}
          activeTool={activeTool}
          selectedId={selectedId}
          elementStyle={elementStyle}
          onSelect={setSelectedId}
          onCommit={commitElement}
          onDelete={deleteElement}
          onToolChange={setActiveTool}
        />
        <Inspector
          selected={selectedElement}
          style={elementStyle}
          onStyleChange={setElementStyle}
          onSelectedChange={updateSelected}
        />
      </section>

      <PageBar
        pages={present.pages}
        activePageId={present.activePageId}
        onSelect={selectPage}
        onAdd={addPage}
        onDuplicate={duplicatePage}
        onDelete={deletePage}
        onTemplateChange={(template) => updateActivePage((page) => ({ ...page, template }))}
      />
    </main>
  );
}
