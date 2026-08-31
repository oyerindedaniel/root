import type { RuntimeState } from "./state";

export const LIVE_PROVIDER_CAP = 4;

export function liveWindowCount(
  state: RuntimeState,
  omitInstanceId?: string,
): number {
  let count = 0;
  for (const instanceId of Object.keys(state.windows)) {
    if (instanceId === omitInstanceId) {
      continue;
    }
    count += 1;
  }
  return count;
}

export function pickEvictionVictim(
  state: RuntimeState,
  omitInstanceId?: string,
): string | null {
  const suctionId =
    state.motion.status === "suction" ? state.motion.instanceId : null;
  let victimId: string | null = null;
  let victimTray = false;
  let victimTouched = 0;
  for (const windowState of Object.values(state.windows)) {
    if (
      windowState.instanceId === omitInstanceId ||
      windowState.instanceId === state.focusedInstanceId ||
      windowState.instanceId === suctionId ||
      windowState.openedBy === "human"
    ) {
      continue;
    }
    const tray = windowState.placement === "tray";
    if (
      victimId === null ||
      (tray && !victimTray) ||
      (tray === victimTray && windowState.lastTouchedAt < victimTouched)
    ) {
      victimId = windowState.instanceId;
      victimTray = tray;
      victimTouched = windowState.lastTouchedAt;
    }
  }
  return victimId;
}
