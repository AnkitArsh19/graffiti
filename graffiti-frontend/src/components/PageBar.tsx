import { ChevronLeft, ChevronRight, CopyPlus, Plus, Trash2 } from "lucide-react";
import type { NotebookPage, PaperTemplate } from "../types";

interface PageBarProps {
  pages: NotebookPage[];
  activePageId: string;
  onSelect: (pageId: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTemplateChange: (template: PaperTemplate) => void;
}

const templateLabels: Record<PaperTemplate, string> = {
  blank: "Blank",
  ruled: "Ruled",
  grid: "Grid",
  dotted: "Dotted",
  cornell: "Cornell",
};

export function PageBar({
  pages,
  activePageId,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onTemplateChange,
}: PageBarProps) {
  const activeIndex = Math.max(0, pages.findIndex((page) => page.id === activePageId));
  const activePage = pages[activeIndex];

  const move = (offset: number) => {
    const nextIndex = Math.min(Math.max(activeIndex + offset, 0), pages.length - 1);
    onSelect(pages[nextIndex].id);
  };

  return (
    <div className="page-bar" aria-label="Notebook pages">
      <div className="page-nav">
        <button type="button" aria-label="Previous page" disabled={activeIndex === 0} onClick={() => move(-1)}>
          <ChevronLeft aria-hidden="true" size={17} />
        </button>
        <span><strong>{activeIndex + 1}</strong> / {pages.length}</span>
        <button
          type="button"
          aria-label="Next page"
          disabled={activeIndex === pages.length - 1}
          onClick={() => move(1)}
        >
          <ChevronRight aria-hidden="true" size={17} />
        </button>
      </div>

      <div className="page-tabs" role="tablist" aria-label="Pages">
        {pages.map((page, index) => (
          <button
            key={page.id}
            type="button"
            role="tab"
            aria-selected={page.id === activePageId}
            className="page-tab"
            data-active={page.id === activePageId}
            onClick={() => onSelect(page.id)}
          >
            <span>{index + 1}</span>{page.title}
          </button>
        ))}
      </div>

      <div className="page-actions">
        <select
          aria-label="Page background"
          value={activePage.template}
          onChange={(event) => onTemplateChange(event.target.value as PaperTemplate)}
        >
          {Object.entries(templateLabels).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
        <button type="button" aria-label="Duplicate page" onClick={onDuplicate}>
          <CopyPlus aria-hidden="true" size={16} />
        </button>
        <button type="button" aria-label="Delete page" disabled={pages.length === 1} onClick={onDelete}>
          <Trash2 aria-hidden="true" size={16} />
        </button>
        <button className="add-page" type="button" onClick={onAdd}>
          <Plus aria-hidden="true" size={16} /> Add page
        </button>
      </div>
    </div>
  );
}
