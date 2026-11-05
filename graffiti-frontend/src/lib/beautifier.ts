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

  const num = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x);
  return num / Math.sqrt(lenSq);
}

/**
 * Distance from point p to finite line segment (a -> b).
 */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
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
 * Resample points to N evenly spaced points along the path.
 * Eliminates drawing-speed bias.
 */
function resample(pts: Point[], n = 64): Point[] {
  let totalLen = 0;
  for (let i = 1; i < pts.length; i++) {
    totalLen += dist(pts[i - 1], pts[i]);
  }
  if (totalLen === 0) return pts.slice(0, n);

  const interval = totalLen / (n - 1);
  let accumulated = 0;
  const result: Point[] = [pts[0]];
  let prev = pts[0];

  for (let i = 1; i < pts.length; i++) {
    const curr = pts[i];
    const segLen = dist(prev, curr);
    if (accumulated + segLen >= interval) {
      let remaining = interval - accumulated;
      while (remaining <= segLen + 1e-9) {
        const t = remaining / (segLen || 1);
        const newPt: Point = {
          x: prev.x + t * (curr.x - prev.x),
          y: prev.y + t * (curr.y - prev.y),
        };
        result.push(newPt);
        if (result.length === n) return result;
        prev = newPt;
        accumulated = 0;
        remaining += interval;
      }
      accumulated = segLen - (remaining - interval);
    } else {
      accumulated += segLen;
    }
    prev = curr;
  }
  while (result.length < n) result.push(pts[pts.length - 1]);
  return result;
}

/**
 * Computes windowed turn angles along a resampled stroke.
 */
function windowedTurns(pts: Point[], window = 3): number[] {
  const turns: number[] = [];
  for (let i = window; i < pts.length - window; i++) {
    const a = pts[i - window];
    const b = pts[i];
    const c = pts[i + window];
    const v1x = b.x - a.x;
    const v1y = b.y - a.y;
    const v2x = c.x - b.x;
    const v2y = c.y - b.y;
    const dot = v1x * v2x + v1y * v2y;
    const cross = v1x * v2y - v1y * v2x;
    turns.push(Math.abs(Math.atan2(cross, dot)));
  }
  return turns;
}

/**
 * Share of total turning angle concentrated in the k sharpest corner loci.
 * ~0.85-1.0 for polygons (triangles, quads, pentagons, hexagons).
 * ~0.45-0.62 for smooth circles / ellipses.
 */
function cornerTurnShare(pts: Point[], numCorners = 4, window = 3): number {
  const turns = windowedTurns(pts, window);
  const total = turns.reduce((sum, t) => sum + t, 0);
  if (total === 0) return 0;

  const taken = new Array(turns.length).fill(false);
  let topTurns = 0;
  for (let c = 0; c < numCorners; c++) {
    let peak = -1;
    let peakTurn = 0;
    for (let i = 0; i < turns.length; i++) {
      if (!taken[i] && turns[i] > peakTurn) {
        peakTurn = turns[i];
        peak = i;
      }
    }
    if (peak < 0) break;
    for (let i = peak - window; i <= peak + window; i++) {
      if (i >= 0 && i < turns.length && !taken[i]) {
        topTurns += turns[i];
        taken[i] = true;
      }
    }
  }
  return topTurns / total;
}

/**
 * Computes kurtosis of a 1D distribution (fourth standardized moment).
 * Used for rotation-invariant shape prototype distance matching.
 * ~1.83 for rectangles, ~2.25 for circles/ellipses, ~3.24 for diamonds.
 */
function kurtosis(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  let m2 = 0;
  let m4 = 0;
  for (const v of values) {
    const diff = v - mean;
    m2 += diff * diff;
    m4 += diff * diff * diff * diff;
  }
  m2 /= n;
  m4 /= n;
  if (m2 === 0) return 0;
  return m4 / (m2 * m2);
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Interior angle at vertex B given edges A-B and B-C (in radians). */
function interiorAngle(a: Point, b: Point, c: Point): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
  if (magBA === 0 || magBC === 0) return Math.PI;
  let cosAngle = dot / (magBA * magBC);
  cosAngle = Math.max(-1, Math.min(1, cosAngle));
  return Math.acos(cosAngle);
}

/** Polygon area via the shoelace formula (signed). */
function polygonArea(verts: Point[]): number {
  let area = 0;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += verts[i].x * verts[j].y;
    area -= verts[j].x * verts[i].y;
  }
  return area / 2;
}

/** Centroid of a polygon. */
function polygonCentroid(verts: Point[]): Point {
  let cx = 0,
    cy = 0;
  for (const v of verts) {
    cx += v.x;
    cy += v.y;
  }
  return { x: cx / verts.length, y: cy / verts.length };
}

/** Perimeter of a polygon. */
function polygonPerimeter(verts: Point[]): number {
  let p = 0;
  for (let i = 0; i < verts.length; i++) {
    p += dist(verts[i], verts[(i + 1) % verts.length]);
  }
  return p;
}

