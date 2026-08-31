import type { GatewayErrorCode } from "@repo/contracts";

export type AbortErrorCode = Extract<
  GatewayErrorCode,
  "cancelled" | "stopped_by_user"
>;

export const STOPPED_BY_USER: Extract<GatewayErrorCode, "stopped_by_user"> =
  "stopped_by_user";
export const CANCELLED: Extract<GatewayErrorCode, "cancelled"> = "cancelled";

export function stoppedByUserAbort() {
  return new DOMException(STOPPED_BY_USER, "AbortError");
}

function reasonIsStoppedByUser(reason: unknown) {
  return (
    reason === STOPPED_BY_USER ||
    (reason instanceof Error && reason.message === STOPPED_BY_USER)
  );
}

export function isStoppedByUser(
  error: unknown,
  signal: AbortSignal,
): boolean {
  return reasonIsStoppedByUser(signal.reason) || reasonIsStoppedByUser(error);
}

export function isCancellation(
  error: unknown,
  signal: AbortSignal,
): boolean {
  return signal.aborted || (error instanceof Error && error.name === "AbortError");
}

export function abortErrorCode(
  error: unknown,
  signal: AbortSignal,
): AbortErrorCode | null {
  if (isStoppedByUser(error, signal)) {
    return STOPPED_BY_USER;
  }
  if (isCancellation(error, signal)) {
    return CANCELLED;
  }
  return null;
}
