import type { Transition } from "motion/react";

export const LIBRARY_EDIT_HOLD_MS = 500;

export function libraryJiggleRotate(
  reduceMotion: boolean | null,
  index: number,
) {
  if (reduceMotion === true) {
    return 0;
  }
  return index % 2 === 0
    ? [0, 1.35, 0, -1.1, 0]
    : [0, -1.35, 0, 1.1, 0];
}

export function libraryJiggleOrigin(index: number) {
  return index % 2 === 0 ? "50% 12%" : "34% 8%";
}

export function libraryJiggleTransition(
  reduceMotion: boolean | null,
  index: number,
): Transition {
  if (reduceMotion === true) {
    return { duration: 0 };
  }
  const duration = 0.155 + (index % 5) * 0.012;
  return {
    type: "tween",
    duration,
    ease: "easeInOut",
    repeat: Infinity,
    repeatType: "loop",
    delay: -((index * 0.037) % duration),
  };
}

export function instanceIdsForProvider(
  windows: Iterable<{ instanceId: string; providerId: string }>,
  providerId: string,
): string[] {
  const ids: string[] = [];
  for (const windowState of windows) {
    if (windowState.providerId === providerId) {
      ids.push(windowState.instanceId);
    }
  }
  return ids;
}

const LIBRARY_EDIT_OCCUPANTS = [
  "[data-library-alias]",
  "[data-caliper-id='root-dock']",
  "[data-caliper-id='root-workflow']",
  "[data-provider-window]",
] as const;

export function libraryEditOccupiesClick(target: EventTarget | null): boolean {
  if (!target || !("closest" in target)) {
    return false;
  }
  const node = target as { closest: (selector: string) => unknown };
  for (const selector of LIBRARY_EDIT_OCCUPANTS) {
    if (node.closest(selector)) {
      return true;
    }
  }
  return false;
}
