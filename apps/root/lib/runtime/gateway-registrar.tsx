"use client";

import {
  boundedError,
  cancelWorkflowInputSchema,
  discoverCapabilitiesInputSchema,
  executeWorkflowInputSchema,
  inspectWorkflowInputSchema,
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
  type ListProvidersOutput,
  type PrepareWorkflowInput,
  type PrepareWorkflowOutput,
} from "@repo/contracts";
import { useEffect, useRef } from "react";

import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";

export type GatewayHandlers = {
  listProviders: () => BoundedResultEnvelope<ListProvidersOutput>;
  discoverCapabilities: (
    input: DiscoverCapabilitiesInput,
    signal: AbortSignal,
  ) => Promise<BoundedResultEnvelope<DiscoverCapabilitiesOutput>>;
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
        "List configured provider IDs and whether each is workflow-ready or discovery-only.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async () => handlersRef.current.listProviders(),
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
        const parsed = discoverCapabilitiesInputSchema.safeParse(
          parseToolExecuteInput(input),
        );
        if (!parsed.success) {
          return boundedError(
            "invalid_arguments",
            "discover_capabilities requires a configured providerId.",
          );
        }
        return handlersRef.current.discoverCapabilities(
          parsed.data,
          options.signal,
        );
      },
    },
    { signal },
  );

  await context.registerTool(
    {
      name: "prepare_workflow",
      title: "Prepare workflow",
      description:
        "Prepare one or two sequential read-only search steps against trusted providers.",
      inputSchema: {
        type: "object",
        properties: {
          steps: { type: "array", description: "Workflow steps to prepare." },
        },
        required: ["steps"],
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async (input) => {
        const parsed = prepareWorkflowInputSchema.safeParse(
          parseToolExecuteInput(input),
        );
        if (!parsed.success) {
          return boundedError(
            "invalid_arguments",
            "prepare_workflow requires one or two allowlisted search steps.",
          );
        }
        return handlersRef.current.prepareWorkflow(parsed.data);
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
        const parsed = executeWorkflowInputSchema.safeParse(
          parseToolExecuteInput(input),
        );
        if (!parsed.success) {
          return boundedError(
            "invalid_arguments",
            "execute_workflow requires workflowId.",
          );
        }
        return handlersRef.current.executeWorkflow(parsed.data, options.signal);
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
        const parsed = cancelWorkflowInputSchema.safeParse(
          parseToolExecuteInput(input),
        );
        if (!parsed.success) {
          return boundedError(
            "invalid_arguments",
            "cancel_workflow requires workflowId.",
          );
        }
        return handlersRef.current.cancelWorkflow(parsed.data);
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
        const parsed = inspectWorkflowInputSchema.safeParse(
          parseToolExecuteInput(input),
        );
        if (!parsed.success) {
          return boundedError(
            "invalid_arguments",
            "inspect_workflow requires workflowId.",
          );
        }
        return handlersRef.current.inspectWorkflow(parsed.data);
      },
    },
    { signal },
  );
}
