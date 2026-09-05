import type { CanvasElement, Point, Viewport } from "../types";

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function screenToWorld(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
}

export function normalizeBox(start: Point, end: Point) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function pointInElement(point: Point, element: CanvasElement, tolerance = 10) {
  if (element.type === "pen" || element.type === "line" || element.type === "arrow") {
    const points = element.points ?? [];
    if (points.length < 2) return false;

    for (let index = 1; index < points.length; index += 1) {
      if (distanceToSegment(point, points[index - 1], points[index]) <= tolerance) {
        return true;
      }
    }
    return false;
  }

  return (
    point.x >= element.x - tolerance &&
    point.x <= element.x + element.width + tolerance &&
    point.y >= element.y - tolerance &&
    point.y <= element.y + element.height + tolerance
  );
}

export function distanceToSegment(point: Point, start: Point, end: Point) {
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

export function moveElement(element: CanvasElement, dx: number, dy: number): CanvasElement {
  return {
    ...element,
    x: element.x + dx,
    y: element.y + dy,
    points: element.points?.map((point) => ({ x: point.x + dx, y: point.y + dy })),
  };
}

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createSeed() {
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}
