import { describe, expect, it } from "vitest";

import {
  abortInstance,
  adoptInstanceAbort,
  dropInstanceAbort,
} from "./operation-abort";

describe("instance abort", () => {
  it("aborts the adopted signal without aborting a different instance", () => {
    const aborts = new Map<string, AbortController>();
    const parent = new AbortController();
    const accounts = adoptInstanceAbort(aborts, "accounts_1", parent.signal);
    const shop = adoptInstanceAbort(aborts, "shop_1", parent.signal);

    abortInstance(aborts, "accounts_1");

    expect(accounts.aborted).toBe(true);
    expect(shop.aborted).toBe(false);
    expect(parent.signal.aborted).toBe(false);
  });

  it("stores the Take control reason on the adopted signal", () => {
    const aborts = new Map<string, AbortController>();
    const parent = new AbortController();
    const accounts = adoptInstanceAbort(aborts, "accounts_1", parent.signal);
    const reason = new DOMException("stopped_by_user", "AbortError");

    abortInstance(aborts, "accounts_1", reason);

    expect(accounts.reason).toBe(reason);
    expect(parent.signal.aborted).toBe(false);
  });

  it("forwards parent abort to the adopted signal", () => {
    const aborts = new Map<string, AbortController>();
    const parent = new AbortController();
    const child = adoptInstanceAbort(aborts, "shop_1", parent.signal);

    parent.abort();

    expect(child.aborted).toBe(true);
  });

  it("drop leaves the parent running", () => {
    const aborts = new Map<string, AbortController>();
    const parent = new AbortController();
    adoptInstanceAbort(aborts, "shop_1", parent.signal);
    dropInstanceAbort(aborts, "shop_1");
    abortInstance(aborts, "shop_1");

    expect(parent.signal.aborted).toBe(false);
  });
});
