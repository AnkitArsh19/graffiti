import type { CanvasElement, Point } from "../types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Converts screen pixel coordinates to world coordinates given scroll and zoom:
 * worldX = screenX / zoom - scrollX
 * worldY = screenY / zoom - scrollY
 */
export function screenToWorld(
  screenPoint: Point,
  scrollX: number,
  scrollY: number,
  zoom: number,
): Point {
  return {
    x: screenPoint.x / zoom - scrollX,
    y: screenPoint.y / zoom - scrollY,
    pressure: screenPoint.pressure,
  };
}

/**
 * Converts world coordinates to screen pixel coordinates.
 * screenX = (worldX + scrollX) * zoom
 * screenY = (worldY + scrollY) * zoom
 */
export function worldToScreen(
  worldPoint: Point,
  scrollX: number,
  scrollY: number,
  zoom: number,
): Point {
  return {
    x: (worldPoint.x + scrollX) * zoom,
    y: (worldPoint.y + scrollY) * zoom,
  };
}

export function moveElement(element: CanvasElement, dx: number, dy: number): CanvasElement {
  return {
    ...element,
    x: element.x + dx,
    y: element.y + dy,
  };
}

export function createId(prefix = "el"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createSeed(): number {
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}

export interface AnchorPoint {
  id: string;
  elementId: string;
  x: number;
  y: number;
}

/**
 * Rotates a point (px, py) around center (cx, cy) by angle in radians.
 */
export function rotatePoint(px: number, py: number, cx: number, cy: number, angle: number): Point {
  if (!angle) return { x: px, y: py };
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/**
 * Returns connection anchor points for an element:
 * - Rectangles, sticky notes, ellipses, diamonds, text: 4 edge centers (top, right, bottom, left).
 * - Lines and arrows: start, middle, and end points.
 */
export function getElementAnchorPoints(element: CanvasElement): AnchorPoint[] {
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const angle = element.angle || 0;

  if (element.type === "line" || element.type === "arrow") {
    if (!element.points || element.points.length < 2) return [];
    const pts = element.points;
    const anchors: AnchorPoint[] = [];

    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      const rawX = element.x + pt.x;
      const rawY = element.y + pt.y;
      const rotated = rotatePoint(rawX, rawY, cx, cy, angle);

      let id = `point_${i}`;
      if (i === 0) id = "start";
      else if (i === pts.length - 1) id = "end";

      anchors.push({
        id,
        elementId: element.id,
        x: rotated.x,
        y: rotated.y,
      });

      // Segment midpoint
      if (i < pts.length - 1) {
        const nextPt = pts[i + 1];
        const midX = element.x + (pt.x + nextPt.x) / 2;
        const midY = element.y + (pt.y + nextPt.y) / 2;
        const midRotated = rotatePoint(midX, midY, cx, cy, angle);
        const midId = pts.length === 2 ? "mid" : `mid_${i}`;

        anchors.push({
          id: midId,
          elementId: element.id,
          x: midRotated.x,
          y: midRotated.y,
        });
      }
    }

    return anchors;
  }

  // 2D shapes: rectangle, ellipse, diamond, sticky, text
  const rawAnchors = [
    { id: "top", x: cx, y: element.y },
    { id: "right", x: element.x + element.width, y: cy },
    { id: "bottom", x: cx, y: element.y + element.height },
    { id: "left", x: element.x, y: cy },
  ];

  return rawAnchors.map((raw) => {
    const rotated = rotatePoint(raw.x, raw.y, cx, cy, angle);
    return {
      id: raw.id,
      elementId: element.id,
      x: rotated.x,
      y: rotated.y,
    };
  });
}

/**
 * Returns the exact coordinates of an anchor point on an element.
 */
export function getAnchorPointPosition(
  element: CanvasElement,
  pointId: string,
): Point | null {
  const anchors = getElementAnchorPoints(element);
  const found = anchors.find((a) => a.id === pointId);
  return found ? { x: found.x, y: found.y } : null;
}

/**
 * Finds the closest connection anchor point to worldPoint among eligible elements.
 */
export function findClosestAnchorPoint(
  worldPoint: Point,
  elements: CanvasElement[],
  excludeId?: string,
  threshold = 24,
): { anchor: AnchorPoint; distance: number } | null {
  let closest: { anchor: AnchorPoint; distance: number } | null = null;

  for (const el of elements) {
    if (el.id === excludeId) continue;
    const anchors = getElementAnchorPoints(el);
    for (const anchor of anchors) {
      const dist = Math.hypot(anchor.x - worldPoint.x, anchor.y - worldPoint.y);
      if (dist <= threshold && (!closest || dist < closest.distance)) {
        closest = { anchor, distance: dist };
      }
    }
  }

  return closest;
}

/**
 * Automatically updates any arrows or lines bound to movedElement.
 */
export function updateBoundArrows(
  elements: CanvasElement[],
  movedElement: CanvasElement,
): CanvasElement[] {
  return elements.map((el) => {
    if (el.type !== "arrow" && el.type !== "line") return el;
    if (el.id === movedElement.id) return el;
    if (!el.points || el.points.length < 2) return el;

    let updated = false;
    const pts = [...el.points];
    let startX = el.x + pts[0].x;
    let startY = el.y + pts[0].y;
    let endX = el.x + pts[pts.length - 1].x;
    let endY = el.y + pts[pts.length - 1].y;

    if (el.startBinding?.elementId === movedElement.id) {
      const anchor = getAnchorPointPosition(movedElement, el.startBinding.pointId);
      if (anchor) {
        startX = anchor.x;
        startY = anchor.y;
        updated = true;
      }
    }

    if (el.endBinding?.elementId === movedElement.id) {
      const anchor = getAnchorPointPosition(movedElement, el.endBinding.pointId);
      if (anchor) {
        endX = anchor.x;
        endY = anchor.y;
        updated = true;
      }
    }

    if (!updated) return el;

    const dx = endX - startX;
    const dy = endY - startY;

    return {
      ...el,
      x: startX,
      y: startY,
      width: Math.max(Math.abs(dx), 1),
      height: Math.max(Math.abs(dy), 1),
      points: [
        { x: 0, y: 0 },
        { x: dx / 2, y: dy / 2 },
        { x: dx, y: dy },
      ],
    };
  });
}

/**
 * Tests if an element is inside or intersects a selection box.
 */
export function doesElementIntersectBox(
  element: CanvasElement,
  box: { x: number; y: number; width: number; height: number },
): boolean {
  const boxLeft = Math.min(box.x, box.x + box.width);
  const boxRight = Math.max(box.x, box.x + box.width);
  const boxTop = Math.min(box.y, box.y + box.height);
  const boxBottom = Math.max(box.y, box.y + box.height);

  const elLeft = element.x;
  const elRight = element.x + element.width;
  const elTop = element.y;
  const elBottom = element.y + element.height;

  // Check AABB overlap first
  const overlapsAABB =
    elLeft <= boxRight &&
    elRight >= boxLeft &&
    elTop <= boxBottom &&
    elBottom >= boxTop;

  if (!overlapsAABB) return false;

  // If fully inside
  if (elLeft >= boxLeft && elRight <= boxRight && elTop >= boxTop && elBottom <= boxBottom) {
    return true;
  }

  // For points-based elements (pen, line, arrow), check if any point is inside
  if (element.points && element.points.length > 0) {
    return element.points.some((pt) => {
      const px = element.x + pt.x;
      const py = element.y + pt.y;
      return px >= boxLeft && px <= boxRight && py >= boxTop && py <= boxBottom;
    });
  }

  return true;
}

/**
 * Normalizes a freehand pen element so element.x and element.y are the minimum
 * world coordinates of the stroke, and all points are offset relative to (0, 0).
 * This ensures the selection box, resize handles, and collision box perfectly surround the figure.
 */
export function normalizePenElement(element: CanvasElement): CanvasElement {
  if (element.type !== "pen" || !element.points || element.points.length === 0) {
    return element;
  }

  const xs = element.points.map((p) => p.x);
  const ys = element.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  if (minX === 0 && minY === 0 && element.width === Math.max(maxX, 2) && element.height === Math.max(maxY, 2)) {
    return element;
  }

  return {
    ...element,
    x: element.x + minX,
    y: element.y + minY,
    width: Math.max(maxX - minX, 2),
    height: Math.max(maxY - minY, 2),
    points: element.points.map((p) => ({
      ...p,
      x: p.x - minX,
      y: p.y - minY,
    })),
  };
}

/**
 * Tests if an element is FULLY enclosed inside a selection box.
 */
export function isElementFullyInsideBox(
  element: CanvasElement,
  box: { x: number; y: number; width: number; height: number },
): boolean {
  const boxLeft = Math.min(box.x, box.x + box.width);
  const boxRight = Math.max(box.x, box.x + box.width);
  const boxTop = Math.min(box.y, box.y + box.height);
  const boxBottom = Math.max(box.y, box.y + box.height);

  // For pen / lines / arrows, check all points
  if (element.points && element.points.length > 0) {
    return element.points.every((pt) => {
      const px = element.x + pt.x;
      const py = element.y + pt.y;
      return px >= boxLeft && px <= boxRight && py >= boxTop && py <= boxBottom;
    });
  }

  // For 2D boxes (rectangles, ellipses, diamonds, text, sticky)
  const elLeft = element.x;
  const elRight = element.x + element.width;
  const elTop = element.y;
  const elBottom = element.y + element.height;

  return (
    elLeft >= boxLeft &&
    elRight <= boxRight &&
    elTop >= boxTop &&
    elBottom <= boxBottom
  );
}

