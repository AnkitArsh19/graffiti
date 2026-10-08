import React, { useEffect, useRef, useState, useCallback } from "react";
import { Map as MapIcon, X, Eye } from "lucide-react";
import type { CanvasElement, Viewport, DockPosition } from "../types";
import { applyDarkModeFilter } from "../lib/colors";

interface MinimapProps {
  elements: CanvasElement[];
  viewport: Viewport;
  onPanTo: (worldX: number, worldY: number) => void;
  theme?: "dark" | "light";
  isOpen: boolean;
  onToggle: () => void;
  dockPosition?: DockPosition;
}

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 125;
const PADDING = 200;

export function drawMinimapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  scale: number,
  fontSizeName?: string,
  textAlign?: string,
  isPureText: boolean = false,
) {
  if (!text || !text.trim()) return;

  const rawSize =
    fontSizeName === "small"
      ? 14
      : fontSizeName === "large"
      ? 24
      : fontSizeName === "xlarge"
      ? 32
      : 18;

  // Legible scaled font size between 7px and 12px
  const fontSize = Math.max(7, Math.min(12, Math.round(rawSize * scale * 2)));

  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = "top";

  const lines = text.split("\n");
  const lineHeight = fontSize * 1.25;
  const maxLines = Math.max(1, Math.floor(Math.max(h, fontSize * 1.5) / lineHeight));
  const visibleLines = lines.slice(0, maxLines);

  visibleLines.forEach((line, index) => {
    const textY = isPureText
      ? y + index * lineHeight
      : y + Math.max(1, (h - visibleLines.length * lineHeight) / 2) + index * lineHeight;

    let textX = x + 2;
    if (textAlign === "center") {
      ctx.textAlign = "center";
      textX = x + w / 2;
    } else if (textAlign === "right") {
      ctx.textAlign = "right";
      textX = x + w - 2;
    } else {
      ctx.textAlign = "left";
    }

    let displayLine = line;
    const maxTextWidth = Math.max(w, 80) + 30;
    if (ctx.measureText(displayLine).width > maxTextWidth) {
      while (displayLine.length > 3 && ctx.measureText(displayLine + "...").width > maxTextWidth) {
        displayLine = displayLine.slice(0, -1);
      }
      displayLine += "...";
    }

    ctx.fillText(displayLine, textX, textY);
  });

  ctx.restore();
}

