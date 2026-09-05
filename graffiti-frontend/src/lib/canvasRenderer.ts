import rough from "roughjs";
import type { Options } from "roughjs/bin/core";
import { getStroke } from "perfect-freehand";
import { applyDarkModeFilter } from "./colors";
import { getElementTransformHandles, type TransformHandleType } from "./collision";
import type { CanvasElement, PaperTemplate } from "../types";

const generator = rough.generator();

// -----------------------------------------------------------------------------
// Freedraw Constants
// -----------------------------------------------------------------------------
const VARIABLE_WIDTH_FREEDRAW = {
  SIZE_FACTOR: 4.25,
  THINNING: 0.6,
  SMOOTHING: 0.5,
  STREAMLINE: 0.5,
} as const;

const med = (A: number[], B: number[]) => [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
const TO_FIXED_PRECISION = /(\s?[A-Z]?,?-?[0-9]*\.[0-9]{0,2})(([0-9]|e|-)*)/g;

export function getSvgPathFromStroke(points: number[][]): string {
  if (!points.length) return "";
  const max = points.length - 1;

  return points
    .reduce(
      (acc, point, i, arr) => {
        if (i === max) {
          acc.push(point, med(point, arr[0]), "L", arr[0], "Z");
        } else {
          acc.push(point, med(point, arr[i + 1]));
        }
        return acc;
      },
      ["M", points[0], "Q"],
    )
    .join(" ")
    .replace(TO_FIXED_PRECISION, "$1");
}

export function getFreedrawOutline(
  points: { x: number; y: number; pressure?: number }[],
  strokeWidth: number,
): number[][] {
  if (!points || points.length === 0) return [];
  const rawPoints = points.map((p) => [p.x, p.y, p.pressure ?? 0.5]);

  return getStroke(rawPoints, {
    size: strokeWidth * VARIABLE_WIDTH_FREEDRAW.SIZE_FACTOR,
    thinning: VARIABLE_WIDTH_FREEDRAW.THINNING,
    smoothing: VARIABLE_WIDTH_FREEDRAW.SMOOTHING,
    streamline: VARIABLE_WIDTH_FREEDRAW.STREAMLINE,
    easing: (t) => Math.sin((t * Math.PI) / 2),
    last: true,
  });
}

// -----------------------------------------------------------------------------
// Screen-Space Paper Grid & Canvas Background
// -----------------------------------------------------------------------------
export function strokePaperGrid(
  context: CanvasRenderingContext2D,
  template: PaperTemplate,
  scrollX: number,
  scrollY: number,
  zoom: number,
  theme: "dark" | "light",
  width: number,
  height: number,
) {
  if (template === "blank") return;

  const isDark = theme === "dark";
  const gridSize = 24;
  const gridStep = 5;
  const actualGridSize = gridSize * zoom;

  const step = Math.max(actualGridSize, 12);
  const offsetX = (((scrollX * zoom) % step) + step) % step;
  const offsetY = (((scrollY * zoom) % step) + step) % step;

  context.save();
  context.translate(offsetX % 1 ? 0 : 0.5, offsetY % 1 ? 0 : 0.5);

  const boldColor = isDark ? "#242424" : "#d8d8d8";
  const regularColor = isDark ? "#181818" : "#eeeeee";
  const dotColor = isDark ? "#333333" : "#cbd5e1";
  const cornellRed = isDark ? "rgba(239, 68, 68, 0.4)" : "rgba(239, 68, 68, 0.5)";

  if (template === "grid") {
    context.lineWidth = 1;
    for (let x = offsetX - step; x <= width + step; x += step) {
      const colIndex = Math.round((x - (scrollX * zoom)) / step);
      const isBold = gridStep > 1 && colIndex % gridStep === 0;
      context.strokeStyle = isBold ? boldColor : regularColor;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = offsetY - step; y <= height + step; y += step) {
      const rowIndex = Math.round((y - (scrollY * zoom)) / step);
      const isBold = gridStep > 1 && rowIndex % gridStep === 0;
      context.strokeStyle = isBold ? boldColor : regularColor;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  } else if (template === "dotted") {
    context.fillStyle = dotColor;
    const dotRadius = Math.max(1, Math.min(1.3 * zoom, 1.6));
    for (let x = offsetX - step; x <= width + step; x += step) {
      for (let y = offsetY - step; y <= height + step; y += step) {
        context.beginPath();
        context.arc(x, y, dotRadius, 0, Math.PI * 2);
        context.fill();
      }
    }
  } else if (template === "ruled" || template === "cornell") {
    context.lineWidth = 1;
    const lineStep = Math.max(30 * zoom, 16);
    const lineOffsetY = (((scrollY * zoom) % lineStep) + lineStep) % lineStep;
    context.strokeStyle = isDark ? "#202020" : "#e5e7eb";

    for (let y = lineOffsetY - lineStep; y <= height + lineStep; y += lineStep) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    if (template === "cornell") {
      const marginScreenX = (180 + scrollX) * zoom;
      if (marginScreenX >= 0 && marginScreenX <= width) {
        context.strokeStyle = cornellRed;
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(marginScreenX, 0);
        context.lineTo(marginScreenX, height);
        context.stroke();
      }
    }
  }

  context.restore();
}

// -----------------------------------------------------------------------------
// Rough.js Options Helper
// -----------------------------------------------------------------------------
function getDashArray(strokeStyle?: string, strokeWidth: number = 2): number[] | undefined {
  if (strokeStyle === "dashed") {
    return [8, 8 + strokeWidth];
  }
  if (strokeStyle === "dotted") {
    return [1.5, 6 + strokeWidth];
  }
  return undefined;
}

function getRoughOptions(
  element: CanvasElement,
  isDarkMode: boolean,
  continuousPath = false,
): Options {
  const strokeColor = applyDarkModeFilter(element.strokeColor, isDarkMode, false);
  const fillColor =
    element.backgroundColor && element.backgroundColor !== "transparent"
      ? applyDarkModeFilter(element.backgroundColor, isDarkMode, true)
      : undefined;

  const strokeLineDash = getDashArray(element.strokeStyle, element.strokeWidth);
  const roughness = element.roughness ?? 0;

  const options: Options = {
    seed: element.seed,
    stroke: strokeColor,
    strokeWidth: element.strokeStyle !== "solid" ? element.strokeWidth + 0.5 : element.strokeWidth,
    strokeLineDash,
    disableMultiStroke: element.strokeStyle !== "solid" || roughness === 0,
    roughness,
    bowing: roughness === 0 ? 0 : roughness * 0.75,
    preserveVertices: continuousPath || roughness < 2,
    fill: fillColor,
    fillStyle:
      element.fillStyle === "hachure" || element.fillStyle === "cross-hatch"
        ? element.fillStyle
        : "solid",
    fillWeight: Math.max(1, element.strokeWidth / 2),
    hachureGap: Math.max(6, element.strokeWidth * 3.5),
  };

  return options;
}

// -----------------------------------------------------------------------------
// Arrowhead Drawing (Retraction + Clean Vector Shapes)
// -----------------------------------------------------------------------------
function drawArrowhead(
  rc: any,
  generator: any,
  tip: { x: number; y: number },
  dirX: number,
  dirY: number,
  type: string,
  strokeColor: string,
  strokeWidth: number,
  roughness: number,
  seed: number,
) {
  if (!type || type === "none") return;

  const headLen = Math.max(12, strokeWidth * 3.5);
  const perpX = -dirY;
  const perpY = dirX;
  const wingWidth = headLen * 0.55;

  const baseX = tip.x - dirX * headLen;
  const baseY = tip.y - dirY * headLen;

  const w1 = { x: baseX + perpX * wingWidth, y: baseY + perpY * wingWidth };
  const w2 = { x: baseX - perpX * wingWidth, y: baseY - perpY * wingWidth };

  const headOptions: Options = {
    seed: seed + 1,
    stroke: strokeColor,
    strokeWidth,
    roughness: Math.min(1, roughness),
    disableMultiStroke: true,
  };

  if (type === "bar") {
    rc.draw(
      generator.line(
        tip.x + perpX * wingWidth,
        tip.y + perpY * wingWidth,
        tip.x - perpX * wingWidth,
        tip.y - perpY * wingWidth,
        headOptions,
      ),
    );
    return;
  }

  if (type === "circle") {
    const circOptions = {
      ...headOptions,
      fill: strokeColor,
      fillStyle: "solid" as const,
    };
    rc.draw(
      generator.circle(
        tip.x - dirX * (headLen * 0.45),
        tip.y - dirY * (headLen * 0.45),
        headLen * 0.9,
        circOptions,
      ),
    );
    return;
  }

  if (type === "triangle") {
    const triOptions = {
      ...headOptions,
      fill: strokeColor,
      fillStyle: "solid" as const,
    };
    rc.draw(
      generator.polygon(
        [
          [tip.x, tip.y],
          [w1.x, w1.y],
          [w2.x, w2.y],
        ],
        triOptions,
      ),
    );
    return;
  }

  // Default: "arrow" (two lines converging to tip)
  rc.draw(generator.line(w1.x, w1.y, tip.x, tip.y, headOptions));
  rc.draw(generator.line(w2.x, w2.y, tip.x, tip.y, headOptions));
}

// -----------------------------------------------------------------------------
// Shape Rendering Pipeline via Rough.js & Vector Geometry
// -----------------------------------------------------------------------------
export function drawShapeOnCanvas(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  element: CanvasElement,
  isDarkMode: boolean,
) {
  const rc = rough.canvas(canvas);
  const strokeColor = applyDarkModeFilter(element.strokeColor, isDarkMode, false);
  const isSemi = element.fillStyle === "semi";

  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";

  if (isSemi && element.backgroundColor && element.backgroundColor !== "transparent") {
    context.globalAlpha = Math.max(0.05, (element.opacity / 100) * 0.45);
  }

  const options = getRoughOptions(element, isDarkMode);

  switch (element.type) {
    case "rectangle":
    case "sticky": {
      const isSticky = element.type === "sticky";
      const isRound = element.roundness === "round" || isSticky;
      const w = element.width;
      const h = element.height;
      const r = isSticky ? 10 : Math.min(16, w / 4, h / 4);

      if (isRound && r > 0) {
        const pathD = `M ${r} 0 L ${w - r} 0 Q ${w} 0, ${w} ${r} L ${w} ${h - r} Q ${w} ${h}, ${w - r} ${h} L ${r} ${h} Q 0 ${h}, 0 ${h - r} L 0 ${r} Q 0 0, ${r} 0`;
        rc.draw(generator.path(pathD, options));
      } else {
        rc.draw(generator.rectangle(0, 0, w, h, options));
      }
      break;
    }
    case "ellipse": {
      rc.draw(
        generator.ellipse(
          element.width / 2,
          element.height / 2,
          element.width,
          element.height,
          options,
        ),
      );
      break;
    }
    case "diamond": {
      const [topX, topY] = [element.width / 2, 0];
      const [rightX, rightY] = [element.width, element.height / 2];
      const [bottomX, bottomY] = [element.width / 2, element.height];
      const [leftX, leftY] = [0, element.height / 2];
      rc.draw(
        generator.polygon(
          [
            [topX, topY],
            [rightX, rightY],
            [bottomX, bottomY],
            [leftX, leftY],
          ],
          options,
        ),
      );
      break;
    }
    case "line":
    case "arrow": {
      if (element.points && element.points.length >= 2) {
        const p0 = element.points[0];
        const p1 = element.points[element.points.length - 1];
        const pMid =
          element.points.length >= 3
            ? element.points[1]
            : { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };

        const startType = element.startArrowhead ?? "none";
        const endType =
          element.endArrowhead ?? (element.type === "arrow" ? "arrow" : "none");

        const hasStart = startType && startType !== "none";
        const hasEnd = endType && endType !== "none";

        const headLen = Math.max(12, element.strokeWidth * 3.5);

        // Compute start tangent
        const sDx = pMid.x - p0.x;
        const sDy = pMid.y - p0.y;
        const sDist = Math.hypot(sDx, sDy);
        const sNx = sDist > 0 ? sDx / sDist : 1;
        const sNy = sDist > 0 ? sDy / sDist : 0;

        // Compute end tangent
        const eDx = p1.x - pMid.x;
        const eDy = p1.y - pMid.y;
        const eDist = Math.hypot(eDx, eDy);
        const eNx = eDist > 0 ? eDx / eDist : 1;
        const eNy = eDist > 0 ? eDy / eDist : 0;

        // RETRACT shaft endpoints so line stops cleanly at the arrowhead base!
        const shaftStart = hasStart
          ? { x: p0.x + sNx * headLen, y: p0.y + sNy * headLen }
          : { x: p0.x, y: p0.y };

        const shaftEnd = hasEnd
          ? { x: p1.x - eNx * headLen, y: p1.y - eNy * headLen }
          : { x: p1.x, y: p1.y };

        const shaftOptions = getRoughOptions(element, isDarkMode);

        const isCurved = element.arrowType === "curved";
        const isElbow = element.arrowType === "elbow";

        if (isCurved) {
          rc.draw(
            generator.curve(
              [
                [shaftStart.x, shaftStart.y],
                [pMid.x, pMid.y],
                [shaftEnd.x, shaftEnd.y],
              ],
              shaftOptions,
            ),
          );
        } else if (isElbow) {
          rc.draw(
            generator.linearPath(
              [
                [shaftStart.x, shaftStart.y],
                [pMid.x, shaftStart.y],
                [pMid.x, shaftEnd.y],
                [shaftEnd.x, shaftEnd.y],
              ],
              shaftOptions,
            ),
          );
        } else {
          // Straight arrow / line
          const cross = Math.abs(
            (p1.x - p0.x) * (pMid.y - p0.y) - (pMid.x - p0.x) * (p1.y - p0.y),
          );
          if (element.points.length >= 3 && cross > 25) {
            rc.draw(
              generator.curve(
                [
                  [shaftStart.x, shaftStart.y],
                  [pMid.x, pMid.y],
                  [shaftEnd.x, shaftEnd.y],
                ],
                shaftOptions,
              ),
            );
          } else {
            rc.draw(
              generator.line(
                shaftStart.x,
                shaftStart.y,
                shaftEnd.x,
                shaftEnd.y,
                shaftOptions,
              ),
            );
          }
        }

        // Render Start Arrowhead at p0 (dir pointing outward towards p0)
        if (hasStart) {
          drawArrowhead(
            rc,
            generator,
            p0,
            -sNx,
            -sNy,
            startType,
            strokeColor,
            element.strokeWidth,
            element.roughness ?? 0,
            element.seed,
          );
        }

        // Render End Arrowhead at p1 (dir pointing forward towards p1)
        if (hasEnd) {
          drawArrowhead(
            rc,
            generator,
            p1,
            eNx,
            eNy,
            endType,
            strokeColor,
            element.strokeWidth,
            element.roughness ?? 0,
            element.seed + 2,
          );
        }
      }
      break;
    }
    case "pen": {
      if (element.points && element.points.length > 0) {
        const outlinePoints = getFreedrawOutline(element.points, element.strokeWidth);
        const pathData = getSvgPathFromStroke(outlinePoints);
        if (pathData) {
          context.fillStyle = strokeColor;
          context.fill(new Path2D(pathData));
        }
      }
      break;
    }
    case "text":
      break;
  }

  // Draw element text using selected font family and size
  if (element.text) {
    const fontSize =
      element.customFontSize ||
      (element.fontSize === "small"
        ? 14
        : element.fontSize === "large"
        ? 24
        : element.fontSize === "xlarge"
        ? 32
        : 18);

    const fontFamilyName =
      element.fontFamily === "clean"
        ? '"Inter", -apple-system, sans-serif'
        : element.fontFamily === "mono"
        ? '"JetBrains Mono", "Courier New", monospace'
        : '"Montserrat", sans-serif';

    context.fillStyle = strokeColor;
    context.font = `normal ${fontSize}px ${fontFamilyName}`;
    context.textBaseline = "top";
    context.textAlign = element.textAlign || "left";

    const padding = element.type === "sticky" ? 14 : 2;
    const lines = element.text.split("\n");
    const lineHeight = fontSize * 1.35;

    let startX = padding;
    if (element.textAlign === "center") {
      startX = element.width / 2;
    } else if (element.textAlign === "right") {
      startX = element.width - padding;
    }

    lines.forEach((line, i) => {
      context.fillText(line, startX, padding + i * lineHeight);
    });
  }

  context.restore();
}

/**
 * Renders an element in world coordinates onto canvas.
 */
export function renderCanvasElement(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  element: CanvasElement,
  isDarkMode: boolean,
) {
  context.save();
  context.globalAlpha = Math.max(0.05, element.opacity / 100);

  if (element.type === "line" || element.type === "arrow" || element.type === "pen") {
    context.translate(element.x, element.y);
    drawShapeOnCanvas(context, canvas, element, isDarkMode);
  } else {
    // 2D shapes: rotate around center!
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    context.translate(cx, cy);
    if (element.angle) {
      context.rotate(element.angle);
    }
    context.translate(-element.width / 2, -element.height / 2);
    drawShapeOnCanvas(context, canvas, element, isDarkMode);
  }

  context.restore();
}

/**
 * Renders standard selection handles:
 * - Linear elements (line, arrow): 3 circular drag handles (p0, pMid, p1).
 * - 2D shapes: rotated dashed bounding box + 8 drag handles + top circle rotation handle.
 */
export function renderSelectionBox(
  context: CanvasRenderingContext2D,
  element: CanvasElement,
  zoom: number,
  theme: "dark" | "light",
) {
  context.save();
  const selectionColor = theme === "dark" ? "#38bdf8" : "#2563eb";
  const handleFill = theme === "dark" ? "#121212" : "#ffffff";
  const handles = getElementTransformHandles(element, zoom);

  // For line or arrow: render start, middle (curve), and end circle handles
  if (element.type === "line" || element.type === "arrow") {
    const circleRadius = 5 / zoom;

    context.lineWidth = 1.6 / zoom;
    context.setLineDash([]);

    const entries = Object.entries(handles) as [TransformHandleType, [number, number]][];
    for (const [key, [hx, hy]] of entries) {
      context.beginPath();
      context.arc(hx, hy, circleRadius, 0, Math.PI * 2);
      if (key === "pMid") {
        context.fillStyle = theme === "dark" ? "#818cf8" : "#a5b4fc";
        context.strokeStyle = theme === "dark" ? "#c7d2fe" : "#4f46e5";
      } else {
        context.fillStyle = handleFill;
        context.strokeStyle = selectionColor;
      }
      context.fill();
      context.stroke();
    }

    context.restore();
    return;
  }

  // For 2D shapes: rotate selection box and handles around center
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const w = element.width;
  const h = element.height;
  const handleSize = 8 / zoom;
  const rotRadius = 4.5 / zoom;
  const rotDistance = 22 / zoom;

  context.translate(cx, cy);
  if (element.angle) {
    context.rotate(element.angle);
  }
  context.translate(-w / 2, -h / 2);

  // Dashed bounding box
  context.strokeStyle = selectionColor;
  context.lineWidth = 1.2 / zoom;
  context.setLineDash([5 / zoom, 4 / zoom]);
  context.strokeRect(0, 0, w, h);

  // Connecting line to top rotation handle
  context.beginPath();
  context.moveTo(w / 2, 0);
  context.lineTo(w / 2, -rotDistance);
  context.stroke();

  // 8 handles (4 corners + 4 sides)
  context.setLineDash([]);
  context.fillStyle = handleFill;
  context.strokeStyle = selectionColor;
  context.lineWidth = 1.5 / zoom;

  const localHandles = [
    [0, 0], // nw
    [w, 0], // ne
    [w, h], // se
    [0, h], // sw
    [w / 2, 0], // n
    [w / 2, h], // s
    [0, h / 2], // w
    [w, h / 2], // e
  ];

  localHandles.forEach(([hx, hy]) => {
    context.beginPath();
    context.rect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    context.fill();
    context.stroke();
  });

  // Top circle rotation handle
  context.beginPath();
  context.arc(w / 2, -rotDistance, rotRadius, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.restore();
}
