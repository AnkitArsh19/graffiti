import React, { useState } from "react";
import { Workflow, X, ArrowDown, ArrowRight, Code, Eye, Layers, Check, RefreshCw } from "lucide-react";
import type { CanvasElement } from "../types";
import { createId, createSeed } from "../lib/geometry";
import { apiSynthesizeDiagram } from "../lib/api";

interface TextToDiagramPanelProps {
  isOpen: boolean;
  onClose: () => void;
  pageId: string;
  onInsertElements: (elements: CanvasElement[]) => void;
  onRequestAiDiagram?: (prompt: string) => void;
}

const PRESETS = [
  {
    label: "Authentication Flow",
    prompt: "User Auth: Client -> API Gateway -> Validate Token? -> User DB -> Return JWT or 401",
  },
  {
    label: "Order Pipeline",
    prompt: "Order Pipeline: Created -> Validate Payment? -> Process Order -> Warehouse Dispatch -> Complete",
  },
  {
    label: "CI/CD Deployment",
    prompt: "CI/CD: Git Push -> Run Tests -> Docker Build -> Health Check? -> Production Deploy -> Rollback on Error",
  },
  {
    label: "Decision Approval",
    prompt: "Approval Matrix: Submission -> Reviewer Check? -> Manager Approval? -> Accepted -> Rejected",
  },
];

