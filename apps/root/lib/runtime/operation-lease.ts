export type OperationLease = {
  current: boolean;
};

export function acquireOperationLease(
  lease: OperationLease,
): (() => void) | null {
  if (lease.current) {
    return null;
  }
  lease.current = true;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    lease.current = false;
  };
}
