export type ToolId =
  | "select"
  | "hand"
  | "pen"
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "text"
  | "sticky"
  | "eraser";

export type ElementType = Exclude<ToolId, "select" | "hand" | "eraser">;
export type PaperTemplate = "blank" | "ruled" | "grid" | "dotted" | "cornell";

export type DockPosition = "top" | "bottom" | "left" | "right" | "floating";
export type ThemeMode = "dark" | "light" | "system";
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type FillStyle = "solid" | "semi" | "hachure" | "cross-hatch" | "transparent";
export type FontSize = "small" | "medium" | "large" | "xlarge";
export type FontFamily = "rough" | "clean" | "mono";
export type TextAlign = "left" | "center" | "right";
export type Roundness = "sharp" | "round";
export type ArrowType = "straight" | "curved" | "elbow";
export type Arrowhead = "none" | "arrow" | "triangle" | "bar" | "circle";

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface PointBinding {
  elementId: string;
  pointId: string; // e.g. "top", "right", "bottom", "left", "start", "mid", "end"
}

export interface CanvasElement {
  id: string;
  pageId: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  points?: Point[];
  angle?: number; // rotation in radians
  text?: string;
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  strokeStyle?: StrokeStyle;
  fillStyle?: FillStyle;
  roughness: number;
  roundness?: Roundness;
  arrowType?: ArrowType;
  startArrowhead?: Arrowhead;
  endArrowhead?: Arrowhead;
  opacity: number;
  fontSize?: FontSize;
  customFontSize?: number;
  fontFamily?: FontFamily;
  textAlign?: TextAlign;
  seed: number;
  startBinding?: PointBinding;
  endBinding?: PointBinding;
}

export interface NotebookPage {
  id: string;
  title: string;
  template: PaperTemplate;
  elements: CanvasElement[];
}

export interface Viewport {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

export interface ElementStyle {
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  strokeStyle?: StrokeStyle;
  fillStyle?: FillStyle;
  roughness: number;
  roundness?: Roundness;
  arrowType?: ArrowType;
  startArrowhead?: Arrowhead;
  endArrowhead?: Arrowhead;
  fontSize?: FontSize;
  customFontSize?: number;
  fontFamily?: FontFamily;
  textAlign?: TextAlign;
}
