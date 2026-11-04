import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  CheckCircle2,
  Circle,
  HelpCircle,
  Lightbulb,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  PlusCircle,
  Layers,
} from "lucide-react";
import { apiSummarizeNotebook } from "../lib/api";

export interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  priority: "high" | "medium" | "low";
  completed: boolean;
}

export interface KeyDecision {
  id: string;
  decision: string;
  context: string;
}

export interface OpenQuestion {
  id: string;
  question: string;
  status: "unresolved" | "addressed";
}

interface NotebookBriefingWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  pageTitle: string;
  getTextContent: () => string;
  onAddStickyNote?: (text: string, color: string) => void;
}

export function NotebookBriefingWidget({
  isOpen,
  onClose,
  pageTitle,
  getTextContent,
  onAddStickyNote,
}: NotebookBriefingWidgetProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [executiveSummary, setExecutiveSummary] = useState<string>("");
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [keyDecisions, setKeyDecisions] = useState<KeyDecision[]>([]);
  const [openQuestions, setOpenQuestions] = useState<OpenQuestion[]>([]);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const debounceTimerRef = useRef<any>(null);
  const lastFetchedTextRef = useRef<string>("");

  // Debounced auto-summarizer trigger (2-second pause when content changes)
  const triggerSummarize = async (manual = false) => {
    const text = getTextContent().trim();
    if (!text || text.length < 15) return;
    if (!manual && text === lastFetchedTextRef.current) return;

    setIsLoading(true);
    try {
      const resp = await apiSummarizeNotebook({
        text,
        pageTitle,
      });

      if (resp && resp.success) {
        lastFetchedTextRef.current = text;
        setExecutiveSummary(resp.executiveSummary || "");
        setActionItems(resp.actionItems || []);
        setKeyDecisions(resp.keyDecisions || []);
        setOpenQuestions(resp.openQuestions || []);
        setAiProvider(resp.aiProvider || "groq-llama-3.1-8b-instant");
        setLatencyMs(resp.latencyMs || null);
      }
    } catch (err) {
      console.warn("Semantic briefing error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll / debounce check when panel is open
  useEffect(() => {
    if (!isOpen) return;

    // Run initial fetch
    triggerSummarize(true);

    const interval = setInterval(() => {
      const currentText = getTextContent().trim();
      if (currentText && currentText !== lastFetchedTextRef.current && currentText.length >= 20) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          triggerSummarize(false);
        }, 2000); // 2-second debounce pause
      }
    }, 1500);

    return () => {
      clearInterval(interval);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [isOpen, pageTitle]);

  if (!isOpen) return null;

  function toggleActionItem(id: string) {
    setActionItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  }

  return (
    <aside
      aria-label="Live Executive Briefing"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 380,
        maxHeight: isMinimized ? 52 : "calc(100vh - 120px)",
        zIndex: 95,
        background: "var(--bg-surface, #18181b)",
        border: "1px solid var(--border-color, rgba(255, 255, 255, 0.12))",
        borderRadius: 16,
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(20px)",
        color: "var(--text-primary, #f4f4f5)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "max-height 0.25s ease-in-out",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: isMinimized ? "none" : "1px solid var(--border-color, rgba(255, 255, 255, 0.08))",
          background: "rgba(255, 255, 255, 0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "rgba(245, 158, 11, 0.18)",
              color: "#fbbf24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={15} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <span>Live Executive Briefing</span>
              {isLoading && <RefreshCw size={11} className="animate-spin" color="#fbbf24" />}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted, #a1a1aa)" }}>
              {aiProvider ? `${aiProvider} • ${latencyMs ?? 5}ms` : "Groq Llama 3.1 8B Instant"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            type="button"
            onClick={() => triggerSummarize(true)}
            title="Refresh Briefing Now"
            aria-label="Refresh Briefing Now"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted, #a1a1aa)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
            }}
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized((prev) => !prev)}
            aria-label={isMinimized ? "Expand" : "Collapse"}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted, #a1a1aa)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
            }}
          >
            {isMinimized ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

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
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {!isMinimized && (
        <div style={{ padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Executive Summary */}
          {executiveSummary ? (
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)", fontSize: 12, lineHeight: 1.5, color: "#e4e4e7" }}>
              <div style={{ fontWeight: 600, color: "#fbbf24", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={13} />
                <span>Executive Summary</span>
              </div>
              <div>{executiveSummary}</div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted, #a1a1aa)", fontStyle: "italic", textAlign: "center", padding: "12px 0" }}>
              Add text, stickies, or notes to your canvas. The briefing updates automatically after a 2-second typing pause.
            </div>
          )}

          {/* Action Items */}
          {actionItems.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted, #a1a1aa)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Action Items ({actionItems.filter(i => !i.completed).length} pending)</span>
                {onAddStickyNote && (
                  <button
                    type="button"
                    onClick={() => {
                      actionItems.forEach((item, idx) => {
                        onAddStickyNote(`[${item.priority.toUpperCase()}] ${item.task} (${item.assignee})`, "#fef08a");
                      });
                    }}
                    style={{ background: "transparent", border: "none", color: "#fbbf24", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <PlusCircle size={11} />
                    <span>Post all to canvas</span>
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {actionItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleActionItem(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: item.completed ? "rgba(255, 255, 255, 0.02)" : "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      cursor: "pointer",
                    }}
                  >
                    {item.completed ? (
                      <CheckCircle2 size={15} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
                    ) : (
                      <Circle size={15} color="#a1a1aa" style={{ marginTop: 2, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, fontSize: 12, textDecoration: item.completed ? "line-through" : "none", color: item.completed ? "var(--text-muted, #71717a)" : "var(--text-primary, #f4f4f5)" }}>
                      <div>{item.task}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 4, fontSize: 10 }}>
                        <span style={{ color: "#38bdf8" }}>{item.assignee}</span>
                        <span
                          style={{
                            padding: "1px 5px",
                            borderRadius: 4,
                            background: item.priority === "high" ? "rgba(239, 68, 68, 0.2)" : "rgba(99, 102, 241, 0.2)",
                            color: item.priority === "high" ? "#fca5a5" : "#c7d2fe",
                            textTransform: "uppercase",
                            fontWeight: 600,
                          }}
                        >
                          {item.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Decisions */}
          {keyDecisions.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted, #a1a1aa)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Lightbulb size={12} color="#34d399" />
                <span>Key Decisions</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {keyDecisions.map((dec) => (
                  <div key={dec.id} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: "#a7f3d0" }}>{dec.decision}</div>
                    {dec.context && <div style={{ fontSize: 11, color: "var(--text-muted, #a1a1aa)", marginTop: 2 }}>{dec.context}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Open Questions */}
          {openQuestions.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted, #a1a1aa)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <HelpCircle size={12} color="#f472b6" />
                <span>Open Questions</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {openQuestions.map((q) => (
                  <div key={q.id} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(236, 72, 153, 0.08)", border: "1px solid rgba(236, 72, 153, 0.2)", fontSize: 12, color: "#fbcfe8" }}>
                    {q.question}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
