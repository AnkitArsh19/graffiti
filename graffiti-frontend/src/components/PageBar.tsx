import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { NotebookPage, PaperTemplate } from "../types";

interface PageBarProps {
  pages: NotebookPage[];
  activePageId: string;
  onSelect: (pageId: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: (pageId?: string) => void;
  onTemplateChange: (template: PaperTemplate) => void;
  onRenamePage?: (pageId: string, title: string) => void;
}

const templateLabels: Record<PaperTemplate, string> = {
  blank: "Blank Paper",
  ruled: "Ruled Paper",
  grid: "Grid Paper",
  dotted: "Dotted Paper",
  cornell: "Cornell Notes",
};

export function PageBar({
  pages,
  activePageId,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onTemplateChange,
  onRenamePage,
}: PageBarProps) {
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const startEditing = (page: NotebookPage) => {
    setEditingPageId(page.id);
    setEditingTitle(page.title);
  };

  const finishEditing = () => {
    if (editingPageId) {
      const trimmed = editingTitle.trim();
      if (trimmed && onRenamePage) {
        onRenamePage(editingPageId, trimmed);
      }
      setEditingPageId(null);
    }
  };

  useEffect(() => {
    if (editingPageId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingPageId]);

  const activeIndex = Math.max(
    0,
    pages.findIndex((page) => page.id === activePageId),
  );
  const activePage = pages[activeIndex] || pages[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (templateRef.current && !templateRef.current.contains(event.target as Node)) {
        setIsTemplateOpen(false);
      }
    }
    if (isTemplateOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTemplateOpen]);

  const move = (offset: number) => {
    const nextIndex = Math.min(
      Math.max(activeIndex + offset, 0),
      pages.length - 1,
    );
    onSelect(pages[nextIndex].id);
  };

  return (
    <footer className="page-bar" aria-label="Notebook Pages Management">
      <div className="page-bar-left">
        <button
          type="button"
          className="icon-action-btn"
          aria-label="Previous page"
          disabled={activeIndex === 0}
          onClick={() => move(-1)}
        >
          <ChevronLeft size={16} />
        </button>

        <div className="page-tabs-scroll" role="tablist" aria-label="Pages list">
          {pages.map((page, index) => {
            const isActive = page.id === activePageId;
            const isEditing = editingPageId === page.id;

            if (isEditing) {
              return (
                <div
                  key={page.id}
                  className="page-tab-btn page-tab-btn-editing"
                  data-active={isActive}
                >
                  <span className="page-tab-index">{index + 1}</span>
                  <input
                    ref={editInputRef}
                    className="page-tab-edit-input"
                    value={editingTitle}
                    onFocus={(e) => {
                      const el = e.currentTarget;
                      requestAnimationFrame(() => el.select());
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.currentTarget.select();
                    }}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") finishEditing();
                      if (e.key === "Escape") setEditingPageId(null);
                    }}
                    onBlur={finishEditing}
                  />
                </div>
              );
            }

            return (
              <div key={page.id} className="page-tab-wrapper">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className="page-tab-btn"
                  data-active={isActive}
                  onClick={() => onSelect(page.id)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startEditing(page);
                  }}
                  title="Click to select, double-click to rename"
                >
                  <span className="page-tab-index">{index + 1}</span>
                  <span>{page.title || `Canvas ${index + 1}`}</span>
                </button>
                {pages.length > 1 && (
                  <button
                    type="button"
                    className="page-tab-close-btn"
                    title={`Delete ${page.title || `Canvas ${index + 1}`}`}
                    aria-label={`Delete ${page.title || `Canvas ${index + 1}`}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(page.id);
                    }}
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="icon-action-btn"
          aria-label="Next page"
          disabled={activeIndex === pages.length - 1}
          onClick={() => move(1)}
        >
          <ChevronRight size={16} />
        </button>

        <button
          type="button"
          className="add-page-btn"
          aria-label="Add new page"
          onClick={onAdd}
        >
          <Plus size={15} />
          <span>Page</span>
        </button>
      </div>

      <div className="page-bar-right">
        {/* Custom Dark-Theme Paper Template Selector */}
        <div className="template-dropdown-container" ref={templateRef}>
          <button
            type="button"
            className="template-trigger-btn"
            aria-label="Select paper template"
            aria-expanded={isTemplateOpen}
            onClick={() => setIsTemplateOpen((prev) => !prev)}
          >
            <span>{templateLabels[activePage.template] || "Paper"}</span>
            <ChevronDown size={13} className={`chevron-icon ${isTemplateOpen ? "rotated" : ""}`} />
          </button>

          {isTemplateOpen ? (
            <div className="template-popover" role="menu" aria-label="Paper templates">
              <div className="template-popover-title">Paper Style</div>
              {Object.entries(templateLabels).map(([value, label]) => {
                const isSelected = activePage.template === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className="template-option-btn"
                    data-active={isSelected}
                    role="menuitem"
                    onClick={() => {
                      onTemplateChange(value as PaperTemplate);
                      setIsTemplateOpen(false);
                    }}
                  >
                    <span>{label}</span>
                    {isSelected ? <Check size={14} className="template-check" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="icon-action-btn"
          aria-label="Duplicate current page"
          title="Duplicate current page"
          onClick={onDuplicate}
        >
          <CopyPlus size={15} />
        </button>

        <button
          type="button"
          className="icon-action-btn"
          aria-label="Delete current page"
          title="Delete current page"
          disabled={pages.length === 1}
          onClick={() => onDelete()}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </footer>
  );
}

