import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Pipette } from "lucide-react";
import {
  COLOR_GRID_FAMILIES,
  GRAFFITI_COLOR_PALETTE,
  isLightColor,
  type ColorFamily,
} from "../lib/colors";

const STORAGE_CUSTOM_COLORS = "graffiti:custom_colors:v1";
const DEFAULT_TOP_PICKS = ["#087f5b", "#182a4d", "#c92a2a", "#0c8599", "#ffffff"];

function loadRecentColors(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_CUSTOM_COLORS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 5);
      }
    }
  } catch {}
  return DEFAULT_TOP_PICKS;
}

function saveRecentColor(color: string) {
  if (!color || color === "transparent") return;
  try {
    const current = loadRecentColors().filter((c) => c.toLowerCase() !== color.toLowerCase());
    const next = [color, ...current].slice(0, 5);
    localStorage.setItem(STORAGE_CUSTOM_COLORS, JSON.stringify(next));
  } catch {}
}

function pinColorToSlot(slotIndex: number, colorToPin: string): string[] {
  if (!colorToPin || colorToPin === "transparent") return loadRecentColors();
  try {
    const current = [...loadRecentColors()];
    while (current.length < 5) {
      current.push(DEFAULT_TOP_PICKS[current.length] || "#ffffff");
    }
    current[slotIndex] = colorToPin;
    localStorage.setItem(STORAGE_CUSTOM_COLORS, JSON.stringify(current));
    return current;
  } catch {
    return loadRecentColors();
  }
}

/**
 * Finds which color family and shade index best matches the current hex color.
 */
function findMatchingFamilyAndShade(hex: string): { family: ColorFamily; shadeIndex: number } {
  if (!hex || hex === "transparent") {
    return { family: "transparent", shadeIndex: 0 };
  }
  const cleanHex = hex.toLowerCase().trim();

  // White and near-white match white family index 0
  if (
    cleanHex === "#ffffff" ||
    cleanHex === "#f8f9fa" ||
    cleanHex === "#f5f5f5" ||
    cleanHex === "#f0f6fc"
  ) {
    return { family: "white", shadeIndex: 0 };
  }

  // Black and dark tones match black family index 4
  if (cleanHex === "#1e1e1e" || cleanHex === "#000000" || cleanHex === "#111827") {
    return { family: "black", shadeIndex: 4 };
  }

  for (const [famName, shades] of Object.entries(GRAFFITI_COLOR_PALETTE)) {
    const idx = (shades as readonly string[]).findIndex((s) => s.toLowerCase() === cleanHex);
    if (idx !== -1) {
      return { family: famName as ColorFamily, shadeIndex: idx };
    }
  }

  return { family: "red", shadeIndex: 1 };
}

interface ColorPickerPopoverProps {
  type: "stroke" | "background";
  color: string;
  theme?: "dark" | "light";
  anchorRect?: DOMRect;
  onColorChange: (newColor: string) => void;
  onClose: () => void;
}

