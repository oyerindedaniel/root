import { describe, expect, it } from "vitest";

import { MAX_PREPARED_WORKFLOW_STEPS, schemaFingerprint } from "@repo/contracts";

import { prepareWorkflow, revalidatePreparedStep } from "./prepare";
import { runtimeReducer } from "./reducer";
import { createInitialRuntimeState } from "./state";

const account = {
  id: "user_1",
  email: "dev@localhost",
  name: "Dev",
};

const origins = {
  shop: "http://localhost:3002",
  accounts: "http://localhost:3001",
  support: "http://localhost:3003",
};

const fingerprint = schemaFingerprint({
  type: "object",
  properties: { query: { type: "string" } },
});

function readyProvider(
  providerId: "shop" | "accounts" | "support",
  toolName: string,
  namespacedName: string,
) {
  return addReadyProvider(
    createInitialRuntimeState(account),
    providerId,
    toolName,
    namespacedName,
  );
}

function addReadyProvider(
  initial: ReturnType<typeof createInitialRuntimeState>,
  providerId: "shop" | "accounts" | "support",
  toolName: string,
  namespacedName: string,
  readOnlyHint = true,
) {
  const instanceId = `${providerId}_1`;
  const origin = origins[providerId];
  let state = initial;
  state = runtimeReducer(state, {
    type: "provider/mount",
    providerId,
    instanceId,
    origin,
    entryUrl: `${origin}/`,
    openedBy: "human",
    touchedAt: 1,
  });
  state = runtimeReducer(state, {
    type: "provider/loaded",
    instanceId,
  });
  state = runtimeReducer(state, {
    type: "provider/ready",
    instanceId,
    tools: [
      {
        providerId,
        namespacedName,
        name: toolName,
        title: toolName,
        description: toolName,
        origin,
        inputSchema: { type: "object" },
        schemaFingerprint: fingerprint,
        invokeKind: "object",
        readOnlyHint,
        untrustedContentHint: false,
      },
    ],
  });
  return state;
}

function preparedProductStep() {
  const state = readyProvider(
    "shop",
    "search_products",
    "shop.search_products",
  );
  const prepared = prepareWorkflow({
    state,
    workflowId: "wf_1",
    origins,
    steps: [
      {
        providerId: "shop",
        tool: "search_products",
        arguments: { query: "keyboard" },
      },
    ],
  });
  if (!prepared.ok || !prepared.steps[0]) {
    throw new Error("expected prepare to succeed");
  }
  return { state, step: prepared.steps[0] };
}

