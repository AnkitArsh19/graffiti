import type { CanvasElement, Point } from "../types";
import { createId, createSeed } from "./geometry";

/**
 * Calculates Euclidean distance between two points.
 */
function dist(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Perpendicular distance from a point to a line segment (a -> b).
 */
function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);

  // Area of triangle * 2 / base length
  const num = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x);
  return num / Math.sqrt(lenSq);
}

/**
 * Ramer-Douglas-Peucker (RDP) polyline simplification algorithm.
 * Reduces jitter and redundant points while preserving shape contours.
 */
export function ramerDouglasPeucker(points: Point[], epsilon = 2.5): Point[] {
  if (points.length <= 2) return points;

  let dmax = 0;
  let index = 0;
  const last = points.length - 1;

  for (let i = 1; i < last; i++) {
    const d = perpendicularDistance(points[i], points[0], points[last]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const rec1 = ramerDouglasPeucker(points.slice(0, index + 1), epsilon);
    const rec2 = ramerDouglasPeucker(points.slice(index), epsilon);
    return rec1.slice(0, rec1.length - 1).concat(rec2);
  }

  return [points[0], points[last]];
}

/**
 * Result of client-side shape detection and beautification.
 */
export interface BeautifiedShapeResult {
  shape: "circle" | "ellipse" | "rectangle" | "diamond" | "line" | "arrow" | "smoothed_stroke";
  confidence: number;
  element: CanvasElement;
}

/**
 * Deterministic client-side stroke beautifier.
 * Analyzes raw freehand pen points and sniffs out intended geometric primitives
 * (Circle, Ellipse, Rectangle, Diamond, Straight Line, Arrow) with 0ms offline latency.
 */
export function beautifyStroke(
  points: Point[],
  baseElement?: Partial<CanvasElement>,
  pageId = "page-1"
): BeautifiedShapeResult {
  if (!points || points.length < 2) {
    const fallbackId = baseElement?.id || createId("pen");
    return {
      shape: "smoothed_stroke",
      confidence: 1.0,
      element: {
        id: fallbackId,
        pageId,
        type: "pen",
        x: baseElement?.x || 0,
        y: baseElement?.y || 0,
        width: baseElement?.width || 10,
        height: baseElement?.height || 10,
        points: points || [],
        strokeColor: baseElement?.strokeColor || "#f4f4f5",
        backgroundColor: baseElement?.backgroundColor || "transparent",
        strokeWidth: baseElement?.strokeWidth || 2,
        roughness: 0,
        opacity: 100,
        seed: createSeed(),
        ...baseElement,
      },
    };
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 4);
  const height = Math.max(maxY - minY, 4);
  const startPt = points[0];
  const endPt = points[points.length - 1];

  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalLength += dist(points[i], points[i + 1]);
  }

  const endToEndDist = dist(startPt, endPt);
  const isClosed = endToEndDist < 40 || endToEndDist / Math.max(totalLength, 1) < 0.22;
  const strokeColor = baseElement?.strokeColor || "#f4f4f5";
  const strokeWidth = baseElement?.strokeWidth || 2;
  const strokeStyle = baseElement?.strokeStyle || "solid";
  const fillStyle = baseElement?.fillStyle || "transparent";
  const backgroundColor = baseElement?.backgroundColor || "transparent";

  // 1. OPEN STROKES: Test for Line or Arrow
  if (!isClosed) {
    const directDist = endToEndDist;
    const straightness = directDist / Math.max(totalLength, 1);

    if (straightness > 0.85) {
      // Check if user intended horizontal / vertical / 45-degree snap
      let dx = endPt.x - startPt.x;
      let dy = endPt.y - startPt.y;
      const angle = Math.atan2(dy, dx);
      const angleDeg = (angle * 180) / Math.PI;

      // Snap within +/- 6 degrees of 0, 90, 180, -90, -180
      let snappedPt2 = { ...endPt };
      if (Math.abs(angleDeg) < 6 || Math.abs(angleDeg) > 174) {
        snappedPt2.y = startPt.y;
      } else if (Math.abs(Math.abs(angleDeg) - 90) < 6) {
        snappedPt2.x = startPt.x;
      }

      const isArrow = Boolean(baseElement?.type === "arrow" || baseElement?.endArrowhead === "arrow");
      const elementId = baseElement?.id || createId(isArrow ? "arrow" : "line");

      const lineX = Math.min(startPt.x, snappedPt2.x);
      const lineY = Math.min(startPt.y, snappedPt2.y);
      const lineW = Math.max(Math.abs(snappedPt2.x - startPt.x), 2);
      const lineH = Math.max(Math.abs(snappedPt2.y - startPt.y), 2);

      return {
        shape: isArrow ? "arrow" : "line",
        confidence: straightness,
        element: {
          id: elementId,
          pageId,
          type: isArrow ? "arrow" : "line",
          x: lineX,
          y: lineY,
          width: lineW,
          height: lineH,
          strokeColor,
          backgroundColor,
          strokeWidth,
          strokeStyle,
          fillStyle,
          roughness: 0,
          opacity: 100,
          roundness: "sharp",
          arrowType: "straight",
          startArrowhead: "none",
          endArrowhead: isArrow ? "arrow" : "none",
          points: [
            { x: startPt.x - lineX, y: startPt.y - lineY },
            { x: snappedPt2.x - lineX, y: snappedPt2.y - lineY },
          ],
          seed: createSeed(),
        },
      };
    }
  }

  // 2. CLOSED STROKES: Test for Circle, Ellipse, Rectangle, Diamond
  if (isClosed && points.length >= 6) {
    const cx = minX + width / 2;
    const cy = minY + height / 2;
    const rx = width / 2;
    const ry = height / 2;

    // Geometric fit errors:
    // 1. Ellipse: sqrt((dx/rx)^2 + (dy/ry)^2) = 1
    const ellipseDist = points.reduce((sum, p) => {
      const nx = (p.x - cx) / rx;
      const ny = (p.y - cy) / ry;
      const r = Math.sqrt(nx * nx + ny * ny);
      return sum + Math.abs(r - 1);
    }, 0) / points.length;

    // 2. Rectangle: max(|dx/rx|, |dy/ry|) = 1
    const rectDist = points.reduce((sum, p) => {
      const nx = Math.abs(p.x - cx) / rx;
      const ny = Math.abs(p.y - cy) / ry;
      return sum + Math.abs(Math.max(nx, ny) - 1);
    }, 0) / points.length;

    // 3. Diamond: |dx/rx| + |dy/ry| = 1
    const diamondDist = points.reduce((sum, p) => {
      const nx = Math.abs(p.x - cx) / rx;
      const ny = Math.abs(p.y - cy) / ry;
      return sum + Math.abs(nx + ny - 1);
    }, 0) / points.length;

    const minErr = Math.min(ellipseDist, rectDist, diamondDist);

    if (minErr === rectDist && rectDist < 0.28) {
      const elementId = baseElement?.id || createId("rectangle");
      return {
        shape: "rectangle",
        confidence: Math.max(0.75, 1 - rectDist),
        element: {
          id: elementId,
          pageId,
          type: "rectangle",
          x: minX,
          y: minY,
          width,
          height,
          strokeColor,
          backgroundColor,
          strokeWidth,
          strokeStyle,
          fillStyle,
          roughness: 0,
          opacity: 100,
          roundness: "round",
          seed: createSeed(),
        },
      };
    }

    if (minErr === diamondDist && diamondDist < 0.28) {
      const elementId = baseElement?.id || createId("diamond");
      return {
        shape: "diamond",
        confidence: Math.max(0.75, 1 - diamondDist),
        element: {
          id: elementId,
          pageId,
          type: "diamond",
          x: minX,
          y: minY,
          width,
          height,
          strokeColor,
          backgroundColor,
          strokeWidth,
          strokeStyle,
          fillStyle,
          roughness: 0,
          opacity: 100,
          seed: createSeed(),
        },
      };
    }

    if (minErr === ellipseDist && ellipseDist < 0.28) {
      const aspectRatio = width / height;
      const isCircle = aspectRatio >= 0.82 && aspectRatio <= 1.22;
      const side = Math.max(width, height);
      const finalW = isCircle ? side : width;
      const finalH = isCircle ? side : height;
      const finalX = isCircle ? cx - side / 2 : minX;
      const finalY = isCircle ? cy - side / 2 : minY;

      const elementId = baseElement?.id || createId("ellipse");
      return {
        shape: isCircle ? "circle" : "ellipse",
        confidence: Math.max(0.75, 1 - ellipseDist),
        element: {
          id: elementId,
          pageId,
          type: "ellipse",
          x: finalX,
          y: finalY,
          width: finalW,
          height: finalH,
          strokeColor,
          backgroundColor,
          strokeWidth,
          strokeStyle,
          fillStyle,
          roughness: 0,
          opacity: 100,
          seed: createSeed(),
        },
      };
    }
  }

  // 3. FALLBACK: Apply RDP Polyline Smoothing
  const simplifiedPoints = ramerDouglasPeucker(points, 2.5);
  // Re-normalize points relative to bounding box top-left
  const relPoints = simplifiedPoints.map((p) => ({
    x: p.x - minX,
    y: p.y - minY,
    pressure: p.pressure,
  }));

  const elementId = baseElement?.id || createId("pen");
  return {
    shape: "smoothed_stroke",
    confidence: 0.9,
    element: {
      id: elementId,
      pageId,
      type: "pen",
      x: minX,
      y: minY,
      width,
      height,
      points: relPoints,
      strokeColor,
      backgroundColor,
      strokeWidth,
      strokeStyle,
      roughness: 0,
      opacity: 100,
      seed: createSeed(),
    },
  };
}
