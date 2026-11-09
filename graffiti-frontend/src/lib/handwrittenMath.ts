import type { CanvasElement, Point } from "../types";
import { evaluateMathExpression } from "./mathEvaluator";
import { createId, createSeed } from "./geometry";

/**
 * Checks if a single pen stroke looks like a clean, flat horizontal bar of an '=' sign.
 */
function isHorizontalBar(el: CanvasElement): boolean {
  if (el.type !== "pen") return false;
  const w = el.width;
  const h = el.height;
  // Must be substantially flat, wider than 14px, and not tall (prevents letter curves from matching)
  return w >= 14 && w > h * 2.5 && h <= 12;
}

/**
 * Detects if a newly finished pen stroke forms an equals sign ('='),
 * either as the second bar of a double-stroke '=', or as a single zig-zag '=' stroke.
 */
export function detectEqualsSign(
  currentStroke: CanvasElement,
  allElements: CanvasElement[]
): { isEquals: boolean; bounds: { minX: number; maxX: number; minY: number; maxY: number; right: number; centerY: number } | null } {
  if (currentStroke.type !== "pen" || !currentStroke.points || currentStroke.points.length < 2) {
    return { isEquals: false, bounds: null };
  }

  const curW = currentStroke.width;
  const curH = currentStroke.height;
  const curMinX = currentStroke.x;
  const curMaxX = currentStroke.x + curW;
  const curMinY = currentStroke.y;
  const curMaxY = currentStroke.y + curH;
  const curMidY = curMinY + curH / 2;

  // Case 1: The current stroke is one horizontal bar, and another horizontal bar was drawn right above/below it
  if (isHorizontalBar(currentStroke)) {
    // Look for a paired horizontal bar in existing elements
    const paired = allElements.find((other) => {
      if (other.id === currentStroke.id || other.type !== "pen") return false;
      if (!isHorizontalBar(other)) return false;

      // Must be horizontally overlapping significantly (> 50%)
      const overlapLeft = Math.max(curMinX, other.x);
      const overlapRight = Math.min(curMaxX, other.x + other.width);
      const overlapW = overlapRight - overlapLeft;
      const minW = Math.min(curW, other.width);
      if (overlapW < minW * 0.45) return false;

      // Must be vertically stacked within a reasonable spacing (not too far, not overlapping)
      const otherMidY = other.y + other.height / 2;
      const vertDist = Math.abs(curMidY - otherMidY);
      const maxAllowedDist = Math.max(curW, other.width) * 1.2 + 10;
      const minAllowedDist = 3;

      return vertDist >= minAllowedDist && vertDist <= maxAllowedDist;
    });

    if (paired) {
      const minX = Math.min(curMinX, paired.x);
      const maxX = Math.max(curMaxX, paired.x + paired.width);
      const minY = Math.min(curMinY, paired.y);
      const maxY = Math.max(curMaxY, paired.y + paired.height);
      return {
        isEquals: true,
        bounds: { minX, maxX, minY, maxY, right: maxX, centerY: (minY + maxY) / 2 },
      };
    }
  }

  // Case 2: A single stroke drawn as an equals sign (2 distinct horizontal passes)
  // The stroke must be clearly wider than tall (flat, like "=") with exactly 1 reversal
  // showing two horizontal sweeps connected by a quick vertical drop.
  const pts = currentStroke.points;
  if (pts.length >= 10 && curW >= 20 && curH >= 6 && curH <= curW * 0.7) {
    // Must be significantly wider than tall — a real "=" is very flat
    let reversals = 0;
    let lastDx = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      if (Math.abs(dx) > 4) {
        if (lastDx !== 0 && ((dx > 0 && lastDx < 0) || (dx < 0 && lastDx > 0))) {
          reversals++;
        }
        lastDx = dx;
      }
    }
    // Exactly 1 reversal = two horizontal sweeps (left-right then right-left or vice versa)
    // with a small vertical drop in between. More reversals = regular handwriting, not "=".
    if (reversals === 1) {
      return {
        isEquals: true,
        bounds: { minX: curMinX, maxX: curMaxX, minY: curMinY, maxY: curMaxY, right: curMaxX, centerY: curMidY },
      };
    }
  }

  return { isEquals: false, bounds: null };
}

