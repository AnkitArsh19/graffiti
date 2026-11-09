import React, { useState } from "react";
import { ScanEye, X, MessageSquare, Palette, RefreshCw, Send } from "lucide-react";
import type { CanvasElement } from "../types";

export interface CircleQueryPopoverProps {
  bounds: { x: number; y: number; width: number; height: number };
  enclosedElements: CanvasElement[];
  screenPos: { x: number; y: number };
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string, actionType: "explain" | "restyle" | "transform") => void;
  isLoading?: boolean;
}

export function CircleQueryPopover({
  enclosedElements,
  screenPos,
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: CircleQueryPopoverProps) {
  const [prompt, setPrompt] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = prompt.trim();
    if (!clean) return;

    // Detect action intent from prompt
    const lower = clean.toLowerCase();
    let actionType: "explain" | "restyle" | "transform" = "explain";
    if (["restyle", "color", "theme", "clean", "beautify", "align", "palette"].some((w) => lower.includes(w))) {
      actionType = "restyle";
    } else if (["transform", "card", "convert", "expand", "flowchart", "boxes"].some((w) => lower.includes(w))) {
      actionType = "transform";
    }
    onSubmit(clean, actionType);
  };

  return (
    <div
      className="circle-query-popover"
      style={{
        position: "fixed",
        left: `${Math.max(20, Math.min(window.innerWidth - 360, screenPos.x))}px`,
        top: `${Math.max(70, Math.min(window.innerHeight - 200, screenPos.y))}px`,
        zIndex: 9999,
      }}
    >
      <div className="circle-query-header">
        <div className="circle-query-title">
          <ScanEye size={14} className="sparkle-icon" />
          <span>
            {enclosedElements.length > 0
              ? `Circled ${enclosedElements.length} ${enclosedElements.length === 1 ? "element" : "elements"}`
              : "Circled canvas region"}
          </span>
        </div>
        <button type="button" className="circle-query-close" onClick={onClose} title="Dismiss">
          <X size={14} />
        </button>
      </div>

      <div className="circle-query-quick-actions">
        <button
          type="button"
          className="quick-action-chip"
          disabled={isLoading}
          onClick={() => onSubmit(prompt.trim() || "Explain the circled content and key concepts", "explain")}
        >
          <MessageSquare size={12} />
          <span>Explain</span>
        </button>

        <button
          type="button"
          className="quick-action-chip"
          disabled={isLoading}
          onClick={() => onSubmit(prompt.trim() || "Clean up, align, and restyle with cohesive theme", "restyle")}
        >
          <Palette size={12} />
          <span>Restyle</span>
        </button>

        <button
          type="button"
          className="quick-action-chip"
          disabled={isLoading}
          onClick={() => onSubmit(prompt.trim() || "Transform into structured architecture cards", "transform")}
        >
          <RefreshCw size={12} />
          <span>Transform</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="circle-query-input-row">
        <input
          type="text"
          className="circle-query-input"
          placeholder="Ask AI or describe change..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isLoading}
          autoFocus
        />
        <button
          type="submit"
          className="circle-query-submit-btn"
          disabled={isLoading || !prompt.trim()}
          title="Send"
        >
          <Send size={13} />
        </button>
      </form>
    </div>
  );
}

