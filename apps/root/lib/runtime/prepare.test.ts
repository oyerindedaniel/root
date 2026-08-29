import { describe, expect, it } from "vitest";

import { schemaFingerprint } from "@repo/contracts";

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
};

const fingerprint = schemaFingerprint({
  type: "object",
  properties: { query: { type: "string" } },
});

function readyProvider(
  providerId: "shop" | "accounts",
  toolName: string,
  namespacedName: string,
) {
  const instanceId = `${providerId}_1`;
  const origin = origins[providerId];
  let state = createInitialRuntimeState(account);
  state = runtimeReducer(state, {
    type: "provider/mount",
    providerId,
    instanceId,
    origin,
    entryUrl: `${origin}/`,
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
        readOnlyHint: true,
        untrustedContentHint: false,
      },
    ],
  });
  return state;
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

  it("rejects graphs longer than two steps", () => {
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
          providerId: "shop",
          tool: "search_products",
          arguments: { query: "mouse" },
        },
      ],
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.error.code).toBe("unsupported_graph");
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

  it("rejects a live document that is missing the prepared tool", () => {
    const instanceId = "shop_1";
    let state = createInitialRuntimeState(account);
    state = runtimeReducer(state, {
      type: "provider/mount",
      providerId: "shop",
      instanceId,
      origin: origins.shop,
      entryUrl: `${origins.shop}/`,
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
  it("fails when the fingerprint changed", () => {
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
    const changed = {
      ...state,
      discoveredTools: state.discoveredTools.map((tool) => ({
        ...tool,
        schemaFingerprint: "other",
      })),
    };
    const revalidated = revalidatePreparedStep({
      state: changed,
      step: prepared.steps[0],
    });
    expect(revalidated.ok).toBe(false);
    if (!revalidated.ok) {
      expect(revalidated.error.code).toBe("revalidation_failed");
    }
  });
});
