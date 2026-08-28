import { z } from "zod";

import {
  boundedResultEnvelopeSchema,
  normalizedToolDescriptorSchema,
  originSchema,
  providerIdSchema,
  webmcpToolNameSchema,
} from "./webmcp.js";
import { searchProductsInputSchema } from "./shop.js";

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

export const shopSearchStepSchema = z.strictObject({
  providerId: z.literal("shop"),
  tool: z.literal("search_products"),
  arguments: searchProductsInputSchema,
});

export const prepareWorkflowInputSchema = z.object({
  steps: z.array(z.unknown()),
});

export type PrepareWorkflowInput = z.infer<typeof prepareWorkflowInputSchema>;

export const preparedShopSearchStepSchema = z.object({
  providerId: z.literal("shop"),
  providerInstanceId: z.string().min(1),
  origin: originSchema,
  toolName: z.literal("search_products"),
  namespacedName: z.literal("shop.search_products"),
  schemaFingerprint: z.string().min(1),
  arguments: searchProductsInputSchema,
  readOnly: z.literal(true),
});

export type PreparedShopSearchStep = z.infer<typeof preparedShopSearchStepSchema>;

export const preparedWorkflowSchema = z.object({
  workflowId: workflowExecutionIdSchema,
  lifecycle: z.literal("prepared"),
  step: preparedShopSearchStepSchema,
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
  step: preparedShopSearchStepSchema.nullable(),
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

export const operatorIdentitySchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  name: z.string().min(1),
});

export type OperatorIdentity = z.infer<typeof operatorIdentitySchema>;

export const trustedProviderEntrySchema = z.object({
  providerId: providerIdSchema,
  origin: originSchema,
  entryUrl: z.url(),
  contractVersion: z.string().min(1),
  expectedTools: z.array(webmcpToolNameSchema).min(1),
});

export type TrustedProviderEntry = z.infer<typeof trustedProviderEntrySchema>;
