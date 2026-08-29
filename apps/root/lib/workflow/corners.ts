export type WorkflowCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type Point = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export const WORKFLOW_CORNERS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const satisfies readonly WorkflowCorner[];

export const WORKFLOW_ICON_SIZE = 40;

export const WORKFLOW_INSET = 20;

export const DEFAULT_WORKFLOW_CORNER = "bottom-left" satisfies WorkflowCorner;

export function cornerAnchors(
  viewport: Size,
  iconSize: number,
  inset: number,
): Record<WorkflowCorner, Point> {
  return {
    "top-left": { x: inset, y: inset },
    "top-right": { x: viewport.width - inset - iconSize, y: inset },
    "bottom-left": {
      x: inset,
      y: viewport.height - inset - iconSize,
    },
    "bottom-right": {
      x: viewport.width - inset - iconSize,
      y: viewport.height - inset - iconSize,
    },
  };
}

export function cornerCenter(anchor: Point, iconSize: number): Point {
  return {
    x: anchor.x + iconSize / 2,
    y: anchor.y + iconSize / 2,
  };
}

export function nearestCorner(
  point: Point,
  anchors: Record<WorkflowCorner, Point>,
  iconSize: number,
  current: WorkflowCorner,
): WorkflowCorner {
  let best = current;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const corner of WORKFLOW_CORNERS) {
    const center = cornerCenter(anchors[corner], iconSize);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = corner;
      continue;
    }
    if (distance === bestDistance && corner === current) {
      best = corner;
    }
  }
  return best;
}

export function isRightCorner(corner: WorkflowCorner) {
  return corner === "top-right" || corner === "bottom-right";
}

export function isBottomCorner(corner: WorkflowCorner) {
  return corner === "bottom-left" || corner === "bottom-right";
}
