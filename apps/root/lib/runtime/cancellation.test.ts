import { describe, expect, it } from "vitest";

import { isCancellation } from "./cancellation";

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
