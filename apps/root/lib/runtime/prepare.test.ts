import { describe, expect, it } from "vitest";

import { schemaFingerprint } from "@repo/contracts";

import { prepareShopSearchStep, revalidatePreparedStep } from "./prepare";
import { runtimeReducer } from "./reducer";
import { createInitialRuntimeState } from "./state";

const account = {
  id: "user_1",
  email: "dev@localhost",
  name: "Dev",
};

const fingerprint = schemaFingerprint({
  type: "object",
  properties: { query: { type: "string" } },
});

function readyState() {
  let state = createInitialRuntimeState(account);
  state = runtimeReducer(state, {
    type: "provider/mount",
    providerId: "shop",
    instanceId: "shop_1",
    origin: "http://localhost:3002",
    entryUrl: "http://localhost:3002/",
  });
  state = runtimeReducer(state, {
    type: "provider/loaded",
    instanceId: "shop_1",
  });
  state = runtimeReducer(state, {
    type: "provider/ready",
    instanceId: "shop_1",
    tools: [
      {
        providerId: "shop",
        namespacedName: "shop.search_products",
        name: "search_products",
        title: "Search products",
        description: "Search the test catalog.",
        origin: "http://localhost:3002",
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

describe("prepareShopSearchStep", () => {
  it("binds one read-only Catalog search", () => {
    const prepared = prepareShopSearchStep({
      state: readyState(),
      workflowId: "wf_1",
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
      expect(prepared.step.schemaFingerprint).toBe(fingerprint);
      expect(prepared.step.providerInstanceId).toBe("shop_1");
    }
  });

  it("rejects graphs that are not one Catalog search", () => {
    const prepared = prepareShopSearchStep({
      state: readyState(),
      workflowId: "wf_1",
      steps: [
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

  it("rejects unknown arguments", () => {
    const prepared = prepareShopSearchStep({
      state: readyState(),
      workflowId: "wf_1",
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
    const prepared = prepareShopSearchStep({
      state: readyState(),
      workflowId: "wf_1",
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
});

describe("revalidatePreparedStep", () => {
  it("fails when the fingerprint changed", () => {
    const state = readyState();
    const prepared = prepareShopSearchStep({
      state,
      workflowId: "wf_1",
      steps: [
        {
          providerId: "shop",
          tool: "search_products",
          arguments: { query: "keyboard" },
        },
      ],
    });
    if (!prepared.ok) {
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
      step: prepared.step,
    });
    expect(revalidated.ok).toBe(false);
    if (!revalidated.ok) {
      expect(revalidated.error.code).toBe("revalidation_failed");
    }
  });
});
