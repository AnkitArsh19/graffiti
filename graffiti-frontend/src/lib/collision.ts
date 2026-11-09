import type { CanvasElement, Point } from "../types";

export type TransformHandleType =
  | "nw"
  | "ne"
  | "se"
  | "sw"
  | "n"
  | "s"
  | "e"
  | "w"
  | "rotation"
  | "p0"
  | "pMid"
  | "p1";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function rotatePoint(
  point: [number, number],
  center: [number, number],
  angle: number,
): [number, number] {
  if (!angle) return point;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  return [
    center[0] + dx * cos - dy * sin,
    center[1] + dx * sin + dy * cos,
  ];
}

export function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);

  const position = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy),
    0,
    1,
  );
  const projection = { x: start.x + position * dx, y: start.y + position * dy };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

export function normalizeBox(start: Point, end: Point) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

/**
 * Checks if a point hits an element for selection or eraser.
 */
export function pointInElement(
  worldPoint: Point,
  element: CanvasElement,
  tolerance = 10,
): boolean {
  // For freehand pen
  if (element.type === "pen") {
    if (!element.points || element.points.length === 0) return false;
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    const [testPtX, testPtY] = element.angle
      ? rotatePoint([worldPoint.x, worldPoint.y], [cx, cy], -element.angle)
      : [worldPoint.x, worldPoint.y];
    const local = { x: testPtX - element.x, y: testPtY - element.y };
    if (element.points.length === 1) {
      return (
        Math.hypot(local.x - element.points[0].x, local.y - element.points[0].y) <=
        tolerance + element.strokeWidth * 2
      );
    }
    // If it is a beautified polygon, check point-in-polygon interior hit
    if (element.customData?.isPolygon && element.points.length >= 3) {
      let inside = false;
      const pts = element.points;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x;
        const yi = pts[i].y;
        const xj = pts[j].x;
        const yj = pts[j].y;
        const intersect =
          yi > local.y !== yj > local.y &&
          local.x < ((xj - xi) * (local.y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      if (inside) return true;
    }
    for (let i = 1; i < element.points.length; i++) {
      if (
        distanceToSegment(local, element.points[i - 1], element.points[i]) <=
        tolerance + element.strokeWidth * 2
      ) {
        return true;
      }
    }
    return false;
  }

  // For line or arrow: test segments between p0, pMid, and p1
  if (element.type === "line" || element.type === "arrow") {
    if (!element.points || element.points.length < 2) return false;
    const pts = element.points.map((p) => ({
      x: element.x + p.x,
      y: element.y + p.y,
    }));
    for (let i = 1; i < pts.length; i++) {
      if (distanceToSegment(worldPoint, pts[i - 1], pts[i]) <= tolerance + element.strokeWidth) {
        return true;
      }
    }
    return false;
  }

  // For 2D shapes: rotate point to element local orientation
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const [testPtX, testPtY] = element.angle
    ? rotatePoint([worldPoint.x, worldPoint.y], [cx, cy], -element.angle)
    : [worldPoint.x, worldPoint.y];

  const inBounds =
    testPtX >= element.x - tolerance &&
    testPtX <= element.x + element.width + tolerance &&
    testPtY >= element.y - tolerance &&
    testPtY <= element.y + element.height + tolerance;

  if (!inBounds) return false;

  // Ellipse geometric containment
  if (element.type === "ellipse") {
    const rx = element.width / 2 + tolerance;
    const ry = element.height / 2 + tolerance;
    if (rx <= 0 || ry <= 0) return false;
    const dx = testPtX - cx;
    const dy = testPtY - cy;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
  }

  // Diamond geometric containment
  if (element.type === "diamond") {
    const rx = element.width / 2 + tolerance;
    const ry = element.height / 2 + tolerance;
    if (rx <= 0 || ry <= 0) return false;
    const dx = Math.abs(testPtX - cx);
    const dy = Math.abs(testPtY - cy);
    return dx / rx + dy / ry <= 1;
  }

  // Rectangle, text, sticky, etc.
  return true;
}

/**
 * Returns the transform handles dictionary for a selected element.
 */
export function getElementTransformHandles(
  element: CanvasElement,
  zoom = 1,
): Record<TransformHandleType, [number, number]> {
  // Linear elements (line, arrow) have start, middle (curve/bend), and end handles
  if (element.type === "line" || element.type === "arrow") {
    const p0 = element.points?.[0] ?? { x: 0, y: 0 };
    const p1 =
      element.points?.[element.points.length - 1] ?? {
        x: element.width,
        y: element.height,
      };
    const pMid =
      element.points && element.points.length >= 3
        ? element.points[1]
        : { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };

    return {
      p0: [element.x + p0.x, element.y + p0.y],
      pMid: [element.x + pMid.x, element.y + pMid.y],
      p1: [element.x + p1.x, element.y + p1.y],
    } as any;
  }

  // 2D shapes have 8 bounding handles + 1 top rotation handle
  const { x, y, width: w, height: h } = element;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rotDistance = 22 / zoom;

  const isThinH = (h * zoom < 64 || h < 60) || (w > 80 && h < 70 && w > h * 2.5);
  const isThinW = (w * zoom < 64 || w < 60) || (h > 80 && w < 70 && h > w * 2.5);

  let unrotated: Record<string, [number, number]>;

  if (isThinH && !isThinW) {
    // Thin horizontal line / stroke: show only Left (w) and Right (e) handles + rotation
    // This avoids top and bottom handles colliding into stacked double squares!
    unrotated = {
      w: [x, cy],
      e: [x + w, cy],
      rotation: [cx, y - rotDistance],
    };
  } else if (isThinW && !isThinH) {
    // Thin vertical line / stroke: show only Top (n) and Bottom (s) handles + rotation
    unrotated = {
      n: [cx, y],
      s: [cx, y + h],
      rotation: [cx, y - rotDistance],
    };
  } else if (isThinW && isThinH) {
    // Tiny element in both dimensions
    unrotated = {
      nw: [x, y],
      se: [x + w, y + h],
      rotation: [cx, y - rotDistance],
    };
  } else {
    // Standard 2D box / shape: full 8 handles + rotation
    unrotated = {
      nw: [x, y],
      ne: [x + w, y],
      se: [x + w, y + h],
      sw: [x, y + h],
      n: [cx, y],
      s: [cx, y + h],
      w: [x, cy],
      e: [x + w, cy],
      rotation: [cx, y - rotDistance],
    };
  }

  if (!element.angle) {
    return unrotated as any;
  }

  const rotated: Record<string, [number, number]> = {};
  for (const [key, pt] of Object.entries(unrotated)) {
    rotated[key] = rotatePoint(pt, [cx, cy], element.angle);
  }
  return rotated as any;
}

/**
 * Checks if a world coordinate hits one of the drag handles of the selected element.
 */
export function getHitTransformHandle(
  worldPoint: Point,
  element: CanvasElement,
  zoom: number,
): TransformHandleType | null {
  const handleHitRadius = 12 / zoom;
  const handles = getElementTransformHandles(element, zoom);

  let bestHandle: TransformHandleType | null = null;
  let minDistanceSq = handleHitRadius * handleHitRadius;

  for (const [handleType, [hx, hy]] of Object.entries(handles) as [
    TransformHandleType,
    [number, number],
  ][]) {
    const dx = worldPoint.x - hx;
    const dy = worldPoint.y - hy;
    const distSq = dx * dx + dy * dy;
    if (distSq <= minDistanceSq) {
      minDistanceSq = distSq;
      bestHandle = handleType;
    }
  }

  return bestHandle;
}

export function getHandleCursor(handle: TransformHandleType | null): string {
  switch (handle) {
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "rotation":
      return "grab";
    case "p0":
    case "p1":
    case "pMid":
      return "crosshair";
    default:
      return "default";
  }
}

