"use client";

import {
  boundedError,
  cancelWorkflowInputSchema,
  discoverCapabilitiesInputSchema,
  executeWorkflowInputSchema,
  inspectWorkflowInputSchema,
  parseToolExecuteInput,
  prepareWorkflowInputSchema,
  type BoundedResultEnvelope,
  type DiscoverCapabilitiesInput,
  type InspectWorkflowOutput,
} from "@repo/contracts";
import { useEffect, useRef } from "react";

import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";
import { getDocumentModelContext } from "@/lib/webmcp/model-context";

export type GatewayHandlers = {
  discoverCapabilities: (
    input: DiscoverCapabilitiesInput,
    signal: AbortSignal,
  ) => Promise<BoundedResultEnvelope>;
  prepareWorkflow: (input: unknown) => BoundedResultEnvelope;
  executeWorkflow: (
    input: { workflowId: string },
    signal: AbortSignal,
  ) => Promise<BoundedResultEnvelope>;
  cancelWorkflow: (input: { workflowId: string }) => BoundedResultEnvelope;
  inspectWorkflow: (
    input: { workflowId: string },
  ) => InspectWorkflowOutput | BoundedResultEnvelope;
};

export function GatewayRegistrar(handlers: GatewayHandlers) {
  const handlersRef = useRef(handlers);

  useIsomorphicLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const modelContext = getDocumentModelContext(document);
    if (!modelContext) {
      return;
    }
    const controller = new AbortController();
    void registerGatewayTools(controller.signal, handlersRef);
    return () => controller.abort();
  }, []);

  return null;
}

async function registerGatewayTools(
  signal: AbortSignal,
  handlersRef: { current: GatewayHandlers },
) {
  const context = getDocumentModelContext(document);
  if (!context) {
    return;
  }

  await context.registerTool(
    {
      name: "discover_capabilities",
      title: "Discover capabilities",
      description:
        "Mount the trusted Catalog provider and discover its current WebMCP tools.",
      inputSchema: {
        type: "object",
        properties: {
          providerId: {
            type: "string",
            description: "Trusted provider id. Only shop is allowed in this pass.",
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
            "discover_capabilities requires providerId shop.",
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
        "Prepare exactly one read-only Catalog search step bound to the current provider document.",
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
            "prepare_workflow requires a steps array.",
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
      description: "Execute a prepared Catalog search on the live Catalog document.",
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
      description: "Cancel the current Catalog search workflow.",
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
      description: "Inspect the current Catalog search workflow and evidence.",
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
