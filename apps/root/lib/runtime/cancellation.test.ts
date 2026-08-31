import { describe, expect, it } from "vitest";

import {
  abortErrorCode,
  CANCELLED,
  isCancellation,
  isStoppedByUser,
  STOPPED_BY_USER,
  stoppedByUserAbort,
} from "./cancellation";

describe("isCancellation", () => {
  it("recognizes an aborted signal regardless of the thrown value", () => {
    const controller = new AbortController();
    controller.abort();
    expect(isCancellation(new Error("network failed"), controller.signal)).toBe(
      true,
    );
  });

  it("recognizes AbortError from the operation", () => {
    expect(
      isCancellation(
        new DOMException("Aborted", "AbortError"),
        new AbortController().signal,
      ),
    ).toBe(true);
  });

  it("does not swallow non-cancellation failures", () => {
    expect(
      isCancellation(new Error("network failed"), new AbortController().signal),
    ).toBe(false);
    expect(
      isCancellation(
        { name: "AbortError" },
        new AbortController().signal,
      ),
    ).toBe(false);
  });
});

describe("stopped by user", () => {
  it("classifies a Take control abort before generic cancel", () => {
    const controller = new AbortController();
    controller.abort(stoppedByUserAbort());
    expect(isStoppedByUser(undefined, controller.signal)).toBe(true);
    expect(abortErrorCode(undefined, controller.signal)).toBe(STOPPED_BY_USER);
  });

  it("keeps a generic abort as cancelled", () => {
    const controller = new AbortController();
    controller.abort(new DOMException("Cancelled", "AbortError"));
    expect(isStoppedByUser(undefined, controller.signal)).toBe(false);
    expect(abortErrorCode(undefined, controller.signal)).toBe(CANCELLED);
  });
});
