export function setPendingHumanTimer(
  timers: Map<string, ReturnType<typeof setTimeout>>,
  instanceId: string,
  open: boolean,
  onTimeout: (instanceId: string) => void,
  delayMs: number,
) {
  const existing = timers.get(instanceId);
  if (existing !== undefined) {
    clearTimeout(existing);
    timers.delete(instanceId);
  }
  if (!open) {
    return;
  }
  const handle = setTimeout(() => {
    timers.delete(instanceId);
    onTimeout(instanceId);
  }, delayMs);
  timers.set(instanceId, handle);
}
