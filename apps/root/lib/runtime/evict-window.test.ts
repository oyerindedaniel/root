import { describe, expect, it } from "vitest";

import {
  liveWindowCount,
  pickEvictionVictim,
} from "./evict-window";
import { runtimeReducer } from "./reducer";
import { createInitialRuntimeState, type RuntimeState } from "./state";

const account = { id: "user_1", email: "dev@localhost", name: "Dev" };

function mount(
  state: RuntimeState,
  options: {
    providerId: "shop" | "accounts" | "support";
    instanceId: string;
    openedBy: "human" | "agent";
    touchedAt: number;
    origin?: string;
  },
) {
  const origins = {
    shop: "http://localhost:3002",
    accounts: "http://localhost:3001",
    support: "http://localhost:3003",
  };
  const origin = options.origin ?? origins[options.providerId];
  return runtimeReducer(state, {
    type: "provider/mount",
    providerId: options.providerId,
    instanceId: options.instanceId,
    origin,
    entryUrl: `${origin}/`,
    openedBy: options.openedBy,
    touchedAt: options.touchedAt,
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

describe("liveWindowCount", () => {
  it("counts mounted windows and can omit one", () => {
    let state = createInitialRuntimeState(account);
    state = mount(state, {
      providerId: "shop",
      instanceId: "shop_1",
      openedBy: "agent",
      touchedAt: 1,
    });
    state = mount(state, {
      providerId: "accounts",
      instanceId: "accounts_1",
      openedBy: "agent",
      touchedAt: 2,
    });
    expect(liveWindowCount(state)).toBe(2);
    expect(liveWindowCount(state, "shop_1")).toBe(1);
  });
});

describe("pickEvictionVictim", () => {
  it("returns null when every window is protected", () => {
    let state = createInitialRuntimeState(account);
    state = mount(state, {
      providerId: "shop",
      instanceId: "shop_1",
      openedBy: "human",
      touchedAt: 1,
    });
    state = mount(state, {
      providerId: "accounts",
      instanceId: "accounts_1",
      openedBy: "human",
      touchedAt: 2,
    });
    expect(pickEvictionVictim(state)).toBeNull();
  });

  it("does not evict the focused window or a human-opened window", () => {
    let state = createInitialRuntimeState(account);
    state = mount(state, {
      providerId: "shop",
      instanceId: "shop_1",
      openedBy: "agent",
      touchedAt: 1,
    });
    state = tray(state, "shop_1");
    state = mount(state, {
      providerId: "accounts",
      instanceId: "accounts_1",
      openedBy: "human",
      touchedAt: 2,
    });
    expect(state.focusedInstanceId).toBe("accounts_1");
    expect(pickEvictionVictim(state)).toBe("shop_1");
  });

  it("evicts a tray agent window before a stage agent window", () => {
    let state = createInitialRuntimeState(account);
    state = mount(state, {
      providerId: "shop",
      instanceId: "shop_1",
      openedBy: "agent",
      touchedAt: 1,
    });
    state = tray(state, "shop_1");
    state = mount(state, {
      providerId: "accounts",
      instanceId: "accounts_1",
      openedBy: "agent",
      touchedAt: 2,
    });
    state = mount(state, {
      providerId: "support",
      instanceId: "support_1",
      openedBy: "human",
      touchedAt: 3,
    });
    expect(pickEvictionVictim(state)).toBe("shop_1");
  });

  it("evicts the oldest-touched agent tray window first", () => {
    let state = createInitialRuntimeState(account);
    state = mount(state, {
      providerId: "shop",
      instanceId: "shop_1",
      openedBy: "agent",
      touchedAt: 5,
    });
    state = tray(state, "shop_1");
    state = mount(state, {
      providerId: "accounts",
      instanceId: "accounts_1",
      openedBy: "agent",
      touchedAt: 2,
    });
    state = tray(state, "accounts_1");
    state = mount(state, {
      providerId: "support",
      instanceId: "support_1",
      openedBy: "human",
      touchedAt: 9,
    });
    expect(pickEvictionVictim(state)).toBe("accounts_1");
  });

  it("evicts the oldest-touched agent stage window when none are in the tray", () => {
    let state = createInitialRuntimeState(account);
    state = mount(state, {
      providerId: "shop",
      instanceId: "shop_1",
      openedBy: "agent",
      touchedAt: 1,
    });
    state = mount(state, {
      providerId: "accounts",
      instanceId: "accounts_1",
      openedBy: "agent",
      touchedAt: 4,
    });
    state = mount(state, {
      providerId: "support",
      instanceId: "support_1",
      openedBy: "human",
      touchedAt: 5,
    });
    expect(pickEvictionVictim(state)).toBe("shop_1");
  });

  it("skips the suction target and an omitted instance", () => {
    let state = createInitialRuntimeState(account);
    state = mount(state, {
      providerId: "shop",
      instanceId: "shop_1",
      openedBy: "agent",
      touchedAt: 1,
    });
    state = tray(state, "shop_1");
    state = mount(state, {
      providerId: "accounts",
      instanceId: "accounts_1",
      openedBy: "agent",
      touchedAt: 2,
    });
    state = tray(state, "accounts_1");
    state = runtimeReducer(state, {
      type: "placement/request",
      instanceId: "shop_1",
      placement: "stage",
    });
    state = mount(state, {
      providerId: "support",
      instanceId: "support_1",
      openedBy: "human",
      touchedAt: 3,
    });
    expect(state.motion).toMatchObject({
      status: "suction",
      instanceId: "shop_1",
    });
    expect(pickEvictionVictim(state)).toBe("accounts_1");
    expect(pickEvictionVictim(state, "accounts_1")).toBeNull();
  });
});
