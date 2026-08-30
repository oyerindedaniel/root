import { describe, expect, it } from "vitest";

import type { NormalizedToolDescriptor } from "@repo/contracts";

import { deriveProviderGrantRows, grantBadgeForRow } from "./provider-grants";

const live = (name: string, readOnlyHint = true): NormalizedToolDescriptor => ({
  providerId: "custom-provider-1",
  namespacedName: `custom-provider-1.${name}`,
  name,
  title: name,
  description: name,
  origin: "https://analytics.example",
  inputSchema: { type: "object" },
  schemaFingerprint: "{}",
  invokeKind: "object",
  readOnlyHint,
  untrustedContentHint: false,
});

describe("deriveProviderGrantRows", () => {
  it("distinguishes live, ungranted, and stale grants", () => {
    expect(
      deriveProviderGrantRows(
        ["read_report", "removed_tool"],
        [live("read_report"), live("delete_report", false)],
      ).map(({ name, state }) => ({ name, state })),
    ).toEqual([
      { name: "read_report", state: "granted-live" },
      { name: "delete_report", state: "discovered-ungranted" },
      { name: "removed_tool", state: "granted-missing" },
    ]);
  });

  it("maps grant state to badge copy without inventing a fourth state", () => {
    const [grantedLive, discoveredWrite, grantedMissing] =
      deriveProviderGrantRows(
        ["read_report", "removed_tool"],
        [live("read_report"), live("delete_report", false)],
      );
    expect(grantedLive && grantBadgeForRow(grantedLive)).toEqual({
      label: "Granted · live",
      variant: "success",
    });
    expect(discoveredWrite && grantBadgeForRow(discoveredWrite)).toEqual({
      label: "Discovered · may write",
      variant: "warning",
    });
    expect(grantedMissing && grantBadgeForRow(grantedMissing)).toEqual({
      label: "Granted · missing",
      variant: "warning",
    });
  });
});
