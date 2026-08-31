export type InstanceAborts = Map<string, AbortController>;

export function adoptInstanceAbort(
  aborts: InstanceAborts,
  instanceId: string,
  parent: AbortSignal,
): AbortSignal {
  const controller = new AbortController();
  aborts.set(instanceId, controller);
  const forward = () => {
    if (!controller.signal.aborted) {
      controller.abort(parent.reason);
    }
  };
  if (parent.aborted) {
    forward();
  } else {
    parent.addEventListener("abort", forward, { once: true });
  }
  controller.signal.addEventListener(
    "abort",
    () => {
      parent.removeEventListener("abort", forward);
      if (aborts.get(instanceId) === controller) {
        aborts.delete(instanceId);
      }
    },
    { once: true },
  );
  return controller.signal;
}

export function abortInstance(aborts: InstanceAborts, instanceId: string) {
  aborts.get(instanceId)?.abort(
    new DOMException("Cancelled", "AbortError"),
  );
}

export function dropInstanceAbort(
  aborts: InstanceAborts,
  instanceId: string,
) {
  aborts.delete(instanceId);
}
