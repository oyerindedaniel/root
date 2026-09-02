import {
  boundedError,
  isBindQuery,
  MAX_PREPARED_WORKFLOW_STEPS,
  namespacedToolName,
  type BuiltinProviderId,
  type BoundedError,
  type NormalizedToolDescriptor,
  type PreparedWorkflowStep,
  type ProviderId,
} from "@repo/contracts";

import { bindPassReadStep, getPassReadTool } from "./pass-tools";
import { findProviderWindow, type RuntimeState } from "./state";

export function prepareWorkflow(options: {
  state: RuntimeState;
  steps: unknown[];
  workflowId: string;
  origins: Record<BuiltinProviderId, string>;
}):
  | { ok: true; workflowId: string; steps: PreparedWorkflowStep[] }
  | { ok: false; error: BoundedError } {
  if (
    options.steps.length < 1 ||
    options.steps.length > MAX_PREPARED_WORKFLOW_STEPS
  ) {
    return {
      ok: false,
      error: boundedError(
        "unsupported_graph",
        `This pass accepts 1 to ${MAX_PREPARED_WORKFLOW_STEPS} sequential allowlisted steps.`,
      ),
    };
  }

  const prepared: PreparedWorkflowStep[] = [];
  for (let index = 0; index < options.steps.length; index += 1) {
    const bound = bindProposedStep({
      raw: options.steps[index],
      index,
      state: options.state,
      origins: options.origins,
    });
    if (!bound.ok) {
      return bound;
    }
    prepared.push(bound.step);
  }

  return { ok: true, workflowId: options.workflowId, steps: prepared };
}

export function revalidatePreparedStep(options: {
  state: RuntimeState;
  step: PreparedWorkflowStep;
}): { ok: true } | { ok: false; error: BoundedError } {
  const { state, step } = options;
  const windowState = findProviderWindow(state, step.providerId);
  if (!windowState) {
    return {
      ok: false,
      error: boundedError(
        "revalidation_failed",
        "The prepared provider window is not open.",
      ),
    };
  }
  if (windowState.origin !== step.origin) {
    return {
      ok: false,
      error: boundedError(
        "revalidation_failed",
        "The provider origin no longer matches preparation.",
      ),
    };
  }
  const tool = findDiscoveredTool(
    windowState.discoveredTools,
    step.providerId,
    step.toolName,
  );
  if (!tool) {
    return {
      ok: false,
      error: boundedError(
        "revalidation_failed",
        "The prepared tool is not currently registered.",
      ),
    };
  }
  if (Boolean(tool.readOnlyHint) !== step.readOnly) {
    return {
      ok: false,
      error: boundedError(
        "revalidation_failed",
        "The prepared tool's read-only contract changed.",
      ),
    };
  }
  if (
    step.schemaFingerprint &&
    tool.schemaFingerprint !== step.schemaFingerprint
  ) {
    return {
      ok: false,
      error: boundedError(
        "revalidation_failed",
        "The tool contract changed since preparation.",
      ),
    };
  }
  return { ok: true };
}

function bindProposedStep(options: {
  raw: unknown;
  index: number;
  state: RuntimeState;
  origins: Record<BuiltinProviderId, string>;
}):
  | { ok: true; step: PreparedWorkflowStep }
  | { ok: false; error: BoundedError } {
  const binding = bindPassReadStep(options.raw);
  if (!binding) {
    return {
      ok: false,
      error: boundedError(
        "unsupported_graph",
        "Each step needs an allowlisted provider, tool, and arguments.",
      ),
    };
  }
  const proposed = binding.proposed;
  const query = Reflect.get(proposed.arguments, "query");
  if (isBindQuery(query)) {
    if (
      proposed.tool !== "search_cases" ||
      query.bind.stepIndex >= options.index
    ) {
      return {
        ok: false,
        error: boundedError(
          "unsupported_graph",
          "Each step needs an allowlisted provider, tool, and arguments.",
        ),
      };
    }
  }
  const id = Reflect.get(proposed.arguments, "id");
  if (isBindQuery(id)) {
    if (
      (proposed.tool !== "open_customer" &&
        proposed.tool !== "open_product" &&
        proposed.tool !== "open_case") ||
      id.bind.stepIndex >= options.index
    ) {
      return {
        ok: false,
        error: boundedError(
          "unsupported_graph",
          "Each step needs an allowlisted provider, tool, and arguments.",
        ),
      };
    }
  }

  const origin = options.origins[proposed.providerId];
  if (!origin) {
    return {
      ok: false,
      error: boundedError(
        "unsupported_graph",
        "That provider is not in the trusted directory.",
      ),
    };
  }

  let schemaFingerprint: string | null = null;
  if (isLiveProvider(options.state, proposed.providerId, origin)) {
    const windowState = findProviderWindow(
      options.state,
      proposed.providerId,
    );
    const tool = findDiscoveredTool(
      windowState?.discoveredTools ?? [],
      proposed.providerId,
      proposed.tool,
    );
    if (!tool) {
      return {
        ok: false,
        error: boundedError(
          "tool_not_found",
          `${proposed.providerId}.${proposed.tool} is not currently registered.`,
        ),
      };
    }
    const passTool = getPassReadTool(
      namespacedToolName(proposed.providerId, proposed.tool),
    );
    if (!passTool || Boolean(tool.readOnlyHint) !== passTool.readOnly) {
      return {
        ok: false,
        error: boundedError(
          "unsupported_graph",
          "The live tool's read-only contract does not match this pass step.",
        ),
      };
    }
    schemaFingerprint = tool.schemaFingerprint;
  }

  return {
    ok: true,
    step: binding.freeze(origin, schemaFingerprint),
  };
}

function isLiveProvider(
  state: RuntimeState,
  providerId: ProviderId,
  origin: string,
) {
  const windowState = findProviderWindow(state, providerId);
  return (
    windowState?.origin === origin &&
    (windowState.lifecycle === "ready" ||
      windowState.lifecycle === "active")
  );
}

function findDiscoveredTool(
  tools: NormalizedToolDescriptor[],
  providerId: ProviderId,
  toolName: string,
): NormalizedToolDescriptor | undefined {
  for (const tool of tools) {
    if (tool.providerId === providerId && tool.name === toolName) {
      return tool;
    }
  }
  return undefined;
}