/** Convex hull using Graham scan. */
function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return [...points];

  let pivot = points[0];
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < pivot.y || (points[i].y === pivot.y && points[i].x < pivot.x)) {
      pivot = points[i];
    }
  }

  const sorted = points
    .filter((p) => p !== pivot)
    .sort((a, b) => {
      const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
      const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
      if (angleA !== angleB) return angleA - angleB;
      return dist(pivot, a) - dist(pivot, b);
    });

  const hull: Point[] = [pivot];
  for (const pt of sorted) {
    while (hull.length >= 2) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      const cross = (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x);
      if (cross <= 0) hull.pop();
      else break;
    }
    hull.push(pt);
  }
  return hull;
}

/**
 * Compute the Oriented Bounding Box (OBB) of a set of points using rotating calipers.
 * Returns the OBB center, half-widths, angle, and the 4 corner points.
 */
function orientedBoundingBox(points: Point[]): {
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
  angle: number;
  corners: Point[];
} {
  const hull = convexHull(points);
  if (hull.length < 2) {
    const p = hull[0] || { x: 0, y: 0 };
    return { cx: p.x, cy: p.y, halfW: 0, halfH: 0, angle: 0, corners: [p, p, p, p] };
  }

  let minArea = Infinity;
  let bestAngle = 0;
  let bestMin = { x: 0, y: 0 };
  let bestMax = { x: 0, y: 0 };

  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    const edgeAngle = Math.atan2(hull[j].y - hull[i].y, hull[j].x - hull[i].x);
    const cos = Math.cos(-edgeAngle);
    const sin = Math.sin(-edgeAngle);

    let rminX = Infinity,
      rmaxX = -Infinity;
    let rminY = Infinity,
      rmaxY = -Infinity;

    for (const p of hull) {
      const rx = p.x * cos - p.y * sin;
      const ry = p.x * sin + p.y * cos;
      rminX = Math.min(rminX, rx);
      rmaxX = Math.max(rmaxX, rx);
      rminY = Math.min(rminY, ry);
      rmaxY = Math.max(rmaxY, ry);
    }

    const area = (rmaxX - rminX) * (rmaxY - rminY);
    if (area < minArea) {
      minArea = area;
      bestAngle = edgeAngle;
      bestMin = { x: rminX, y: rminY };
      bestMax = { x: rmaxX, y: rmaxY };
    }
  }

  const halfW = (bestMax.x - bestMin.x) / 2;
  const halfH = (bestMax.y - bestMin.y) / 2;
  const rcx = bestMin.x + halfW;
  const rcy = bestMin.y + halfH;

  const cos = Math.cos(bestAngle);
  const sin = Math.sin(bestAngle);
  const cx = rcx * cos - rcy * sin;
  const cy = rcx * sin + rcy * cos;

  const localCorners = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ];
  const corners = localCorners.map((lc) => ({
    x: cx + lc.x * cos - lc.y * sin,
    y: cy + lc.x * sin + lc.y * cos,
  }));

  return { cx, cy, halfW, halfH, angle: bestAngle, corners };
}

/**
 * Robust detection of closed strokes.
 * Handles overshoots, hooks, small gaps, and area loops.
 */
function isStrokeClosed(
  points: Point[],
  width: number,
  height: number,
  totalLength: number
): boolean {
  if (points.length < 5) return false;
  const startPt = points[0];
  const endPt = points[points.length - 1];
  const endDist = dist(startPt, endPt);
  const diagonal = Math.hypot(width, height);

  // 1. Direct end-to-end proximity (scales with shape size)
  if (endDist < Math.max(50, diagonal * 0.25)) return true;
  if (endDist / Math.max(totalLength, 1) < 0.25) return true;

  // 2. Check if start point is near ANY point in the last 25% of stroke (overshoot / hook)
  const lastQuarter = Math.floor(points.length * 0.75);
  for (let i = lastQuarter; i < points.length; i++) {
    if (dist(startPt, points[i]) < Math.max(45, diagonal * 0.20)) return true;
  }

  // 3. Check if end point is near ANY point in the first 25% of stroke
  const firstQuarter = Math.floor(points.length * 0.25);
  for (let i = 0; i <= firstQuarter; i++) {
    if (dist(endPt, points[i]) < Math.max(45, diagonal * 0.20)) return true;
  }

  // 4. Enclosed area check: if stroke wraps around and encloses significant 2D area
  const area = Math.abs(polygonArea(points));
  const bboxArea = width * height;
  if (bboxArea > 400 && totalLength > 1.8 * Math.max(width, height)) {
    if (area / bboxArea > 0.25 && endDist < Math.max(80, diagonal * 0.35)) {
      return true;
    }
  }

  return false;
}

/**
 * Fit an ellipse to the points using least-squares algebraic distance.
 * Uses exact Math.SQRT2 scaling for perimeter points.
 * Returns the center, semi-axes, rotation angle, and fitting error.
 */
