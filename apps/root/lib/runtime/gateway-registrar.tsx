"use client";

import {
  boundedError,
  cancelWorkflowInputSchema,
  discoverCapabilitiesInputSchema,
  executeWorkflowInputSchema,
  inspectWorkflowInputSchema,
  invokeGrantedToolInputSchema,
  listProvidersInputSchema,
  MAX_PREPARED_WORKFLOW_STEPS,
  parseToolExecuteInput,
  prepareWorkflowInputSchema,
  type BoundedError,
  type BoundedResultEnvelope,
  type CancelWorkflowInput,
  type CancelWorkflowOutput,
  type DiscoverCapabilitiesInput,
  type DiscoverCapabilitiesOutput,
  type ExecuteWorkflowInput,
  type ExecuteWorkflowOutput,
  type InspectWorkflowInput,
  type InspectWorkflowOutput,
  type InvokeGrantedToolInput,
  type InvokeGrantedToolOutput,
  type ListProvidersOutput,
  type PrepareWorkflowInput,
  type PrepareWorkflowOutput,
} from "@repo/contracts";
import { useEffect, useRef } from "react";
import type { z } from "zod";

import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";
import {
  boundJsonValue,
  MAX_CUSTOM_INPUT_CHARS,
  MAX_CUSTOM_INPUT_DEPTH,
  MAX_CUSTOM_INPUT_NODES,
} from "@/lib/webmcp/json-bounds";

export type GatewayHandlers = {
  listProviders: () => BoundedResultEnvelope<ListProvidersOutput>;
  discoverCapabilities: (
    input: DiscoverCapabilitiesInput,
    signal: AbortSignal,
  ) => Promise<BoundedResultEnvelope<DiscoverCapabilitiesOutput>>;
  invokeGrantedTool: (
    input: InvokeGrantedToolInput,
    signal: AbortSignal,
  ) => Promise<BoundedResultEnvelope<InvokeGrantedToolOutput>>;
  prepareWorkflow: (
    input: PrepareWorkflowInput,
  ) => BoundedResultEnvelope<PrepareWorkflowOutput>;
  executeWorkflow: (
    input: ExecuteWorkflowInput,
    signal: AbortSignal,
  ) => Promise<BoundedResultEnvelope<ExecuteWorkflowOutput>>;
  cancelWorkflow: (
    input: CancelWorkflowInput,
  ) => BoundedResultEnvelope<CancelWorkflowOutput>;
  inspectWorkflow: (
    input: InspectWorkflowInput,
  ) => InspectWorkflowOutput | BoundedError;
};

export function GatewayRegistrar(handlers: GatewayHandlers) {
  const handlersRef = useRef(handlers);

  useIsomorphicLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      return;
    }
    const controller = new AbortController();
    void registerGatewayTools(controller.signal, handlersRef);
    return () => controller.abort();
  }, []);

  return null;
}

