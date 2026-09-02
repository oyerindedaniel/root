import {
  boundedError,
  boundedSuccess,
  GatewayError,
  isBindQuery,
  parseBoundedJsonResult,
  parseExecuteResultText,
  type BoundedResultEnvelope,
  type DiscoverCapabilitiesOutput,
  type ExecuteWorkflowInput,
  type ExecuteWorkflowOutput,
  type InvokeKind,
  type ModelContext,
  type PreparedWorkflowStep,
  type RegisteredTool,
  type WorkflowStepResult,
} from "@repo/contracts";

import { executeRegisteredTool } from "../webmcp/execute";
import {
  abortErrorCode,
  abortErrorMessage,
  CANCELLED,
  NO_RESPONSE,
  STOPPED_BY_USER,
} from "./cancellation";
import { parsePassToolResult } from "./pass-tools";
import { revalidatePreparedStep } from "./prepare";
import {
  type RuntimeAction,
  type RuntimeState,
} from "./state";

export type WindowOperation = {
  instanceId: string;
  release: () => void;
};

export type ExecutePassDependencies = {
  getState: () => RuntimeState;
  dispatch: (action: RuntimeAction) => void;
  acquireOperation: (providerId: string) => WindowOperation | null;
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
        throw new GatewayError(
          "execution_failed",
          "Workflow execution failed.",
        );
      }
      const operation = dependencies.acquireOperation(step.providerId);
      if (!operation) {
        dependencies.dispatch({
          type: "workflow/failed",
          workflowId: input.workflowId,
          reason: "operation_in_progress",
        });
        return boundedError(
          "operation_in_progress",
          "Another provider operation is already in progress.",
        );
      }
      try {
        dependencies.dispatch({
          type: "workflow/step",
          workflowId: input.workflowId,
          index,
        });
        const discovered = await dependencies.discover(
          step.providerId,
          operation.instanceId,
          signal,
        );
        if (discovered.status === "error") {
          if (
            discovered.code === STOPPED_BY_USER ||
            discovered.code === NO_RESPONSE ||
            discovered.code === CANCELLED
          ) {
            dependencies.dispatch({
              type: "workflow/cancelled",
              workflowId: input.workflowId,
              reason: discovered.code,
            });
            return discovered;
          }
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
        const windowState = live.windows[operation.instanceId];
        if (!windowState) {
          dependencies.dispatch({ type: "workflow/invalidate" });
          return boundedError(
            "revalidation_failed",
            "The provider document is gone.",
          );
        }

        const handle = dependencies.getHandle(
          windowState.instanceId,
          step.origin,
          step.toolName,
        );
        const descriptor = windowState.discoveredTools.find(
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
          input: resolveStepArguments(step, results),
          signal,
        });
        const parsed = parsePassToolResult(
          step.namespacedName,
          parseBoundedJsonResult(parseExecuteResultText(resultText)),
        );
        if (!parsed) {
          throw new GatewayError(
            "execution_failed",
            "Workflow execution failed.",
          );
        }
        results.push(parsed.result);
        evidenceParts.push(parsed.evidence);
      } finally {
        operation.release();
      }
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
    const code = abortErrorCode(error, signal);
    if (code) {
      dependencies.dispatch({
        type: "workflow/cancelled",
        workflowId: input.workflowId,
        reason: code,
      });
      return boundedError(code, abortErrorMessage(code, "Workflow"));
    }
    if (error instanceof GatewayError) {
      dependencies.dispatch({
        type: "workflow/failed",
        workflowId: input.workflowId,
        reason: error.code,
      });
      return boundedError(error.code, error.message);
    }
    dependencies.dispatch({
      type: "workflow/failed",
      workflowId: input.workflowId,
      reason: "execution_failed",
    });
    return boundedError("execution_failed", "Workflow execution failed.");
  }
}

function resolveStepArguments(
  step: PreparedWorkflowStep,
  results: WorkflowStepResult[],
) {
  const input: Record<string, unknown> = { ...step.arguments };
  for (const [key, value] of Object.entries(input)) {
    if (!isBindQuery(value)) {
      continue;
    }
    const data = results[value.bind.stepIndex]?.data;
    if (!data || !("selected" in data) || !data.selected) {
      throw new GatewayError(
        "execution_failed",
        "Workflow execution failed.",
      );
    }
    if (key === "id") {
      input[key] = data.selected.sourceId;
      continue;
    }
    input[key] = data.selected;
  }
  return input;
}
