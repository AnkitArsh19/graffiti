import rough from "roughjs";
import type { Options } from "roughjs/bin/core";
import { getStroke } from "perfect-freehand";
import tinycolor from "tinycolor2";
import { applyDarkModeFilter } from "./colors";
import { getElementTransformHandles, type TransformHandleType } from "./collision";
import type { CanvasElement, PaperTemplate, TextAlign } from "../types";
import { getApiBaseUrl } from "./api";

const generator = rough.generator();

const imageCache = new Map<string, HTMLImageElement>();
const pendingImages = new Set<string>();

export function resolveMediaUrl(src?: string): string {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  if (src.startsWith("/")) {
    return `${getApiBaseUrl()}${src}`;
  }
  return src;
}

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
  let fillColor =
    element.backgroundColor && element.backgroundColor !== "transparent"
      ? applyDarkModeFilter(element.backgroundColor, isDarkMode, true)
      : undefined;

  // For semi fillStyle: make the fill layer 45% translucent while keeping the border stroke 100% crisp & solid
  if (fillColor && element.fillStyle === "semi") {
    const tc = tinycolor(fillColor);
    if (tc.isValid()) {
      const rgb = tc.toRgb();
      fillColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`;
    }
  }

  const strokeLineDash = getDashArray(element.strokeStyle, element.strokeWidth);
  const roughness = element.roughness ?? 0;
  const sw = element.strokeWidth ?? 2;

  const isHatched =
    element.fillStyle === "hachure" ||
    element.fillStyle === "cross-hatch" ||
    element.fillStyle === "zigzag" ||
    element.fillStyle === "dots";

  // In light mode, ensure hachure/cross-hatch strokes have strong visible contrast against white paper
  if (fillColor && !isDarkMode && isHatched) {
    const tc = tinycolor(fillColor);
    if (tc.isValid() && tc.getLuminance() > 0.72) {
      fillColor = tc.darken(22).toHexString();
    }
  }

  const options: Options = {
    seed: element.seed || 1,
    stroke: strokeColor,
    strokeWidth: element.strokeStyle !== "solid" ? sw + 0.5 : sw,
    strokeLineDash,
    disableMultiStroke: element.strokeStyle !== "solid" || roughness === 0,
    roughness,
    bowing: roughness === 0 ? 0 : roughness * 0.75,
    preserveVertices: continuousPath || roughness < 2,
    fill: fillColor,
    fillStyle: isHatched ? element.fillStyle : "solid",
    fillWeight: Math.max(2.0, sw * 0.85),
    hachureGap: Math.max(5.0, sw * 2.2),
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

/**
 * Wraps text into lines that do not exceed maxWidth to prevent horizontal overflow.
 */
export function wrapTextLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];
  if (maxWidth <= 0) return text.split("\n");

  const paragraphs = text.split("\n");
  const resultLines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      resultLines.push("");
      continue;
    }
    const words = para.split(" ");
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = context.measureText(testLine).width;

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          resultLines.push(currentLine);
          currentLine = word;
        } else {
          // If a single word exceeds maxWidth, break characters
          let partial = "";
          for (const char of word) {
            const charTest = partial + char;
            if (context.measureText(charTest).width <= maxWidth) {
              partial = charTest;
            } else {
              if (partial) resultLines.push(partial);
              partial = char;
            }
          }
          currentLine = partial;
        }
      }
    }
    if (currentLine) {
      resultLines.push(currentLine);
    }
  }

  return resultLines;
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
  const strokeColor = applyDarkModeFilter(element.strokeColor || (isDarkMode ? "#ffffff" : "#1e1e1e"), isDarkMode, false);
  const isSemi = element.fillStyle === "semi";

  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";

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
    case "frame": {
      const frameOptions = { ...options, fill: undefined, strokeLineDash: [8, 5] };
      rc.draw(generator.rectangle(0, 0, element.width, element.height, frameOptions));
      context.fillStyle = strokeColor;
      context.font = "600 12px Inter, sans-serif";
      context.fillText(element.title || "Frame", 8, 8);
      break;
    }
    case "card":
    case "code":
    case "table":
    case "deviceFrame": {
      rc.draw(generator.rectangle(0, 0, element.width, element.height, options));
      const header =
        element.type === "code"
          ? element.language || "code"
          : element.type === "table"
          ? element.title || "Table"
          : element.type === "deviceFrame"
          ? element.deviceType || "browser"
          : element.title || "Service Card";

      context.save();
      // Header background
      context.fillStyle = isDarkMode ? "rgba(255,255,255,.09)" : "rgba(15,23,42,.08)";
      context.fillRect(0, 0, element.width, Math.min(30, element.height));

      // Header title
      context.fillStyle = strokeColor;
      context.font = element.type === "code" ? "12px monospace" : "600 13px Inter, sans-serif";
      context.fillText(header, 10, 9);

      // Card body content
      if (element.type === "card") {
        const body = element.text || element.bodyText || "";
        if (body) {
          const lines = body.split("\n");
          context.font = "12px Inter, sans-serif";
          context.fillStyle = isDarkMode ? "#cbd5e1" : "#334155";
          lines.slice(0, 6).forEach((line, index) => {
            const y = 46 + index * 18;
            if (y < element.height - 8) {
              context.fillText(line, 10, y);
            }
          });
        }
      }

      // Syntax-Highlighted Code Block
      if (element.type === "code") {
        const codeText = element.text || "const config = {\n  env: 'production',\n  port: 8080,\n};\nexport default config;";
        const lines = codeText.split("\n");
        lines.slice(0, 18).forEach((line, index) => {
          const y = 48 + index * 18;
          if (y < element.height - 8) {
            // Line number
            context.font = "11px monospace";
            context.fillStyle = isDarkMode ? "#64748b" : "#94a3b8";
            context.fillText(String(index + 1).padStart(2, " "), 10, y);
            // Code line
            context.font = "12px monospace";
            context.fillStyle = isDarkMode ? "#e2e8f0" : "#1e293b";
            context.fillText(line, 36, y);
          }
        });
      }

      // Device Mockup Frames (Browser Window or Mobile Phone)
      if (element.type === "deviceFrame") {
        const isPhone = element.deviceType === "phone";
        if (isPhone) {
          // Dynamic island / top speaker notch
          context.fillStyle = isDarkMode ? "#27272a" : "#cbd5e1";
          const notchW = Math.min(80, element.width * 0.4);
          context.beginPath();
          context.roundRect((element.width - notchW) / 2, 7, notchW, 14, 7);
          context.fill();
        } else {
          // Browser window 3 traffic light dots
          const dots = ["#ef4444", "#f59e0b", "#10b981"];
          dots.forEach((color, i) => {
            context.fillStyle = color;
            context.beginPath();
            context.arc(14 + i * 14, 15, 4.5, 0, Math.PI * 2);
            context.fill();
          });
          // Address bar pill
          context.fillStyle = isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
          const barW = Math.max(80, element.width - 90);
          context.beginPath();
          context.roundRect(64, 6, barW, 18, 4);
          context.fill();
          context.font = "10px Inter, sans-serif";
          context.fillStyle = isDarkMode ? "#94a3b8" : "#64748b";
          context.fillText(element.title || "https://app.graffiti.dev", 72, 10);
        }
      }

      // ERD Schema Table columns
      if (element.type === "table") {
        (element.columns || []).forEach((column, index) => {
          const y = 42 + index * 22;
          if (y < element.height - 10) {
            context.strokeStyle = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
            context.beginPath();
            context.moveTo(0, y + 16);
            context.lineTo(element.width, y + 16);
            context.stroke();

            // Key tag (PK / FK)
            let colOffset = 10;
            if (column.key) {
              context.font = "bold 10px Inter, sans-serif";
              context.fillStyle = column.key.toUpperCase() === "PK" ? "#f59e0b" : "#3b82f6";
              const tagText = column.key.toUpperCase();
              context.fillText(tagText, colOffset, y);
              colOffset += context.measureText(tagText).width + 6;
            }

            // Column Name
            context.font = "12px Inter, sans-serif";
            context.fillStyle = isDarkMode ? "#f1f5f9" : "#1e293b";
            context.fillText(column.name, colOffset, y);

            // Column Type (Right-aligned)
            if (column.type) {
              context.font = "11px monospace";
              context.fillStyle = isDarkMode ? "#94a3b8" : "#64748b";
              const typeText = column.type;
              const typeWidth = context.measureText(typeText).width;
              context.fillText(typeText, element.width - typeWidth - 10, y);
            }
          }
        });
      }
      context.restore();
      break;
    }
    case "icon": {
      context.strokeStyle = strokeColor; context.fillStyle = strokeColor; context.lineWidth = element.strokeWidth;
      if (element.svgPath) { try { context.fill(new Path2D(element.svgPath)); } catch { /* malformed imported SVG path */ } }
      else { context.beginPath(); context.arc(element.width / 2, element.height / 2, Math.min(element.width, element.height) / 3, 0, Math.PI * 2); context.fill(); }
      break;
    }
    case "image": {
      const rawSrc = (element.customData?.src as string) || (element.customData?.url as string) || element.fileId || "";
      const fullUrl = resolveMediaUrl(rawSrc);
      const cached = fullUrl ? imageCache.get(fullUrl) : undefined;

      if (cached && cached.complete && cached.naturalWidth > 0) {
        context.save();
        context.beginPath();
        if (typeof (context as any).roundRect === "function") {
          (context as any).roundRect(0, 0, element.width, element.height, 8);
        } else {
          context.rect(0, 0, element.width, element.height);
        }
        context.clip();
        context.drawImage(cached, 0, 0, element.width, element.height);
        context.restore();

        // Subtle frame outline
        context.strokeStyle = strokeColor || "rgba(255, 255, 255, 0.15)";
        context.lineWidth = Math.max(1, element.strokeWidth || 1);
        if (typeof (context as any).roundRect === "function") {
          context.beginPath();
          (context as any).roundRect(0, 0, element.width, element.height, 8);
          context.stroke();
        } else {
          context.strokeRect(0, 0, element.width, element.height);
        }
      } else {
        if (fullUrl && !pendingImages.has(fullUrl)) {
          pendingImages.add(fullUrl);
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            imageCache.set(fullUrl, img);
            pendingImages.delete(fullUrl);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("graffiti:canvas:rerender"));
            }
          };
          img.onerror = () => {
            pendingImages.delete(fullUrl);
          };
          img.src = fullUrl;
        }

        // Placeholder box while image is loading or if no src
        context.fillStyle = "rgba(39, 39, 42, 0.85)";
        if (typeof (context as any).roundRect === "function") {
          context.beginPath();
          (context as any).roundRect(0, 0, element.width, element.height, 8);
          context.fill();
        } else {
          context.fillRect(0, 0, element.width, element.height);
        }
        context.strokeStyle = strokeColor || "#71717a";
        context.setLineDash([6, 4]);
        if (typeof (context as any).roundRect === "function") {
          context.beginPath();
          (context as any).roundRect(0, 0, element.width, element.height, 8);
          context.stroke();
        } else {
          context.strokeRect(0, 0, element.width, element.height);
        }
        context.setLineDash([]);

        context.fillStyle = strokeColor || "#a1a1aa";
        context.font = "600 13px Inter, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        const label = (element.customData?.name as string) || element.title || "Image";
        context.fillText(label, element.width / 2, element.height / 2);
      }
      break;
    }
    case "video": {
      // Video Media Card
      context.fillStyle = "#18181b";
      if (typeof (context as any).roundRect === "function") {
        context.beginPath();
        (context as any).roundRect(0, 0, element.width, element.height, 10);
        context.fill();
      } else {
        context.fillRect(0, 0, element.width, element.height);
      }

      // Border
      context.strokeStyle = strokeColor || "#3f3f46";
      context.lineWidth = Math.max(1, element.strokeWidth || 1);
      if (typeof (context as any).roundRect === "function") {
        context.beginPath();
        (context as any).roundRect(0, 0, element.width, element.height, 10);
        context.stroke();
      } else {
        context.strokeRect(0, 0, element.width, element.height);
      }

      // Large Glassmorphic Play Button in Center
      const cx = element.width / 2;
      const cy = element.height / 2;
      const playRadius = Math.min(26, Math.min(element.width, element.height) / 4);

      context.beginPath();
      context.arc(cx, cy, playRadius, 0, Math.PI * 2);
      context.fillStyle = "rgba(139, 92, 246, 0.9)";
      context.fill();

      // Play Triangle
      context.beginPath();
      const triSize = playRadius * 0.55;
      context.moveTo(cx - triSize * 0.5 + 2, cy - triSize);
      context.lineTo(cx + triSize + 2, cy);
      context.lineTo(cx - triSize * 0.5 + 2, cy + triSize);
      context.closePath();
      context.fillStyle = "#ffffff";
      context.fill();

      // Bottom Bar with Title & Type badge
      context.fillStyle = "rgba(0, 0, 0, 0.65)";
      if (typeof (context as any).roundRect === "function") {
        context.beginPath();
        (context as any).roundRect(0, Math.max(0, element.height - 34), element.width, 34, [0, 0, 10, 10]);
        context.fill();
      } else {
        context.fillRect(0, Math.max(0, element.height - 34), element.width, 34);
      }

      context.fillStyle = "#f4f4f5";
      context.font = "600 12px Inter, sans-serif";
      context.textAlign = "left";
      context.textBaseline = "middle";
      const title = (element.customData?.name as string) || element.title || "Video Clip";
      const truncated = title.length > 25 ? title.slice(0, 22) + "..." : title;
      context.fillText(truncated, 12, element.height - 17);

      // "VIDEO" Badge
      context.fillStyle = "#a855f7";
      context.font = "bold 10px monospace";
      context.textAlign = "right";
      context.fillText("VIDEO", element.width - 12, element.height - 17);
      break;
    }
    case "audio": {
      // Audio Waveform Card
      context.fillStyle = "#18181b";
      if (typeof (context as any).roundRect === "function") {
        context.beginPath();
        (context as any).roundRect(0, 0, element.width, element.height, 12);
        context.fill();
      } else {
        context.fillRect(0, 0, element.width, element.height);
      }

      // Border
      context.strokeStyle = strokeColor || "#3f3f46";
      context.lineWidth = Math.max(1, element.strokeWidth || 1);
      if (typeof (context as any).roundRect === "function") {
        context.beginPath();
        (context as any).roundRect(0, 0, element.width, element.height, 12);
        context.stroke();
      } else {
        context.strokeRect(0, 0, element.width, element.height);
      }

      // Circular Play Button on Left
      const playX = 28;
      const playY = element.height / 2;
      const playR = Math.min(18, element.height / 3);

      context.beginPath();
      context.arc(playX, playY, playR, 0, Math.PI * 2);
      context.fillStyle = "#10b981";
      context.fill();

      // Play icon
      context.beginPath();
      const pSize = playR * 0.5;
      context.moveTo(playX - pSize * 0.5 + 1.5, playY - pSize);
      context.lineTo(playX + pSize + 1.5, playY);
      context.lineTo(playX - pSize * 0.5 + 1.5, playY + pSize);
      context.closePath();
      context.fillStyle = "#ffffff";
      context.fill();

      // Audio Waveform Bars
      const waveStartX = 58;
      const waveEndX = element.width - 60;
      const waveWidth = Math.max(10, waveEndX - waveStartX);
      const barCount = Math.max(8, Math.min(32, Math.floor(waveWidth / 7)));
      const barGap = waveWidth / barCount;
      const maxBarH = Math.min(36, element.height * 0.5);

      context.fillStyle = strokeColor || "#34d399";
      for (let i = 0; i < barCount; i++) {
        const factor = Math.sin((i / barCount) * Math.PI) * 0.8 + 0.2 + (Math.sin(i * 1.5) * 0.2);
        const bh = Math.max(4, maxBarH * factor);
        const bx = waveStartX + i * barGap;
        const by = playY - bh / 2;
        context.fillRect(bx, by, 3, bh);
      }

      // Audio Tag on Right
      context.fillStyle = "#10b981";
      context.font = "bold 10px monospace";
      context.textAlign = "right";
      context.textBaseline = "middle";
      context.fillText("AUDIO", element.width - 12, playY);

      // Title on Top
      if (element.height > 50) {
        context.fillStyle = "#a1a1aa";
        context.font = "500 11px Inter, sans-serif";
        context.textAlign = "left";
        const audioTitle = (element.customData?.name as string) || element.title || "Audio Track";
        context.fillText(audioTitle, 58, 14);
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
      if (element.customData?.isPolygon && element.points && element.points.length >= 3) {
        const polyPts = element.points.map((p) => [p.x, p.y] as [number, number]);
        rc.draw(generator.polygon(polyPts, options));
      } else if (element.points && element.points.length > 0) {
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

  // Draw element text using selected font family and size, clipped to shape interior.
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

    const isSticky = element.type === "sticky";
    const isDiamond = element.type === "diamond";
    const isEllipse = element.type === "ellipse";
    const isRect = element.type === "rectangle";
    const isShape = isRect || isEllipse || isDiamond;

    const align: TextAlign = element.textAlign || (isShape || isSticky ? "center" : "left");
    context.textAlign = align;

    const padding = isSticky ? 14 : isDiamond ? 14 : isEllipse ? 12 : isRect ? 8 : 2;
    // Tighter inset for diamond (inscribed square: width*0.5) and ellipse (inscribed rect: width*0.707).
    const maxWidth = isSticky
      ? Math.max(20, element.width - padding * 2)
      : isDiamond
      ? Math.max(20, element.width * 0.50)
      : isEllipse
      ? Math.max(20, element.width * 0.707)
      : isRect
      ? Math.max(20, element.width - padding * 2)
      : element.width && element.width > 30
      ? element.width
      : 999999;

    const lines = wrapTextLines(context, element.text, maxWidth);
    const lineHeight = fontSize * 1.35;
    const totalTextHeight = lines.length * lineHeight;

    const startY = isShape || isSticky
      ? Math.max(padding, (element.height - totalTextHeight) / 2)
      : padding;

    let startX = padding;
    if (align === "center") {
      startX = element.width / 2;
    } else if (align === "right") {
      startX = element.width - padding;
    }

    // Apply hard clip to shape interior so text never bleeds outside the outline.
    context.save();
    if (isDiamond) {
      context.beginPath();
      context.moveTo(element.width / 2, 0);
      context.lineTo(element.width, element.height / 2);
      context.lineTo(element.width / 2, element.height);
      context.lineTo(0, element.height / 2);
      context.closePath();
      context.clip();
    } else if (isEllipse) {
      context.beginPath();
      context.ellipse(
        element.width / 2,
        element.height / 2,
        element.width / 2,
        element.height / 2,
        0,
        0,
        Math.PI * 2,
      );
      context.closePath();
      context.clip();
    } else if (isSticky) {
      const r = 10;
      const w = element.width;
      const h = element.height;
      context.beginPath();
      context.moveTo(r, 0);
      context.lineTo(w - r, 0);
      context.quadraticCurveTo(w, 0, w, r);
      context.lineTo(w, h - r);
      context.quadraticCurveTo(w, h, w - r, h);
      context.lineTo(r, h);
      context.quadraticCurveTo(0, h, 0, h - r);
      context.lineTo(0, r);
      context.quadraticCurveTo(0, 0, r, 0);
      context.closePath();
      context.clip();
    }

    lines.forEach((line, i) => {
      context.fillText(line, startX, startY + i * lineHeight);
    });

    context.restore();
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
  if (!element) return;
  context.save();
  const rawOpacity = element.opacity ?? 100;
  const normalizedOpacity =
    rawOpacity > 0 && rawOpacity <= 1
      ? rawOpacity
      : Math.max(0.05, Math.min(1, rawOpacity / 100));
  context.globalAlpha = normalizedOpacity;

  if (element.type === "line" || element.type === "arrow") {
    context.translate(element.x ?? 0, element.y ?? 0);
    drawShapeOnCanvas(context, canvas, element, isDarkMode);
  } else {
    // 2D shapes & pen strokes: rotate around center!
    const width = element.width ?? 1;
    const height = element.height ?? 1;
    const cx = (element.x ?? 0) + width / 2;
    const cy = (element.y ?? 0) + height / 2;
    context.translate(cx, cy);
    if (element.angle) {
      context.rotate(element.angle);
    }
    context.translate(-width / 2, -height / 2);
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
  const selectionColor = theme === "dark" ? "#d4a359" : "#b47b18";
  const handleFill = theme === "dark" ? "#09090b" : "#ffffff";
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
        context.fillStyle = theme === "dark" ? "#d4a359" : "#b47b18";
        context.strokeStyle = selectionColor;
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

  // Handles rendering
  context.setLineDash([]);
  context.fillStyle = handleFill;
  context.strokeStyle = selectionColor;
  context.lineWidth = 1.5 / zoom;

  const isThinH = (h * zoom < 64 || h < 60) || (w > 80 && h < 70 && w > h * 2.5);
  const isThinW = (w * zoom < 64 || w < 60) || (h > 80 && w < 70 && h > w * 2.5);

  let localHandles: [number, number][];

  if (isThinH && !isThinW) {
    // Thin horizontal line / stroke: clean Left (w) and Right (e) handles (no stacked double-square buttons!)
    localHandles = [
      [0, h / 2], // w
      [w, h / 2], // e
    ];
  } else if (isThinW && !isThinH) {
    // Thin vertical line / stroke: clean Top (n) and Bottom (s) handles
    localHandles = [
      [w / 2, 0], // n
      [w / 2, h], // s
    ];
  } else if (isThinW && isThinH) {
    localHandles = [
      [0, 0],
      [w, h],
    ];
  } else {
    // 8 handles (4 corners + 4 sides)
    localHandles = [
      [0, 0], // nw
      [w, 0], // ne
      [w, h], // se
      [0, h], // sw
      [w / 2, 0], // n
      [w / 2, h], // s
      [0, h / 2], // w
      [w, h / 2], // e
    ];
  }

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

/**
 * Renders an animated active token pulse and halo around nodes during flowchart simulation.
 */
export function renderSimulationTokenHalo(
  context: CanvasRenderingContext2D,
  element: CanvasElement,
  zoom: number,
  _theme: "dark" | "light"
) {
  context.save();
  const haloColor = "#10b981"; // Vibrant Emerald Token Green
  const x = element.x;
  const y = element.y;
  const w = element.width;
  const h = element.height;

  context.strokeStyle = haloColor;
  context.lineWidth = 3 / zoom;
  context.shadowColor = haloColor;
  context.shadowBlur = 14;
  context.setLineDash([6 / zoom, 4 / zoom]);

  if (element.type === "ellipse") {
    context.beginPath();
    context.ellipse(x + w / 2, y + h / 2, w / 2 + 6 / zoom, h / 2 + 6 / zoom, 0, 0, Math.PI * 2);
    context.stroke();
  } else if (element.type === "diamond") {
    context.beginPath();
    context.moveTo(x + w / 2, y - 6 / zoom);
    context.lineTo(x + w + 6 / zoom, y + h / 2);
    context.lineTo(x + w / 2, y + h + 6 / zoom);
    context.lineTo(x - 6 / zoom, y + h / 2);
    context.closePath();
    context.stroke();
  } else {
    context.strokeRect(x - 6 / zoom, y - 6 / zoom, w + 12 / zoom, h + 12 / zoom);
  }

  // Draw an active token indicator circle on top right
  const badgeR = 6 / zoom;
  context.beginPath();
  context.arc(x + w + 2 / zoom, y - 2 / zoom, badgeR, 0, Math.PI * 2);
  context.fillStyle = haloColor;
  context.shadowBlur = 8;
  context.fill();

  context.restore();
}
