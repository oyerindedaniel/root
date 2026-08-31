import { describe, expect, it, vi } from "vitest";

import {
  boundedError,
  boundedSuccess,
  type ModelContext,
  type NormalizedToolDescriptor,
  type PreparedWorkflowStep,
  type RegisteredTool,
} from "@repo/contracts";

import { executePass, type ExecutePassDependencies } from "./execute-pass";
import { runtimeReducer } from "./reducer";
import {
  createInitialRuntimeState,
  type RuntimeAction,
} from "./state";

const account = {
  id: "user_1",
  email: "dev@localhost",
  name: "Dev",
};

const origins = {
  accounts: "http://localhost:3001",
  shop: "http://localhost:3002",
};

const productStep: PreparedWorkflowStep = {
  providerId: "shop",
  origin: origins.shop,
  toolName: "search_products",
  namespacedName: "shop.search_products",
  schemaFingerprint: null,
  arguments: { query: "keyboard" },
  readOnly: true,
};

const customerStep: PreparedWorkflowStep = {
  providerId: "accounts",
  origin: origins.accounts,
  toolName: "search_customers",
  namespacedName: "accounts.search_customers",
  schemaFingerprint: null,
  arguments: { query: "ada" },
  readOnly: true,
};

const productOutput = {
  status: "success",
  query: "keyboard",
  products: [
    {
      id: "product_1",
      name: "Keyboard",
      description: "A keyboard",
      priceUsd: 40,
    },
  ],
};

const customerOutput = {
  status: "success",
  query: "ada",
  customers: [
    {
      id: "customer_1",
      name: "Ada",
      email: "ada@localhost",
    },
  ],
};

function descriptor(step: PreparedWorkflowStep): NormalizedToolDescriptor {
  return {
    providerId: step.providerId,
    namespacedName: step.namespacedName,
    name: step.toolName,
    title: step.toolName,
    description: step.toolName,
    origin: step.origin,
    inputSchema: { type: "object" },
    schemaFingerprint: "live-fingerprint",
    invokeKind: "object",
    readOnlyHint: true,
    untrustedContentHint: false,
  };
}

function handle(step: PreparedWorkflowStep): RegisteredTool {
  return {
    name: step.toolName,
    origin: step.origin,
    inputSchema: { type: "object" },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  };
}

function createHarness(steps: PreparedWorkflowStep[]) {
  let state = runtimeReducer(createInitialRuntimeState(account), {
    type: "workflow/prepared",
    workflowId: "wf_1",
    steps,
  });
  const events: string[] = [];
  const handles = new Map(steps.map((step) => [step.namespacedName, handle(step)]));
  const modelContext = Object.assign(new EventTarget(), {
    registerTool: async () => undefined,
    getTools: async () => [],
    executeTool: async () => undefined,
  }) satisfies ModelContext;

  const setLiveProvider = (
    step: PreparedWorkflowStep,
    tools: NormalizedToolDescriptor[] = [descriptor(step)],
  ) => {
    const instanceId = `${step.providerId}_instance`;
    state = runtimeReducer(state, {
      type: "provider/mount",
      providerId: step.providerId,
      instanceId,
      origin: step.origin,
      entryUrl: `${step.origin}/`,
      openedBy: "agent",
      touchedAt: state.windowOrder.length + 1,
    });
    state = runtimeReducer(state, {
      type: "provider/loaded",
      instanceId,
    });
    state = runtimeReducer(state, {
      type: "provider/ready",
      instanceId,
      tools,
    });
  };

  const dispatch = vi.fn((action: RuntimeAction) => {
    events.push(action.type);
    state = runtimeReducer(state, action);
  });
  const discover = vi.fn(async (providerId: string) => {
    events.push(`discover:${providerId}`);
    const step = steps.find((candidate) => candidate.providerId === providerId);
    if (!step) {
      return boundedError("discovery_failed", "Capability discovery failed.");
    }
    setLiveProvider(step);
    return boundedSuccess({
      providerId: step.providerId,
      origin: step.origin,
      contractVersion: "1.0.0",
      tools: [descriptor(step)],
    });
  });
  const executeTool = vi.fn(
    async (options: Parameters<NonNullable<ExecutePassDependencies["executeTool"]>>[0]) => {
      events.push(`execute:${options.tool.name}`);
      return JSON.stringify(
        options.tool.name === "search_products" ? productOutput : customerOutput,
      );
    },
  );
  const dependencies: ExecutePassDependencies = {
    getState: () => state,
    dispatch,
    discover,
    getHandle: (_instanceId, _origin, toolName) => {
      const step = steps.find((candidate) => candidate.toolName === toolName);
      return step ? handles.get(step.namespacedName) : undefined;
    },
    getModelContext: () => modelContext,
    executeTool,
  };

  return {
    dependencies,
    discover,
    dispatch,
    events,
    executeTool,
    getState: () => state,
    handles,
    modelContext,
    setLiveProvider,
  };
}

async function run(
  harness: ReturnType<typeof createHarness>,
  signal = new AbortController().signal,
) {
  return executePass({
    input: { workflowId: "wf_1" },
    signal,
    dependencies: harness.dependencies,
  });
}