function fitEllipse(points: Point[]): {
  cx: number;
  cy: number;
  a: number;
  b: number;
  angle: number;
  error: number;
} {
  let mx = 0,
    my = 0;
  for (const p of points) {
    mx += p.x;
    my += p.y;
  }
  mx /= points.length;
  my /= points.length;

  const centered = points.map((p) => ({ x: p.x - mx, y: p.y - my }));

  let sxx = 0,
    syy = 0,
    sxy = 0;
  for (const p of centered) {
    sxx += p.x * p.x;
    syy += p.y * p.y;
    sxy += p.x * p.y;
  }
  sxx /= points.length;
  syy /= points.length;
  sxy /= points.length;

  const trace = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
  const lambda1 = trace / 2 + disc;
  const lambda2 = Math.max(0, trace / 2 - disc);

  const angle = sxy === 0 && sxx >= syy ? 0 : Math.atan2(lambda1 - sxx, sxy);

  // Exact sqrt(2) factor for points along the perimeter of an ellipse
  const a = Math.sqrt(Math.max(lambda1, 0.01)) * Math.SQRT2;
  const b = Math.sqrt(Math.max(lambda2, 0.01)) * Math.SQRT2;

  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);
  let totalError = 0;
  for (const p of centered) {
    const rx = p.x * cosA - p.y * sinA;
    const ry = p.x * sinA + p.y * cosA;
    const r = Math.sqrt((rx / Math.max(a, 1)) ** 2 + (ry / Math.max(b, 1)) ** 2);
    totalError += Math.abs(r - 1);
  }
  const error = totalError / points.length;

  return { cx: mx, cy: my, a, b, angle, error };
}

/**
 * Calculates how well points fit the segments of a candidate polygon.
 */
function computePolyFitError(points: Point[], vertices: Point[]): number {
  const n = vertices.length;
  if (n < 3) return Infinity;
  let totalDist = 0;
  for (const p of points) {
    let minDist = Infinity;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const d = distanceToSegment(p, vertices[i], vertices[j]);
      if (d < minDist) minDist = d;
    }
    totalDist += minDist;
  }
  return totalDist / points.length;
}

/**
 * Detect polygons with 3 to 6 sides at any orientation.
 * Sweeps RDP epsilons and evaluates vertex geometry + segment fitting.
 */
function detectPolygon(
  points: Point[],
  width: number,
  height: number,
  totalLength: number
): {
  vertexCount: number;
  vertices: Point[];
  confidence: number;
  fitError: number;
} {
  const closed = [...points];
  if (dist(closed[0], closed[closed.length - 1]) > 5) {
    closed.push({ ...closed[0] });
  }

  // Standard computer vision epsilon sweep for polygon vertex detection
  // Sweeping from coarse to fine [0.045 -> 0.022] matches OpenCV approxPolyDP
  const epsilons = [
    Math.max(totalLength * 0.045, 8),
    Math.max(totalLength * 0.038, 6.5),
    Math.max(totalLength * 0.030, 5),
    Math.max(totalLength * 0.024, 4),
  ];

  let bestResult = {
    vertexCount: 0,
    vertices: [] as Point[],
    confidence: 0,
    fitError: Infinity,
  };

  const shapeSize = Math.max(width, height);

  for (const eps of epsilons) {
    let simplified = ramerDouglasPeucker(closed, eps);

    if (
      simplified.length > 2 &&
      dist(simplified[0], simplified[simplified.length - 1]) < eps * 2.5
    ) {
      simplified = simplified.slice(0, -1);
    }

    const perim = polygonPerimeter(simplified);
    const minEdgeLen = (perim / Math.max(simplified.length, 1)) * 0.10;
    const merged: Point[] = [];
    for (let i = 0; i < simplified.length; i++) {
      const prev = merged[merged.length - 1];
      if (prev && dist(prev, simplified[i]) < minEdgeLen) {
        merged[merged.length - 1] = {
          x: (prev.x + simplified[i].x) / 2,
          y: (prev.y + simplified[i].y) / 2,
        };
      } else {
        merged.push(simplified[i]);
      }
    }

    const n = merged.length;
    if (n < 3 || n > 8) continue;

    // Filter out nearly collinear vertices (interior angle > 158° or < 20°)
    const filtered: Point[] = [];
    for (let i = 0; i < n; i++) {
      const a = merged[(i - 1 + n) % n];
      const b = merged[i];
      const c = merged[(i + 1) % n];
      const ang = interiorAngle(a, b, c);
      if (ang < (158 * Math.PI) / 180 && ang > (20 * Math.PI) / 180) {
        filtered.push(merged[i]);
      }
    }

    const fn = filtered.length;
    if (fn < 3 || fn > 6) continue;

    // Strict regularity check for N=5 or N=6 to avoid closure hooks / jitters becoming pentagons:
    if (fn === 5 || fn === 6) {
      const edgeLens: number[] = [];
      for (let i = 0; i < fn; i++) {
        edgeLens.push(dist(filtered[i], filtered[(i + 1) % fn]));
      }
      const minEdge = Math.min(...edgeLens);
      const maxEdge = Math.max(...edgeLens);
      // If one edge is tiny (<40% of max edge), it's a hook/closure artifact, not a true regular polygon!
      if (minEdge / Math.max(maxEdge, 1) < 0.40) continue;
    }

    const fitDist = computePolyFitError(points, filtered);
    const normFitError = fitDist / Math.max(shapeSize, 1);

    const angles: number[] = [];
    for (let i = 0; i < fn; i++) {
      const a = filtered[(i - 1 + fn) % fn];
      const b = filtered[i];
      const c = filtered[(i + 1) % fn];
      angles.push(interiorAngle(a, b, c));
    }
    const expectedAngle = ((fn - 2) * Math.PI) / fn;
    const avgAngleDev =
      angles.reduce((sum, a) => sum + Math.abs(a - expectedAngle), 0) / fn;

    if ((fn === 5 || fn === 6) && avgAngleDev > (25 * Math.PI) / 180) {
      continue; // Pentagon/hexagon must have uniform interior angles
    }

    const fitConfidence = Math.max(0, 1 - normFitError * 14);
    const angleConfidence = Math.max(0, 1 - avgAngleDev / (Math.PI / 2.5));
    // Complexity penalty: prefer simpler polygons unless extra vertices significantly improve fit
    const complexityPenalty = (fn - 3) * 0.035;
    const confidence = fitConfidence * 0.70 + angleConfidence * 0.30 - complexityPenalty;

    // Prefer simpler polygon when lower-N already fits excellently (normFitError < 0.02)
    const isSignificantlyBetter =
      confidence > bestResult.confidence &&
      (bestResult.fitError > 0.02 || normFitError < bestResult.fitError * 0.75);

    if ((bestResult.vertexCount === 0 || isSignificantlyBetter) && normFitError < 0.08) {
      bestResult = {
        vertexCount: fn,
        vertices: filtered,
        confidence: Math.max(0.75, fitConfidence),
        fitError: normFitError,
      };
    }
  }

  return bestResult;
}

