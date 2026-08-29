import { z } from "zod";

import { searchCustomersInputSchema, searchCustomersOutputSchema } from "./customers.js";
import { searchProductsInputSchema, searchProductsOutputSchema } from "./shop.js";
import {
  contractVersionSchema,
  gatewayErrorCodeSchema,
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

export const builtinWorkflowProviderIdSchema = z.enum(["accounts", "shop"]);

export type BuiltinWorkflowProviderId = z.infer<
  typeof builtinWorkflowProviderIdSchema
>;

export const passReadToolNameSchema = z.enum([
  "accounts.search_customers",
  "shop.search_products",
]);

export type PassReadToolName = z.infer<typeof passReadToolNameSchema>;

export const proposedCustomerSearchStepSchema = z.strictObject({
  providerId: z.literal("accounts"),
  tool: z.literal("search_customers"),
  arguments: searchCustomersInputSchema,
});

export const proposedProductSearchStepSchema = z.strictObject({
  providerId: z.literal("shop"),
  tool: z.literal("search_products"),
  arguments: searchProductsInputSchema,
});

export const proposedWorkflowStepSchema = z.discriminatedUnion("tool", [
  proposedCustomerSearchStepSchema,
  proposedProductSearchStepSchema,
]);

export type ProposedWorkflowStep = z.infer<typeof proposedWorkflowStepSchema>;

export const prepareWorkflowInputSchema = z.object({
  steps: z
    .array(proposedWorkflowStepSchema)
    .min(1)
    .max(MAX_PREPARED_WORKFLOW_STEPS),
});

export type PrepareWorkflowInput = z.infer<typeof prepareWorkflowInputSchema>;

export const preparedCustomerSearchStepSchema = z.object({
  providerId: z.literal("accounts"),
  origin: originSchema,
  toolName: z.literal("search_customers"),
  namespacedName: z.literal("accounts.search_customers"),
  schemaFingerprint: z.string().min(1).nullable(),
  arguments: searchCustomersInputSchema,
  readOnly: z.literal(true),
});

export const preparedProductSearchStepSchema = z.object({
  providerId: z.literal("shop"),
  origin: originSchema,
  toolName: z.literal("search_products"),
  namespacedName: z.literal("shop.search_products"),
  schemaFingerprint: z.string().min(1).nullable(),
  arguments: searchProductsInputSchema,
  readOnly: z.literal(true),
});

export const preparedWorkflowStepSchema = z.discriminatedUnion(
  "namespacedName",
  [preparedCustomerSearchStepSchema, preparedProductSearchStepSchema],
);

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

export const customerSearchResultSchema = z.object({
  tool: z.literal("accounts.search_customers"),
  data: searchCustomersOutputSchema,
});

export const productSearchResultSchema = z.object({
  tool: z.literal("shop.search_products"),
  data: searchProductsOutputSchema,
});

export const workflowStepResultSchema = z.discriminatedUnion("tool", [
  customerSearchResultSchema,
  productSearchResultSchema,
]);

export type WorkflowStepResult = z.infer<typeof workflowStepResultSchema>;

export const discoverCapabilitiesInputSchema = z.object({
  providerId: providerIdSchema,
});

export type DiscoverCapabilitiesInput = z.infer<
  typeof discoverCapabilitiesInputSchema
>;

export const discoverCapabilitiesOutputSchema = z.object({
  providerId: providerIdSchema,
  origin: originSchema,
  contractVersion: contractVersionSchema.nullable(),
  tools: z.array(normalizedToolDescriptorSchema),
});

export type DiscoverCapabilitiesOutput = z.infer<
  typeof discoverCapabilitiesOutputSchema
>;

export const prepareWorkflowOutputSchema = z.object({
  workflowId: workflowExecutionIdSchema,
  steps: z
    .array(preparedWorkflowStepSchema)
    .min(1)
    .max(MAX_PREPARED_WORKFLOW_STEPS),
});

export type PrepareWorkflowOutput = z.infer<typeof prepareWorkflowOutputSchema>;

export const executeWorkflowInputSchema = z.object({
  workflowId: workflowExecutionIdSchema,
});

export type ExecuteWorkflowInput = z.infer<typeof executeWorkflowInputSchema>;

export const executeWorkflowOutputSchema = z.object({
  results: z
    .array(workflowStepResultSchema)
    .min(1)
    .max(MAX_PREPARED_WORKFLOW_STEPS),
});

export type ExecuteWorkflowOutput = z.infer<typeof executeWorkflowOutputSchema>;

export const cancelWorkflowInputSchema = z.object({
  workflowId: workflowExecutionIdSchema,
});

export type CancelWorkflowInput = z.infer<typeof cancelWorkflowInputSchema>;

export const cancelWorkflowOutputSchema = z.object({
  workflowId: workflowExecutionIdSchema,
});

export type CancelWorkflowOutput = z.infer<typeof cancelWorkflowOutputSchema>;

export const inspectWorkflowInputSchema = z.object({
  workflowId: workflowExecutionIdSchema,
});

export type InspectWorkflowInput = z.infer<typeof inspectWorkflowInputSchema>;

export const inspectWorkflowOutputSchema = z.object({
  workflowId: workflowExecutionIdSchema,
  lifecycle: workflowLifecycleSchema,
  steps: z.array(preparedWorkflowStepSchema),
  step: preparedWorkflowStepSchema.nullable(),
  results: z.array(workflowStepResultSchema),
  evidence: z.string().nullable(),
  failureReason: gatewayErrorCodeSchema.nullable(),
});

export type InspectWorkflowOutput = z.infer<typeof inspectWorkflowOutputSchema>;

export const providerSummarySchema = z.strictObject({
  providerId: providerIdSchema,
  label: z.string().min(1).max(80),
  source: z.enum(["builtin", "custom"]),
  capability: z.enum(["workflow-ready", "discovery-only"]),
});

export type ProviderSummary = z.infer<typeof providerSummarySchema>;

export const listProvidersOutputSchema = z.strictObject({
  providers: z.array(providerSummarySchema).max(32),
});

export type ListProvidersOutput = z.infer<typeof listProvidersOutputSchema>;

export const gatewayToolNameSchema = z.enum([
  "list_providers",
  "discover_capabilities",
  "prepare_workflow",
  "execute_workflow",
  "cancel_workflow",
  "inspect_workflow",
]);

export type GatewayToolName = z.infer<typeof gatewayToolNameSchema>;

export const ROOT_GATEWAY_TOOLS = [
  "list_providers",
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
  contractVersion: contractVersionSchema,
  expectedTools: z.array(webmcpToolNameSchema).min(1),
});

export type TrustedProviderEntry = z.infer<typeof trustedProviderEntrySchema>;