export function TextToDiagramPanel({
  isOpen,
  onClose,
  pageId,
  onInsertElements,
  onRequestAiDiagram,
}: TextToDiagramPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [direction, setDirection] = useState<"TD" | "LR">("TD");
  const [mermaidCode, setMermaidCode] = useState<string>("");
  const [isMermaidOpen, setIsMermaidOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedElements, setGeneratedElements] = useState<CanvasElement[] | null>(null);

  if (!isOpen) return null;

  function generateLocalFlowchart(text: string, dir: "TD" | "LR"): CanvasElement[] {
    const rawSteps = text
      .split(/->|-->|=>|then|&|\n/i)
      .map((s) => s.trim().replace(/^[-*•\d.]+\s*/, ""))
      .filter((s) => s.length > 0);

    const steps = rawSteps.length > 0 ? rawSteps : ["Start", "Process Request", "Verify Condition?", "Complete"];
    const elements: CanvasElement[] = [];
    const flowGroupId = createId("grp_flowchart");

    const isHorizontal = dir === "LR";
    const startX = 220;
    const startY = 180;
    const nodeWidth = 160;
    const nodeHeight = 64;
    const gap = isHorizontal ? 100 : 70;

    let prevNodeId: string | null = null;
    let prevX = startX;
    let prevY = startY;

    steps.forEach((step, index) => {
      const isDecision =
        step.toLowerCase().includes("condition") ||
        step.toLowerCase().includes("check") ||
        step.toLowerCase().includes("?") ||
        step.toLowerCase().includes("valid");
      const isTerminal = index === 0 || index === steps.length - 1;

      const shapeType = isDecision ? "diamond" : isTerminal ? "ellipse" : "rectangle";
      const nodeId = createId(shapeType);

      const currentX = isHorizontal ? startX + index * (nodeWidth + gap) : startX;
      const currentY = isHorizontal ? startY : startY + index * (nodeHeight + gap);

      const stroke = isDecision ? "#d97706" : isTerminal ? "#059669" : "#2563eb";
      const bg = isDecision ? "#fffbeb" : isTerminal ? "#ecfdf5" : "#eff6ff";

      elements.push({
        id: nodeId,
        pageId,
        type: shapeType,
        x: currentX,
        y: currentY,
        width: nodeWidth,
        height: nodeHeight,
        strokeColor: stroke,
        backgroundColor: bg,
        strokeWidth: 2,
        strokeStyle: "solid",
        fillStyle: "semi",
        roughness: 0,
        opacity: 100,
        roundness: "round",
        text: step,
        fontSize: "medium",
        fontFamily: "clean",
        textAlign: "center",
        seed: createSeed(),
        boundElements: [],
        groupIds: [flowGroupId],
        customData: {
          aiGenerated: true,
          groupId: flowGroupId,
          label: step,
        },
      });

      if (prevNodeId) {
        const arrowId = createId("arrow");
        const startPointId = isHorizontal ? "right" : "bottom";
        const endPointId = isHorizontal ? "left" : "top";

        const arrowX = isHorizontal ? prevX + nodeWidth : prevX + nodeWidth / 2;
        const arrowY = isHorizontal ? prevY + nodeHeight / 2 : prevY + nodeHeight;
        const arrowDx = isHorizontal ? gap : 0;
        const arrowDy = isHorizontal ? 0 : gap;

        elements.push({
          id: arrowId,
          pageId,
          type: "arrow",
          x: arrowX,
          y: arrowY,
          width: Math.max(Math.abs(arrowDx), 2),
          height: Math.max(Math.abs(arrowDy), 2),
          strokeColor: "#64748b",
          backgroundColor: "transparent",
          strokeWidth: 2,
          strokeStyle: "solid",
          fillStyle: "solid",
          roughness: 0,
          opacity: 100,
          roundness: "sharp",
          arrowType: "straight",
          startArrowhead: "none",
          endArrowhead: "arrow",
          points: [
            { x: 0, y: 0 },
            { x: arrowDx, y: arrowDy },
          ],
          startBinding: { elementId: prevNodeId, pointId: startPointId },
          endBinding: { elementId: nodeId, pointId: endPointId },
          seed: createSeed(),
          groupIds: [flowGroupId],
          customData: { aiGenerated: true, groupId: flowGroupId },
        });

        // Register boundElements on both ends
        const prevEl = elements.find((e) => e.id === prevNodeId);
        if (prevEl) {
          prevEl.boundElements = [...(prevEl.boundElements || []), { id: arrowId, type: "arrow" }];
        }
        const curEl = elements.find((e) => e.id === nodeId);
        if (curEl) {
          curEl.boundElements = [...(curEl.boundElements || []), { id: arrowId, type: "arrow" }];
        }
      }

      prevNodeId = nodeId;
      prevX = currentX;
      prevY = currentY;
    });

    return elements;
  }

  async function handleSynthesize() {
    const textToUse = prompt.trim() || (PRESETS[0] ? PRESETS[0].prompt : "Start -> Process -> End");
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      // 1. Call backend diagram synthesize API (Groq Llama 3.3 70B / gpt-oss-120b)
      const res = await apiSynthesizeDiagram({
        prompt: textToUse,
        direction,
        mermaid: isMermaidOpen && mermaidCode.trim() ? mermaidCode.trim() : undefined,
      });

      if (res && res.proposedElements && res.proposedElements.length > 0) {
        const flowGroupId = createId("grp_flowchart");
        const mapped = res.proposedElements.map((el) => {
          const existingGid = el.groupIds && el.groupIds.length > 0 ? el.groupIds[0] : flowGroupId;
          return {
            ...el,
            pageId,
            groupIds: [existingGid],
            customData: {
              ...(el.customData || {}),
              groupId: (el.customData?.groupId as string) || existingGid,
              aiGenerated: true,
            },
          };
        }) as CanvasElement[];

        setGeneratedElements(mapped);
        setMermaidCode(res.mermaid || "");
      } else {
        // Resilient fallback
        const local = generateLocalFlowchart(textToUse, direction);
        setGeneratedElements(local);
      }
    } catch {
      // Resilient local fallback when backend is unreachable
      const local = generateLocalFlowchart(textToUse, direction);
      setGeneratedElements(local);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleInsertDirect() {
    if (!generatedElements || generatedElements.length === 0) return;
    onInsertElements(generatedElements);
    onClose();
  }

  function handlePreviewGhost() {
    if (onRequestAiDiagram && prompt.trim()) {
      onRequestAiDiagram(prompt.trim());
      onClose();
    } else if (generatedElements && generatedElements.length > 0) {
      onInsertElements(generatedElements);
      onClose();
    }
  }

  const shapesCount = generatedElements
    ? generatedElements.filter((e) => e.type !== "arrow" && e.type !== "text").length
    : 0;
  const arrowsCount = generatedElements
    ? generatedElements.filter((e) => e.type === "arrow").length
    : 0;

  return (
    <div
      className="text-to-diagram-panel"
      role="dialog"
      aria-label="Text to Flowchart Generator"
      style={{
        position: "fixed",
        top: 64,
        right: 20,
        width: 440,
        maxWidth: "94vw",
        zIndex: 85,
        background: "var(--bg-panel, #18181b)",
        borderRadius: 14,
        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
        color: "var(--text-primary, #f4f4f5)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        maxHeight: "calc(100vh - 84px)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
          background: "rgba(255, 255, 255, 0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "rgba(212, 163, 89, 0.15)",
              color: "var(--accent-primary, #d4a359)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Workflow size={16} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Text to Flowchart</h3>
            <span style={{ fontSize: 11, color: "var(--text-muted, #a1a1aa)" }}>
              Groq Architecture Compiler & DAG Generator
            </span>
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
      <div style={{ padding: "16px 18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.75, lineHeight: 1.45 }}>
          Generates 100% editable vector nodes (processes, decision diamonds, start/end pills) with dynamic arrow bindings.
        </p>

        {/* Direction Selector */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary, #d4d4d8)" }}>
            Flowchart Layout:
          </span>
          <div style={{ display: "flex", gap: 4, background: "rgba(0, 0, 0, 0.25)", padding: 2, borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setDirection("TD")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: direction === "TD" ? 600 : 400,
                background: direction === "TD" ? "#2563eb" : "transparent",
                color: direction === "TD" ? "#ffffff" : "var(--text-muted, #a1a1aa)",
                border: "none",
                cursor: "pointer",
              }}
            >
              <ArrowDown size={12} />
              <span>Top to Bottom (TD)</span>
            </button>
            <button
              type="button"
              onClick={() => setDirection("LR")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: direction === "LR" ? 600 : 400,
                background: direction === "LR" ? "#2563eb" : "transparent",
                color: direction === "LR" ? "#ffffff" : "var(--text-muted, #a1a1aa)",
                border: "none",
                cursor: "pointer",
              }}
            >
              <ArrowRight size={12} />
              <span>Left to Right (LR)</span>
            </button>
          </div>
        </div>

        {/* Prompt Input */}
        <div>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Order Pipeline: Cart -> Check Payment? -> Dispatch -> Deliver"
            style={{
              width: "100%",
              background: "var(--bg-input, rgba(0, 0, 0, 0.35))",
              border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))",
              borderRadius: 8,
              padding: "10px 12px",
              color: "inherit",
              fontSize: 13,
              outline: "none",
              resize: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Quick Presets */}
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Quick Flowchart Templates
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
            {PRESETS.map((preset, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPrompt(preset.prompt)}
                style={{
                  textAlign: "left",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 6,
                  padding: "6px 9px",
                  fontSize: 11,
                  color: "inherit",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={preset.prompt}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mermaid Toggle */}
        <div>
          <button
            type="button"
            onClick={() => setIsMermaidOpen(!isMermaidOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "none",
              color: "#60a5fa",
              fontSize: 11,
              cursor: "pointer",
              padding: 0,
            }}
          >
            <Code size={13} />
            <span>{isMermaidOpen ? "Hide Mermaid.js Code" : "Inspect or Edit Mermaid.js Code"}</span>
          </button>
          {isMermaidOpen && (
            <textarea
              rows={4}
              value={mermaidCode}
              onChange={(e) => setMermaidCode(e.target.value)}
              placeholder="flowchart TD&#10;Start([Start]) --> Process[Step] --> End([Done])"
              style={{
                width: "100%",
                marginTop: 6,
                background: "#09090b",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 8,
                padding: "8px 10px",
                color: "#e4e4e7",
                fontFamily: "var(--font-code, monospace)",
                fontSize: 11,
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          )}
        </div>

        {errorMsg && (
          <div style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(239, 68, 68, 0.15)", color: "#fca5a5", fontSize: 12 }}>
            {errorMsg}
          </div>
        )}

        {/* Synthesize Button */}
        <button
          type="button"
          disabled={isGenerating}
          onClick={handleSynthesize}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 8,
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            color: "#ffffff",
            border: "none",
            fontWeight: 600,
            fontSize: 13,
            cursor: isGenerating ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
          }}
        >
          {isGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Workflow size={14} />}
          <span>{isGenerating ? "Synthesizing Flowchart..." : "Synthesize Flowchart"}</span>
        </button>

        {/* Results Banner & Insert Actions */}
        {generatedElements && generatedElements.length > 0 && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "#6ee7b7" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Check size={14} />
                <span style={{ fontWeight: 600 }}>Ready to place on canvas</span>
              </div>
              <span style={{ opacity: 0.85, fontSize: 11 }}>
                {shapesCount} nodes &middot; {arrowsCount} arrows
              </span>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={handleInsertDirect}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Layers size={14} />
                <span>Insert to Canvas (Editable)</span>
              </button>

              <button
                type="button"
                onClick={handlePreviewGhost}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "var(--text-secondary, #d4d4d8)",
                  fontWeight: 500,
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Eye size={13} />
                <span>Ghost</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
