import {
  boundedError,
  boundedSuccess,
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
import { DirectoryError } from "@/lib/providers/directory";
import { executeRegisteredTool } from "@/lib/webmcp/execute";
import { validateJsonSchemaInput } from "@/lib/webmcp/json-schema-validator";

import { isCancellation } from "./cancellation";
import { findProviderWindow, type RuntimeState } from "./state";

export type InvokeGrantedDependencies = {
  catalog: ProviderCatalog;
  acquireOperation: () => (() => void) | null;
  getState: () => RuntimeState;
  discover: (
    providerId: string,
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

export async function invokeGrantedTool(options: {
  input: InvokeGrantedToolInput;
  signal: AbortSignal;
  dependencies: InvokeGrantedDependencies;
}): Promise<BoundedResultEnvelope<InvokeGrantedToolOutput>> {
  const { input, signal, dependencies } = options;
  let provider;
  try {
    provider = getProvider(dependencies.catalog, input.providerId);
  } catch (error) {
    if (error instanceof DirectoryError) {
      return boundedError(error.code, error.message);
    }
    return boundedError("unknown_provider", "Provider is not installed.");
  }
  if (provider.source !== "custom") {
    return boundedError(
      "provider_not_invokable",
      "Built-in providers are available only through typed workflows.",
    );
  }
  if (!provider.grantedTools.includes(input.tool)) {
    return boundedError(
      "tool_not_granted",
      "This tool has not been granted by the user.",
    );
  }
  const releaseOperation = dependencies.acquireOperation();
  if (!releaseOperation) {
    return boundedError(
      "operation_in_progress",
      "Another provider operation is already in progress.",
    );
  }

  try {
    const discovered = await dependencies.discover(input.providerId, signal);
    if (discovered.status === "error") {
      return discovered;
    }
    signal.throwIfAborted();
    const state = dependencies.getState();
    const windowState = findProviderWindow(state, provider.id);
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
      signal,
    });
    let data;
    try {
      data = parseBoundedJsonResult(parseExecuteResultText(resultText));
    } catch (error) {
      if (error instanceof Error && error.message === "result_too_large") {
        return boundedError(
          "output_too_large",
          "Tool output exceeds the result limit.",
        );
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
    return isCancellation(error, signal)
      ? boundedError("cancelled", "Tool invocation was cancelled.")
      : boundedError("execution_failed", "Tool invocation failed.");
  } finally {
    releaseOperation();
  }
}
