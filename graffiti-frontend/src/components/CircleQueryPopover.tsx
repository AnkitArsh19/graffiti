import React, { useState } from "react";
import { Sparkles, X, MessageSquare, Palette, RefreshCw, Send } from "lucide-react";
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

  if (!isOpen || enclosedElements.length === 0) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt.trim(), "transform");
    }
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
          <Sparkles size={14} className="sparkle-icon" />
          <span>Circled {enclosedElements.length} {enclosedElements.length === 1 ? "element" : "elements"}</span>
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
          onClick={() => onSubmit("Explain this diagram and its flow", "explain")}
        >
          <MessageSquare size={12} />
          <span>Explain</span>
        </button>

        <button
          type="button"
          className="quick-action-chip"
          disabled={isLoading}
          onClick={() => onSubmit("Clean up, align, and restyle with cohesive theme", "restyle")}
        >
          <Palette size={12} />
          <span>Restyle</span>
        </button>

        <button
          type="button"
          className="quick-action-chip"
          disabled={isLoading}
          onClick={() => onSubmit("Transform into structured architecture cards", "transform")}
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