/**
 * Extracts a mathematical expression string from nearby text or simple strokes to the left of the '=' sign.
 */
export function findExpressionToLeft(
  equalsBounds: { minX: number; maxX: number; minY: number; maxY: number; right: number; centerY: number },
  elements: CanvasElement[]
): { rawExpression: string; sourceElement?: CanvasElement; strokeColor: string; fontSize: string } | null {
  const eqX = equalsBounds.minX;
  const eqY = equalsBounds.centerY;

  // 1. Search for text elements directly to the left (within 500px horizontally, aligned within 60px vertically)
  const nearbyTexts = elements
    .filter((el) => {
      if (el.type !== "text" || !el.text || !el.text.trim()) return false;
      const elRight = el.x + el.width;
      const elCenterY = el.y + el.height / 2;
      const dx = eqX - elRight;
      const dy = Math.abs(eqY - elCenterY);
      return dx >= -20 && dx <= 450 && dy <= 70;
    })
    .sort((a, b) => (b.x + b.width) - (a.x + a.width)); // closest to '=' first

  if (nearbyTexts.length > 0) {
    const textEl = nearbyTexts[0];
    const cleanText = textEl.text!.replace(/=\s*(\?.*)?$/, "").trim();
    if (cleanText) {
      return {
        rawExpression: cleanText,
        sourceElement: textEl,
        strokeColor: textEl.strokeColor,
        fontSize: String(textEl.fontSize || "medium"),
      };
    }
  }

  // 2. Search for pen strokes to the left of the '=' sign with verified OCR math text
  const leftStrokes = elements
    .filter((el) => {
      if (el.type !== "pen" || !el.points || el.points.length === 0) return false;
      const elRight = el.x + el.width;
      const elCenterY = el.y + el.height / 2;
      const dx = eqX - elRight;
      const dy = Math.abs(eqY - elCenterY);
      return dx >= 0 && dx <= 400 && dy <= 60;
    })
    .sort((a, b) => a.x - b.x); // Left-to-right order

  if (leftStrokes.length > 0) {
    // Only infer expression if strokes carry verified OCR tokens or explicit math text
    const ocrTokens = leftStrokes
      .map((s) => s.customData?.ocrText)
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0);

    if (ocrTokens.length > 0) {
      const combined = ocrTokens.join(" ");
      if (/[0-9]/.test(combined) && /[+\-*/^=]/.test(combined)) {
        return {
          rawExpression: combined,
          strokeColor: leftStrokes[0].strokeColor,
          fontSize: "medium",
        };
      }
    }
  }

  return null;
}

/**
 * Classifies a sequence of left-to-right pen strokes into an arithmetic expression string.
 */
export function classifyStrokesToExpression(strokes: CanvasElement[]): string | null {
  const tokens: string[] = [];

  for (let i = 0; i < strokes.length; i++) {
    const s = strokes[i];
    const w = s.width;
    const h = s.height;
    const aspect = w / Math.max(h, 1);
    const pts = s.points || [];

    // Minus '-': flat horizontal stroke
    if (aspect > 2.2 && h < 16) {
      tokens.push("-");
      continue;
    }

    // Plus '+': check for two intersecting perpendicular strokes (current + next)
    if (i < strokes.length - 1) {
      const nextS = strokes[i + 1];
      const isCross =
        (aspect > 1.8 && nextS.height / Math.max(nextS.width, 1) > 1.8) ||
        (nextS.width / Math.max(nextS.height, 1) > 1.8 && h / Math.max(w, 1) > 1.8);
      const overlapX = Math.abs((s.x + w / 2) - (nextS.x + nextS.width / 2)) < Math.max(w, nextS.width);
      const overlapY = Math.abs((s.y + h / 2) - (nextS.y + nextS.height / 2)) < Math.max(h, nextS.height);

      if (isCross && overlapX && overlapY) {
        tokens.push("+");
        i++; // consumed paired stroke
        continue;
      }
    }

    // Multiply '*' / 'x': diagonal cross
    if (pts.length >= 4 && Math.abs(aspect - 1.0) < 0.4 && w < 30 && h < 30) {
      tokens.push("*");
      continue;
    }

    // Divide '/': steep forward-slanting diagonal line
    if (h > 15 && aspect < 0.8 && pts.length >= 2) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      const dx = last.x - first.x;
      const dy = last.y - first.y;
      if (dx * dy < 0 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        tokens.push("/");
        continue;
      }
    }

    // Digit '1': single vertical stroke
    if (h > 15 && aspect < 0.45) {
      tokens.push("1");
      continue;
    }

    // Digit '0': closed loop
    if (pts.length >= 8 && Math.abs(aspect - 1.0) < 0.6) {
      const d = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
      if (d < Math.max(w, h) * 0.35) {
        tokens.push("0");
        continue;
      }
    }
  }

  const expr = tokens.join(" ").trim();
  // Valid expression must have at least one operator AND at least two digit operands
  // (e.g. "1 + 0", "2 * 3") to avoid false positives from single-stroke shapes.
  const operators = (expr.match(/[+\-*/^]/g) || []).length;
  const digits = (expr.match(/[0-9]+/g) || []).length;
  if (expr && operators >= 1 && digits >= 2) {
    return expr;
  }

  return null;
}

