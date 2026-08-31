import { describe, expect, it } from "vitest";

import type { ProviderId, ProviderPlacement } from "@repo/contracts";

import {
  createPassMinimizeQueue,
  uniqueProviderIdsFromSteps,
  usedWindowsToMinimize,
} from "./pass-minimize";

const shop: ProviderId = "shop";
const accounts: ProviderId = "accounts";
const support: ProviderId = "support";

describe("uniqueProviderIdsFromSteps", () => {
  it("keeps first-seen order and drops repeats", () => {
    expect(
      uniqueProviderIdsFromSteps([
        { providerId: shop },
        { providerId: accounts },
        { providerId: shop },
        { providerId: support },
      ]),
    ).toEqual([shop, accounts, support]);
  });
});

describe("usedWindowsToMinimize", () => {
  it("keeps stage windows and skips tray or missing", () => {
    const placement: Record<string, ProviderPlacement | undefined> = {
      shop: "stage",
      accounts: "tray",
    };
    expect(
      usedWindowsToMinimize(
        [
          { providerId: shop },
          { providerId: accounts },
          { providerId: support },
          { providerId: shop },
        ],
        (providerId) => placement[providerId],
      ),
    ).toEqual([shop]);
  });
});

describe("createPassMinimizeQueue", () => {
  it("minimizes every id while none wait for a pour", () => {
    const minimized: ProviderId[] = [];
    const queue = createPassMinimizeQueue({
      minimize: (providerId) => {
        minimized.push(providerId);
        return false;
      },
    });
    queue.enqueue([shop, accounts]);
    expect(minimized).toEqual([shop, accounts]);
  });

  it("defers the next id while a pour is in flight", () => {
    const minimized: ProviderId[] = [];
    const queue = createPassMinimizeQueue({
      minimize: (providerId) => {
        minimized.push(providerId);
        return providerId === shop;
      },
    });
    queue.enqueue([shop, accounts]);
    expect(minimized).toEqual([shop]);
    queue.drain();
    expect(minimized).toEqual([shop, accounts]);
  });

  it("does not unmount", () => {
    const calls: string[] = [];
    const queue = createPassMinimizeQueue({
      minimize: (providerId) => {
        calls.push(`minimize:${providerId}`);
        return false;
      },
    });
    queue.enqueue([shop]);
    expect(calls).toEqual(["minimize:shop"]);
  });
});
