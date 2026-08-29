import { describe, expect, it } from "vitest";

import { runtimeReducer } from "./reducer";
import { createInitialRuntimeState, type RuntimeState } from "./state";

const account = {
  id: "user_1",
  email: "dev@localhost",
  name: "Dev",
};

function mounted(state: RuntimeState = createInitialRuntimeState(account)) {
  return runtimeReducer(state, {
    type: "provider/mount",
    providerId: "shop",
    instanceId: "shop_1",
    origin: "http://localhost:3002",
    entryUrl: "http://localhost:3002/",
  });
}

function catalogStep() {
  return {
    providerId: "shop" as const,
    origin: "http://localhost:3002",
    toolName: "search_products",
    namespacedName: "shop.search_products",
    schemaFingerprint: "fp",
    arguments: { query: "keyboard" },
    readOnly: true as const,
  };
}

describe("runtimeReducer", () => {
  it("starts unmounted and signed in", () => {
    const state = createInitialRuntimeState(account);
    expect(state.provider.lifecycle).toBe("unmounted");
    expect(state.workflow.lifecycle).toBe("draft");
    expect(state.sessionStatus).toBe("authenticated");
  });

  it("walks mount loaded discovering ready", () => {
    let state = mounted();
    expect(state.provider.lifecycle).toBe("mounting");
    expect(state.provider.providerId).toBe("shop");
    state = runtimeReducer(state, {
      type: "provider/loaded",
      instanceId: "shop_1",
    });
    expect(state.provider.lifecycle).toBe("loaded");
    expect(state.provider.iframeRevision).toBe(1);
    state = runtimeReducer(state, {
      type: "provider/discovering",
      instanceId: "shop_1",
    });
    expect(state.provider.lifecycle).toBe("discovering");
    state = runtimeReducer(state, {
      type: "provider/ready",
      instanceId: "shop_1",
      tools: [],
    });
    expect(state.provider.lifecycle).toBe("active");
  });

  it("ignores events from a stale instance", () => {
    const state = runtimeReducer(mounted(), {
      type: "provider/loaded",
      instanceId: "shop_other",
    });
    expect(state.provider.lifecycle).toBe("mounting");
  });

  it("invalidates a prepared workflow when handles go stale", () => {
    let state = runtimeReducer(mounted(), {
      type: "workflow/prepared",
      workflowId: "wf_1",
      steps: [catalogStep()],
    });
    state = runtimeReducer(state, {
      type: "handles/invalidate",
      instanceId: "shop_1",
    });
    expect(state.workflow.lifecycle).toBe("failed");
    expect(state.workflow.failureReason).toBe("stale_handle");
    expect(state.discoveredTools).toEqual([]);
  });

  it("cancels an executing workflow", () => {
    let state = runtimeReducer(mounted(), {
      type: "workflow/prepared",
      workflowId: "wf_1",
      steps: [catalogStep()],
    });
    state = runtimeReducer(state, {
      type: "workflow/executing",
      workflowId: "wf_1",
    });
    state = runtimeReducer(state, {
      type: "workflow/cancelled",
      workflowId: "wf_1",
    });
    expect(state.workflow.lifecycle).toBe("cancelled");
    expect(state.control).toBe("human");
  });

  it("records a signed-out session without clearing the account", () => {
    const state = runtimeReducer(createInitialRuntimeState(account), {
      type: "session/signed-out",
    });
    expect(state.sessionStatus).toBe("signed-out");
    expect(state.account.email).toBe("dev@localhost");
  });

  it("finishes suction onto the tray", () => {
    let state = runtimeReducer(mounted(), {
      type: "provider/ready",
      instanceId: "shop_1",
      tools: [],
    });
    state = runtimeReducer(state, { type: "placement/request", placement: "tray" });
    expect(state.motion).toBe("suction");
    state = runtimeReducer(state, { type: "motion/finish", placement: "tray" });
    expect(state.provider.placement).toBe("tray");
    expect(state.provider.lifecycle).toBe("ready");
    expect(state.motion).toBe("idle");
  });

  it("keeps an executing workflow when the provider document switches", () => {
    let state = runtimeReducer(mounted(), {
      type: "workflow/prepared",
      workflowId: "wf_1",
      steps: [catalogStep()],
    });
    state = runtimeReducer(state, {
      type: "workflow/executing",
      workflowId: "wf_1",
    });
    state = runtimeReducer(state, {
      type: "provider/mount",
      providerId: "accounts",
      instanceId: "accounts_1",
      origin: "http://localhost:3001",
      entryUrl: "http://localhost:3001/",
    });
    expect(state.provider.providerId).toBe("accounts");
    expect(state.workflow.lifecycle).toBe("executing");
    expect(state.workflow.steps).toHaveLength(1);
  });

  it("does not fail an executing workflow when handles go stale", () => {
    let state = runtimeReducer(mounted(), {
      type: "workflow/prepared",
      workflowId: "wf_1",
      steps: [catalogStep()],
    });
    state = runtimeReducer(state, {
      type: "workflow/executing",
      workflowId: "wf_1",
    });
    state = runtimeReducer(state, {
      type: "handles/invalidate",
      instanceId: "shop_1",
    });
    expect(state.workflow.lifecycle).toBe("executing");
    expect(state.discoveredTools).toEqual([]);
  });
});
