import { describe, expect, it } from "vitest";

import { runtimeReducer } from "./reducer";
import {
  createInitialRuntimeState,
  dockPendingCue,
  waitingProviderIds,
  type RuntimeState,
} from "./state";

const account = { id: "user_1", email: "dev@localhost", name: "Dev" };

function mount(
  state: RuntimeState,
  options: {
    providerId: "shop" | "accounts";
    instanceId: string;
  },
) {
  const origins = {
    shop: "http://localhost:3002",
    accounts: "http://localhost:3001",
  };
  const origin = origins[options.providerId];
  return runtimeReducer(state, {
    type: "provider/mount",
    providerId: options.providerId,
    instanceId: options.instanceId,
    origin,
    entryUrl: `${origin}/`,
    openedBy: "human",
    touchedAt: 1,
  });
}

function tray(state: RuntimeState, instanceId: string) {
  let next = runtimeReducer(state, {
    type: "placement/request",
    instanceId,
    placement: "tray",
  });
  return runtimeReducer(next, { type: "motion/finish", instanceId });
}

describe("waitingProviderIds", () => {
  it("names the pending window, not the focused one", () => {
    let state = createInitialRuntimeState(account);
    state = mount(state, { providerId: "shop", instanceId: "shop_1" });
    state = mount(state, { providerId: "accounts", instanceId: "accounts_1" });
    expect(state.focusedInstanceId).toBe("accounts_1");
    expect(waitingProviderIds(state, ["shop_1"])).toEqual(["shop"]);
  });
});

describe("dockPendingCue", () => {
  it("skips a pending window already focused on stage", () => {
    let state = createInitialRuntimeState(account);
    state = mount(state, { providerId: "shop", instanceId: "shop_1" });
    expect(
      dockPendingCue(state.windows.shop_1, ["shop_1"], "shop_1"),
    ).toBe(false);
  });

  it("lights a pending window in the tray or unfocused on stage", () => {
    let state = createInitialRuntimeState(account);
    state = mount(state, { providerId: "shop", instanceId: "shop_1" });
    state = mount(state, { providerId: "accounts", instanceId: "accounts_1" });
    expect(
      dockPendingCue(state.windows.shop_1, ["shop_1"], "accounts_1"),
    ).toBe(true);
    state = tray(state, "shop_1");
    expect(
      dockPendingCue(state.windows.shop_1, ["shop_1"], "shop_1"),
    ).toBe(true);
  });
});
