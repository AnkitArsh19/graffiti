import React, { useState } from "react";
import { GitBranch, Sparkles, X, Check, RefreshCw, Layers, ArrowRight } from "lucide-react";
import type { CanvasElement } from "../types";
import { apiAutoLayoutMindmap } from "../lib/api";

interface MindMapPanelProps {
  isOpen: boolean;
  onClose: () => void;
  elements: CanvasElement[];
  selectedIds: string[];
  onApplyLayout: (updatedNodes: CanvasElement[], connectors: CanvasElement[]) => void;
}

export function MindMapPanel({
  isOpen,
  onClose,
  elements,
  selectedIds,
  onApplyLayout,
}: MindMapPanelProps) {
  const [preferredModel, setPreferredModel] = useState<"auto" | "groq" | "gemini">("auto");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);

  if (!isOpen) return null;

  // Selected elements or all non-arrow elements on canvas
  const candidateElements = selectedIds.length > 0
    ? elements.filter((e) => selectedIds.includes(e.id) && e.type !== "arrow" && e.type !== "line")
    : elements.filter((e) => e.type !== "arrow" && e.type !== "line");

  async function handleAutoLayout() {
    if (candidateElements.length === 0) {
      setErrorMsg("Please add or select at least 2 sticky notes, rectangles, or text nodes to auto-layout.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSummary(null);

    try {
      const resp = await apiAutoLayoutMindmap({
        elements: candidateElements,
        preferredModel,
      });

      if (resp && resp.success) {
        setSummary(resp.summary || "Mind-map layout calculated.");
        setAiProvider(resp.aiProvider || "groq-llama-3.1-70b-versatile");
        onApplyLayout(resp.nodes || [], resp.connectors || []);
      } else {
        setErrorMsg(resp?.detail || "Failed to generate mind-map layout.");
      }
    } catch (err: any) {
      console.error("Mind-map error:", err);
      setErrorMsg(err.message || "Failed to connect to AI/ML service. Is it running on port 8000?");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-labelledby="mindmap-modal-title"
      style={{
        position: "fixed",
        top: 80,
        right: 24,
        width: 380,
        zIndex: 100,
        background: "var(--bg-surface, #18181b)",
        border: "1px solid var(--border-color, rgba(255, 255, 255, 0.12))",
        borderRadius: 16,
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(16px)",
        color: "var(--text-primary, #f4f4f5)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.08))",
          background: "rgba(255, 255, 255, 0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(99, 102, 241, 0.15)",
              color: "#818cf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GitBranch size={18} />
          </div>
          <div>
            <div id="mindmap-modal-title" style={{ fontWeight: 600, fontSize: 15 }}>
              Mind-Map Auto-Layout
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted, #a1a1aa)" }}>
              Semantic Hierarchy & Tree Balancing
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted, #a1a1aa)",
            cursor: "pointer",
            padding: 4,
            borderRadius: 6,
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary, #d4d4d8)", lineHeight: 1.5 }}>
          Transforms messy clusters of canvas notes into a balanced, hierarchical mind-map with semantic curved arrows.
        </div>

        {/* Selected Count Indicator */}
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--border-color, rgba(255, 255, 255, 0.08))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
          }}
        >
          <span style={{ color: "var(--text-muted, #a1a1aa)" }}>Target Elements:</span>
          <span style={{ fontWeight: 600, color: candidateElements.length > 0 ? "#818cf8" : "#f87171" }}>
            {selectedIds.length > 0 ? `${candidateElements.length} selected node(s)` : `All ${candidateElements.length} canvas note(s)`}
          </span>
        </div>

        {/* Free Model Selector */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted, #a1a1aa)", marginBottom: 6, display: "block" }}>
            AI Engine (Free Providers Only):
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {(["auto", "groq", "gemini"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPreferredModel(m)}
                style={{
                  padding: "6px 8px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: preferredModel === m ? 600 : 400,
                  border: preferredModel === m ? "1px solid #6366f1" : "1px solid var(--border-color, rgba(255, 255, 255, 0.08))",
                  background: preferredModel === m ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.03)",
                  color: preferredModel === m ? "#c7d2fe" : "var(--text-secondary, #a1a1aa)",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {m === "auto" ? "Auto (Best)" : m === "groq" ? "Groq (70B)" : "Gemini 1.5"}
              </button>
            ))}
          </div>
        </div>

        {/* Error / Success Feedback */}
        {errorMsg && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", fontSize: 12 }}>
            {errorMsg}
          </div>
        )}

        {summary && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#6ee7b7", fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Auto-Layout Complete</div>
            <div>{summary}</div>
            {aiProvider && (
              <div style={{ fontSize: 10, marginTop: 4, opacity: 0.8 }}>
                Engine: {aiProvider}
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={handleAutoLayout}
          disabled={isLoading || candidateElements.length === 0}
          style={{
            marginTop: 4,
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            background: candidateElements.length === 0 ? "rgba(255, 255, 255, 0.08)" : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: 13,
            cursor: candidateElements.length === 0 || isLoading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: candidateElements.length > 0 ? "0 4px 14px rgba(99, 102, 241, 0.4)" : "none",
            transition: "all 0.2s ease",
          }}
        >
          {isLoading ? (
            <>
              <RefreshCw size={15} className="animate-spin" />
              <span>Analyzing Semantic Structure...</span>
            </>
          ) : (
            <>
              <Sparkles size={15} />
              <span>Balance & Auto-Layout Canvas</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
