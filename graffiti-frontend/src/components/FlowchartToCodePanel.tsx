import React, { useState } from "react";
import { Code2, Sparkles, X, Copy, Check, FileCode, Play, Terminal, Layers } from "lucide-react";
import { apiConvertFlowchartToCode } from "../lib/api";

interface FlowchartToCodePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureCanvasImage: () => Promise<string>;
  onInsertCodeSnippet?: (title: string, code: string) => void;
}

export function FlowchartToCodePanel({
  isOpen,
  onClose,
  onCaptureCanvasImage,
  onInsertCodeSnippet,
}: FlowchartToCodePanelProps) {
  const [activeTab, setActiveTab] = useState<"python" | "nodejs" | "mermaid">("python");
  const [targetLanguage, setTargetLanguage] = useState<"both" | "python" | "nodejs">("both");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pythonCode, setPythonCode] = useState<string | null>(null);
  const [nodeJsCode, setNodeJsCode] = useState<string | null>(null);
  const [mermaidCode, setMermaidCode] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleConvert() {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Capture base64 screenshot from canvas
      const base64Image = await onCaptureCanvasImage();

      // 2. Call backend Gemini 1.5 Flash Vision endpoint
      const resp = await apiConvertFlowchartToCode({
        image: base64Image,
        targetLanguage,
      });

      if (resp && resp.success) {
        setPythonCode(resp.pythonCode || "");
        setNodeJsCode(resp.nodeJsCode || "");
        setMermaidCode(resp.mermaid || "");
        setSummary(resp.summary || "Parsed flowchart successfully.");
        setAiProvider(resp.aiProvider || "gemini-1.5-flash");
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
        width: 540,
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
              Multi-Modal Gemini 1.5 Flash Vision
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
            <Sparkles size={15} />
            <span>{isLoading ? "Analyzing Canvas Vision..." : "Scan & Generate Code"}</span>
          </button>
        </div>

        {summary && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)", fontSize: 12, color: "#6ee7b7" }}>
            <span style={{ fontWeight: 600 }}>Overview:</span> {summary}
            {aiProvider && <span style={{ opacity: 0.75, marginLeft: 8 }}>({aiProvider})</span>}
          </div>
        )}

        {errorMsg && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", fontSize: 12 }}>
            {errorMsg}
          </div>
        )}

        {/* Code Tabs */}
        {currentCode !== null && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 280 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.08))", paddingBottom: 8 }}>
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
                    onClick={() => currentCode && onInsertCodeSnippet(`${activeTab.toUpperCase()} Flowchart Implementation`, currentCode)}
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