describe("prepareWorkflow", () => {
  it("binds one read-only Catalog search against the live document", () => {
    const prepared = prepareWorkflow({
      state: readyProvider("shop", "search_products", "shop.search_products"),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "shop",
          tool: "search_products",
          arguments: { query: "keyboard" },
        },
      ],
    });
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.steps).toHaveLength(1);
      expect(prepared.steps[0]?.schemaFingerprint).toBe(fingerprint);
      expect(prepared.steps[0]?.origin).toBe(origins.shop);
    }
  });

  it("binds a Customers search then a Catalog search without both documents live", () => {
    const prepared = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "accounts",
          tool: "search_customers",
          arguments: { query: "ada" },
        },
        {
          providerId: "shop",
          tool: "search_products",
          arguments: { query: "keyboard" },
        },
      ],
    });
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.steps.map((step) => step.namespacedName)).toEqual([
        "accounts.search_customers",
        "shop.search_products",
      ]);
      expect(prepared.steps[0]?.schemaFingerprint).toBeNull();
      expect(prepared.steps[1]?.schemaFingerprint).toBeNull();
    }
  });

  it("stamps a fingerprint only for the currently open provider", () => {
    const prepared = prepareWorkflow({
      state: readyProvider(
        "accounts",
        "search_customers",
        "accounts.search_customers",
      ),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "accounts",
          tool: "search_customers",
          arguments: { query: "ada" },
        },
        {
          providerId: "shop",
          tool: "search_products",
          arguments: { query: "keyboard" },
        },
      ],
    });
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.steps[0]?.schemaFingerprint).toBe(fingerprint);
      expect(prepared.steps[1]?.schemaFingerprint).toBeNull();
    }
  });

  it("stamps fingerprints for every matching live provider window", () => {
    const accounts = readyProvider(
      "accounts",
      "search_customers",
      "accounts.search_customers",
    );
    const state = addReadyProvider(
      accounts,
      "shop",
      "search_products",
      "shop.search_products",
    );
    const prepared = prepareWorkflow({
      state,
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "accounts",
          tool: "search_customers",
          arguments: { query: "ada" },
        },
        {
          providerId: "shop",
          tool: "search_products",
          arguments: { query: "keyboard" },
        },
      ],
    });

    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.steps.map((step) => step.schemaFingerprint)).toEqual([
        fingerprint,
        fingerprint,
      ]);
    }
  });

  it("binds Customers, Catalog, and Cases without all documents live", () => {
    const prepared = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "accounts",
          tool: "search_customers",
          arguments: { query: "ada" },
        },
        {
          providerId: "shop",
          tool: "search_products",
          arguments: { query: "keyboard" },
        },
        {
          providerId: "support",
          tool: "search_cases",
          arguments: { query: "hub" },
        },
      ],
    });
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.steps.map((step) => step.namespacedName)).toEqual([
        "accounts.search_customers",
        "shop.search_products",
        "support.search_cases",
      ]);
    }
  });

  it("binds more allowlisted reads than the allowlist length", () => {
    const prepared = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "accounts",
          tool: "search_customers",
          arguments: { query: "ada" },
        },
        {
          providerId: "accounts",
          tool: "search_customers",
          arguments: { query: "lin" },
        },
        {
          providerId: "support",
          tool: "search_cases",
          arguments: { query: "hub" },
        },
        {
          providerId: "shop",
          tool: "search_products",
          arguments: { query: "keyboard" },
        },
      ],
    });
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.steps.map((step) => step.namespacedName)).toEqual([
        "accounts.search_customers",
        "accounts.search_customers",
        "support.search_cases",
        "shop.search_products",
      ]);
    }
  });

  it("rejects graphs longer than the safety cap", () => {
    const prepared = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: Array.from(
        { length: MAX_PREPARED_WORKFLOW_STEPS + 1 },
        (_, index) => ({
          providerId: "accounts" as const,
          tool: "search_customers" as const,
          arguments: { query: `q${index}` },
        }),
      ),
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.error.code).toBe("unsupported_graph");
    }
  });

  it("binds a Cases search as a builtin read step", () => {
    const prepared = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "support",
          tool: "search_cases",
          arguments: { query: "hub" },
        },
      ],
    });
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.steps[0]?.namespacedName).toBe("support.search_cases");
      expect(prepared.steps[0]?.origin).toBe(origins.support);
    }
  });

  it("rejects tools that are not on the pass allowlist", () => {
    const prepared = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "shop",
          tool: "create_order",
          arguments: { query: "keyboard" },
        },
      ],
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.error.code).toBe("unsupported_graph");
    }
  });

  it("rejects custom providers even when they claim a built-in tool name", () => {
    const prepared = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "custom-analytics-1",
          tool: "search_products",
          arguments: { query: "keyboard" },
        },
      ],
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.error.code).toBe("unsupported_graph");
    }
  });

  it("rejects unknown arguments", () => {
    const prepared = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "shop",
          tool: "search_products",
          arguments: { query: "keyboard", extra: true },
        },
      ],
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.error.code).toBe("unsupported_graph");
    }
  });

  it("rejects empty queries", () => {
    const prepared = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "shop",
          tool: "search_products",
          arguments: { query: "" },
        },
      ],
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.error.code).toBe("unsupported_graph");
    }
  });

  it("freezes a Cases query bound to an earlier step", () => {
    const prepared = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "accounts",
          tool: "search_customers",
          arguments: { query: "ada" },
        },
        {
          providerId: "accounts",
          tool: "select_result",
          arguments: { source: { bind: { stepIndex: 0 } } },
        },
        {
          providerId: "support",
          tool: "search_cases",
          arguments: { query: { bind: { stepIndex: 1 } } },
        },
      ],
    });
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      const step = prepared.steps[2];
      if (!step || step.toolName !== "search_cases") {
        throw new Error("expected search_cases");
      }
      expect(step.arguments.query).toEqual({
        bind: { stepIndex: 1 },
      });
    }
  });

  it("freezes an open id bound to an earlier selected step", () => {
    const prepared = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "accounts",
          tool: "search_customers",
          arguments: { query: "ada" },
        },
        {
          providerId: "accounts",
          tool: "select_result",
          arguments: { source: { bind: { stepIndex: 0 } } },
        },
        {
          providerId: "accounts",
          tool: "open_customer",
          arguments: { id: { bind: { stepIndex: 1 } } },
        },
      ],
    });
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.steps[2]?.arguments).toEqual({
        id: { bind: { stepIndex: 1 } },
      });
      expect(prepared.steps[2]?.readOnly).toBe(true);
    }
  });

  it("rejects an open id bind that is not an earlier step", () => {
    const prepared = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "accounts",
          tool: "open_customer",
          arguments: { id: { bind: { stepIndex: 0 } } },
        },
      ],
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.error.code).toBe("unsupported_graph");
    }
  });

  it("rejects a copied id for a selected-record open", () => {
    const prepared = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "accounts",
          tool: "open_customer",
          arguments: { id: "customer_1" },
        },
      ],
    });
    expect(prepared.ok).toBe(false);
  });

  it("allows an explicit direct-id record open", () => {
    const prepared = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "accounts",
          tool: "open_customer_by_id",
          arguments: { id: "customer_1" },
        },
      ],
    });
    expect(prepared.ok).toBe(true);
  });

  it("freezes a create step as a write", () => {
    const prepared = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "accounts",
          tool: "create_customer",
          arguments: { name: "Ada", email: "ada@localhost" },
        },
      ],
    });
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.steps[0]?.namespacedName).toBe(
        "accounts.create_customer",
      );
      expect(prepared.steps[0]?.readOnly).toBe(false);
    }
  });

  it("accepts a live create tool whose hint is a write", () => {
    const prepared = prepareWorkflow({
      state: addReadyProvider(
        createInitialRuntimeState(account),
        "accounts",
        "create_customer",
        "accounts.create_customer",
        false,
      ),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "accounts",
          tool: "create_customer",
          arguments: { name: "Ada", email: "ada@localhost" },
        },
      ],
    });
    expect(prepared.ok).toBe(true);
  });

  it("rejects a live create tool that still claims to be read-only", () => {
    const prepared = prepareWorkflow({
      state: addReadyProvider(
        createInitialRuntimeState(account),
        "accounts",
        "create_customer",
        "accounts.create_customer",
      ),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "accounts",
          tool: "create_customer",
          arguments: { name: "Ada", email: "ada@localhost" },
        },
      ],
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.error.code).toBe("unsupported_graph");
    }
  });

  it("rejects a bind that is not an earlier Cases argument", () => {
    const sameStep = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "support",
          tool: "search_cases",
          arguments: { query: { bind: { stepIndex: 0 } } },
        },
      ],
    });
    expect(sameStep.ok).toBe(false);
    if (!sameStep.ok) {
      expect(sameStep.error.code).toBe("unsupported_graph");
    }
    const intoShop = prepareWorkflow({
      state: createInitialRuntimeState(account),
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "accounts",
          tool: "search_customers",
          arguments: { query: "ada" },
        },
        {
          providerId: "shop",
          tool: "search_products",
          arguments: { query: { bind: { stepIndex: 0 } } },
        },
      ],
    });
    expect(intoShop.ok).toBe(false);
    if (!intoShop.ok) {
      expect(intoShop.error.code).toBe("unsupported_graph");
    }
  });

  it("rejects a live document that is missing the prepared tool", () => {
    const instanceId = "shop_1";
    let state = createInitialRuntimeState(account);
    state = runtimeReducer(state, {
      type: "provider/mount",
      providerId: "shop",
      instanceId,
      origin: origins.shop,
      entryUrl: `${origins.shop}/`,
      openedBy: "human",
      touchedAt: 1,
    });
    state = runtimeReducer(state, {
      type: "provider/loaded",
      instanceId,
    });
    state = runtimeReducer(state, {
      type: "provider/ready",
      instanceId,
      tools: [],
    });
    const prepared = prepareWorkflow({
      state,
      workflowId: "wf_1",
      origins,
      steps: [
        {
          providerId: "shop",
          tool: "search_products",
          arguments: { query: "keyboard" },
        },
      ],
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.error.code).toBe("tool_not_found");
    }
  });
});

