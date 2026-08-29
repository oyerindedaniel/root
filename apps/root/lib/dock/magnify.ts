export const DOCK_ICON_SIZE = 56;
export const DOCK_ICON_GAP = 8;
export const DOCK_ICON_COUNT = 3;
export const DOCK_MAX_SCALE = 1.4;
export const DOCK_EFFECT_WIDTH = (DOCK_ICON_SIZE + DOCK_ICON_GAP) * 3.4;
export const DOCK_PITCH = DOCK_ICON_SIZE + DOCK_ICON_GAP;

const REST_WIDTH = DOCK_ICON_COUNT * DOCK_PITCH;

export function dockIconScale(
  index: number,
  pointerX: number,
  hovering: number,
  rowLeft: number,
  rowWidth: number,
) {
  if (hovering < 0.5 || rowWidth <= 0) {
    return 1;
  }
  const origin = rowLeft + (rowWidth - REST_WIDTH) / 2;
  const center = origin + index * DOCK_PITCH + DOCK_PITCH / 2;
  const minX = pointerX - DOCK_EFFECT_WIDTH / 2;
  const maxX = pointerX + DOCK_EFFECT_WIDTH / 2;
  if (center < minX || center > maxX) {
    return 1;
  }
  const theta = ((center - minX) / DOCK_EFFECT_WIDTH) * Math.PI * 2;
  const t = (1 - Math.cos(Math.min(Math.max(theta, 0), Math.PI * 2))) / 2;
  return 1 + t * (DOCK_MAX_SCALE - 1);
}

export function dockSlotWidth(scale: number) {
  return DOCK_PITCH * scale;
}

export function dockPointerAllowed(pointerType: string) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }
  return pointerType === "mouse" || pointerType === "pen";
}
