import type { GatewayErrorCode } from "@repo/contracts";

export type AbortErrorCode = Extract<
  GatewayErrorCode,
  "cancelled" | "stopped_by_user" | "no_response"
>;

export const STOPPED_BY_USER: Extract<GatewayErrorCode, "stopped_by_user"> =
  "stopped_by_user";
export const NO_RESPONSE: Extract<GatewayErrorCode, "no_response"> =
  "no_response";
export const CANCELLED: Extract<GatewayErrorCode, "cancelled"> = "cancelled";

export function stoppedByUserAbort() {
  return new DOMException(STOPPED_BY_USER, "AbortError");
}

export function noResponseAbort() {
  return new DOMException(NO_RESPONSE, "AbortError");
}

function reasonIsCode(reason: unknown, code: AbortErrorCode) {
  return reason === code || (reason instanceof Error && reason.message === code);
}

export function isStoppedByUser(
  error: unknown,
  signal: AbortSignal,
): boolean {
  return (
    reasonIsCode(signal.reason, STOPPED_BY_USER) ||
    reasonIsCode(error, STOPPED_BY_USER)
  );
}

export function isNoResponse(error: unknown, signal: AbortSignal): boolean {
  return (
    reasonIsCode(signal.reason, NO_RESPONSE) ||
    reasonIsCode(error, NO_RESPONSE)
  );
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
  if (isNoResponse(error, signal)) {
    return NO_RESPONSE;
  }
  if (isCancellation(error, signal)) {
    return CANCELLED;
  }
  return null;
}

export function abortErrorMessage(code: AbortErrorCode, subject: string) {
  if (code === STOPPED_BY_USER) {
    return "The human took control. Do not retry this workflow.";
  }
  if (code === NO_RESPONSE) {
    return `${subject} had no human response.`;
  }
  return `${subject} was cancelled.`;
}
