export const DOCK_ICON_SIZE = 56;
export const DOCK_ICON_GAP = 8;
export const DOCK_MAX_SCALE = 1.4;
export const DOCK_PITCH = DOCK_ICON_SIZE + DOCK_ICON_GAP;
export const DOCK_VIEWPORT_GUTTER = 80;
export const DOCK_ROW_PADDING = 16;

export function dockIconScale(
  index: number,
  pointerX: number,
  hovering: number,
  rowLeft: number,
  rowWidth: number,
  itemCount: number,
) {
  if (hovering < 0.5 || rowWidth <= 0 || itemCount <= 0) {
    return 1;
  }
  const pitch = (rowWidth - DOCK_ROW_PADDING) / itemCount;
  const origin = rowLeft + DOCK_ROW_PADDING / 2;
  const center = origin + index * pitch + pitch / 2;
  const effectWidth = pitch * 3.4;
  const minX = pointerX - effectWidth / 2;
  const maxX = pointerX + effectWidth / 2;
  if (center < minX || center > maxX) {
    return 1;
  }
  const theta = ((center - minX) / effectWidth) * Math.PI * 2;
  const t = (1 - Math.cos(Math.min(Math.max(theta, 0), Math.PI * 2))) / 2;
  return 1 + t * (DOCK_MAX_SCALE - 1);
}

export function dockPitch(itemCount: number) {
  return `min(${DOCK_PITCH}px, calc((100vw - ${DOCK_VIEWPORT_GUTTER}px) / ${Math.max(itemCount, 1)}))`;
}

export function dockIconOffset(
  index: number,
  pointerX: number,
  hovering: number,
  rowLeft: number,
  rowWidth: number,
  itemCount: number,
) {
  if (hovering < 0.5 || rowWidth <= 0 || itemCount <= 0) {
    return 0;
  }
  const pitch = (rowWidth - DOCK_ROW_PADDING) / itemCount;
  const iconSize = pitch * (DOCK_ICON_SIZE / DOCK_PITCH);
  const expansions = Array.from(
    { length: itemCount },
    (_, itemIndex) =>
      iconSize *
      (dockIconScale(
        itemIndex,
        pointerX,
        hovering,
        rowLeft,
        rowWidth,
        itemCount,
      ) -
        1),
  );
  const totalExpansion = expansions.reduce(
    (total, expansion) => total + expansion,
    0,
  );
  const precedingExpansion = expansions
    .slice(0, index)
    .reduce((total, expansion) => total + expansion, 0);
  return (
    precedingExpansion +
    (expansions[index] ?? 0) / 2 -
    totalExpansion / 2
  );
}

export function dockPointerAllowed(pointerType: string) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }
  return pointerType === "mouse" || pointerType === "pen";
}
