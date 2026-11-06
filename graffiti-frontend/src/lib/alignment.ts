import type { CanvasElement } from "../types";

export type AlignmentType = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type DistributionDirection = "horizontal" | "vertical";

/**
 * Aligns selected elements along the specified axis based on their collective bounding box.
 */
export function alignElements(
  elements: CanvasElement[],
  alignment: AlignmentType
): CanvasElement[] {
  if (elements.length < 2) return elements;

  const minX = Math.min(...elements.map((e) => e.x));
  const maxX = Math.max(...elements.map((e) => e.x + e.width));
  const midX = (minX + maxX) / 2;

  const minY = Math.min(...elements.map((e) => e.y));
  const maxY = Math.max(...elements.map((e) => e.y + e.height));
  const midY = (minY + maxY) / 2;

  return elements.map((el) => {
    let nextX = el.x;
    let nextY = el.y;

    switch (alignment) {
      case "left":
        nextX = minX;
        break;
      case "center":
        nextX = Math.round(midX - el.width / 2);
        break;
      case "right":
        nextX = maxX - el.width;
        break;
      case "top":
        nextY = minY;
        break;
      case "middle":
        nextY = Math.round(midY - el.height / 2);
        break;
      case "bottom":
        nextY = maxY - el.height;
        break;
    }

    if (nextX === el.x && nextY === el.y) return el;

    return {
      ...el,
      x: nextX,
      y: nextY,
    };
  });
}

/**
 * Distributes elements with equal spacing along the specified axis.
 */
export function distributeElements(
  elements: CanvasElement[],
  direction: DistributionDirection
): CanvasElement[] {
  if (elements.length < 3) return elements;

  const sorted = [...elements].sort((a, b) => {
    return direction === "horizontal" ? a.x - b.x : a.y - b.y;
  });

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (direction === "horizontal") {
    const totalSpan = last.x + last.width - first.x;
    const totalElemWidths = sorted.reduce((sum, el) => sum + el.width, 0);
    const totalGap = Math.max(0, totalSpan - totalElemWidths);
    const gap = totalGap / (sorted.length - 1);

    let curX = first.x;
    return sorted.map((el, i) => {
      const targetX = Math.round(curX);
      curX += el.width + gap;
      if (el.x === targetX) return el;
      return {
        ...el,
        x: targetX,
      };
    });
  } else {
    const totalSpan = last.y + last.height - first.y;
    const totalElemHeights = sorted.reduce((sum, el) => sum + el.height, 0);
    const totalGap = Math.max(0, totalSpan - totalElemHeights);
    const gap = totalGap / (sorted.length - 1);

    let curY = first.y;
    return sorted.map((el, i) => {
      const targetY = Math.round(curY);
      curY += el.height + gap;
      if (el.y === targetY) return el;
      return {
        ...el,
        y: targetY,
      };
    });
  }
}

/**
 * "Tidy Up": Automatically rearranges a scattered selection into a neat, uniform grid or row
 * with standard padding (24px).
 */
export function tidyUpElements(elements: CanvasElement[], gap = 24): CanvasElement[] {
  if (elements.length < 2) return elements;

  const minX = Math.min(...elements.map((e) => e.x));
  const minY = Math.min(...elements.map((e) => e.y));

  // Determine grid dimensions
  const count = elements.length;
  // If count <= 3, arrange in a single row
  const cols = count <= 3 ? count : Math.ceil(Math.sqrt(count));

  // Sort primarily top-to-bottom, secondarily left-to-right
  const sorted = [...elements].sort((a, b) => {
    const rowA = Math.floor(a.y / 80);
    const rowB = Math.floor(b.y / 80);
    if (rowA !== rowB) return rowA - rowB;
    return a.x - b.x;
  });

  // Calculate uniform cell dimensions
  const maxW = Math.max(...sorted.map((e) => e.width));
  const maxH = Math.max(...sorted.map((e) => e.height));

  return sorted.map((el, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;

    const targetX = Math.round(minX + col * (maxW + gap));
    const targetY = Math.round(minY + row * (maxH + gap));

    return {
      ...el,
      x: targetX,
      y: targetY,
    };
  });
}
