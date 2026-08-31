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
    openedBy: "human",
    touchedAt: 1,
  });
}

function windowState(state: RuntimeState, instanceId = "shop_1") {
  const current = state.windows[instanceId];
  if (!current) {
    throw new Error(`missing window ${instanceId}`);
  }
  return current;
}

function catalogStep() {
  return {
    providerId: "shop" as const,
    origin: "http://localhost:3002",
    toolName: "search_products" as const,
    namespacedName: "shop.search_products" as const,
    schemaFingerprint: "fp",
    arguments: { query: "keyboard" },
    readOnly: true as const,
  };
}

function catalogResult() {
  return {
    tool: "shop.search_products" as const,
    data: {
      status: "success" as const,
      query: "keyboard",
      products: [
        {
          id: "product_1",
          name: "Keyboard",
          description: "A keyboard",
          priceUsd: 40,
        },
      ],
    },
  };
}

describe("runtimeReducer", () => {
  it("starts unmounted", () => {
    const state = createInitialRuntimeState(account);
    expect(state.windowOrder).toEqual([]);
    expect(state.focusedInstanceId).toBeNull();
    expect(state.workflow.lifecycle).toBe("draft");
  });

  it("records an ended session once without clearing the account", () => {
    const initial = createInitialRuntimeState(account);
    const state = runtimeReducer(initial, { type: "session/ended" });
    expect(state.sessionStatus).toBe("signed-out");
    expect(state.account.email).toBe("dev@localhost");
    expect(runtimeReducer(state, { type: "session/ended" })).toBe(state);
  });

  it("walks mount loaded discovering ready", () => {
    let state = mounted();
    expect(windowState(state).lifecycle).toBe("mounting");
    expect(windowState(state).providerId).toBe("shop");
    state = runtimeReducer(state, {
      type: "provider/loaded",
      instanceId: "shop_1",
    });
    expect(windowState(state).lifecycle).toBe("loaded");
    state = runtimeReducer(state, {
      type: "provider/discovering",
      instanceId: "shop_1",
    });
    expect(windowState(state).lifecycle).toBe("discovering");
    state = runtimeReducer(state, {
      type: "provider/ready",
      instanceId: "shop_1",
      tools: [],
    });
    expect(windowState(state).lifecycle).toBe("active");
  });

  it("mounts a bounded dynamic provider identity", () => {
    const state = runtimeReducer(createInitialRuntimeState(account), {
      type: "provider/mount",
      providerId: "custom-analytics-1",
      instanceId: "custom-analytics-1_instance",
      origin: "https://analytics.example",
      entryUrl: "https://analytics.example/app",
      openedBy: "agent",
      touchedAt: 2,
    });
    expect(
      windowState(state, "custom-analytics-1_instance").providerId,
    ).toBe("custom-analytics-1");
    expect(
      windowState(state, "custom-analytics-1_instance").entryUrl,
    ).toBe("https://analytics.example/app");
  });

  it("ignores events from a stale instance", () => {
    const state = runtimeReducer(mounted(), {
      type: "provider/loaded",
      instanceId: "shop_other",
    });
    expect(windowState(state).lifecycle).toBe("mounting");
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
    expect(windowState(state).discoveredTools).toEqual([]);
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

  it("selects the current workflow step", () => {
    const second = {
      ...catalogStep(),
      arguments: { query: "mouse" },
    };
    let state = runtimeReducer(mounted(), {
      type: "workflow/prepared",
      workflowId: "wf_1",
      steps: [catalogStep(), second],
    });

    state = runtimeReducer(state, {
      type: "workflow/step",
      workflowId: "wf_1",
      index: 1,
    });

    expect(state.workflow.currentStepIndex).toBe(1);
    expect(state.workflow.step?.arguments).toEqual({ query: "mouse" });
    expect(windowState(state).activeTool).toBe("shop.search_products");
  });

  it("records a passed workflow", () => {
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
      type: "workflow/passed",
      workflowId: "wf_1",
      results: [catalogResult()],
      evidence: '1 products for "keyboard"',
    });

    expect(state.workflow.lifecycle).toBe("passed");
    expect(state.workflow.results).toEqual([catalogResult()]);
    expect(state.workflow.evidence).toBe('1 products for "keyboard"');
    expect(windowState(state).outcome).toBe("passed");
    expect(state.control).toBe("human");
  });

  it("records a failed workflow", () => {
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
      type: "workflow/failed",
      workflowId: "wf_1",
      reason: "execution_failed",
    });

    expect(state.workflow.lifecycle).toBe("failed");
    expect(state.workflow.failureReason).toBe("execution_failed");
    expect(windowState(state).outcome).toBe("failed");
    expect(state.control).toBe("human");
  });

  it("invalidates a workflow after failed revalidation", () => {
    let state = runtimeReducer(mounted(), {
      type: "workflow/prepared",
      workflowId: "wf_1",
      steps: [catalogStep()],
    });
    state = runtimeReducer(state, {
      type: "workflow/executing",
      workflowId: "wf_1",
    });

    state = runtimeReducer(state, { type: "workflow/invalidate" });

    expect(state.workflow.lifecycle).toBe("failed");
    expect(state.workflow.failureReason).toBe("revalidation_failed");
    expect(state.workflow.steps).toEqual([catalogStep()]);
  });

  it("finishes suction onto the tray", () => {
    let state = runtimeReducer(mounted(), {
      type: "provider/ready",
      instanceId: "shop_1",
      tools: [],
    });
    state = runtimeReducer(state, {
      type: "placement/request",
      instanceId: "shop_1",
      placement: "tray",
    });
    expect(state.motion).toEqual({
      status: "suction",
      instanceId: "shop_1",
      placement: "tray",
    });
    state = runtimeReducer(state, {
      type: "motion/finish",
      instanceId: "shop_1",
    });
    expect(windowState(state).placement).toBe("tray");
    expect(windowState(state).lifecycle).toBe("ready");
    expect(state.motion).toEqual({ status: "idle" });
  });

  it("restores the requested tray window to the stage", () => {
    let state = runtimeReducer(mounted(), {
      type: "provider/ready",
      instanceId: "shop_1",
      tools: [],
    });
    state = runtimeReducer(state, {
      type: "placement/request",
      instanceId: "shop_1",
      placement: "tray",
    });
    state = runtimeReducer(state, {
      type: "motion/finish",
      instanceId: "shop_1",
    });
    state = runtimeReducer(state, {
      type: "placement/request",
      instanceId: "shop_1",
      placement: "stage",
    });
    expect(state.motion).toEqual({
      status: "suction",
      instanceId: "shop_1",
      placement: "stage",
    });
    state = runtimeReducer(state, {
      type: "motion/finish",
      instanceId: "shop_1",
    });
    expect(windowState(state).placement).toBe("stage");
    expect(windowState(state).lifecycle).toBe("active");
    expect(state.motion).toEqual({ status: "idle" });
  });

  it("only finishes the window with the pending placement", () => {
    let state = runtimeReducer(mounted(), {
      type: "placement/request",
      instanceId: "shop_1",
      placement: "tray",
    });
    const pending = state;
    state = runtimeReducer(state, {
      type: "motion/finish",
      instanceId: "shop_other",
    });
    expect(state).toBe(pending);
    state = runtimeReducer(state, {
      type: "motion/cancel",
      instanceId: "shop_1",
    });
    expect(state.motion).toEqual({ status: "idle" });
    expect(windowState(state).placement).toBe("stage");
  });

  it("clears a pending placement when its window closes", () => {
    let state = runtimeReducer(mounted(), {
      type: "placement/request",
      instanceId: "shop_1",
      placement: "tray",
    });
    state = runtimeReducer(state, {
      type: "provider/unmount",
      instanceId: "shop_1",
    });
    expect(state.motion).toEqual({ status: "idle" });
  });

  it("preserves an executing lifecycle when the window minimizes", () => {
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
      type: "placement/request",
      instanceId: "shop_1",
      placement: "tray",
    });
    state = runtimeReducer(state, {
      type: "motion/finish",
      instanceId: "shop_1",
    });
    expect(windowState(state).placement).toBe("tray");
    expect(windowState(state).lifecycle).toBe("executing");
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
      openedBy: "agent",
      touchedAt: 2,
    });
    expect(windowState(state).providerId).toBe("shop");
    expect(windowState(state, "accounts_1").providerId).toBe("accounts");
    expect(state.windowOrder).toEqual(["shop_1", "accounts_1"]);
    expect(state.workflow.lifecycle).toBe("executing");
    expect(state.workflow.steps).toHaveLength(1);
  });

  it("changes stacking without changing persistent window identity order", () => {
    let state = runtimeReducer(mounted(), {
      type: "provider/mount",
      providerId: "accounts",
      instanceId: "accounts_1",
      origin: "http://localhost:3001",
      entryUrl: "http://localhost:3001/",
      openedBy: "human",
      touchedAt: 2,
    });
    state = runtimeReducer(state, {
      type: "provider/focus",
      instanceId: "shop_1",
      touchedAt: 3,
    });
    expect(Object.keys(state.windows)).toEqual(["shop_1", "accounts_1"]);
    expect(state.windowOrder).toEqual(["accounts_1", "shop_1"]);
    expect(state.focusedInstanceId).toBe("shop_1");
  });

  it("appears a new stage window through suction", () => {
    const state = runtimeReducer(mounted(), {
      type: "placement/appear",
      instanceId: "shop_1",
    });
    expect(state.motion).toEqual({
      status: "suction",
      instanceId: "shop_1",
      placement: "stage",
    });
    expect(
      runtimeReducer(state, {
        type: "motion/finish",
        instanceId: "shop_1",
      }).windows.shop_1?.placement,
    ).toBe("stage");
  });

  it("does not appear while another suction is pending", () => {
    const pending = runtimeReducer(mounted(), {
      type: "placement/request",
      instanceId: "shop_1",
      placement: "tray",
    });
    expect(
      runtimeReducer(pending, {
        type: "placement/appear",
        instanceId: "shop_1",
      }),
    ).toBe(pending);
  });

  it("unmounts after close suction finishes", () => {
    let state = runtimeReducer(mounted(), {
      type: "placement/request",
      instanceId: "shop_1",
      placement: "tray",
      settle: "unmount",
    });
    expect(state.motion).toEqual({
      status: "suction",
      instanceId: "shop_1",
      placement: "tray",
      settle: "unmount",
    });
    state = runtimeReducer(state, {
      type: "motion/finish",
      instanceId: "shop_1",
    });
    expect(state.windows.shop_1).toBeUndefined();
    expect(state.windowOrder).toEqual([]);
    expect(state.motion).toEqual({ status: "idle" });
  });

  it("closes one window without clearing another window or the workflow", () => {
    let state = runtimeReducer(mounted(), {
      type: "workflow/prepared",
      workflowId: "wf_1",
      steps: [catalogStep()],
    });
    state = runtimeReducer(state, {
      type: "provider/mount",
      providerId: "accounts",
      instanceId: "accounts_1",
      origin: "http://localhost:3001",
      entryUrl: "http://localhost:3001/",
      openedBy: "human",
      touchedAt: 2,
    });
    state = runtimeReducer(state, {
      type: "provider/unmount",
      instanceId: "shop_1",
    });

    expect(state.windows.shop_1).toBeUndefined();
    expect(windowState(state, "accounts_1").providerId).toBe("accounts");
    expect(state.workflow.lifecycle).toBe("prepared");
    expect(state.focusedInstanceId).toBe("accounts_1");
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
    expect(windowState(state).discoveredTools).toEqual([]);
  });
});
