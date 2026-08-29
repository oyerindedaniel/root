import {
  serializeExecuteInput,
  type InvokeKind,
  type ModelContext,
  type RegisteredTool,
} from "@repo/contracts";

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