export function ColorPickerPopover({
  type,
  color,
  theme = "dark",
  anchorRect,
  onColorChange,
  onClose,
}: ColorPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const initialMatch = findMatchingFamilyAndShade(color);
  const [selectedFamily, setSelectedFamily] = useState<ColorFamily>(initialMatch.family);
  const [hexInput, setHexInput] = useState<string>(
    color && color !== "transparent" ? color.replace("#", "") : "",
  );
  const [recentColors, setRecentColors] = useState<string[]>(() => loadRecentColors());

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Keep hexInput synced with incoming color
  useEffect(() => {
    if (color && color !== "transparent") {
      setHexInput(color.replace("#", ""));
      const match = findMatchingFamilyAndShade(color);
      setSelectedFamily(match.family);
    }
  }, [color]);

  const handleSelectColor = (newColor: string) => {
    onColorChange(newColor);
    saveRecentColor(newColor);
    setRecentColors(loadRecentColors());
    if (newColor && newColor !== "transparent") {
      setHexInput(newColor.replace("#", ""));
      const match = findMatchingFamilyAndShade(newColor);
      setSelectedFamily(match.family);
    }
  };

  const handleFamilyClick = (family: ColorFamily) => {
    setSelectedFamily(family);
    const shades = GRAFFITI_COLOR_PALETTE[family];
    // White and transparent: always default to index 0 (#ffffff or transparent)
    // Background: default to shade 1 (light pastel tint)
    // Stroke: default to shade 4 (deep saturated tone)
    const defaultIndex =
      family === "white" || family === "transparent"
        ? 0
        : type === "background"
        ? 1
        : 4;
    const chosenColor = shades[defaultIndex] || shades[0];
    handleSelectColor(chosenColor);
  };

  // Keyboard shortcut listener for family hotkeys & numbers
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Check numbers 1-5
      if (["1", "2", "3", "4", "5"].includes(e.key)) {
        e.preventDefault();
        const num = parseInt(e.key, 10) - 1;
        if (e.shiftKey) {
          // Shift + 1..5: select shade
          const famShades =
            GRAFFITI_COLOR_PALETTE[selectedFamily] || GRAFFITI_COLOR_PALETTE.red;
          const chosenShade = famShades[num];
          if (chosenShade) handleSelectColor(chosenShade);
        } else {
          // 1..5: select top pick
          const chosenTopPick = recentColors[num] || DEFAULT_TOP_PICKS[num];
          if (chosenTopPick) handleSelectColor(chosenTopPick);
        }
        return;
      }

      // Check hotkeys for families (q, w, e, r, t, etc.)
      const pressedKey = e.key.toLowerCase();
      const famMatch = COLOR_GRID_FAMILIES.find((f) => f.hotkey === pressedKey);
      if (famMatch) {
        e.preventDefault();
        handleFamilyClick(famMatch.id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFamily, recentColors, onClose]);

  const handleEyedropper = async () => {
    if ("EyeDropper" in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          handleSelectColor(result.sRGBHex);
        }
      } catch {
        // Fall back to native color picker input
        colorInputRef.current?.click();
      }
    } else {
      colorInputRef.current?.click();
    }
  };

  const popoverWidth = 256;
  const popoverHeight = 350;

  let fixedLeft = 14;
  let fixedTop = 70;

  if (anchorRect) {
    fixedLeft = anchorRect.right + 10;
    if (fixedLeft + popoverWidth > window.innerWidth - 12) {
      fixedLeft = Math.max(12, anchorRect.left - popoverWidth - 10);
    }
    fixedTop = Math.max(12, Math.min(window.innerHeight - popoverHeight - 12, anchorRect.top - 20));
  }

  const shades =
    GRAFFITI_COLOR_PALETTE[selectedFamily] || GRAFFITI_COLOR_PALETTE.red;

  const popoverContent = (
    <div
      className="color-picker-popover"
      ref={popoverRef}
      role="dialog"
      aria-label="Color Picker"
      style={
        anchorRect
          ? {
              position: "fixed",
              left: `${fixedLeft}px`,
              top: `${fixedTop}px`,
              zIndex: 99999,
            }
          : undefined
      }
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Most Used Custom Colors */}
      <div className="picker-section">
        <div className="picker-section-title">Most Used Custom Colors</div>
        <div className="top-picks-row">
          {Array.from({ length: 5 }).map((_, i) => {
            const slotColor = recentColors[i] || DEFAULT_TOP_PICKS[i];
            const isSlotActive =
              color && color.toLowerCase() === slotColor.toLowerCase();
            const isLight = isLightColor(slotColor);

            return (
              <button
                key={i}
                type="button"
                className="top-pick-btn"
                data-active={isSlotActive}
                style={{ "--slot-color": slotColor } as CSSProperties}
                title={`Top pick ${i + 1}: ${slotColor} (Drag any shade here to pin)`}
                onClick={() => handleSelectColor(slotColor)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedColor = e.dataTransfer.getData("text/plain");
                  if (droppedColor) {
                    const next = pinColorToSlot(i, droppedColor);
                    setRecentColors(next);
                  }
                }}
              >
                <span
                  className="slot-badge"
                  style={{
                    color: isLight ? "#1e1e1e" : "#ffffff",
                    textShadow: isLight ? "none" : "0 1px 2px rgba(0, 0, 0, 0.8)",
                  }}
                >
                  {i + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Colors Grid (15 families: 5 columns x 3 rows) */}
      <div className="picker-section">
        <div className="picker-section-title">Colors</div>
        <div className="colors-palette-grid">
          {COLOR_GRID_FAMILIES.map(({ id, label, hotkey }) => {
            const famShades = GRAFFITI_COLOR_PALETTE[id];
            const displayColor =
              id === "transparent"
                ? "transparent"
                : id === "white"
                ? "#ffffff"
                : type === "background"
                ? famShades[1]
                : famShades[4];

            const isFamilySelected = selectedFamily === id;
            const isLight = isLightColor(displayColor);

            return (
              <button
                key={id}
                type="button"
                draggable={id !== "transparent"}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", displayColor);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className={`palette-family-btn ${
                  id === "transparent" ? "transparent-cell" : ""
                }`}
                data-selected={isFamilySelected}
                style={{ "--family-color": displayColor } as CSSProperties}
                title={`${label} (${hotkey})`}
                onClick={() => handleFamilyClick(id)}
              >
                <span
                  className="hotkey-hint"
                  style={{
                    color: isLight ? "#1e1e1e" : "#ffffff",
                    textShadow: isLight ? "none" : "0 1px 2px rgba(0, 0, 0, 0.8)",
                  }}
                >
                  {hotkey}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Shades of Selected Color Family */}
      <div className="picker-section">
        <div className="picker-section-title">Shades</div>
        <div className="shades-row">
          {(shades as readonly string[]).map((shadeHex, index) => {
            const isShadeActive =
              color && color.toLowerCase() === shadeHex.toLowerCase();
            const isLight = isLightColor(shadeHex);

            return (
              <button
                key={index}
                type="button"
                draggable={shadeHex !== "transparent"}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", shadeHex);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className={`shade-btn ${
                  shadeHex === "transparent" ? "transparent-cell" : ""
                }`}
                data-active={isShadeActive}
                style={{ "--shade-color": shadeHex } as CSSProperties}
                title={`Shade ${index + 1}: ${shadeHex} (Drag to pin)`}
                onClick={() => handleSelectColor(shadeHex)}
              >
                <span
                  className="shade-badge"
                  style={{
                    color: isLight ? "#1e1e1e" : "#ffffff",
                    textShadow: isLight ? "none" : "0 1px 2px rgba(0, 0, 0, 0.8)",
                  }}
                >{`⇧${index + 1}`}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Hex Code Input & Eyedropper */}
      <div className="picker-section">
        <div className="picker-section-title">Hex Code</div>
        <div className="hex-input-row">
          <div className="hex-input-wrapper">
            <span className="hex-hash">#</span>
            <input
              type="text"
              className="hex-text-input"
              value={hexInput}
              placeholder="e.g. ffc9c9"
              maxLength={7}
              onFocus={(e) => {
                const el = e.currentTarget;
                requestAnimationFrame(() => el.select());
              }}
              onClick={(e) => e.currentTarget.select()}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9a-fA-F]/g, "");
                setHexInput(val);
                if (val.length === 3 || val.length === 6) {
                  const fullHex = `#${val}`;
                  onColorChange(fullHex);
                  saveRecentColor(fullHex);
                  setRecentColors(loadRecentColors());
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (hexInput.length === 3 || hexInput.length === 6) {
                    handleSelectColor(`#${hexInput}`);
                  }
                }
              }}
            />
          </div>

          {/* Eyedropper / Color Wheel Trigger */}
          <button
            type="button"
            className="eyedropper-btn"
            title="Pick screen color or open color spectrum"
            onClick={handleEyedropper}
          >
            <Pipette size={15} />
            <input
              ref={colorInputRef}
              type="color"
              className="hidden-native-color-input"
              value={color && color.startsWith("#") ? color.slice(0, 7) : "#1e1e1e"}
              onChange={(e) => handleSelectColor(e.target.value)}
            />
          </button>
        </div>
      </div>

      {/* 5. Footer Tip */}
      <div className="picker-tip">
        Tip: drag any color onto your top picks to pin it
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(popoverContent, document.body)
    : popoverContent;
}
