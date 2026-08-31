export type OperationLeases = Set<string>;

export function acquireOperationLease(
  leases: OperationLeases,
  instanceId: string,
): (() => void) | null {
  if (leases.has(instanceId)) {
    return null;
  }
  leases.add(instanceId);
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    leases.delete(instanceId);
  };
}