describe("executePass", () => {
  it("executes one step and records its result and evidence", async () => {
    const harness = createHarness([productStep]);
    const result = await run(harness);

    expect(result).toEqual(
      boundedSuccess({
        results: [{ tool: "shop.search_products", data: productOutput }],
      }),
    );
    expect(harness.getState().workflow.lifecycle).toBe("passed");
    expect(harness.getState().workflow.evidence).toBe(
      '1 products for "keyboard"',
    );
  });

  it("executes two steps in provider and tool order", async () => {
    const harness = createHarness([customerStep, productStep]);
    const result = await run(harness);

    expect(result.status).toBe("success");
    expect(harness.events).toEqual([
      "workflow/executing",
      "workflow/step",
      "discover:accounts",
      "workflow/executing",
      "execute:search_customers",
      "workflow/step",
      "discover:shop",
      "workflow/executing",
      "execute:search_products",
      "workflow/passed",
    ]);
    expect(harness.getState().workflow.evidence).toBe(
      '1 customers for "ada"; 1 products for "keyboard"',
    );
    expect(Object.keys(harness.getState().windows)).toEqual([
      "accounts_instance",
      "shop_instance",
    ]);
    expect(
      harness.getState().windows.accounts_instance?.instanceId,
    ).toBe("accounts_instance");
  });

  it("returns workflow_not_prepared without starting discovery", async () => {
    const harness = createHarness([productStep]);
    const result = await executePass({
      input: { workflowId: "wf_other" },
      signal: new AbortController().signal,
      dependencies: harness.dependencies,
    });

    expect(result.status).toBe("error");
    expect(result.status === "error" ? result.code : null).toBe(
      "workflow_not_prepared",
    );
    expect(harness.discover).not.toHaveBeenCalled();
  });

  it("cancels when the operation signal aborts", async () => {
    const harness = createHarness([productStep]);
    const controller = new AbortController();
    harness.dependencies.discover = async (_providerId, signal) => {
      controller.abort();
      signal.throwIfAborted();
      return boundedError("discovery_failed", "unreachable");
    };

    const result = await run(harness, controller.signal);

    expect(result.status === "error" ? result.code : null).toBe("cancelled");
    expect(harness.getState().workflow.lifecycle).toBe("cancelled");
  });

  it("fails malformed tool output", async () => {
    const harness = createHarness([productStep]);
    harness.dependencies.executeTool = async () => "{";

    const result = await run(harness);

    expect(result.status === "error" ? result.code : null).toBe(
      "execution_failed",
    );
    expect(harness.getState().workflow.lifecycle).toBe("failed");
  });

  it("invalidates when the live handle is missing", async () => {
    const harness = createHarness([productStep]);
    harness.handles.clear();

    const result = await run(harness);

    expect(result.status === "error" ? result.code : null).toBe(
      "revalidation_failed",
    );
    expect(harness.executeTool).not.toHaveBeenCalled();
  });

  it("invalidates when the live descriptor is missing", async () => {
    const harness = createHarness([productStep]);
    harness.dependencies.discover = async () => {
      harness.setLiveProvider(productStep, []);
      return boundedSuccess({
        providerId: "shop",
        origin: origins.shop,
        contractVersion: "1.0.0",
        tools: [],
      });
    };

    const result = await run(harness);

    expect(result.status === "error" ? result.code : null).toBe(
      "revalidation_failed",
    );
    expect(harness.executeTool).not.toHaveBeenCalled();
  });

  it("fails when WebMCP is unavailable", async () => {
    const harness = createHarness([productStep]);
    harness.dependencies.getModelContext = () => undefined;

    const result = await run(harness);

    expect(result.status === "error" ? result.code : null).toBe(
      "webmcp_unavailable",
    );
    expect(harness.getState().webmcpStatus).toBe("unavailable");
  });

  it("propagates discovery failure", async () => {
    const harness = createHarness([productStep]);
    harness.dependencies.discover = async () =>
      boundedError("discovery_timeout", "Capability discovery failed.");

    const result = await run(harness);

    expect(result.status === "error" ? result.code : null).toBe(
      "discovery_timeout",
    );
    expect(harness.getState().workflow.failureReason).toBe("discovery_timeout");
  });

  it("invalidates when revalidation fails", async () => {
    const stampedStep = { ...productStep, schemaFingerprint: "prepared" };
    const harness = createHarness([stampedStep]);

    const result = await run(harness);

    expect(result.status === "error" ? result.code : null).toBe(
      "revalidation_failed",
    );
    expect(harness.getState().workflow.failureReason).toBe(
      "revalidation_failed",
    );
  });

  it("does not execute a later step after the first step fails", async () => {
    const harness = createHarness([customerStep, productStep]);
    harness.dependencies.executeTool = vi.fn(async () => "{}");

    const result = await run(harness);

    expect(result.status === "error" ? result.code : null).toBe(
      "execution_failed",
    );
    expect(harness.discover).toHaveBeenCalledTimes(1);
    expect(harness.dependencies.executeTool).toHaveBeenCalledTimes(1);
  });
});
