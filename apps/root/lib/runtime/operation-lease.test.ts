import { describe, expect, it } from "vitest";

import { acquireOperationLease } from "./operation-lease";

describe("acquireOperationLease", () => {
  it("allows one operation until its lease is released", () => {
    const lease = { current: false };

    const release = acquireOperationLease(lease);

    expect(release).not.toBeNull();
    expect(acquireOperationLease(lease)).toBeNull();
    release?.();
    expect(acquireOperationLease(lease)).not.toBeNull();
  });
});
