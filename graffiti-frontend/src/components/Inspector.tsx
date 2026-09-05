import { SlidersHorizontal } from "lucide-react";
import type { CSSProperties } from "react";
import type { CanvasElement, ElementStyle } from "../types";

interface InspectorProps {
  selected: CanvasElement | null;
  style: ElementStyle;
  onStyleChange: (style: ElementStyle) => void;
  onSelectedChange: (patch: Partial<CanvasElement>) => void;
}

const strokeColors = ["#111827", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a"];
const fillColors = ["transparent", "#dbeafe", "#ede9fe", "#fce7f3", "#ffedd5", "#dcfce7", "#fef3c7"];

export function Inspector({ selected, style, onStyleChange, onSelectedChange }: InspectorProps) {
  const currentStyle = selected
    ? {
        strokeColor: selected.strokeColor,
        backgroundColor: selected.backgroundColor,
        strokeWidth: selected.strokeWidth,
        roughness: selected.roughness,
      }
    : style;

  const updateStyle = (patch: Partial<ElementStyle>) => {
    const next = { ...currentStyle, ...patch };
    onStyleChange(next);
    if (selected) onSelectedChange(patch);
  };

  return (
    <aside className="inspector" aria-label="Element properties">
      <div className="inspector-heading">
        <span className="inspector-icon"><SlidersHorizontal aria-hidden="true" size={17} /></span>
        <div>
          <p className="eyebrow">Inspector</p>
          <h2>{selected ? selected.type.replace("rectangle", "shape") : "Defaults"}</h2>
        </div>
      </div>

      <section className="control-section">
        <p className="control-label">Stroke</p>
        <div className="swatch-row">
          {strokeColors.map((color) => (
            <button
              key={color}
              type="button"
              className="color-swatch"
              data-selected={currentStyle.strokeColor === color}
              style={{ "--swatch": color } as CSSProperties}
              aria-label={`Set stroke color to ${color}`}
              onClick={() => updateStyle({ strokeColor: color })}
            />
          ))}
        </div>
      </section>

      <section className="control-section">
        <p className="control-label">Fill</p>
        <div className="swatch-row">
          {fillColors.map((color) => (
            <button
              key={color}
              type="button"
              className={`color-swatch${color === "transparent" ? " transparent" : ""}`}
              data-selected={currentStyle.backgroundColor === color}
              style={{ "--swatch": color } as CSSProperties}
              aria-label={`Set fill color to ${color}`}
              onClick={() => updateStyle({ backgroundColor: color })}
            />
          ))}
        </div>
      </section>

      <section className="control-section compact-controls">
        <label>
          <span>Stroke width</span>
          <select
            value={currentStyle.strokeWidth}
            onChange={(event) => updateStyle({ strokeWidth: Number(event.target.value) })}
          >
            <option value={1}>Fine</option>
            <option value={2}>Medium</option>
            <option value={4}>Bold</option>
          </select>
        </label>
        <label>
          <span>Edge style</span>
          <select
            value={currentStyle.roughness}
            onChange={(event) => updateStyle({ roughness: Number(event.target.value) })}
          >
            <option value={0}>Precise</option>
            <option value={1}>Natural</option>
            <option value={2}>Sketchy</option>
          </select>
        </label>
      </section>

      {selected?.text !== undefined ? (
        <section className="control-section">
          <label className="text-control">
            <span className="control-label">Content</span>
            <textarea
              value={selected.text}
              rows={5}
              onChange={(event) => onSelectedChange({ text: event.target.value })}
              aria-label="Selected element text"
            />
          </label>
        </section>
      ) : null}

      <div className="inspector-hint">
        <span>Tip</span>
        Hold the middle mouse button or choose the hand tool to move around the canvas.
      </div>
    </aside>
  );
}
