import tinycolor from "tinycolor2";

// Cache to avoid recalculating dark mode color transformations
const DARK_MODE_COLORS_CACHE = new Map<string, string>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function cssHueRotate(
  red: number,
  green: number,
  blue: number,
  degrees: number,
): { r: number; g: number; b: number } {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;

  const a = degreesToRadians(degrees);
  const c = Math.cos(a);
  const s = Math.sin(a);

  // Rotation matrix for CSS hue-rotate
  const matrix = [
    0.213 + c * 0.787 - s * 0.213,
    0.715 - c * 0.715 - s * 0.715,
    0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143,
    0.715 + c * 0.285 + s * 0.14,
    0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787,
    0.715 - c * 0.715 + s * 0.715,
    0.072 + c * 0.928 + s * 0.072,
  ];

  const newR = r * matrix[0] + g * matrix[1] + b * matrix[2];
  const newG = r * matrix[3] + g * matrix[4] + b * matrix[5];
  const newB = r * matrix[6] + g * matrix[7] + b * matrix[8];

  return {
    r: Math.round(clamp(newR, 0, 1) * 255),
    g: Math.round(clamp(newG, 0, 1) * 255),
    b: Math.round(clamp(newB, 0, 1) * 255),
  };
}

function cssInvert(
  r: number,
  g: number,
  b: number,
  percent: number,
): { r: number; g: number; b: number } {
  const p = clamp(percent, 0, 100) / 100;

  const invertComponent = (color: number): number => {
    const inverted = color * (1 - p) + (255 - color) * p;
    return Math.round(clamp(inverted, 0, 255));
  };

  return {
    r: invertComponent(r),
    g: invertComponent(g),
    b: invertComponent(b),
  };
}

export const rgbToHex = (r: number, g: number, b: number, a?: number): string => {
  const hex6 = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  if (a !== undefined && a < 1) {
    const alphaHex = Math.round(a * 255).toString(16).padStart(2, "0");
    return `${hex6}${alphaHex}`;
  }
  return hex6;
};

export function isColorDark(color: string): boolean {
  if (!color || color === "transparent") return false;
  const tc = tinycolor(color);
  return tc.isValid() && tc.isDark();
}

export function isLightColor(color: string): boolean {
  if (!color || color === "transparent") return true;
  const tc = tinycolor(color);
  return !tc.isValid() || tc.getBrightness() > 165;
}

// White and off-white hex values that must stay crisp white ink in dark mode
// and normalize to black ink on white canvas in light mode
const WHITE_HEX_SET = new Set([
  "#ffffff",
  "#f8f9fa",
  "#f1f3f5",
  "#e9ecef",
  "#dee2e6",
  "#f5f5f5",
  "#f0f6fc",
  "#fafafa",
]);

// Black and dark-ink hex values that invert to bright white in dark mode
const BLACK_HEX_SET = new Set([
  "#000000",
  "#1e1e1e",
  "#111827",
  "#121212",
  "#212529",
  "#343a40",
]);

/**
 * Studio dark mode color filter.
 * Resolves the white-ink glitch:
 * - When in Dark Mode (enable = true):
 *   - Dark inks (#1e1e1e, #000000) invert to pure crisp white ink (#ffffff).
 *   - Pure white and all white family shades (#ffffff, #f8f9fa, #dee2e6, etc.)
 *     strictly remain crisp bright white (#ffffff) for ink, NEVER inverting to dark grey or black!
 *   - Shape background fills with white invert to dark surface (#1e1e1e).
 * - When in Light Mode (enable = false):
 *   - For stroke ink: white or off-white ink normalizes to dark ink (#1e1e1e) so it is
 *     clearly visible against the white canvas and never vanishes or turns to a pale grey artifact.
 *   - For background: white shapes remain pure white (#ffffff).
 */
export function applyDarkModeFilter(
  color: string,
  enable = true,
  isBackground = false,
): string {
  if (!color || color === "transparent") {
    return color;
  }

  const lower = color.toLowerCase().trim();

  // In light mode:
  if (!enable) {
    // If it's a stroke (ink / text / line), white ink on white canvas is invisible.
    // Normalize white or near-white ink to primary dark ink #1e1e1e.
    if (!isBackground && WHITE_HEX_SET.has(lower)) {
      return "#1e1e1e";
    }
    return color;
  }

  // In dark mode:
  // 1. Black/dark inks become crisp bright white ink
  if (BLACK_HEX_SET.has(lower)) {
    return isBackground ? "#1e1e1e" : "#ffffff";
  }

  // 2. White and near-white tones:
  // For stroke (ink): MUST stay crisp pure white (#ffffff), NEVER become black or dark grey!
  if (WHITE_HEX_SET.has(lower)) {
    return isBackground ? "#1e1e1e" : "#ffffff";
  }

  const cacheKey = `${color}:${isBackground ? "bg" : "stroke"}`;
  const cached = DARK_MODE_COLORS_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const tc = tinycolor(color);
  if (!tc.isValid()) {
    return color;
  }

  const alpha = tc.getAlpha();
  const rgb = tc.toRgb();

  // Filter pipeline: invert(93%) hue-rotate(180deg)
  const inverted = cssInvert(rgb.r, rgb.g, rgb.b, 93);
  const rotated = cssHueRotate(inverted.r, inverted.g, inverted.b, 180);

  const result = rgbToHex(rotated.r, rotated.g, rotated.b, alpha);
  DARK_MODE_COLORS_CACHE.set(cacheKey, result);
  return result;
}