export function Minimap({
  elements,
  viewport,
  onPanTo,
  theme = "dark",
  isOpen,
  onToggle,
  dockPosition,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Compute scene bounds
  const getBounds = useCallback(() => {
    if (elements.length === 0) {
      return { minX: -800, minY: -500, maxX: 800, maxY: 500 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    elements.forEach((el) => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    });

    return {
      minX: minX - PADDING,
      minY: minY - PADDING,
      maxX: maxX + PADDING,
      maxY: maxY + PADDING,
    };
  }, [elements]);

  // Render minimap canvas
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bounds = getBounds();
    const boundsWidth = Math.max(100, bounds.maxX - bounds.minX);
    const boundsHeight = Math.max(100, bounds.maxY - bounds.minY);

    const scaleX = MINIMAP_WIDTH / boundsWidth;
    const scaleY = MINIMAP_HEIGHT / boundsHeight;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (MINIMAP_WIDTH - boundsWidth * scale) / 2;
    const offsetY = (MINIMAP_HEIGHT - boundsHeight * scale) / 2;

    const isDark = theme === "dark";
    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Draw canvas background
    ctx.fillStyle = isDark ? "#09090b" : "#ffffff";
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Draw elements with true shapes, colors, lines, and readable text
    elements.forEach((el) => {
      const x = offsetX + (el.x - bounds.minX) * scale;
      const y = offsetY + (el.y - bounds.minY) * scale;
      const w = Math.max(2, el.width * scale);
      const h = Math.max(2, el.height * scale);

      const strokeColor = applyDarkModeFilter(
        el.strokeColor || (isDark ? "#ffffff" : "#18181b"),
        isDark,
        false
      );
      const hasBg = el.backgroundColor && el.backgroundColor !== "transparent";
      const bgColor = hasBg
        ? applyDarkModeFilter(el.backgroundColor, isDark, true)
        : "transparent";
      const alpha = Math.max(0.2, (el.opacity ?? 100) / 100);

      ctx.save();
      ctx.globalAlpha = alpha;

      if (el.angle && el.type !== "line" && el.type !== "arrow" && el.type !== "pen") {
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(el.angle);
        ctx.translate(-(x + w / 2), -(y + h / 2));
      }

      // 1. Pen / Freehand strokes
      if (el.type === "pen") {
        if (el.points && el.points.length > 0) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = Math.max(1, (el.strokeWidth || 2) * scale * 1.5);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          el.points.forEach((pt, i) => {
            const px = offsetX + (el.x + pt.x - bounds.minX) * scale;
            const py = offsetY + (el.y + pt.y - bounds.minY) * scale;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();
        }
        ctx.restore();
        return;
      }

      // 2. Lines & Arrows
      if (el.type === "line" || el.type === "arrow") {
        if (el.points && el.points.length >= 2) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = Math.max(1, (el.strokeWidth || 2) * scale * 1.5);
          ctx.beginPath();
          const p0 = el.points[0];
          const p1 = el.points[el.points.length - 1];
          const sx = offsetX + (el.x + p0.x - bounds.minX) * scale;
          const sy = offsetY + (el.y + p0.y - bounds.minY) * scale;
          const ex = offsetX + (el.x + p1.x - bounds.minX) * scale;
          const ey = offsetY + (el.y + p1.y - bounds.minY) * scale;
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          if (el.type === "arrow") {
            const angle = Math.atan2(ey - sy, ex - sx);
            const headLen = Math.max(4, 8 * scale);
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
          }
        }
        ctx.restore();
        return;
      }

      // 3. Frames
      if (el.type === "frame") {
        ctx.setLineDash([3, 2]);
        ctx.strokeStyle = isDark ? "rgba(212, 163, 89, 0.7)" : "rgba(180, 123, 24, 0.7)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
        if (el.title) {
          ctx.fillStyle = isDark ? "#d4a359" : "#b47b18";
          ctx.font = "bold 8px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText(el.title, x + 2, y + 8);
        }
        ctx.restore();
        return;
      }

      // 4. Pure Text Elements
      if (el.type === "text") {
        if (hasBg) {
          ctx.fillStyle = bgColor;
          ctx.fillRect(x, y, w, h);
        }
        if (el.text) {
          drawMinimapText(ctx, el.text, x, y, w, h, strokeColor, scale, el.fontSize, el.textAlign, true);
        }
        ctx.restore();
        return;
      }

      // 5. Sticky Notes
      if (el.type === "sticky") {
        const stickyBg = hasBg
          ? bgColor
          : isDark
          ? "rgba(212, 163, 89, 0.25)"
          : "rgba(254, 240, 138, 0.85)";
        ctx.fillStyle = stickyBg;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = isDark ? "#d4a359" : "#b47b18";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        if (el.text) {
          drawMinimapText(ctx, el.text, x, y, w, h, strokeColor, scale, el.fontSize, el.textAlign, false);
        }
        ctx.restore();
        return;
      }

      // 6. Ellipses
      if (el.type === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
        if (hasBg) {
          ctx.fillStyle = bgColor;
          ctx.fill();
        } else {
          ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)";
          ctx.fill();
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = Math.max(1, (el.strokeWidth || 1) * scale);
        ctx.stroke();
        if (el.text) {
          drawMinimapText(ctx, el.text, x, y, w, h, strokeColor, scale, el.fontSize, el.textAlign, false);
        }
        ctx.restore();
        return;
      }

      // 7. Diamonds
      if (el.type === "diamond") {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h / 2);
        ctx.lineTo(x + w / 2, y + h);
        ctx.lineTo(x, y + h / 2);
        ctx.closePath();
        if (hasBg) {
          ctx.fillStyle = bgColor;
          ctx.fill();
        } else {
          ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)";
          ctx.fill();
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = Math.max(1, (el.strokeWidth || 1) * scale);
        ctx.stroke();
        if (el.text) {
          drawMinimapText(ctx, el.text, x, y, w, h, strokeColor, scale, el.fontSize, el.textAlign, false);
        }
        ctx.restore();
        return;
      }

      // 8. Rectangles, Cards, Code, Tables, Devices
      if (hasBg) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, w, h);
      } else {
        ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)";
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = Math.max(1, (el.strokeWidth || 1) * scale);
      ctx.strokeRect(x, y, w, h);

      if (el.type === "card" || el.type === "code" || el.type === "table") {
        const title = el.title || (el.type === "code" ? el.language : undefined);
        if (title) {
          ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
          ctx.fillRect(x, y, w, Math.min(h, 9));
          ctx.fillStyle = strokeColor;
          ctx.font = "bold 6px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText(title.slice(0, 16), x + 2, y + 7);
        }
      }

      if (el.text) {
        drawMinimapText(ctx, el.text, x, y, w, h, strokeColor, scale, el.fontSize, el.textAlign, false);
      }

      ctx.restore();
    });

    // Draw viewport frustum (visible screen area)
    const screenWidth = typeof window !== "undefined" ? window.innerWidth : 1600;
    const screenHeight = typeof window !== "undefined" ? window.innerHeight : 900;
    const vpWorldX = -viewport.scrollX;
    const vpWorldY = -viewport.scrollY;
    const vpWorldW = screenWidth / viewport.zoom;
    const vpWorldH = screenHeight / viewport.zoom;

    const vpX = offsetX + (vpWorldX - bounds.minX) * scale;
    const vpY = offsetY + (vpWorldY - bounds.minY) * scale;
    const vpW = Math.max(6, vpWorldW * scale);
    const vpH = Math.max(6, vpWorldH * scale);

    ctx.fillStyle = isDark ? "rgba(212, 163, 89, 0.15)" : "rgba(180, 123, 24, 0.15)";
    ctx.fillRect(vpX, vpY, vpW, vpH);
    ctx.strokeStyle = isDark ? "#d4a359" : "#b47b18";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vpX, vpY, vpW, vpH);
  }, [elements, viewport, theme, isOpen, getBounds]);

  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const bounds = getBounds();
    const boundsWidth = Math.max(100, bounds.maxX - bounds.minX);
    const boundsHeight = Math.max(100, bounds.maxY - bounds.minY);
    const scale = Math.min(MINIMAP_WIDTH / boundsWidth, MINIMAP_HEIGHT / boundsHeight);

    const offsetX = (MINIMAP_WIDTH - boundsWidth * scale) / 2;
    const offsetY = (MINIMAP_HEIGHT - boundsHeight * scale) / 2;

    const worldX = bounds.minX + (clickX - offsetX) / scale;
    const worldY = bounds.minY + (clickY - offsetY) / scale;

    onPanTo(worldX, worldY);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        className="minimap-toggle-btn"
        title="Toggle Minimap (Alt+M)"
        aria-label="Toggle Minimap"
        onClick={onToggle}
        style={{
          position: "fixed",
          bottom: 58,
          right: dockPosition === "right" ? 78 : 20,
          zIndex: 20,
          width: "auto",
          minWidth: 92,
          height: 32,
          background: "var(--bg-panel, #121215)",
          border: "1px solid var(--border-subtle, #27272a)",
          borderRadius: 8,
          boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
          color: "var(--text-primary, #f5f5f5)",
          padding: "0 12px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: "nowrap",
          transition: "right 240ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 150ms ease",
        }}
      >
        <MapIcon size={14} />
        <span>Minimap</span>
      </button>
    );
  }

  return (
    <div
      className="minimap-container"
      style={{
        position: "fixed",
        bottom: 58,
        right: dockPosition === "right" ? 78 : 20,
        zIndex: 20,
        background: "var(--bg-panel, #121215)",
        border: "1px solid var(--border-subtle, #27272a)",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
        transition: "right 240ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid var(--border-subtle, #27272a)",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted, #a1a1aa)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Eye size={12} style={{ color: "var(--accent-primary, #d4a359)" }} />
          <span>Overview</span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Close Minimap"
          style={{
            background: "transparent",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            padding: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={12} />
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        style={{ display: "block", cursor: "crosshair" }}
        onPointerDown={(e) => {
          setIsDragging(true);
          handlePointer(e);
        }}
        onPointerMove={(e) => {
          if (isDragging) handlePointer(e);
        }}
        onPointerUp={() => setIsDragging(false)}
        onPointerLeave={() => setIsDragging(false)}
      />
    </div>
  );
}