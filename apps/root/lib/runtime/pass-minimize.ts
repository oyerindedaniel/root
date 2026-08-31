import type { ProviderId, ProviderPlacement } from "@repo/contracts";

export function uniqueProviderIdsFromSteps(
  steps: ReadonlyArray<{ providerId: ProviderId }>,
): ProviderId[] {
  const seen = new Set<ProviderId>();
  const ids: ProviderId[] = [];
  for (const step of steps) {
    if (seen.has(step.providerId)) {
      continue;
    }
    seen.add(step.providerId);
    ids.push(step.providerId);
  }
  return ids;
}

export function usedWindowsToMinimize(
  steps: ReadonlyArray<{ providerId: ProviderId }>,
  placementOf: (providerId: ProviderId) => ProviderPlacement | undefined,
): ProviderId[] {
  const targets: ProviderId[] = [];
  for (const providerId of uniqueProviderIdsFromSteps(steps)) {
    if (placementOf(providerId) === "stage") {
      targets.push(providerId);
    }
  }
  return targets;
}

export type PassMinimizeHost = {
  minimize: (providerId: ProviderId) => boolean;
};

export function createPassMinimizeQueue(host: PassMinimizeHost) {
  const pending: ProviderId[] = [];
  let draining = false;

  function drain() {
    if (draining) {
      return;
    }
    draining = true;
    try {
      while (pending.length > 0) {
        const providerId = pending.shift();
        if (providerId === undefined) {
          break;
        }
        const waitingForPour = host.minimize(providerId);
        if (waitingForPour) {
          break;
        }
      }
    } finally {
      draining = false;
    }
  }

  function enqueue(providerIds: readonly ProviderId[]) {
    for (const providerId of providerIds) {
      pending.push(providerId);
    }
    drain();
  }

  return { enqueue, drain };
}
