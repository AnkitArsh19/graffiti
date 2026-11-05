import type { ToolId } from "../types";

export type VoiceCommandAction =
  | { type: "selectTool"; tool: ToolId; label: string }
  | { type: "undo"; label: string }
  | { type: "redo"; label: string }
  | { type: "zoomIn"; label: string }
  | { type: "zoomOut"; label: string }
  | { type: "resetView"; label: string }
  | { type: "newPage"; label: string }
  | { type: "clearCanvas"; label: string }
  | { type: "beautify"; label: string }
  | { type: "solveMath"; label: string }
  | { type: "storyboard"; label: string };

/**
 * Parses spoken phrases into canvas commands using phonetic & fuzzy matching.
 * Tolerates common Web Speech API misrecognitions (e.g. "undo" transcribed as "ando" or "and do").
 */
export function parseVoiceCommand(phrase: string): VoiceCommandAction | null {
  if (!phrase) return null;
  const clean = phrase.toLowerCase().trim();

  // 1. Undo: Web Speech API often transcribes "undo" as "ando", "and do", "un do", "undu", "ondo", "end do"
  if (/\b(undo|ando|un\s*do|and\s*do|an\s*do|undu|ondo|on\s*do|end\s*do)\b/i.test(clean)) {
    return { type: "undo", label: "Triggered Undo" };
  }

  // 2. Redo: "redo", "re do", "read do", "ree do", "riddo"
  if (/\b(redo|re\s*do|read\s*do|ree\s*do|riddo)\b/i.test(clean)) {
    return { type: "redo", label: "Triggered Redo" };
  }

  // 3. Clear canvas: "clear canvas", "clear board", "clear screen", "clear all", "wipe canvas", "wipe board"
  if (/\b(clear\s*canvas|clear\s*board|clear\s*screen|clear\s*all|delete\s*all|wipe\s*canvas|wipe\s*board|^clear$)\b/i.test(clean)) {
    return { type: "clearCanvas", label: "Cleared Canvas" };
  }

  // 4. Zoom in: "zoom in", "zoomin", "enlarge", "magnify", "scale up", "closer"
  if (/\b(zoom\s*in|zoomin|enlarge|magnify|scale\s*up|closer)\b/i.test(clean)) {
    return { type: "zoomIn", label: "Zoomed In" };
  }

  // 5. Zoom out: "zoom out", "zoomout", "shrink", "scale down", "smaller", "further"
  if (/\b(zoom\s*out|zoomout|shrink|scale\s*down|smaller|further)\b/i.test(clean)) {
    return { type: "zoomOut", label: "Zoomed Out" };
  }

  // 6. Reset view: "reset view", "reset zoom", "fit to screen", "zoom to fit", "center view", "recenter"
  if (/\b(reset\s*view|reset\s*zoom|fit\s*to\s*screen|zoom\s*to\s*fit|recenter|center\s*view|default\s*view)\b/i.test(clean)) {
    return { type: "resetView", label: "Reset View" };
  }

  // 7. New page: "new page", "add page", "create page", "next page", "another page"
  if (/\b(new\s*page|add\s*page|create\s*page|next\s*page|another\s*page)\b/i.test(clean)) {
    return { type: "newPage", label: "Created New Page" };
  }

  // 8. Beautify / Smooth: "beautify", "beauty", "beautifly", "beautified", "smooth", "tidy", "clean up", "straighten"
  if (/\b(beautify|beauty|beautifly|beautified|smooth|tidy|clean\s*up|straighten|perfect\s*shape|fix\s*shape)\b/i.test(clean)) {
    return { type: "beautify", label: "AI Shape Beautify Triggered" };
  }

  // 9. Solve math: "solve", "calculate", "evaluate", "solve math", "solve equation"
  if (/\b(solve|calculate|evaluate|math|solve\s*equation|solve\s*math)\b/i.test(clean)) {
    return { type: "solveMath", label: "AI Math Solver Triggered" };
  }

  // 10. Live Storyboard: "storyboard", "story board", "live storyboard", "storytelling", "architecture mode"
  if (/\b(storyboard|story\s*board|storytelling|architecture\s*mode)\b/i.test(clean)) {
    return { type: "storyboard", label: "Switched to Live Storyboard Mode!" };
  }

  // 11. Shape Tools
  // Rectangle / Box: "rectangle", "rect angle", "wreck tangle", "reck tangle", "box", "square"
  if (/\b(rectangle|rect\s*angle|wreck\s*tangle|reck\s*tangle|box|square|quad)\b/i.test(clean)) {
    return { type: "selectTool", tool: "rectangle", label: "Selected Rectangle Tool" };
  }

  // Circle / Ellipse: "circle", "sircle", "circal", "circl", "ellipse", "elipse", "eclipse", "oval", "round"
  if (/\b(circle|sircle|circal|circl|ellipse|elipse|eclipse|oval|round)\b/i.test(clean)) {
    return { type: "selectTool", tool: "ellipse", label: "Selected Ellipse Tool" };
  }

  // Diamond / Rhombus: "diamond", "diamon", "dimond", "rhombus", "rhomb", "decision"
  if (/\b(diamond|diamon|dimond|rhombus|rhomb|decision\s*box)\b/i.test(clean)) {
    return { type: "selectTool", tool: "diamond", label: "Selected Diamond Tool" };
  }

  // Arrow: "arrow", "aerow", "arrowhead", "connector"
  if (/\b(arrow|aerow|arrowhead|connector)\b/i.test(clean)) {
    return { type: "selectTool", tool: "arrow", label: "Selected Arrow Tool" };
  }

  // Line: "line", "lyne", "straight line"
  if (/\b(line|lyne|straight\s*line)\b/i.test(clean)) {
    return { type: "selectTool", tool: "line", label: "Selected Line Tool" };
  }

  // Pen / Draw: "pen", "pencil", "draw", "drawing", "sketch", "freehand", "freedraw"
  if (/\b(pen|pencil|draw|drawing|sketch|freehand|freedraw)\b/i.test(clean)) {
    return { type: "selectTool", tool: "pen", label: "Selected Pen Tool" };
  }

  // Text / Type: "text", "type", "typing", "textbox", "text box", "write", "writing"
  if (/\b(text|type|typing|textbox|text\s*box|write|writing)\b/i.test(clean)) {
    return { type: "selectTool", tool: "text", label: "Selected Text Tool" };
  }

  // Sticky Note: "sticky", "sticky note", "post it", "stickynote", "note"
  if (/\b(sticky|sticky\s*note|post\s*it|stickynote|note)\b/i.test(clean)) {
    return { type: "selectTool", tool: "sticky", label: "Selected Sticky Note Tool" };
  }

  // Eraser: "eraser", "erase", "rubber", "remove tool"
  if (/\b(eraser|erase|rubber|remove\s*tool)\b/i.test(clean)) {
    return { type: "selectTool", tool: "eraser", label: "Selected Eraser Tool" };
  }

  // Select / Pointer: "select", "selection", "pointer", "cursor", "pick"
  if (/\b(select|selection|pointer|cursor|pick)\b/i.test(clean)) {
    return { type: "selectTool", tool: "select", label: "Selected Select Tool" };
  }

  // Hand / Pan: "hand", "pan canvas", "drag canvas", "move canvas", "grab"
  if (/\b(hand|pan\s*canvas|drag\s*canvas|move\s*canvas|grab)\b/i.test(clean)) {
    return { type: "selectTool", tool: "hand", label: "Selected Hand Tool" };
  }

  return null;
}

