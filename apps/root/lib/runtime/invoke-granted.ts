import {
  boundedError,
  boundedSuccess,
  GatewayError,
  parseBoundedJsonResult,
  parseExecuteResultText,
  type BoundedResultEnvelope,
  type DiscoverCapabilitiesOutput,
  type InvokeGrantedToolInput,
  type InvokeGrantedToolOutput,
  type InvokeKind,
  type ModelContext,
  type RegisteredTool,
} from "@repo/contracts";

import { getProvider, type ProviderCatalog } from "@/lib/providers/catalog";
import type { CustomProvider } from "@/lib/storage/workspace-preferences";
import { executeRegisteredTool } from "@/lib/webmcp/execute";
import { validateJsonSchemaInput } from "@/lib/webmcp/json-schema-validator";

import { abortErrorCode, abortErrorMessage } from "./cancellation";
import { type RuntimeState } from "./state";

export type WindowOperation = {
  instanceId: string;
  release: () => void;
};

export type InvokeGrantedDependencies = {
  getCatalog: () => ProviderCatalog;
  acquireOperation: () => WindowOperation | null;
  adoptAbort?: (instanceId: string, parent: AbortSignal) => AbortSignal;
  getState: () => RuntimeState;
  discover: (
    providerId: string,
    instanceId: string,
    signal: AbortSignal,
  ) => Promise<BoundedResultEnvelope<DiscoverCapabilitiesOutput>>;
  getHandle: (
    instanceId: string,
    origin: string,
    toolName: string,
  ) => RegisteredTool | undefined;
  getModelContext: () => ModelContext | undefined;
  executeTool?: (options: {
    modelContext: ModelContext;
    tool: RegisteredTool;
    invokeKind: InvokeKind;
    input: object;
    signal: AbortSignal;
  }) => Promise<string>;
};

function requireGrantedCustomProvider(
  catalog: ProviderCatalog,
  providerId: string,
  tool: string,
) {
  const provider = getProvider(catalog, providerId);
  if (provider.source !== "custom") {
    throw new GatewayError(
      "provider_not_invokable",
      "Built-in providers are available only through typed workflows.",
    );
  }
  if (!provider.grantedTools.includes(tool)) {
    throw new GatewayError(
      "tool_not_granted",
      "This tool has not been granted by the user.",
    );
  }
  return provider;
}

export async function invokeGrantedTool(options: {
  input: InvokeGrantedToolInput;
  signal: AbortSignal;
  dependencies: InvokeGrantedDependencies;
}): Promise<BoundedResultEnvelope<InvokeGrantedToolOutput>> {
  const { input, signal, dependencies } = options;
  let provider: CustomProvider;
  try {
    provider = requireGrantedCustomProvider(
      dependencies.getCatalog(),
      input.providerId,
      input.tool,
    );
  } catch (error) {
    if (error instanceof GatewayError) {
      return boundedError(error.code, error.message);
    }
    return boundedError("unknown_provider", "Provider is not installed.");
  }
  const operation = dependencies.acquireOperation();
  if (!operation) {
    return boundedError(
      "operation_in_progress",
      "Another provider operation is already in progress.",
    );
  }

  let operationSignal = signal;
  try {
    if (dependencies.adoptAbort) {
      operationSignal = dependencies.adoptAbort(operation.instanceId, signal);
    }
    const discovered = await dependencies.discover(
      input.providerId,
      operation.instanceId,
      operationSignal,
    );
    if (discovered.status === "error") {
      return discovered;
    }
    operationSignal.throwIfAborted();
    try {
      provider = requireGrantedCustomProvider(
        dependencies.getCatalog(),
        input.providerId,
        input.tool,
      );
    } catch (error) {
      if (error instanceof GatewayError) {
        return boundedError(error.code, error.message);
      }
      return boundedError("unknown_provider", "Provider is not installed.");
    }
    const state = dependencies.getState();
    const windowState = state.windows[operation.instanceId];
    if (
      !windowState ||
      windowState.origin !== provider.origin ||
      windowState.entryUrl !== provider.entryUrl
    ) {
      return boundedError(
        "revalidation_failed",
        "The mounted provider no longer matches the saved provider.",
      );
    }
    const descriptor = windowState.discoveredTools.find(
      (tool) =>
        tool.providerId === provider.id &&
        tool.origin === provider.origin &&
        tool.name === input.tool,
    );
    if (!descriptor) {
      return boundedError(
        "tool_not_found",
        "The granted tool is not present on the live provider.",
      );
    }
    const validation = validateJsonSchemaInput(
      descriptor.inputSchema,
      input.arguments,
    );
    if (validation !== "valid") {
      return boundedError(
        validation,
        validation === "invalid_schema"
          ? "The live tool schema is unsupported or malformed."
          : "Tool arguments do not match the live schema.",
      );
    }
    const handle = dependencies.getHandle(
      windowState.instanceId,
      provider.origin,
      input.tool,
    );
    if (!handle) {
      return boundedError("stale_handle", "The live tool handle is unavailable.");
    }
    const modelContext = dependencies.getModelContext();
    if (!modelContext) {
      return boundedError(
        "webmcp_unavailable",
        "WebMCP is unavailable in this browser.",
      );
    }
    const executeTool = dependencies.executeTool ?? executeRegisteredTool;
    const resultText = await executeTool({
      modelContext,
      tool: handle,
      invokeKind: descriptor.invokeKind,
      input: input.arguments,
      signal: operationSignal,
    });
    let data;
    try {
      data = parseBoundedJsonResult(parseExecuteResultText(resultText));
    } catch (error) {
      if (error instanceof GatewayError) {
        return boundedError(error.code, error.message);
      }
      return boundedError("execution_failed", "Tool output is not valid JSON.");
    }
    return boundedSuccess({
      providerId: provider.id,
      tool: input.tool,
      untrusted: true,
      data,
    });
  } catch (error) {
    const code = abortErrorCode(error, operationSignal);
    if (code) {
      return boundedError(code, abortErrorMessage(code, "Tool invocation"));
    }
    return boundedError("execution_failed", "Tool invocation failed.");
  } finally {
    operation.release();
  }
}
