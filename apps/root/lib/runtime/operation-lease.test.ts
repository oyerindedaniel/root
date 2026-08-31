import { describe, expect, it } from "vitest";

import { acquireOperationLease } from "./operation-lease";

describe("acquireOperationLease", () => {
  it("allows one operation on a window until its lease is released", () => {
    const leases = new Set<string>();

    const release = acquireOperationLease(leases, "shop_1");

    expect(release).not.toBeNull();
    expect(acquireOperationLease(leases, "shop_1")).toBeNull();
    release?.();
    expect(acquireOperationLease(leases, "shop_1")).not.toBeNull();
  });

  it("allows concurrent operations on different windows", () => {
    const leases = new Set<string>();

    const releaseA = acquireOperationLease(leases, "accounts_1");
    const releaseB = acquireOperationLease(leases, "shop_1");

    expect(releaseA).not.toBeNull();
    expect(releaseB).not.toBeNull();
    expect(acquireOperationLease(leases, "accounts_1")).toBeNull();
    releaseA?.();
    expect(acquireOperationLease(leases, "accounts_1")).not.toBeNull();
    expect(acquireOperationLease(leases, "shop_1")).toBeNull();
  });

  it("ignores a second release of the same lease", () => {
    const leases = new Set<string>();
    const first = acquireOperationLease(leases, "shop_1");
    first?.();
    const second = acquireOperationLease(leases, "shop_1");
    first?.();
    expect(second).not.toBeNull();
    expect(acquireOperationLease(leases, "shop_1")).toBeNull();
  });
});
