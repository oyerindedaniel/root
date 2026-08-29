import {
  boundedError,
  MAX_PREPARED_WORKFLOW_STEPS,
  namespacedToolName,
  preparedWorkflowStepSchema,
  proposedWorkflowStepSchema,
  type BoundedError,
  type NormalizedToolDescriptor,
  type PreparedWorkflowStep,
  type ProviderId,
} from "@repo/contracts";

import { getPassReadTool } from "./pass-tools";
import type { RuntimeState } from "./state";

export function prepareWorkflow(options: {
  state: RuntimeState;
  steps: unknown[];
  workflowId: string;
  origins: Record<ProviderId, string>;
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
        "This pass accepts one or two sequential read-only search steps.",
      ),
    };
  }

  const prepared: PreparedWorkflowStep[] = [];
  for (const raw of options.steps) {
    const bound = bindProposedStep({
      raw,
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
  if (state.provider.providerId !== step.providerId) {
    return {
      ok: false,
      error: boundedError(
        "revalidation_failed",
        "The open document is not the prepared provider.",
      ),
    };
  }
  if (state.provider.origin !== step.origin) {
    return {
      ok: false,
      error: boundedError(
        "revalidation_failed",
        "The provider origin no longer matches preparation.",
      ),
    };
  }
  const tool = findDiscoveredTool(
    state.discoveredTools,
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
  if (!tool.readOnlyHint) {
    return {
      ok: false,
      error: boundedError(
        "revalidation_failed",
        "The prepared tool is no longer read-only.",
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
  state: RuntimeState;
  origins: Record<ProviderId, string>;
}):
  | { ok: true; step: PreparedWorkflowStep }
  | { ok: false; error: BoundedError } {
  const proposed = proposedWorkflowStepSchema.safeParse(options.raw);
  if (!proposed.success) {
    return {
      ok: false,
      error: boundedError(
        "unsupported_graph",
        "Each step needs providerId, tool, and arguments.",
      ),
    };
  }

  const namespacedName = namespacedToolName(
    proposed.data.providerId,
    proposed.data.tool,
  );
  const spec = getPassReadTool(namespacedName);
  if (!spec || spec.providerId !== proposed.data.providerId) {
    return {
      ok: false,
      error: boundedError(
        "unsupported_graph",
        "Only allowlisted read-only search tools are supported in this pass.",
      ),
    };
  }

  const parsedArgs = spec.input.safeParse(proposed.data.arguments);
  if (!parsedArgs.success) {
    return {
      ok: false,
      error: boundedError(
        "unsupported_graph",
        "Step arguments do not match the tool contract.",
      ),
    };
  }

  const origin = options.origins[proposed.data.providerId];
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
  if (isLiveProvider(options.state, proposed.data.providerId, origin)) {
    const tool = findDiscoveredTool(
      options.state.discoveredTools,
      proposed.data.providerId,
      proposed.data.tool,
    );
    if (!tool) {
      return {
        ok: false,
        error: boundedError(
          "tool_not_found",
          `${namespacedName} is not currently registered.`,
        ),
      };
    }
    if (!tool.readOnlyHint) {
      return {
        ok: false,
        error: boundedError(
          "unsupported_graph",
          "Only read-only search tools are supported in this pass.",
        ),
      };
    }
    schemaFingerprint = tool.schemaFingerprint;
  }

  return {
    ok: true,
    step: preparedWorkflowStepSchema.parse({
      providerId: proposed.data.providerId,
      origin,
      toolName: proposed.data.tool,
      namespacedName,
      schemaFingerprint,
      arguments: parsedArgs.data,
      readOnly: true,
    }),
  };
}

function isLiveProvider(
  state: RuntimeState,
  providerId: ProviderId,
  origin: string,
) {
  return (
    state.provider.providerId === providerId &&
    state.provider.origin === origin &&
    (state.provider.lifecycle === "ready" ||
      state.provider.lifecycle === "active")
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
