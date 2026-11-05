import React, { useState } from "react";
import { Code2, Sparkles, X, Copy, Check, FileCode, Play, Terminal, Layers, RefreshCw } from "lucide-react";
import { apiConvertFlowchartToCode } from "../lib/api";
import type { CanvasElement } from "../types";

interface FlowchartToCodePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureCanvasImage: () => Promise<string>;
  onInsertCodeSnippet?: (title: string, code: string) => void;
  elements?: CanvasElement[];
  selectedIds?: string[];
}

export function FlowchartToCodePanel({
  isOpen,
  onClose,
  onCaptureCanvasImage,
  onInsertCodeSnippet,
  elements = [],
  selectedIds = [],
}: FlowchartToCodePanelProps) {
  const [activeTab, setActiveTab] = useState<"python" | "nodejs" | "mermaid">("python");
  const [targetLanguage, setTargetLanguage] = useState<"both" | "python" | "nodejs">("both");
  const [scope, setScope] = useState<"all" | "selected">(selectedIds.length > 0 ? "selected" : "all");
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pythonCode, setPythonCode] = useState<string | null>(null);
  const [nodeJsCode, setNodeJsCode] = useState<string | null>(null);
  const [mermaidCode, setMermaidCode] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [detectedNodesCount, setDetectedNodesCount] = useState<number>(0);
  const [detectedEdgesCount, setDetectedEdgesCount] = useState<number>(0);

  if (!isOpen) return null;

  const relevantElements = scope === "selected" && selectedIds.length > 0
    ? elements.filter((el) => selectedIds.includes(el.id))
    : elements;

  const detectedShapes = relevantElements.filter((el) =>
    ["rectangle", "diamond", "ellipse", "frame"].includes(el.type)
  ).length;
  const detectedArrows = relevantElements.filter((el) =>
    ["arrow", "line"].includes(el.type)
  ).length;

  async function handleConvert() {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Capture base64 screenshot from canvas
      let base64Image = "";
      try {
        base64Image = await onCaptureCanvasImage();
      } catch {
        // Fallback if screenshot capture was blocked
      }

      // 2. Call backend Flowchart to Code endpoint (powered by Groq / Gemini)
      const resp = await apiConvertFlowchartToCode({
        image: base64Image || undefined,
        elements: relevantElements.length > 0 ? relevantElements : undefined,
        targetLanguage,
        prompt: prompt.trim() || undefined,
      });

      if (resp && resp.success) {
        setPythonCode(resp.pythonCode || "");
        setNodeJsCode(resp.nodeJsCode || "");
        setMermaidCode(resp.mermaid || "");
        setSummary(resp.summary || "Parsed flowchart successfully.");
        setAiProvider(resp.aiProvider || "groq-openai/gpt-oss-120b");
        setDetectedNodesCount(resp.detectedNodes?.length || detectedShapes);
        setDetectedEdgesCount(resp.detectedEdges?.length || detectedArrows);
      } else {
        setErrorMsg(resp?.detail || "Could not parse flowchart into code.");
      }
    } catch (err: any) {
      console.error("Flowchart conversion error:", err);
      setErrorMsg(err.message || "Failed to convert diagram to code.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleCopy(text: string, tab: string) {
    navigator.clipboard.writeText(text);
    setCopiedTab(tab);
    setTimeout(() => setCopiedTab(null), 2000);
  }

  const currentCode =
    activeTab === "python"
      ? pythonCode
      : activeTab === "nodejs"
      ? nodeJsCode
      : mermaidCode;

  return (
    <div
      role="dialog"
      aria-labelledby="flowchart-modal-title"
      style={{
        position: "fixed",
        top: 60,
        right: 30,
        bottom: 60,
        width: 560,
        maxWidth: "calc(100vw - 60px)",
        zIndex: 100,
        background: "var(--bg-surface, #18181b)",
        border: "1px solid var(--border-color, rgba(255, 255, 255, 0.12))",
        borderRadius: 16,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(20px)",
        color: "var(--text-primary, #f4f4f5)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
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
              background: "rgba(16, 185, 129, 0.15)",
              color: "#34d399",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Code2 size={18} />
          </div>
          <div>
            <div id="flowchart-modal-title" style={{ fontWeight: 600, fontSize: 15 }}>
              Diagram-to-Code Generator
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted, #a1a1aa)" }}>
              {aiProvider ? `Compiler Engine: ${aiProvider}` : "Groq AI & Whiteboard Topology Compiler"}
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

      {/* Main Content Area */}
      <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
        {/* Scope and Context Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setScope("all")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: scope === "all" ? 600 : 400,
                background: scope === "all" ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)",
                color: scope === "all" ? "#6ee7b7" : "var(--text-muted, #a1a1aa)",
                border: "none",
                cursor: "pointer",
              }}
            >
              All Canvas ({elements.length} elements)
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setScope("selected")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: scope === "selected" ? 600 : 400,
                background: scope === "selected" ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)",
                color: scope === "selected" ? "#6ee7b7" : "var(--text-muted, #a1a1aa)",
                border: "none",
                cursor: selectedIds.length === 0 ? "not-allowed" : "pointer",
                opacity: selectedIds.length === 0 ? 0.5 : 1,
              }}
            >
              Selected Only ({selectedIds.length})
            </button>
          </div>

          <span style={{ fontSize: 11, color: "var(--text-muted, #a1a1aa)" }}>
            Detected: {detectedShapes} shapes &middot; {detectedArrows} arrows
          </span>
        </div>

        {/* Optional Extra Instructions */}
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Optional instructions (e.g. Include async database queries, typing, or error handler)"
          style={{
            background: "rgba(0, 0, 0, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 8,
            padding: "8px 12px",
            color: "inherit",
            fontSize: 12,
            outline: "none",
          }}
        />

        {/* Trigger Bar */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            onClick={handleConvert}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 13,
              cursor: isLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
            }}
          >
            {isLoading ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
            <span>{isLoading ? "Synthesizing Architecture & Code..." : "Scan & Compile Flowchart to Code"}</span>
          </button>
        </div>

        {summary && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              fontSize: 12,
              color: "#6ee7b7",
              lineHeight: 1.45,
            }}
          >
            <div>
              <span style={{ fontWeight: 600 }}>Architecture Overview:</span> {summary}
            </div>
            <div style={{ marginTop: 4, opacity: 0.8, fontSize: 11, display: "flex", gap: 12 }}>
              <span>Nodes Compiled: {detectedNodesCount}</span>
              <span>Transitions Compiled: {detectedEdgesCount}</span>
              {aiProvider && <span>Provider: {aiProvider}</span>}
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              fontSize: 12,
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Code Tabs */}
        {currentCode !== null && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 280 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.08))",
                paddingBottom: 8,
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {(["python", "nodejs", "mermaid"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: activeTab === tab ? 600 : 400,
                      border: activeTab === tab ? "1px solid #10b981" : "1px solid transparent",
                      background: activeTab === tab ? "rgba(16, 185, 129, 0.15)" : "transparent",
                      color: activeTab === tab ? "#6ee7b7" : "var(--text-muted, #a1a1aa)",
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {tab === "python" ? "Python" : tab === "nodejs" ? "Node.js" : "Mermaid.js"}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => currentCode && handleCopy(currentCode, activeTab)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                    color: "var(--text-secondary, #d4d4d8)",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  {copiedTab === activeTab ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  <span>{copiedTab === activeTab ? "Copied!" : "Copy"}</span>
                </button>

                {onInsertCodeSnippet && (
                  <button
                    type="button"
                    onClick={() =>
                      currentCode &&
                      onInsertCodeSnippet(
                        `${activeTab.toUpperCase()} Flowchart Implementation`,
                        currentCode
                      )
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "rgba(16, 185, 129, 0.15)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      color: "#6ee7b7",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    <Layers size={13} />
                    <span>Insert to Canvas</span>
                  </button>
                )}
              </div>
            </div>

            {/* Code Block */}
            <pre
              style={{
                flex: 1,
                marginTop: 10,
                padding: 14,
                borderRadius: 10,
                background: "#09090b",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                fontSize: 12,
                fontFamily: "var(--font-code, 'Fira Code', monospace)",
                color: "#e4e4e7",
                overflow: "auto",
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
              }}
            >
              {currentCode || "// No code generated yet."}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