export async function registerGatewayTools(
  signal: AbortSignal,
  handlersRef: { current: GatewayHandlers },
) {
  const context = document.modelContext;
  if (!context) {
    return;
  }

  await context.registerTool(
    {
      name: "list_providers",
      title: "List providers",
      description:
        "List configured provider IDs, capabilities, and human-granted custom tools.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async (input) => {
        const parsed = parseIngress(listProvidersInputSchema, input);
        if (!parsed) {
          return boundedError(
            "invalid_arguments",
            "list_providers does not accept arguments.",
          );
        }
        return handlersRef.current.listProviders();
      },
    },
    { signal },
  );

  await context.registerTool(
    {
      name: "discover_capabilities",
      title: "Discover capabilities",
      description:
        "Mount a configured provider and discover its current WebMCP tools.",
      inputSchema: {
        type: "object",
        properties: {
          providerId: {
            type: "string",
            description: "Configured provider ID from list_providers.",
          },
        },
        required: ["providerId"],
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input, options) => {
        const parsed = parseIngress(discoverCapabilitiesInputSchema, input);
        if (!parsed) {
          return boundedError(
            "invalid_arguments",
            "discover_capabilities requires a configured providerId.",
          );
        }
        return handlersRef.current.discoverCapabilities(
          parsed,
          options.signal,
        );
      },
    },
    { signal },
  );

  await context.registerTool(
    {
      name: "invoke_granted_tool",
      title: "Invoke granted tool",
      description:
        "Invoke one human-granted tool on a saved custom provider and return untrusted data.",
      inputSchema: {
        type: "object",
        properties: {
          providerId: { type: "string" },
          tool: { type: "string" },
          arguments: { type: "object" },
        },
        required: ["providerId", "tool", "arguments"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input, options) => {
        if (
          typeof input === "string" &&
          input.length > MAX_CUSTOM_INPUT_CHARS
        ) {
          return boundedError(
            "input_too_large",
            "invoke_granted_tool arguments exceed the input limit.",
          );
        }
        const parsed = parseIngress(invokeGrantedToolInputSchema, input);
        if (!parsed) {
          return boundedError(
            "invalid_arguments",
            "invoke_granted_tool requires providerId, tool, and arguments.",
          );
        }
        const ingressBounds = boundJsonValue(parsed, {
          maxChars: MAX_CUSTOM_INPUT_CHARS,
          maxDepth: MAX_CUSTOM_INPUT_DEPTH,
          maxNodes: MAX_CUSTOM_INPUT_NODES,
        });
        if (!ingressBounds.ok) {
          return boundedError(
            ingressBounds.reason === "too_large"
              ? "input_too_large"
              : "invalid_arguments",
            "invoke_granted_tool arguments exceed the input limit.",
          );
        }
        return handlersRef.current.invokeGrantedTool(parsed, options.signal);
      },
    },
    { signal },
  );

  await context.registerTool(
    {
      name: "prepare_workflow",
      title: "Prepare workflow",
      description: `Prepare 1 to ${MAX_PREPARED_WORKFLOW_STEPS} sequential read-only search steps against trusted providers.`,
      inputSchema: {
        type: "object",
        properties: {
          steps: { type: "array", description: "Workflow steps to prepare." },
        },
        required: ["steps"],
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async (input) => {
        const parsed = parseIngress(prepareWorkflowInputSchema, input);
        if (!parsed) {
          return boundedError(
            "invalid_arguments",
            `prepare_workflow requires 1 to ${MAX_PREPARED_WORKFLOW_STEPS} allowlisted search steps.`,
          );
        }
        return handlersRef.current.prepareWorkflow(parsed);
      },
    },
    { signal },
  );

  await context.registerTool(
    {
      name: "execute_workflow",
      title: "Execute workflow",
      description: "Execute a prepared read-only workflow on the live provider documents.",
      inputSchema: {
        type: "object",
        properties: {
          workflowId: { type: "string" },
        },
        required: ["workflowId"],
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async (input, options) => {
        const parsed = parseIngress(executeWorkflowInputSchema, input);
        if (!parsed) {
          return boundedError(
            "invalid_arguments",
            "execute_workflow requires workflowId.",
          );
        }
        return handlersRef.current.executeWorkflow(parsed, options.signal);
      },
    },
    { signal },
  );

  await context.registerTool(
    {
      name: "cancel_workflow",
      title: "Cancel workflow",
      description: "Cancel the current workflow.",
      inputSchema: {
        type: "object",
        properties: {
          workflowId: { type: "string" },
        },
        required: ["workflowId"],
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        const parsed = parseIngress(cancelWorkflowInputSchema, input);
        if (!parsed) {
          return boundedError(
            "invalid_arguments",
            "cancel_workflow requires workflowId.",
          );
        }
        return handlersRef.current.cancelWorkflow(parsed);
      },
    },
    { signal },
  );

  await context.registerTool(
    {
      name: "inspect_workflow",
      title: "Inspect workflow",
      description: "Inspect the current workflow, steps, and recorded evidence.",
      inputSchema: {
        type: "object",
        properties: {
          workflowId: { type: "string" },
        },
        required: ["workflowId"],
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async (input) => {
        const parsed = parseIngress(inspectWorkflowInputSchema, input);
        if (!parsed) {
          return boundedError(
            "invalid_arguments",
            "inspect_workflow requires workflowId.",
          );
        }
        return handlersRef.current.inspectWorkflow(parsed);
      },
    },
    { signal },
  );
}

function parseIngress<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> | null {
  try {
    const parsed = schema.safeParse(parseToolExecuteInput(input));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
