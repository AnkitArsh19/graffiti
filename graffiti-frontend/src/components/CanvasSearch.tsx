import React, { useEffect, useRef, useState } from "react";
import { Search, X, ChevronRight, FileText, StickyNote, Code2, Table as TableIcon } from "lucide-react";
import type { NotebookPage, CanvasElement } from "../types";

interface SearchResult {
  pageId: string;
  pageTitle: string;
  elementId: string;
  elementType: string;
  textSnippet: string;
  element: CanvasElement;
}

interface CanvasSearchProps {
  isOpen: boolean;
  onClose: () => void;
  pages: NotebookPage[];
  onSelectResult: (pageId: string, elementId: string, element: CanvasElement) => void;
}

export function CanvasSearch({
  isOpen,
  onClose,
  pages,
  onSelectResult,
}: CanvasSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Aggregate results across all pages
  const results: SearchResult[] = React.useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const matches: SearchResult[] = [];

    pages.forEach((page) => {
      (page.elements || []).forEach((el) => {
        let textFound = "";
        if (el.text && el.text.toLowerCase().includes(q)) {
          textFound = el.text;
        } else if (el.title && el.title.toLowerCase().includes(q)) {
          textFound = el.title;
        } else if (el.bodyText && el.bodyText.toLowerCase().includes(q)) {
          textFound = el.bodyText;
        } else if (el.customData && typeof el.customData.ocrText === "string" && el.customData.ocrText.toLowerCase().includes(q)) {
          textFound = el.customData.ocrText;
        }

        if (textFound) {
          matches.push({
            pageId: page.id,
            pageTitle: page.title || "Untitled Canvas",
            elementId: el.id,
            elementType: el.type,
            textSnippet: textFound.length > 60 ? textFound.slice(0, 57) + "..." : textFound,
            element: el,
          });
        }
      });
    });

    return matches;
  }, [pages, query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      const r = results[selectedIndex];
      onSelectResult(r.pageId, r.elementId, r.element);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "14vh",
        zIndex: 100,
      }}
    >
      <div
        className="canvas-search-modal"
        role="dialog"
        aria-label="Search Canvas"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: "92vw",
          background: "var(--bg-panel, #18181b)",
          borderRadius: 12,
          border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
          color: "var(--text-primary, #f4f4f5)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
          }}
        >
          <Search size={18} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search text, notes, code, OCR across notebook..."
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              fontSize: 14,
              outline: "none",
              width: "100%",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", opacity: 0.6 }}
            >
              <X size={15} />
            </button>
          )}
          <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", opacity: 0.6 }}>
            Esc
          </span>
        </div>

        <div style={{ maxHeight: 320, overflowY: "auto", padding: 6 }}>
          {query.trim() === "" ? (
            <div style={{ padding: "24px 16px", textAlign: "center", opacity: 0.5, fontSize: 13 }}>
              Type to search handwriting OCR, sticky notes, text blocks, and titles.
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", opacity: 0.5, fontSize: 13 }}>
              No matches found for "{query}"
            </div>
          ) : (
            results.map((r, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${r.pageId}-${r.elementId}-${idx}`}
                  onClick={() => {
                    onSelectResult(r.pageId, r.elementId, r.element);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: isSelected ? "var(--accent-subtle)" : "transparent",
                    border: isSelected ? "1px solid var(--accent-primary)" : "1px solid transparent",
                    cursor: "pointer",
                    transition: "all 0.1s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{ color: "var(--accent-primary)", flexShrink: 0 }}>
                      {r.elementType === "sticky" ? <StickyNote size={16} /> : r.elementType === "code" ? <Code2 size={16} /> : r.elementType === "table" ? <TableIcon size={16} /> : <FileText size={16} />}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.textSnippet}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>
                        {r.pageTitle} • {r.elementType}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ opacity: isSelected ? 1 : 0.3, flexShrink: 0 }} />
                </div>
              );
            })
          )}
        </div>

        {results.length > 0 && (
          <div
            style={{
              padding: "8px 16px",
              background: "rgba(255,255,255,0.03)",
              borderTop: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
              fontSize: 11,
              opacity: 0.6,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{results.length} match{results.length === 1 ? "" : "es"}</span>
            <span>↑↓ to navigate • ↵ to jump</span>
          </div>
        )}
      </div>
    </div>
  );
}