/**
 * Extracts variable assignments from active canvas elements (e.g. "x = 10", "r = 5.5", "tax = 0.08").
 */
export function extractVariablesFromElements(elements: CanvasElement[]): Record<string, number> {
  const vars: Record<string, number> = {};

  for (const el of elements) {
    if ((el as any).isDeleted) continue;
    const text = (el.text || "").trim();
    if (!text || !text.includes("=")) continue;

    // Match patterns like "varName = 123.45"
    const match = text.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*$/);
    if (match) {
      const varName = match[1].toLowerCase();
      const numVal = parseFloat(match[2]);
      if (!Number.isNaN(numVal)) {
        vars[varName] = numVal;
      }
    }
  }

  return vars;
}

/**
 * Intelligent engine evaluating handwritten math when a stroke completes.
 * Returns the answer element to be placed on canvas, or null if no answer can be found.
 */
export function evaluateHandwrittenMathOnStroke(
  newStroke: CanvasElement,
  allElements: CanvasElement[],
  pageId: string
): CanvasElement | null {
  // 1. Detect if an '=' sign was formed
  const eq = detectEqualsSign(newStroke, allElements);
  if (!eq.isEquals || !eq.bounds) {
    return null;
  }

  // 2. Look for expression to the left of the '=' sign
  const found = findExpressionToLeft(eq.bounds, allElements);
  if (!found || !found.rawExpression) {
    return null;
  }

  // 2b. Reject trivially simple or stroke-noise expressions.
  // Stroke classification often produces bare "0", "1", "-1", "0 - 1" etc.
  // A real math problem needs at least 3 characters (e.g. "2+3", "1*5").
  const trimmedExpr = found.rawExpression.replace(/\s/g, "");
  if (trimmedExpr.length < 3) {
    return null;
  }
  // Reject expressions that are just a single number (possibly negative)
  if (/^[+-]?\d+(\.\d+)?$/.test(trimmedExpr)) {
    return null;
  }

  // 3. Extract page variables for variable memory (e.g. r = 5, area = pi * r^2 =)
  const pageVars = extractVariablesFromElements(allElements);

  // 4. Evaluate mathematical expression
  const solved = evaluateMathExpression(found.rawExpression, pageVars);
  if (!solved.success || solved.formatted === undefined) {
    return null;
  }

  // 5. Construct editable answer text element placed cleanly right after the '=' sign in handwritten font
  const ansX = eq.bounds.right + 14;
  const ansY = eq.bounds.centerY - 14;
  const ansText = solved.formatted;
  const ansWidth = Math.max(ansText.length * 13 + 16, 40);

  const answerElement: CanvasElement = {
    id: createId("math_ans"),
    pageId,
    type: "text",
    x: ansX,
    y: ansY,
    width: ansWidth,
    height: 32,
    text: ansText,
    strokeColor: "#22c55e", // Authentic Apple Math Notes green ink
    backgroundColor: "transparent",
    strokeWidth: 2,
    roughness: 0,
    opacity: 100,
    fontSize: (found.fontSize as any) || "medium",
    fontFamily: "rough", // Handwritten script typography
    textAlign: "left",
    seed: createSeed(),
    customData: {
      aiGenerated: true,
      mathSolved: true,
      originalEquation: found.rawExpression,
    },
  };

  return answerElement;
}

