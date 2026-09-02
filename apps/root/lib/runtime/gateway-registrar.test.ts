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

function setup(registrationSignals: Array<AbortSignal | undefined> = []) {
  const tools: ModelContextTool[] = [];
  const context = Object.assign(new EventTarget(), {
    registerTool: async (
      tool: ModelContextTool,
      options?: { signal?: AbortSignal },
    ) => {
      tools.push(tool);
      registrationSignals.push(options?.signal);
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
            grantedTools: [],
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
    invokeGrantedTool: async (input) =>
      boundedSuccess({
        providerId: input.providerId,
        tool: input.tool,
        untrusted: true,
        data: {},
      }),
    prepareWorkflow: () =>
      boundedError("unsupported_graph", "Not used in this test."),
    executeWorkflow: async () =>
      boundedError("workflow_not_prepared", "Not used in this test."),
    cancelWorkflow: () =>
      boundedError("workflow_not_found", "Not used in this test."),
    inspectWorkflow: () =>
      boundedError("workflow_not_found", "Not used in this test."),
    minimizeWindow: () =>
      boundedError("window_not_found", "Not used in this test."),
    maximizeWindow: () =>
      boundedError("window_not_found", "Not used in this test."),
    closeWindow: () =>
      boundedError("window_not_found", "Not used in this test."),
  };
}

describe("registerGatewayTools", () => {
  it("registers all ten gateway tools with the registrar signal", async () => {
    const registrationSignals: Array<AbortSignal | undefined> = [];
    const tools = setup(registrationSignals);
    const controller = new AbortController();

    await registerGatewayTools(controller.signal, { current: handlers() });

    expect(tools.map((tool) => tool.name)).toEqual([
      "list_providers",
      "discover_capabilities",
      "invoke_granted_tool",
      "prepare_workflow",
      "execute_workflow",
      "cancel_workflow",
      "inspect_workflow",
      "minimize_window",
      "maximize_window",
      "close_window",
    ]);
    expect(registrationSignals).toEqual(
      Array.from({ length: 10 }, () => controller.signal),
    );
  });

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
            grantedTools: [],
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

  it("falls back to the registrar signal when execution options are absent", async () => {
    const tools = setup();
    const gatewayHandlers = handlers();
    gatewayHandlers.discoverCapabilities = vi.fn(
      gatewayHandlers.discoverCapabilities,
    );
    const registrar = new AbortController();
    await registerGatewayTools(registrar.signal, {
      current: gatewayHandlers,
    });

    await tools
      .find((tool) => tool.name === "discover_capabilities")
      ?.execute({ providerId: "custom-analytics-1" });

    expect(gatewayHandlers.discoverCapabilities).toHaveBeenCalledWith(
      { providerId: "custom-analytics-1" },
      registrar.signal,
    );
  });

  it("routes invoke, prepare, execute, cancel, inspect, and window chrome inputs", async () => {
    const tools = setup();
    const gatewayHandlers = handlers();
    gatewayHandlers.prepareWorkflow = vi.fn(
      gatewayHandlers.prepareWorkflow,
    );
    gatewayHandlers.executeWorkflow = vi.fn(
      gatewayHandlers.executeWorkflow,
    );
    gatewayHandlers.cancelWorkflow = vi.fn(gatewayHandlers.cancelWorkflow);
    gatewayHandlers.inspectWorkflow = vi.fn(gatewayHandlers.inspectWorkflow);
    gatewayHandlers.invokeGrantedTool = vi.fn(
      gatewayHandlers.invokeGrantedTool,
    );
    gatewayHandlers.minimizeWindow = vi.fn(gatewayHandlers.minimizeWindow);
    gatewayHandlers.maximizeWindow = vi.fn(gatewayHandlers.maximizeWindow);
    gatewayHandlers.closeWindow = vi.fn(gatewayHandlers.closeWindow);
    await registerGatewayTools(new AbortController().signal, {
      current: gatewayHandlers,
    });
    const operationSignal = new AbortController().signal;

    await tools
      .find((tool) => tool.name === "invoke_granted_tool")
      ?.execute(
        {
          providerId: "custom-analytics-1",
          tool: "read_report",
          arguments: { query: "ada" },
        },
        { signal: operationSignal },
      );
    await tools
      .find((tool) => tool.name === "prepare_workflow")
      ?.execute(
        {
          steps: [
            {
              providerId: "shop",
              tool: "search_products",
              arguments: { query: "keyboard" },
            },
          ],
        },
        { signal: operationSignal },
      );
    await tools
      .find((tool) => tool.name === "execute_workflow")
      ?.execute({ workflowId: "wf_1" }, { signal: operationSignal });
    await tools
      .find((tool) => tool.name === "cancel_workflow")
      ?.execute({ workflowId: "wf_1" }, { signal: operationSignal });
    await tools
      .find((tool) => tool.name === "inspect_workflow")
      ?.execute({ workflowId: "wf_1" }, { signal: operationSignal });
    await tools
      .find((tool) => tool.name === "minimize_window")
      ?.execute({ providerId: "shop" }, { signal: operationSignal });
    await tools
      .find((tool) => tool.name === "maximize_window")
      ?.execute({ providerId: "shop" }, { signal: operationSignal });
    await tools
      .find((tool) => tool.name === "close_window")
      ?.execute({ providerId: "shop" }, { signal: operationSignal });

    expect(gatewayHandlers.prepareWorkflow).toHaveBeenCalledWith({
      steps: [
        {
          providerId: "shop",
          tool: "search_products",
          arguments: { query: "keyboard" },
        },
      ],
    });
    expect(gatewayHandlers.invokeGrantedTool).toHaveBeenCalledWith(
      {
        providerId: "custom-analytics-1",
        tool: "read_report",
        arguments: { query: "ada" },
      },
      operationSignal,
    );
    expect(gatewayHandlers.executeWorkflow).toHaveBeenCalledWith(
      { workflowId: "wf_1" },
      operationSignal,
    );
    expect(gatewayHandlers.cancelWorkflow).toHaveBeenCalledWith({
      workflowId: "wf_1",
    });
    expect(gatewayHandlers.inspectWorkflow).toHaveBeenCalledWith({
      workflowId: "wf_1",
    });
    expect(gatewayHandlers.minimizeWindow).toHaveBeenCalledWith({
      providerId: "shop",
    });
    expect(gatewayHandlers.maximizeWindow).toHaveBeenCalledWith({
      providerId: "shop",
    });
    expect(gatewayHandlers.closeWindow).toHaveBeenCalledWith({
      providerId: "shop",
    });
  });

  it("names the short prepare tool when the step uses a namespaced pass name", async () => {
    const tools = setup();
    const gatewayHandlers = handlers();
    gatewayHandlers.prepareWorkflow = vi.fn(
      gatewayHandlers.prepareWorkflow,
    );
    await registerGatewayTools(new AbortController().signal, {
      current: gatewayHandlers,
    });
    const result = await tools
      .find((tool) => tool.name === "prepare_workflow")
      ?.execute(
        {
          steps: [
            {
              providerId: "shop",
              tool: "shop.search_products",
              arguments: { query: "keyboard" },
            },
          ],
        },
        { signal: new AbortController().signal },
      );
    expect(result).toEqual(
      boundedError(
        "invalid_arguments",
        "prepare_workflow tool must be search_products, not shop.search_products.",
      ),
    );
    expect(gatewayHandlers.prepareWorkflow).not.toHaveBeenCalled();
  });

  it.each([
    ["list_providers", { extra: true }],
    ["discover_capabilities", { providerId: "shop", extra: true }],
    [
      "invoke_granted_tool",
      {
        providerId: "custom-analytics-1",
        tool: "read_report",
        arguments: {},
        origin: "https://analytics.example",
      },
    ],
    [
      "prepare_workflow",
      {
        steps: [
          {
            providerId: "shop",
            tool: "search_products",
            arguments: { query: "keyboard" },
          },
        ],
        extra: true,
      },
    ],
    ["execute_workflow", { workflowId: "wf_1", extra: true }],
    ["cancel_workflow", { workflowId: "wf_1", extra: true }],
    ["inspect_workflow", { workflowId: "wf_1", extra: true }],
    ["minimize_window", { providerId: "shop", extra: true }],
    ["maximize_window", { providerId: "shop", extra: true }],
    ["close_window", { providerId: "shop", extra: true }],
  ])("rejects unknown ingress keys for %s", async (name, input) => {
    const tools = setup();
    await registerGatewayTools(new AbortController().signal, {
      current: handlers(),
    });

    const result = await tools
      .find((tool) => tool.name === name)
      ?.execute(input, { signal: new AbortController().signal });

    expect(result).toMatchObject({
      status: "error",
      code: "invalid_arguments",
    });
  });

  it.each([
    "list_providers",
    "discover_capabilities",
    "invoke_granted_tool",
    "prepare_workflow",
    "execute_workflow",
    "cancel_workflow",
    "inspect_workflow",
    "minimize_window",
    "maximize_window",
    "close_window",
  ])("bounds malformed JSON ingress for %s", async (name) => {
    const tools = setup();
    await registerGatewayTools(new AbortController().signal, {
      current: handlers(),
    });

    const result = await tools
      .find((tool) => tool.name === name)
      ?.execute("{", { signal: new AbortController().signal });

    expect(result).toMatchObject({
      status: "error",
      code: "invalid_arguments",
    });
  });

  it("bounds invoke input before strict ingress parsing", async () => {
    const tools = setup();
    await registerGatewayTools(new AbortController().signal, {
      current: handlers(),
    });
    const result = await tools
      .find((tool) => tool.name === "invoke_granted_tool")
      ?.execute("x".repeat(17_000), {
        signal: new AbortController().signal,
      });
    expect(result).toMatchObject({
      status: "error",
      code: "input_too_large",
    });
  });

  it("rejects structurally oversized invoke input without calling the handler", async () => {
    const tools = setup();
    const gatewayHandlers = handlers();
    gatewayHandlers.invokeGrantedTool = vi.fn(
      gatewayHandlers.invokeGrantedTool,
    );
    await registerGatewayTools(new AbortController().signal, {
      current: gatewayHandlers,
    });
    let nested: Record<string, unknown> = {};
    for (let depth = 0; depth < 30; depth += 1) {
      nested = { value: nested };
    }
    const result = await tools
      .find((tool) => tool.name === "invoke_granted_tool")
      ?.execute(
        {
          providerId: "custom-analytics-1",
          tool: "read_report",
          arguments: nested,
        },
        { signal: new AbortController().signal },
      );
    expect(result).toMatchObject({
      status: "error",
      code: "input_too_large",
    });
    expect(gatewayHandlers.invokeGrantedTool).not.toHaveBeenCalled();
  });
});
