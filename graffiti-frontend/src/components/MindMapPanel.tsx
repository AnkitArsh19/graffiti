import React, { useState } from "react";
import { GitBranch, Sparkles, X, Check, RefreshCw, Layers, ArrowRight, PlusCircle, AlignLeft } from "lucide-react";
import type { CanvasElement } from "../types";
import { apiAutoLayoutMindmap, apiGenerateMindmap } from "../lib/api";

interface MindMapPanelProps {
  isOpen: boolean;
  onClose: () => void;
  elements: CanvasElement[];
  selectedIds: string[];
  onApplyLayout: (updatedNodes: CanvasElement[], connectors: CanvasElement[]) => void;
}

const QUICK_TOPICS = [
  "React 19 Architecture",
  "Microservices System",
  "Deep Learning Foundations",
  "Product Roadmap",
];

export function MindMapPanel({
  isOpen,
  onClose,
  elements,
  selectedIds,
  onApplyLayout,
}: MindMapPanelProps) {
  const [activeTab, setActiveTab] = useState<"layout" | "generate">("layout");
  const [preferredModel, setPreferredModel] = useState<"auto" | "groq" | "gemini">("auto");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);

  // Generate Mode State
  const [topicPrompt, setTopicPrompt] = useState("");
  const [markdownInput, setMarkdownInput] = useState("");
  const [showMarkdownInput, setShowMarkdownInput] = useState(false);

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

  async function handleGenerateMindmap() {
    if (!topicPrompt.trim() && !markdownInput.trim()) {
      setErrorMsg("Please enter a topic or paste a markdown outline.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSummary(null);

    try {
      const resp = await apiGenerateMindmap({
        prompt: topicPrompt.trim() || undefined,
        markdown: markdownInput.trim() || undefined,
        preferredModel,
      });

      if (resp && resp.success) {
        setSummary(resp.summary || "Mind-map generated.");
        setAiProvider(resp.aiProvider || "groq-ai");
        onApplyLayout(resp.nodes || [], resp.connectors || []);
      } else {
        setErrorMsg(resp?.detail || "Failed to generate mind-map from topic.");
      }
    } catch (err: any) {
      console.error("Mind-map generation error:", err);
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
        width: 390,
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
              Mind-Map Engine
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted, #a1a1aa)" }}>
              Collision-Free Tree Layout & Generation
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

      {/* Mode Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.08))", background: "rgba(0, 0, 0, 0.2)" }}>
        <button
          type="button"
          onClick={() => { setActiveTab("layout"); setErrorMsg(null); setSummary(null); }}
          style={{
            flex: 1,
            padding: "10px 14px",
            border: "none",
            background: activeTab === "layout" ? "rgba(99, 102, 241, 0.15)" : "transparent",
            color: activeTab === "layout" ? "#818cf8" : "var(--text-muted, #a1a1aa)",
            fontWeight: activeTab === "layout" ? 600 : 400,
            fontSize: 12,
            cursor: "pointer",
            borderBottom: activeTab === "layout" ? "2px solid #818cf8" : "2px solid transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Layers size={14} />
          <span>Reorganize Canvas</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("generate"); setErrorMsg(null); setSummary(null); }}
          style={{
            flex: 1,
            padding: "10px 14px",
            border: "none",
            background: activeTab === "generate" ? "rgba(99, 102, 241, 0.15)" : "transparent",
            color: activeTab === "generate" ? "#818cf8" : "var(--text-muted, #a1a1aa)",
            fontWeight: activeTab === "generate" ? 600 : 400,
            fontSize: 12,
            cursor: "pointer",
            borderBottom: activeTab === "generate" ? "2px solid #818cf8" : "2px solid transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <PlusCircle size={14} />
          <span>Generate from Topic</span>
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        {activeTab === "layout" ? (
          <>
            <div style={{ fontSize: 13, color: "var(--text-secondary, #d4d4d8)", lineHeight: 1.5 }}>
              Transforms messy clusters of canvas notes into a balanced, hierarchical mind-map with dynamic collision-free spacing.
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
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "var(--text-secondary, #d4d4d8)", lineHeight: 1.5 }}>
              Generates a full hierarchical tree with nodes and curved branches from any topic prompt or markdown outline.
            </div>

            {/* Topic Input */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted, #a1a1aa)", marginBottom: 6, display: "block" }}>
                Topic / Concept:
              </label>
              <input
                type="text"
                placeholder="e.g. React 19 Architecture, System Design..."
                value={topicPrompt}
                onChange={(e) => setTopicPrompt(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(0, 0, 0, 0.25)",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.12))",
                  color: "#ffffff",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Quick Chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {QUICK_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setTopicPrompt(topic)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    fontSize: 11,
                    background: topicPrompt === topic ? "rgba(99, 102, 241, 0.25)" : "rgba(255, 255, 255, 0.05)",
                    border: topicPrompt === topic ? "1px solid #6366f1" : "1px solid rgba(255, 255, 255, 0.08)",
                    color: topicPrompt === topic ? "#c7d2fe" : "var(--text-secondary, #a1a1aa)",
                    cursor: "pointer",
                  }}
                >
                  {topic}
                </button>
              ))}
            </div>

            {/* Optional Markdown Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowMarkdownInput((v) => !v)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#818cf8",
                  fontSize: 11,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: 0,
                }}
              >
                <AlignLeft size={13} />
                <span>{showMarkdownInput ? "Hide Markdown Outline" : "Or Paste Markdown Outline (# / -)"}</span>
              </button>

              {showMarkdownInput && (
                <textarea
                  rows={4}
                  placeholder={`# Main Topic\n## Branch 1\n- Detail A\n- Detail B\n## Branch 2\n- Detail C`}
                  value={markdownInput}
                  onChange={(e) => setMarkdownInput(e.target.value)}
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(0, 0, 0, 0.25)",
                    border: "1px solid var(--border-color, rgba(255, 255, 255, 0.12))",
                    color: "#ffffff",
                    fontSize: 12,
                    fontFamily: "monospace",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              )}
            </div>
          </>
        )}

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
                {m === "auto" ? "Auto (Best)" : m === "groq" ? "Groq (70B)" : "Gemini Flash"}
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
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {activeTab === "generate" ? "Generation Complete" : "Auto-Layout Complete"}
            </div>
            <div>{summary}</div>
            {aiProvider && (
              <div style={{ fontSize: 10, marginTop: 4, opacity: 0.8 }}>
                Engine: {aiProvider}
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        {activeTab === "layout" ? (
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
        ) : (
          <button
            type="button"
            onClick={handleGenerateMindmap}
            disabled={isLoading || (!topicPrompt.trim() && !markdownInput.trim())}
            style={{
              marginTop: 4,
              padding: "12px 16px",
              borderRadius: 10,
              border: "none",
              background: (!topicPrompt.trim() && !markdownInput.trim()) ? "rgba(255, 255, 255, 0.08)" : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 13,
              cursor: (!topicPrompt.trim() && !markdownInput.trim()) || isLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: (topicPrompt.trim() || markdownInput.trim()) ? "0 4px 14px rgba(99, 102, 241, 0.4)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            {isLoading ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Synthesizing Mind-Map Tree...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>Generate & Place Mind-Map</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
