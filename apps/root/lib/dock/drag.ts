import { dockReferenceSchema, type DockReference } from "@/lib/storage/workspace-preferences";

export const ROOT_APP_DRAG_TYPE = "application/x-root-app";

export function dockRemovalCandidate(
  bounds: Pick<DOMRect, "top" | "right" | "bottom" | "left">,
  point: { x: number; y: number },
  threshold: number,
): boolean {
  const horizontal = Math.max(
    bounds.left - point.x,
    0,
    point.x - bounds.right,
  );
  const vertical = Math.max(
    bounds.top - point.y,
    0,
    point.y - bounds.bottom,
  );
  return Math.hypot(horizontal, vertical) >= threshold;
}

export function serializeDockReference(reference: DockReference): string {
  return JSON.stringify(reference);
}

export function parseDockReference(raw: string): DockReference | null {
  try {
    const parsed = dockReferenceSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeDockReference(
  dataTransfer: DataTransfer,
  reference: DockReference,
) {
  dataTransfer.effectAllowed = "move";
  dataTransfer.setData(ROOT_APP_DRAG_TYPE, serializeDockReference(reference));
}

export function readDockReference(
  dataTransfer: DataTransfer,
): DockReference | null {
  return parseDockReference(dataTransfer.getData(ROOT_APP_DRAG_TYPE));
}
