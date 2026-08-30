import {
  boundedError,
  boundedSuccess,
  parseBoundedJsonResult,
  parseExecuteResultText,
  type BoundedResultEnvelope,
  type DiscoverCapabilitiesOutput,
  type ExecuteWorkflowInput,
  type ExecuteWorkflowOutput,
  type InvokeKind,
  type ModelContext,
  type RegisteredTool,
  type WorkflowStepResult,
} from "@repo/contracts";

import { executeRegisteredTool } from "../webmcp/execute";
import { isCancellation } from "./cancellation";
import { parsePassToolResult } from "./pass-tools";
import { revalidatePreparedStep } from "./prepare";
import type { RuntimeAction, RuntimeState } from "./state";

export type ExecutePassDependencies = {
  getState: () => RuntimeState;
  dispatch: (action: RuntimeAction) => void;
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

export async function executePass(options: {
  input: ExecuteWorkflowInput;
  signal: AbortSignal;
  dependencies: ExecutePassDependencies;
}): Promise<BoundedResultEnvelope<ExecuteWorkflowOutput>> {
  const { input, signal, dependencies } = options;
  const current = dependencies.getState();
  if (
    current.workflow.id !== input.workflowId ||
    current.workflow.lifecycle !== "prepared" ||
    current.workflow.steps.length === 0
  ) {
    return boundedError(
      "workflow_not_prepared",
      "No prepared workflow matches that id.",
    );
  }
  const steps = current.workflow.steps;
  const executeTool = dependencies.executeTool ?? executeRegisteredTool;

  dependencies.dispatch({
    type: "workflow/executing",
    workflowId: input.workflowId,
  });
  const results: WorkflowStepResult[] = [];
  const evidenceParts: string[] = [];
  try {
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      if (!step) {
        throw new Error("execution_failed");
      }
      dependencies.dispatch({
        type: "workflow/step",
        workflowId: input.workflowId,
        index,
      });
      const discovered = await dependencies.discover(step.providerId, signal);
      if (discovered.status === "error") {
        dependencies.dispatch({
          type: "workflow/failed",
          workflowId: input.workflowId,
          reason: discovered.code,
        });
        return discovered;
      }
      signal.throwIfAborted();

      const live = dependencies.getState();
      const revalidated = revalidatePreparedStep({ state: live, step });
      if (!revalidated.ok) {
        dependencies.dispatch({ type: "workflow/invalidate" });
        return revalidated.error;
      }
      if (!live.provider.instanceId) {
        dependencies.dispatch({ type: "workflow/invalidate" });
        return boundedError(
          "revalidation_failed",
          "The provider document is gone.",
        );
      }

      const handle = dependencies.getHandle(
        live.provider.instanceId,
        step.origin,
        step.toolName,
      );
      const descriptor = live.discoveredTools.find(
        (tool) =>
          tool.providerId === step.providerId && tool.name === step.toolName,
      );
      if (!handle || !descriptor) {
        dependencies.dispatch({ type: "workflow/invalidate" });
        return boundedError(
          "revalidation_failed",
          "The prepared tool is no longer registered.",
        );
      }

      const modelContext = dependencies.getModelContext();
      if (!modelContext) {
        dependencies.dispatch({ type: "webmcp/unavailable" });
        dependencies.dispatch({
          type: "workflow/failed",
          workflowId: input.workflowId,
          reason: "webmcp_unavailable",
        });
        return boundedError(
          "webmcp_unavailable",
          "WebMCP is unavailable in this browser.",
        );
      }

      dependencies.dispatch({
        type: "workflow/executing",
        workflowId: input.workflowId,
      });
      const resultText = await executeTool({
        modelContext,
        tool: handle,
        invokeKind: descriptor.invokeKind,
        input: step.arguments,
        signal,
      });
      const parsed = parsePassToolResult(
        step.namespacedName,
        parseBoundedJsonResult(parseExecuteResultText(resultText)),
      );
      if (!parsed) {
        throw new Error("execution_failed");
      }
      results.push(parsed.result);
      evidenceParts.push(parsed.evidence);
    }

    const evidence = evidenceParts.join("; ");
    dependencies.dispatch({
      type: "workflow/passed",
      workflowId: input.workflowId,
      results,
      evidence,
    });
    return boundedSuccess({ results });
  } catch (error) {
    if (isCancellation(error, signal)) {
      dependencies.dispatch({
        type: "workflow/cancelled",
        workflowId: input.workflowId,
      });
      return boundedError("cancelled", "Workflow was cancelled.");
    }
    dependencies.dispatch({
      type: "workflow/failed",
      workflowId: input.workflowId,
      reason: "execution_failed",
    });
    return boundedError("execution_failed", "Workflow execution failed.");
  }
}
