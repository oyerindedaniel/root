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
    expect(state.provider.lifecycle).toBe("unmounted");
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

  it("mounts a bounded dynamic provider identity", () => {
    const state = runtimeReducer(createInitialRuntimeState(account), {
      type: "provider/mount",
      providerId: "custom-analytics-1",
      instanceId: "custom-analytics-1_instance",
      origin: "https://analytics.example",
      entryUrl: "https://analytics.example/app",
    });
    expect(state.provider.providerId).toBe("custom-analytics-1");
    expect(state.provider.entryUrl).toBe("https://analytics.example/app");
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
    expect(state.provider.activeTool).toBe("shop.search_products");
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
    expect(state.provider.outcome).toBe("passed");
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
    expect(state.provider.outcome).toBe("failed");
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
