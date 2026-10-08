import React, { useState } from "react";
import { Sparkles, X, ArrowRight, GitBranch, Layers, Check } from "lucide-react";
import type { CanvasElement } from "../types";
import { createId, createSeed } from "../lib/geometry";

interface TextToDiagramPanelProps {
  isOpen: boolean;
  onClose: () => void;
  pageId: string;
  onInsertElements: (elements: CanvasElement[]) => void;
  onRequestAiDiagram?: (prompt: string) => void;
}

const PRESETS = [
  "User Authentication Flow: Login -> Validate JWT -> Fetch Profile",
  "Order State Machine: Created -> Paid -> Shipped -> Delivered",
  "Microservice Topology: Client -> Gateway -> Auth Service & Order Service -> DB",
  "Decision Matrix: Input -> Condition Check -> Approved or Rejected",
];

export function TextToDiagramPanel({
  isOpen,
  onClose,
  pageId,
  onInsertElements,
  onRequestAiDiagram,
}: TextToDiagramPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  function generateSimpleDiagram(text: string): CanvasElement[] {
    const rawSteps = text
      .split(/->|-->|=>|then|&|\n/i)
      .map((s) => s.trim().replace(/^[-*•\d.]+\s*/, ""))
      .filter((s) => s.length > 0);

    const steps = rawSteps.length > 0 ? rawSteps : ["Step 1", "Step 2", "Step 3"];
    const elements: CanvasElement[] = [];

    const startX = 200;
    const startY = 200;
    const nodeWidth = 160;
    const nodeHeight = 60;
    const gapX = 100;

    let prevNodeId: string | null = null;
    let prevX = startX;
    let prevY = startY;

    steps.forEach((step, index) => {
      const isDecision = step.toLowerCase().includes("condition") || step.toLowerCase().includes("check") || step.toLowerCase().includes("?");
      const nodeId = createId(isDecision ? "diamond" : "rectangle");
      const currentX = startX + index * (nodeWidth + gapX);
      const currentY = startY;

      elements.push({
        id: nodeId,
        pageId,
        type: isDecision ? "diamond" : "rectangle",
        x: currentX,
        y: currentY,
        width: nodeWidth,
        height: nodeHeight,
        strokeColor: isDecision ? "#d4a359" : "var(--text-primary)",
        backgroundColor: isDecision ? "rgba(212, 163, 89, 0.15)" : "rgba(255, 255, 255, 0.05)",
        strokeWidth: 2,
        strokeStyle: "solid",
        fillStyle: "solid",
        roughness: 0,
        opacity: 100,
        roundness: "round",
        text: step,
        fontSize: "medium",
        textAlign: "center",
        seed: createSeed(),
      });

      if (prevNodeId) {
        const arrowId = createId("arrow");
        elements.push({
          id: arrowId,
          pageId,
          type: "arrow",
          x: prevX + nodeWidth,
          y: prevY + nodeHeight / 2,
          width: gapX,
          height: 0,
          strokeColor: "#71717a",
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
            { x: gapX, y: 0 },
          ],
          startBinding: { elementId: prevNodeId, pointId: "right" },
          endBinding: { elementId: nodeId, pointId: "left" },
          seed: createSeed(),
        });
      }

      prevNodeId = nodeId;
      prevX = currentX;
      prevY = currentY;
    });

    return elements;
  }

  function handleGenerate() {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    if (onRequestAiDiagram) {
      onRequestAiDiagram(prompt);
      setIsGenerating(false);
      onClose();
      return;
    }

    const diagramElements = generateSimpleDiagram(prompt);
    onInsertElements(diagramElements);
    setIsGenerating(false);
    onClose();
  }

  return (
    <div
      className="text-to-diagram-panel"
      role="dialog"
      aria-label="Text to Diagram Generator"
      style={{
        position: "fixed",
        top: 64,
        right: 20,
        width: 380,
        maxWidth: "92vw",
        zIndex: 85,
        background: "var(--bg-panel, #18181b)",
        borderRadius: 14,
        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
        color: "var(--text-primary, #f4f4f5)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color="var(--accent-primary)" />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Text-to-Diagram</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", padding: 2 }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: "16px" }}>
        <p style={{ margin: "0 0 10px 0", fontSize: 12, opacity: 0.7 }}>
          Describe a workflow, architecture, or sequence to synthesize canvas diagrams.
        </p>

        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Client -> API Gateway -> Auth Service & Database"
          style={{
            width: "100%",
            background: "var(--bg-input, rgba(0,0,0,0.3))",
            border: "1px solid var(--border-subtle, rgba(255,255,255,0.12))",
            borderRadius: 8,
            padding: "8px 10px",
            color: "inherit",
            fontSize: 13,
            outline: "none",
            resize: "none",
            marginBottom: 12,
            boxSizing: "border-box",
          }}
        />

        <div style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Templates
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
            {PRESETS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPrompt(p)}
                style={{
                  textAlign: "left",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 6,
                  padding: "5px 8px",
                  fontSize: 11,
                  color: "inherit",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={!prompt.trim() || isGenerating}
          onClick={handleGenerate}
          style={{
            width: "100%",
            padding: "9px 14px",
            borderRadius: 8,
            background: "var(--accent-primary)",
            color: "var(--accent-text)",
            border: "none",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Sparkles size={15} />
          <span>{isGenerating ? "Synthesizing..." : "Generate Diagram"}</span>
        </button>
      </div>
    </div>
  );
}