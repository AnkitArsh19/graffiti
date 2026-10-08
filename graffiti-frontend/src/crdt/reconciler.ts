import type { CanvasElement } from "../types";

export interface ReconciledOp { shapeId: string; opType: "CREATE_OR_UPDATE" | "DELETE"; payload?: CanvasElement; lamportTs: number; }
export interface ElementVersion { element?: CanvasElement; lamportTs: number; deleted: boolean; }

/** Deterministic LWW element-set reconciliation shared by initial sync and WebSocket updates. */
export function applyRemoteOp(state: Map<string, ElementVersion>, op: ReconciledOp): Map<string, ElementVersion> {
  const prior = state.get(op.shapeId);
  if (prior && prior.lamportTs > op.lamportTs) return state;
  const next = new Map(state);
  next.set(op.shapeId, { element: op.payload, lamportTs: op.lamportTs, deleted: op.opType === "DELETE" });
  return next;
}

export function elementsFromVersions(state: Map<string, ElementVersion>, pageId?: string): CanvasElement[] {
  return [...state.values()].filter((entry) => !entry.deleted && entry.element && (!pageId || entry.element.pageId === pageId)).map((entry) => entry.element!);
}
