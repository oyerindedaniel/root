import {
  boundedError,
  namespacedToolName,
  preparedShopSearchStepSchema,
  shopSearchStepSchema,
  type BoundedError,
  type NormalizedToolDescriptor,
  type PreparedShopSearchStep,
} from "@repo/contracts";

import type { RuntimeState } from "./state";

export function prepareShopSearchStep(options: {
  state: RuntimeState;
  steps: unknown[];
  workflowId: string;
}):
  | { ok: true; workflowId: string; step: PreparedShopSearchStep }
  | { ok: false; error: BoundedError } {
  if (options.steps.length !== 1) {
    return {
      ok: false,
      error: boundedError(
        "unsupported_graph",
        "This pass accepts exactly one read-only Catalog search step.",
      ),
    };
  }

  const parsedStep = shopSearchStepSchema.safeParse(options.steps[0]);
  if (!parsedStep.success) {
    return {
      ok: false,
      error: boundedError(
        "unsupported_graph",
        "Only shop.search_products is supported in this pass.",
      ),
    };
  }

  const { state } = options;
  if (
    !state.provider.instanceId ||
    !state.provider.origin ||
    (state.provider.lifecycle !== "ready" &&
      state.provider.lifecycle !== "active")
  ) {
    return {
      ok: false,
      error: boundedError(
        "provider_not_ready",
        "Catalog is not ready. Discover capabilities first.",
      ),
    };
  }

  const tool = findShopSearchTool(state.discoveredTools);
  if (!tool) {
    return {
      ok: false,
      error: boundedError(
        "tool_not_found",
        "shop.search_products is not currently registered.",
      ),
    };
  }

  if (!tool.readOnlyHint) {
    return {
      ok: false,
      error: boundedError(
        "unsupported_graph",
        "Only read-only Catalog search is supported in this pass.",
      ),
    };
  }

  const step = preparedShopSearchStepSchema.parse({
    providerId: "shop",
    providerInstanceId: state.provider.instanceId,
    origin: state.provider.origin,
    toolName: "search_products",
    namespacedName: namespacedToolName("shop", "search_products"),
    schemaFingerprint: tool.schemaFingerprint,
    arguments: parsedStep.data.arguments,
    readOnly: true,
  });

  return { ok: true, workflowId: options.workflowId, step };
}

export function revalidatePreparedStep(options: {
  state: RuntimeState;
  step: PreparedShopSearchStep;
}): { ok: true } | { ok: false; error: BoundedError } {
  const { state, step } = options;
  if (state.provider.instanceId !== step.providerInstanceId) {
    return {
      ok: false,
      error: boundedError(
        "revalidation_failed",
        "The Catalog document changed since preparation.",
      ),
    };
  }
  if (state.provider.origin !== step.origin) {
    return {
      ok: false,
      error: boundedError(
        "revalidation_failed",
        "The Catalog origin no longer matches preparation.",
      ),
    };
  }
  const tool = findShopSearchTool(state.discoveredTools);
  if (!tool || tool.schemaFingerprint !== step.schemaFingerprint) {
    return {
      ok: false,
      error: boundedError(
        "revalidation_failed",
        "The Catalog tool contract changed since preparation.",
      ),
    };
  }
  return { ok: true };
}

function findShopSearchTool(
  tools: NormalizedToolDescriptor[],
): NormalizedToolDescriptor | undefined {
  for (const tool of tools) {
    if (tool.providerId === "shop" && tool.name === "search_products") {
      return tool;
    }
  }
  return undefined;
}
