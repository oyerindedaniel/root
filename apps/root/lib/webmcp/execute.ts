import {
  serializeExecuteInput,
  type InvokeKind,
} from "@repo/contracts";

import type { ModelContext, RegisteredTool } from "./model-context";

export async function executeRegisteredTool(options: {
  modelContext: ModelContext;
  tool: RegisteredTool;
  invokeKind: InvokeKind;
  input: Record<string, unknown>;
  signal: AbortSignal;
}): Promise<string> {
  const serialized = serializeExecuteInput(options.invokeKind, options.input);
  const result = await options.modelContext.executeTool(options.tool, serialized, {
    signal: options.signal,
  });
  if (typeof result === "string") {
    return result;
  }
  return JSON.stringify(result);
}