/**
 * Classify a 4-vertex polygon as rectangle vs diamond/rhombus.
 */
function classifyQuad(verts: Point[]): {
  type: "rectangle" | "diamond";
  angle?: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
} {
  const c = polygonCentroid(verts);

  const e0 = dist(verts[0], verts[1]);
  const e1 = dist(verts[1], verts[2]);
  const e2 = dist(verts[2], verts[3]);
  const e3 = dist(verts[3], verts[0]);

  const d1 = dist(verts[0], verts[2]);
  const d2 = dist(verts[1], verts[3]);

  const avgEdge = (e0 + e1 + e2 + e3) / 4;
  const edgeVariance =
    [e0, e1, e2, e3].reduce((s, e) => s + ((e - avgEdge) / avgEdge) ** 2, 0) / 4;
  const isRhombus = edgeVariance < 0.08;

  const edgeRatio = Math.max(e0, e1) / Math.max(Math.min(e0, e1), 0.1);
  const diagRatio = Math.max(d1, d2) / Math.max(Math.min(d1, d2), 0.1);

  const d1Angle = Math.atan2(verts[2].y - verts[0].y, verts[2].x - verts[0].x);
  const d2Angle = Math.atan2(verts[3].y - verts[1].y, verts[3].x - verts[1].x);

  let axisAlignedScore = 0;
  for (let i = 0; i < 4; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % 4];
    const ang = Math.abs(Math.atan2(b.y - a.y, b.x - a.x)) % (Math.PI / 2);
    const distToAxis = Math.min(ang, Math.PI / 2 - ang);
    if (distToAxis < (22.5 * Math.PI) / 180) axisAlignedScore++;
  }

  // 1. If adjacent edges differ significantly (> 20%) -> Rectangle
  if (edgeRatio > 1.20) {
    const obb = orientedBoundingBox(verts);
    let rectAngle = obb.angle;
    while (rectAngle > Math.PI / 2) rectAngle -= Math.PI;
    while (rectAngle < -Math.PI / 2) rectAngle += Math.PI;
    if (Math.abs(rectAngle) < 0.08) rectAngle = 0;
    return {
      type: "rectangle",
      angle: rectAngle !== 0 ? rectAngle : undefined,
      width: obb.halfW * 2,
      height: obb.halfH * 2,
      cx: obb.cx,
      cy: obb.cy,
    };
  }

  // 2. If diagonals differ significantly (> 18%) -> Diamond
  if (diagRatio > 1.18 || (isRhombus && axisAlignedScore < 2)) {
    const normD1 = ((d1Angle % Math.PI) + Math.PI) % Math.PI;
    const isD1Horizontal =
      normD1 < Math.PI / 4 || normD1 > (3 * Math.PI) / 4;

    const horizDiag = isD1Horizontal ? d1 : d2;
    const vertDiag = isD1Horizontal ? d2 : d1;
    let diaAngle = isD1Horizontal ? d1Angle : d2Angle;

    while (diaAngle > Math.PI / 2) diaAngle -= Math.PI;
    while (diaAngle < -Math.PI / 2) diaAngle += Math.PI;
    if (Math.abs(diaAngle) < 0.08) diaAngle = 0;

    return {
      type: "diamond",
      angle: diaAngle !== 0 ? diaAngle : undefined,
      width: horizDiag,
      height: vertDiag,
      cx: c.x,
      cy: c.y,
    };
  }

  // 3. Square
  if (axisAlignedScore >= 3) {
    const obb = orientedBoundingBox(verts);
    let rectAngle = obb.angle;
    while (rectAngle > Math.PI / 2) rectAngle -= Math.PI;
    while (rectAngle < -Math.PI / 2) rectAngle += Math.PI;
    if (Math.abs(rectAngle) < 0.08) rectAngle = 0;
    return {
      type: "rectangle",
      angle: rectAngle !== 0 ? rectAngle : undefined,
      width: obb.halfW * 2,
      height: obb.halfH * 2,
      cx: obb.cx,
      cy: obb.cy,
    };
  } else {
    const horizDiag = d1;
    const vertDiag = d2;
    let diaAngle = d1Angle;
    while (diaAngle > Math.PI / 4) diaAngle -= Math.PI / 2;
    while (diaAngle < -Math.PI / 4) diaAngle += Math.PI / 2;
    if (Math.abs(diaAngle) < 0.08) diaAngle = 0;
    return {
      type: "diamond",
      angle: diaAngle !== 0 ? diaAngle : undefined,
      width: horizDiag,
      height: vertDiag,
      cx: c.x,
      cy: c.y,
    };
  }
}