export const GRAFFITI_COLOR_PALETTE = {
  transparent: ["transparent", "transparent", "transparent", "transparent", "transparent"] as const,
  white: ["#ffffff", "#f8f9fa", "#f1f3f5", "#e9ecef", "#dee2e6"] as const,
  gray: ["#f8f9fa", "#e9ecef", "#ced4da", "#868e96", "#343a40"] as const,
  black: ["#f8f9fa", "#dee2e6", "#868e96", "#343a40", "#1e1e1e"] as const,
  bronze: ["#f8f1ee", "#eaddd7", "#d2bab0", "#a18072", "#846358"] as const,
  cyan: ["#e3fafc", "#99e9f2", "#3bc9db", "#15aabf", "#0c8599"] as const,
  blue: ["#e7f5ff", "#a5d8ff", "#4dabf7", "#228be6", "#1971c2"] as const,
  violet: ["#f3f0ff", "#d0bfff", "#9775fa", "#7950f2", "#6741d9"] as const,
  grape: ["#f8f0fc", "#eebefa", "#da77f2", "#be4bdb", "#9c36b5"] as const,
  pink: ["#fff0f6", "#fcc2d7", "#f783ac", "#e64980", "#c2255c"] as const,
  green: ["#ebfbee", "#b2f2bb", "#69db7c", "#40c057", "#2f9e44"] as const,
  teal: ["#e6fcf5", "#96f2d7", "#38d9a9", "#12b886", "#099268"] as const,
  yellow: ["#fff9db", "#ffec99", "#ffd43b", "#fab005", "#f08c00"] as const,
  orange: ["#fff4e6", "#ffd8a8", "#ffa94d", "#fd7e14", "#e8590c"] as const,
  red: ["#fff5f5", "#ffc9c9", "#ff8787", "#fa5252", "#e03131"] as const,
} as const;

export type ColorFamily = keyof typeof GRAFFITI_COLOR_PALETTE;

export const COLOR_GRID_FAMILIES: Array<{ id: ColorFamily; label: string; hotkey: string }> = [
  { id: "transparent", label: "Transparent", hotkey: "q" },
  { id: "white", label: "White", hotkey: "w" },
  { id: "gray", label: "Gray", hotkey: "e" },
  { id: "black", label: "Black", hotkey: "r" },
  { id: "bronze", label: "Bronze", hotkey: "t" },
  { id: "cyan", label: "Cyan", hotkey: "a" },
  { id: "blue", label: "Blue", hotkey: "s" },
  { id: "violet", label: "Violet", hotkey: "d" },
  { id: "grape", label: "Grape", hotkey: "f" },
  { id: "pink", label: "Pink", hotkey: "g" },
  { id: "green", label: "Green", hotkey: "z" },
  { id: "teal", label: "Teal", hotkey: "x" },
  { id: "yellow", label: "Yellow", hotkey: "c" },
  { id: "orange", label: "Orange", hotkey: "v" },
  { id: "red", label: "Red", hotkey: "b" },
];

export const COLOR_PALETTE = {
  black: "#1e1e1e",
  white: "#ffffff",
  transparent: "transparent",
  gray: ["#f8f9fa", "#f1f3f5", "#e9ecef", "#dee2e6", "#ced4da", "#868e96", "#495057", "#343a40", "#212529"],
  red: ["#fff5f5", "#ffe3e3", "#ffc9c9", "#ffa8a8", "#ff8787", "#ff6b6b", "#fa5252", "#f03e3e", "#e03131", "#c92a2a"],
  pink: ["#fff0f6", "#ffdeeb", "#fcc2d7", "#faa2c1", "#f783ac", "#f06595", "#e64980", "#d6336c", "#c2255c", "#a61e4d"],
  grape: ["#f8f0fc", "#f3d9fa", "#eebefa", "#e599f7", "#da77f2", "#cc5de8", "#be4bdb", "#ae3ec9", "#9c36b5", "#862e9c"],
  violet: ["#f3f0ff", "#e5dbff", "#d0bfff", "#b197fc", "#9775fa", "#845ef7", "#7950f2", "#7048e8", "#6741d9", "#5f3dc4"],
  blue: ["#e7f5ff", "#d0ebff", "#a5d8ff", "#74c0fc", "#4dabf7", "#339af0", "#228be6", "#1c7ed6", "#1971c2", "#1864ab"],
  cyan: ["#e3fafc", "#c5f6fa", "#99e9f2", "#66d9e8", "#3bc9db", "#22b8cf", "#15aabf", "#1098ad", "#0c8599", "#0b7285"],
  teal: ["#e6fcf5", "#c3fae8", "#96f2d7", "#63e6be", "#38d9a9", "#20c997", "#12b886", "#0ca678", "#099268", "#087f5b"],
  green: ["#ebfbee", "#d3f9d8", "#b2f2bb", "#8ce99a", "#69db7c", "#51cf66", "#40c057", "#37b24d", "#2f9e44", "#2b8a3e"],
  yellow: ["#fff9db", "#fff3bf", "#ffec99", "#ffe066", "#ffd43b", "#fcc419", "#fab005", "#f59f00", "#f08c00", "#e67700"],
  orange: ["#fff4e6", "#ffe8cc", "#ffd8a8", "#ffc078", "#ffa94d", "#ff922b", "#fd7e14", "#f76707", "#e8590c", "#d9480f"],
} as const;
