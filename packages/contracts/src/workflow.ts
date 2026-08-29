import { z } from "zod";

import {
  boundedResultEnvelopeSchema,
  jsonObjectSchema,
  normalizedToolDescriptorSchema,
  originSchema,
  providerIdSchema,
  webmcpToolNameSchema,
} from "./webmcp.js";

export const workflowExecutionIdSchema = z.string().min(1).max(80);

export type WorkflowExecutionId = z.infer<typeof workflowExecutionIdSchema>;

export const providerLifecycleSchema = z.enum([
  "unmounted",
  "mounting",
  "loaded",
  "discovering",
  "ready",
  "active",
  "executing",
  "failed",
]);

export type ProviderLifecycle = z.infer<typeof providerLifecycleSchema>;

export const workflowLifecycleSchema = z.enum([
  "draft",
  "prepared",
  "executing",
  "passed",
  "failed",
  "cancelled",
]);

export type WorkflowLifecycle = z.infer<typeof workflowLifecycleSchema>;

export const providerPlacementSchema = z.enum(["stage", "tray"]);

export type ProviderPlacement = z.infer<typeof providerPlacementSchema>;

export const MAX_PREPARED_WORKFLOW_STEPS = 2;

export const proposedWorkflowStepSchema = z.strictObject({
  providerId: providerIdSchema,
  tool: webmcpToolNameSchema,
  arguments: z.unknown(),
});

export type ProposedWorkflowStep = z.infer<typeof proposedWorkflowStepSchema>;

export const prepareWorkflowInputSchema = z.object({
  steps: z.array(z.unknown()),
});

export type PrepareWorkflowInput = z.infer<typeof prepareWorkflowInputSchema>;

export const preparedWorkflowStepSchema = z.object({
  providerId: providerIdSchema,
  origin: originSchema,
  toolName: webmcpToolNameSchema,
  namespacedName: z.string().min(1).max(128),
  schemaFingerprint: z.string().min(1).nullable(),
  arguments: jsonObjectSchema,
  readOnly: z.literal(true),
});

export type PreparedWorkflowStep = z.infer<typeof preparedWorkflowStepSchema>;

export const preparedWorkflowSchema = z.object({
  workflowId: workflowExecutionIdSchema,
  lifecycle: z.literal("prepared"),
  steps: z
    .array(preparedWorkflowStepSchema)
    .min(1)
    .max(MAX_PREPARED_WORKFLOW_STEPS),
});

export type PreparedWorkflow = z.infer<typeof preparedWorkflowSchema>;

export const discoverCapabilitiesInputSchema = z.object({
  providerId: providerIdSchema,
});

export type DiscoverCapabilitiesInput = z.infer<
  typeof discoverCapabilitiesInputSchema
>;

export const discoverCapabilitiesOutputSchema = z.object({
  status: z.literal("success"),
  providerId: providerIdSchema,
  origin: originSchema,
  contractVersion: z.string().min(1),
  tools: z.array(normalizedToolDescriptorSchema),
});

export type DiscoverCapabilitiesOutput = z.infer<
  typeof discoverCapabilitiesOutputSchema
>;

export const executeWorkflowInputSchema = z.object({
  workflowId: workflowExecutionIdSchema,
});

export const cancelWorkflowInputSchema = z.object({
  workflowId: workflowExecutionIdSchema,
});

export const inspectWorkflowInputSchema = z.object({
  workflowId: workflowExecutionIdSchema,
});

export const inspectWorkflowOutputSchema = z.object({
  workflowId: workflowExecutionIdSchema,
  lifecycle: workflowLifecycleSchema,
  steps: z.array(preparedWorkflowStepSchema),
  step: preparedWorkflowStepSchema.nullable(),
  results: z.array(z.unknown()),
  result: boundedResultEnvelopeSchema.nullable(),
  failureReason: z.string().max(280).nullable(),
});

export type InspectWorkflowOutput = z.infer<typeof inspectWorkflowOutputSchema>;

export const gatewayToolNameSchema = z.enum([
  "discover_capabilities",
  "prepare_workflow",
  "execute_workflow",
  "cancel_workflow",
  "inspect_workflow",
]);

export type GatewayToolName = z.infer<typeof gatewayToolNameSchema>;

export const ROOT_GATEWAY_TOOLS = [
  "discover_capabilities",
  "prepare_workflow",
  "execute_workflow",
  "cancel_workflow",
  "inspect_workflow",
] as const satisfies readonly GatewayToolName[];

export const trustedProviderEntrySchema = z.object({
  providerId: providerIdSchema,
  origin: originSchema,
  entryUrl: z.url(),
  contractVersion: z.string().min(1),
  expectedTools: z.array(webmcpToolNameSchema).min(1),
});

export type TrustedProviderEntry = z.infer<typeof trustedProviderEntrySchema>;