describe("revalidatePreparedStep", () => {
  it("fails when the provider changed", () => {
    const { state, step } = preparedProductStep();
    const revalidated = revalidatePreparedStep({
      state: {
        ...state,
        windows: {},
        windowOrder: [],
        focusedInstanceId: null,
      },
      step,
    });

    expect(revalidated.ok).toBe(false);
    if (!revalidated.ok) {
      expect(revalidated.error.code).toBe("revalidation_failed");
    }
  });

  it("fails when the provider origin changed", () => {
    const { state, step } = preparedProductStep();
    const revalidated = revalidatePreparedStep({
      state: {
        ...state,
        windows: {
          ...state.windows,
          shop_1: {
            ...state.windows.shop_1!,
            origin: origins.accounts,
          },
        },
      },
      step,
    });

    expect(revalidated.ok).toBe(false);
    if (!revalidated.ok) {
      expect(revalidated.error.code).toBe("revalidation_failed");
    }
  });

  it("fails when the tool disappeared", () => {
    const { state, step } = preparedProductStep();
    const revalidated = revalidatePreparedStep({
      state: {
        ...state,
        windows: {
          ...state.windows,
          shop_1: { ...state.windows.shop_1!, discoveredTools: [] },
        },
      },
      step,
    });

    expect(revalidated.ok).toBe(false);
    if (!revalidated.ok) {
      expect(revalidated.error.code).toBe("revalidation_failed");
    }
  });

  it("fails when the tool lost its read-only hint", () => {
    const { state, step } = preparedProductStep();
    const revalidated = revalidatePreparedStep({
      state: {
        ...state,
        windows: {
          ...state.windows,
          shop_1: {
            ...state.windows.shop_1!,
            discoveredTools: state.windows.shop_1!.discoveredTools.map(
              (tool) => ({ ...tool, readOnlyHint: false }),
            ),
          },
        },
      },
      step,
    });

    expect(revalidated.ok).toBe(false);
    if (!revalidated.ok) {
      expect(revalidated.error.code).toBe("revalidation_failed");
    }
  });

  it("fails when the fingerprint changed", () => {
    const { state, step } = preparedProductStep();
    const changed = {
      ...state,
      windows: {
        ...state.windows,
        shop_1: {
          ...state.windows.shop_1!,
          discoveredTools: state.windows.shop_1!.discoveredTools.map(
            (tool) => ({ ...tool, schemaFingerprint: "other" }),
          ),
        },
      },
    };
    const revalidated = revalidatePreparedStep({
      state: changed,
      step,
    });
    expect(revalidated.ok).toBe(false);
    if (!revalidated.ok) {
      expect(revalidated.error.code).toBe("revalidation_failed");
    }
  });
});
