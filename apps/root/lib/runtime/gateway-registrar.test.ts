import { afterEach, describe, expect, it, vi } from "vitest";

import {
  boundedError,
  boundedSuccess,
  type ModelContext,
  type ModelContextTool,
} from "@repo/contracts";

import {
  registerGatewayTools,
  type GatewayHandlers,
} from "./gateway-registrar";

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  const tools: ModelContextTool[] = [];
  const context = Object.assign(new EventTarget(), {
    registerTool: async (tool: ModelContextTool) => {
      tools.push(tool);
    },
    getTools: async () => [],
    executeTool: async () => undefined,
  }) satisfies ModelContext;
  vi.stubGlobal("document", { modelContext: context });
  return tools;
}

function handlers(): GatewayHandlers {
  return {
    listProviders: () =>
      boundedSuccess({
        providers: [
          {
            providerId: "custom-analytics-1",
            label: "Analytics",
            source: "custom",
            capability: "discovery-only",
          },
        ],
      }),
    discoverCapabilities: async (input) =>
      boundedSuccess({
        providerId: input.providerId,
        origin: "https://analytics.example",
        contractVersion: null,
        tools: [],
      }),
    prepareWorkflow: () =>
      boundedError("unsupported_graph", "Not used in this test."),
    executeWorkflow: async () =>
      boundedError("workflow_not_prepared", "Not used in this test."),
    cancelWorkflow: () =>
      boundedError("workflow_not_found", "Not used in this test."),
    inspectWorkflow: () =>
      boundedError("workflow_not_found", "Not used in this test."),
  };
}

describe("registerGatewayTools", () => {
  it("registers list_providers as a read-only catalog tool", async () => {
    const tools = setup();
    await registerGatewayTools(new AbortController().signal, {
      current: handlers(),
    });
    const list = tools.find((tool) => tool.name === "list_providers");
    expect(list?.annotations?.readOnlyHint).toBe(true);
    const result = await list?.execute(
      {},
      { signal: new AbortController().signal },
    );
    expect(result).toEqual({
      status: "success",
      data: {
        providers: [
          {
            providerId: "custom-analytics-1",
            label: "Analytics",
            source: "custom",
            capability: "discovery-only",
          },
        ],
      },
    });
  });

  it("accepts a bounded dynamic provider ID for discovery", async () => {
    const tools = setup();
    const gatewayHandlers = handlers();
    gatewayHandlers.discoverCapabilities = vi.fn(
      gatewayHandlers.discoverCapabilities,
    );
    await registerGatewayTools(new AbortController().signal, {
      current: gatewayHandlers,
    });
    const discover = tools.find(
      (tool) => tool.name === "discover_capabilities",
    );
    await discover?.execute(
      { providerId: "custom-analytics-1" },
      { signal: new AbortController().signal },
    );
    expect(gatewayHandlers.discoverCapabilities).toHaveBeenCalledWith(
      { providerId: "custom-analytics-1" },
      expect.any(AbortSignal),
    );
  });
});
