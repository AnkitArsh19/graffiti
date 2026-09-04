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

export interface Point {
  x: number;
  y: number;
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
  text?: string;
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  roughness: number;
  opacity: number;
  seed: number;
}

export interface NotebookPage {
  id: string;
  title: string;
  template: PaperTemplate;
  elements: CanvasElement[];
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface ElementStyle {
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  roughness: number;
}
