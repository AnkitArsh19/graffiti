import { API_BASE } from "./api";
import { beautifyStroke } from "./beautifier";
import { evaluateMathExpression } from "./mathEvaluator";
import { createId, createSeed } from "./geometry";
import type { CanvasElement } from "../types";
import type { AiGhostMessage } from "../collab/StompClient";

export interface RequestAiOptions {
  pageId?: string;
  theme?: "dark" | "light";
  timeoutMs?: number;
}

/**
 * Deterministic fallback generator for text-to-diagram.
 */
export function generateLocalDiagram(text: string, pageId = "page-1"): CanvasElement[] {
  const rawSteps = text
    .split(/->|-->|=>|then|&|\n/i)
    .map((s) => s.trim().replace(/^[-*•\d.]+\s*/, ""))
    .filter((s) => s.length > 0);

  const steps = rawSteps.length > 0 ? rawSteps : ["Start", "Process", "Finish"];
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
    const isDecision =
      step.toLowerCase().includes("condition") ||
      step.toLowerCase().includes("check") ||
      step.toLowerCase().includes("?");
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
      strokeColor: isDecision ? "#d4a359" : "#f4f4f5",
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

function stripEmojis(text: string): string {
  if (!text) return "";
  return text.replace(/[\p{Extended_Pictographic}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").trim();
}

/**
 * Universal AI inference dispatcher with resilient client-side fallbacks.
 * First tries backend /ai/request; if unreachable or offline, falls back
 * to deterministic local algorithms without failing or throwing.
 */
export async function executeAiRequest(
  payload: Record<string, any>,
  options: RequestAiOptions = {}
): Promise<AiGhostMessage | null> {
  const pageId = options.pageId || "page-1";
  const feature = String(payload.feature || "beautify");
  const requestId = payload.shapeId || createId("ai");

  // Attempt backend inference with short timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 4000);

    const token = typeof window !== "undefined" ? localStorage.getItem("graffiti:auth:token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/ai/request`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const proposed = data.proposedElements || data.elements;
      if (Array.isArray(proposed) && proposed.length > 0) {
        return {
          type: "AI_GHOST_OP",
          requestId,
          payload: {
            ...data,
            proposedElements: proposed.map((el: any) => ({
              ...el,
              text: el.text ? stripEmojis(el.text) : el.text,
              pageId: el.pageId || pageId,
            })),
            ghostPreview: true,
          },
        };
      }

      // Handle explanation-only response (e.g. circle-to-search ask/explain)
      if (data.explanationText || (data.action === "explain" && data.detail)) {
        const text = data.explanationText || data.detail;
        return {
          type: "AI_GHOST_OP",
          requestId,
          payload: {
            ...data,
            explanationText: text,
            proposedElements: [],
            ghostPreview: false,
          },
        };
      }
    }
  } catch {
    // Backend offline / network failed -> proceed cleanly to offline fallback
  }

  // Resilient Client-Side Fallbacks
  if (feature === "beautify" && Array.isArray(payload.points) && payload.points.length > 0) {
    const beautified = beautifyStroke(
      payload.points,
      {
        id: payload.shapeId,
        strokeColor: payload.strokeColor,
        strokeWidth: payload.strokeWidth,
      },
      pageId
    );
    return {
      type: "AI_GHOST_OP",
      requestId,
      payload: {
        action: "beautify",
        proposedElements: [beautified.element],
        ghostPreview: true,
        confidence: beautified.confidence,
        shape: beautified.shape,
      },
    };
  }

  if (feature === "math") {
    const equation = String(payload.equation || payload.prompt || "");
    const solved = evaluateMathExpression(equation);
    if (solved.success && solved.formatted !== undefined) {
      const anchor = payload.anchor || payload.anchorPosition || { x: 300, y: 300 };
      const mathElement: CanvasElement = {
        id: createId("math_sol"),
        pageId,
        type: "text",
        x: (anchor.x || 300) + 120,
        y: anchor.y || 300,
        width: 140,
        height: 40,
        text: `= ${solved.formatted}`,
        strokeColor: "#22c55e",
        backgroundColor: "transparent",
        strokeWidth: 2,
        roughness: 0,
        opacity: 100,
        fontSize: "medium",
        fontFamily: "mono",
        textAlign: "left",
        seed: createSeed(),
      };
      return {
        type: "AI_GHOST_OP",
        requestId,
        payload: {
          action: "solve",
          proposedElements: [mathElement],
          ghostPreview: true,
          result: solved.result,
        },
      };
    }
  }

  if (feature === "diagram") {
    const prompt = String(payload.prompt || "Start -> Process -> Done");
    const elements = generateLocalDiagram(prompt, pageId);
    return {
      type: "AI_GHOST_OP",
      requestId,
      payload: {
        action: "synthesize",
        proposedElements: elements,
        ghostPreview: true,
      },
    };
  }

  return null;
}