/**
 * Result of client-side shape detection and beautification.
 */
export interface BeautifiedShapeResult {
  shape:
    | "circle"
    | "ellipse"
    | "rectangle"
    | "diamond"
    | "triangle"
    | "pentagon"
    | "hexagon"
    | "polygon"
    | "line"
    | "arrow"
    | "smoothed_stroke";
  confidence: number;
  element: CanvasElement;
}

/**
 * Deterministic client-side stroke beautifier.
 * Analyzes raw freehand pen points and sniffs out intended geometric primitives:
 * - Circle & Ellipse (any orientation and aspect ratio, with optimized tolerance)
 * - Rectangle (any rotation, right-angle snap)
 * - Diamond / Rhombus (any rotation, equal-edge snap)
 * - Triangle (3 sides, any orientation)
 * - Pentagon (5 sides, any orientation)
 * - Hexagon (6 sides, any orientation)
 * - Straight Line & Arrow (with snap)
 * - Fallback: RDP-smoothed stroke
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
  const isClosed = isStrokeClosed(points, width, height, totalLength);
  const strokeColor = baseElement?.strokeColor || "#f4f4f5";
  const strokeWidth = baseElement?.strokeWidth || 2;
  const strokeStyle = baseElement?.strokeStyle || "solid";
  const fillStyle = baseElement?.fillStyle || "transparent";
  const backgroundColor = baseElement?.backgroundColor || "transparent";

  // 1. OPEN STROKES: Test for Line or Arrow
  if (!isClosed) {
    const directDist = endToEndDist;
    const straightness = directDist / Math.max(totalLength, 1);

    if (straightness > 0.82) {
      const dx = endPt.x - startPt.x;
      const dy = endPt.y - startPt.y;
      const angle = Math.atan2(dy, dx);
      const angleDeg = (angle * 180) / Math.PI;

      const snappedPt2 = { ...endPt };
      if (Math.abs(angleDeg) < 6 || Math.abs(angleDeg) > 174) {
        snappedPt2.y = startPt.y;
      } else if (Math.abs(Math.abs(angleDeg) - 90) < 6) {
        snappedPt2.x = startPt.x;
      }

      const isArrow = Boolean(
        baseElement?.type === "arrow" || baseElement?.endArrowhead === "arrow"
      );
      const elementId = baseElement?.id || createId(isArrow ? "arrow" : "line");

      const lineX = Math.min(startPt.x, snappedPt2.x);
      const lineY = Math.min(startPt.y, snappedPt2.y);
      const lineW = Math.max(Math.abs(snappedPt2.x - startPt.x), 2);
      const lineH = Math.max(Math.abs(snappedPt2.y - startPt.y), 2);

      return {
        shape: isArrow ? "arrow" : "line",
        confidence: Math.max(0.80, straightness),
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

  // 2. CLOSED STROKES: Geometric shape recognition
  if (isClosed && points.length >= 6) {
    const cx = minX + width / 2;
    const cy = minY + height / 2;
    const rx = width / 2;
    const ry = height / 2;

    // Resample stroke for robust, speed-invariant moment analysis
    const resampledPts = resample(points, 64);

    // A. Fitted ellipse & simple axis-aligned ellipse distance
    const ellipseResult = fitEllipse(points);
    const simpleEllipseDist =
      points.reduce((sum, p) => {
        const nx = (p.x - cx) / rx;
        const ny = (p.y - cy) / ry;
        const r = Math.sqrt(nx * nx + ny * ny);
        return sum + Math.abs(r - 1);
      }, 0) / points.length;

    const bestEllipseError = Math.min(ellipseResult.error, simpleEllipseDist);

    // Convex hull and compactness
    const hullPts = convexHull(points);
    const hullArea = Math.abs(polygonArea(hullPts));
    const hullPerim = polygonPerimeter(hullPts);
    const compactness = hullArea / Math.max(hullPerim * hullPerim, 1);

    // B. Oriented bounding box
    const obb = orientedBoundingBox(points);
    const obbArea = obb.halfW * 2 * obb.halfH * 2;
    const obbFillRatio = obbArea > 0 ? hullArea / obbArea : 0;
    const shapeSize = Math.max(width, height);
    const obbFitDist = computePolyFitError(points, obb.corners);
    const normObbFitError = obbFitDist / Math.max(shapeSize, 1);

    // Turn share metrics (Excalidraw feature extraction)
    const turnShare4 = cornerTurnShare(resampledPts, 4);
    const turnShare3 = cornerTurnShare(resampledPts, 3);

    // C. Polygon detection (3-6 vertices)
    const polyResult = detectPolygon(points, width, height, totalLength);
    const n = polyResult.vertexCount;
    const polyVerts = polyResult.vertices;
    const polyConf = polyResult.confidence;

    // Measure corner turn concentration (distinguishes sharp corners from smooth ellipse)
    const turnShare = n >= 3 && n <= 6 ? cornerTurnShare(resampledPts, n) : turnShare4;

    // D. Axis-aligned shape errors as baselines
    const rectDist =
      points.reduce((sum, p) => {
        const nx = Math.abs(p.x - cx) / rx;
        const ny = Math.abs(p.y - cy) / ry;
        return sum + Math.abs(Math.max(nx, ny) - 1);
      }, 0) / points.length;

    const diamondDist =
      points.reduce((sum, p) => {
        const nx = Math.abs(p.x - cx) / rx;
        const ny = Math.abs(p.y - cy) / ry;
        return sum + Math.abs(nx + ny - 1);
      }, 0) / points.length;

    // ===================================================================
    // DECISION LOGIC: Rotation-Invariant Invariants in OBB Frame
    // ===================================================================

    // Project resampled points into OBB local coordinate frame (-obb.angle)
    const cosOBB = Math.cos(-obb.angle);
    const sinOBB = Math.sin(-obb.angle);
    const obbLocalPts = resampledPts.map((p) => ({
      x: (p.x - obb.cx) * cosOBB - (p.y - obb.cy) * sinOBB,
      y: (p.x - obb.cx) * sinOBB + (p.y - obb.cy) * cosOBB,
    }));
    const kx = kurtosis(obbLocalPts.map((p) => p.x));
    const ky = kurtosis(obbLocalPts.map((p) => p.y));
    const kurtosisProd = kx * ky;

    // Rotation-invariant Excalidraw prototype distances:
    // Rectangle: fill=1.0,  turnShare=0.95, kurtosis=1.83
    // Diamond:   fill=0.5,  turnShare=0.95, kurtosis=3.24
    // Ellipse:   fill=0.785, turnShare=0.55, kurtosis=2.25
    const rectProtoDist = Math.hypot(
      (obbFillRatio - 1.0) / 0.24,
      (turnShare4 - 0.95) / 0.22,
      (kurtosisProd - 1.83) / 0.90
    );
    const diamondProtoDist = Math.hypot(
      (obbFillRatio - 0.50) / 0.24,
      (turnShare4 - 0.95) / 0.22,
      (kurtosisProd - 3.24) / 0.90
    );
    const ellipseProtoDist = Math.hypot(
      (obbFillRatio - Math.PI / 4) / 0.24,
      (turnShare4 - 0.55) / 0.22,
      (kurtosisProd - 2.25) / 0.90
    );

    // -------------------------------------------------------------------
    // Priority 1: Smooth Circle or Ellipse (Strict Excalidraw Barrier)
    // -------------------------------------------------------------------
    // A shape with smooth turning (turnShare4 < 0.68) and low ellipse error
    // is GUARANTEED to be a circle or ellipse. Polygons are strictly barred.
    const isCornerSpikeDominant = turnShare4 >= 0.70 || turnShare3 >= 0.72;
    const isEllipseMatch =
      (!isCornerSpikeDominant && bestEllipseError < 0.22) ||
      (ellipseProtoDist < 1.35 && turnShare4 < 0.68);

    if (isEllipseMatch) {
      const a = ellipseResult.a;
      const b = ellipseResult.b;
      const axisRatio = Math.max(a, b) / Math.max(Math.min(a, b), 0.1);
      const isCircle = axisRatio <= 1.25 && compactness > 0.060;

      let elAngle = ellipseResult.angle;
      while (elAngle > Math.PI / 2) elAngle -= Math.PI;
      while (elAngle < -Math.PI / 2) elAngle += Math.PI;
      if (Math.abs(elAngle) < 0.08) elAngle = 0;

      const elementId = baseElement?.id || createId("ellipse");

      if (isCircle) {
        const radius = Math.max(a, b);
        const diameter = radius * 2;
        return {
          shape: "circle",
          confidence: Math.max(0.78, 1 - bestEllipseError),
          element: {
            id: elementId,
            pageId,
            type: "ellipse",
            x: ellipseResult.cx - radius,
            y: ellipseResult.cy - radius,
            width: diameter,
            height: diameter,
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
      } else {
        return {
          shape: "ellipse",
          confidence: Math.max(0.78, 1 - bestEllipseError),
          element: {
            id: elementId,
            pageId,
            type: "ellipse",
            x: ellipseResult.cx - a,
            y: ellipseResult.cy - b,
            width: a * 2,
            height: b * 2,
            angle: elAngle !== 0 ? elAngle : undefined,
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

    // -------------------------------------------------------------------
    // Priority 2: Triangle (3 sides, any orientation)
    // -------------------------------------------------------------------
    if (n === 3 && polyConf >= 0.45) {
      const triVerts =
        polyVerts && polyVerts.length === 3
          ? polyVerts
          : ramerDouglasPeucker(points, shapeSize * 0.06).slice(0, 3);
      if (triVerts.length === 3) {
        // Check if roughly equilateral / regular (edges within 25% of each other)
        const e0 = dist(triVerts[0], triVerts[1]);
        const e1 = dist(triVerts[1], triVerts[2]);
        const e2 = dist(triVerts[2], triVerts[0]);
        const avgEdge = (e0 + e1 + e2) / 3;
        const maxEdgeDev =
          Math.max(Math.abs(e0 - avgEdge), Math.abs(e1 - avgEdge), Math.abs(e2 - avgEdge)) /
          Math.max(avgEdge, 1);

        let finalVerts: Point[] = triVerts;
        if (maxEdgeDev < 0.25) {
          const centroid = polygonCentroid(triVerts);
          const distances = triVerts.map((v) => dist(v, centroid));
          const avgRadius = distances.reduce((s, d) => s + d, 0) / 3;
          const startAngle = Math.atan2(triVerts[0].y - centroid.y, triVerts[0].x - centroid.x);
          const perfectVerts: Point[] = [];
          for (let i = 0; i < 3; i++) {
            const a = startAngle + (2 * Math.PI * i) / 3;
            perfectVerts.push({
              x: centroid.x + avgRadius * Math.cos(a),
              y: centroid.y + avgRadius * Math.sin(a),
            });
          }
          finalVerts = perfectVerts;
        }

        const elementId = baseElement?.id || createId("pen");
        const closedVerts = [...finalVerts, { ...finalVerts[0] }];
        const tMinX = Math.min(...closedVerts.map((p) => p.x));
        const tMinY = Math.min(...closedVerts.map((p) => p.y));
        const tW = Math.max(...closedVerts.map((p) => p.x)) - tMinX;
        const tH = Math.max(...closedVerts.map((p) => p.y)) - tMinY;

        return {
          shape: "triangle",
          confidence: Math.max(0.80, polyConf),
          element: {
            id: elementId,
            pageId,
            type: "pen",
            x: tMinX,
            y: tMinY,
            width: Math.max(tW, 4),
            height: Math.max(tH, 4),
            points: closedVerts.map((p) => ({ x: p.x - tMinX, y: p.y - tMinY })),
            strokeColor,
            backgroundColor,
            strokeWidth,
            strokeStyle,
            fillStyle,
            roughness: 0,
            opacity: 100,
            seed: createSeed(),
            customData: {
              isPolygon: true,
              polygonType: "triangle",
            },
          },
        };
      }
    }

    // -------------------------------------------------------------------
    // Priority 3: Deliberate Regular Pentagon (5 sides) or Hexagon (6 sides)
    // -------------------------------------------------------------------
    if ((n === 5 || n === 6) && polyConf >= 0.65) {
      const shapeName = n === 5 ? "pentagon" : "hexagon";
      const elementId = baseElement?.id || createId("pen");
      const centroid = polygonCentroid(polyVerts);

      const distances = polyVerts.map((v) => dist(v, centroid));
      const avgRadius = distances.reduce((s, d) => s + d, 0) / n;
      const startAngle = Math.atan2(
        polyVerts[0].y - centroid.y,
        polyVerts[0].x - centroid.x
      );

      const perfectVerts: Point[] = [];
      for (let i = 0; i < n; i++) {
        const a = startAngle + (2 * Math.PI * i) / n;
        perfectVerts.push({
          x: centroid.x + avgRadius * Math.cos(a),
          y: centroid.y + avgRadius * Math.sin(a),
        });
      }
      perfectVerts.push({ ...perfectVerts[0] });

      const pMinX = Math.min(...perfectVerts.map((p) => p.x));
      const pMinY = Math.min(...perfectVerts.map((p) => p.y));
      const pW = Math.max(...perfectVerts.map((p) => p.x)) - pMinX;
      const pH = Math.max(...perfectVerts.map((p) => p.y)) - pMinY;

      return {
        shape: shapeName as "pentagon" | "hexagon",
        confidence: Math.max(0.80, polyConf),
        element: {
          id: elementId,
          pageId,
          type: "pen",
          x: pMinX,
          y: pMinY,
          width: Math.max(pW, 4),
          height: Math.max(pH, 4),
          points: perfectVerts.map((p) => ({ x: p.x - pMinX, y: p.y - pMinY })),
          strokeColor,
          backgroundColor,
          strokeWidth,
          strokeStyle,
          fillStyle,
          roughness: 0,
          opacity: 100,
          seed: createSeed(),
          customData: {
            isPolygon: true,
            polygonType: shapeName,
          },
        },
      };
    }

    // -------------------------------------------------------------------
    // Priority 4: Quadrilaterals (Rectangles & Diamonds at ANY orientation)
    // -------------------------------------------------------------------
    // Evaluated via OBB. If it matches rectangle or diamond prototypes,
    // it is classified as a quad regardless of closing hooks or minor jitter.
    const isExplicitQuad = n === 4 && polyConf >= 0.50;
    const isSoftQuad =
      (n === 0 || n === 4) &&
      (
        rectProtoDist < 1.45 ||
        diamondProtoDist < 1.45 ||
        normObbFitError < 0.13 ||
        rectDist < 0.26 ||
        diamondDist < 0.26 ||
        (obbFillRatio > 0.68 && turnShare4 >= 0.62)
      );
    const isQuadMatch = isExplicitQuad || isSoftQuad;

    if (isQuadMatch) {
      const isDiamondProto = diamondProtoDist < rectProtoDist || diamondDist < rectDist;
      let candidateVerts = polyVerts && polyVerts.length === 4 ? polyVerts : null;
      if (!candidateVerts) {
        if (isDiamondProto) {
          // A diamond inside an OBB has its 4 vertices at the midpoints of the OBB edges
          const [c0, c1, c2, c3] = obb.corners;
          candidateVerts = [
            { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 },
            { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 },
            { x: (c2.x + c3.x) / 2, y: (c2.y + c3.y) / 2 },
            { x: (c3.x + c0.x) / 2, y: (c3.y + c0.y) / 2 },
          ];
        } else {
          candidateVerts = obb.corners;
        }
      }
      let quad = classifyQuad(candidateVerts);
      // If moment invariants strongly favor diamond, ensure diamond midpoints are used
      if (isDiamondProto && quad.type === "rectangle" && (!polyVerts || polyVerts.length !== 4)) {
        const [c0, c1, c2, c3] = obb.corners;
        const midVerts = [
          { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 },
          { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 },
          { x: (c2.x + c3.x) / 2, y: (c2.y + c3.y) / 2 },
          { x: (c3.x + c0.x) / 2, y: (c3.y + c0.y) / 2 },
        ];
        quad = classifyQuad(midVerts);
      }
      const isRect = quad.type === "rectangle";
      const elementId = baseElement?.id || createId(isRect ? "rectangle" : "diamond");

      let rectAngle = isRect ? (quad.angle ?? obb.angle) : quad.angle;
      if (rectAngle !== undefined) {
        while (rectAngle > Math.PI / 2) rectAngle -= Math.PI;
        while (rectAngle < -Math.PI / 2) rectAngle += Math.PI;
        if (Math.abs(rectAngle) < 0.08) rectAngle = 0;
      }

      return {
        shape: isRect ? "rectangle" : "diamond",
        confidence: Math.max(0.80, Math.max(obbFillRatio, 1 - normObbFitError)),
        element: {
          id: elementId,
          pageId,
          type: isRect ? "rectangle" : "diamond",
          x: quad.cx - quad.width / 2,
          y: quad.cy - quad.height / 2,
          width: Math.max(quad.width, 10),
          height: Math.max(quad.height, 10),
          angle: rectAngle !== 0 ? rectAngle : undefined,
          strokeColor,
          backgroundColor,
          strokeWidth,
          strokeStyle,
          fillStyle,
          roughness: 0,
          opacity: 100,
          roundness: isRect ? "round" : undefined,
          seed: createSeed(),
        },
      };
    }
  }

  // 3. FALLBACK: Apply RDP Polyline Smoothing
  const simplifiedPoints = ramerDouglasPeucker(points, 2.5);
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
