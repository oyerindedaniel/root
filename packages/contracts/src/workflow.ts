import { z } from "zod";

import { searchCasesProposedArgumentsSchema, searchCasesOutputSchema } from "./cases.js";
import { searchCustomersInputSchema, searchCustomersOutputSchema } from "./customers.js";
import { searchProductsInputSchema, searchProductsOutputSchema } from "./shop.js";
import {
  contractVersionSchema,
  gatewayErrorCodeSchema,
  MAX_PROVIDER_TOOLS,
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
/*
  1. unmounted — no window row. Close deletes the instance; this value is absence, not a stored row.
  2. mounting — iframe is loading. Document is not there yet.
  3. loaded — iframe load fired. Document is there; tools are not listed yet.
  4. discovering — listing WebMCP tools on that document.
  5. ready — tools listed; window is in the tray. Same live document as active.
  6. active — tools listed; window is on the stage. Prepare treats ready and active as live.
  7. executing — a workflow step is invoking on this window.
  8. failed — this window’s mount or discover failed, not the workflow’s own failed.
*/

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

export const builtinProviderIdSchema = z.enum(["accounts", "shop", "support"]);

export type BuiltinProviderId = z.infer<typeof builtinProviderIdSchema>;

export const PASS_READ_TOOL_NAMES = [
  "accounts.search_customers",
  "shop.search_products",
  "support.search_cases",
] as const;

export const passReadToolNameSchema = z.enum(PASS_READ_TOOL_NAMES);

export type PassReadToolName = z.infer<typeof passReadToolNameSchema>;

export const MAX_PREPARED_WORKFLOW_STEPS = 32;

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

export const proposedCaseSearchStepSchema = z.strictObject({
  providerId: z.literal("support"),
  tool: z.literal("search_cases"),
  arguments: searchCasesProposedArgumentsSchema,
});

export const proposedWorkflowStepSchema = z.discriminatedUnion("tool", [
  proposedCustomerSearchStepSchema,
  proposedProductSearchStepSchema,
  proposedCaseSearchStepSchema,
]);

export type ProposedWorkflowStep = z.infer<typeof proposedWorkflowStepSchema>;

export const prepareWorkflowInputSchema = z.strictObject({
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

export const preparedCaseSearchStepSchema = z.object({
  providerId: z.literal("support"),
  origin: originSchema,
  toolName: z.literal("search_cases"),
  namespacedName: z.literal("support.search_cases"),
  schemaFingerprint: z.string().min(1).nullable(),
  arguments: searchCasesProposedArgumentsSchema,
  readOnly: z.literal(true),
});

export const preparedWorkflowStepSchema = z.discriminatedUnion(
  "namespacedName",
  [
    preparedCustomerSearchStepSchema,
    preparedProductSearchStepSchema,
    preparedCaseSearchStepSchema,
  ],
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

export const caseSearchResultSchema = z.object({
  tool: z.literal("support.search_cases"),
  data: searchCasesOutputSchema,
});

export const workflowStepResultSchema = z.discriminatedUnion("tool", [
  customerSearchResultSchema,
  productSearchResultSchema,
  caseSearchResultSchema,
]);

export type WorkflowStepResult = z.infer<typeof workflowStepResultSchema>;

export const listProvidersInputSchema = z.strictObject({});

export const discoverCapabilitiesInputSchema = z.strictObject({
  providerId: providerIdSchema,
});

export type DiscoverCapabilitiesInput = z.infer<
  typeof discoverCapabilitiesInputSchema
>;

export const discoverCapabilitiesOutputSchema = z.object({
  providerId: providerIdSchema,
  origin: originSchema,
  contractVersion: contractVersionSchema.nullable(),
  tools: z.array(normalizedToolDescriptorSchema).max(MAX_PROVIDER_TOOLS),
});

export type DiscoverCapabilitiesOutput = z.infer<
  typeof discoverCapabilitiesOutputSchema
>;

export const invokeGrantedToolInputSchema = z.strictObject({
  providerId: providerIdSchema,
  tool: webmcpToolNameSchema,
  arguments: z.record(z.string(), z.unknown()),
});

export type InvokeGrantedToolInput = z.infer<
  typeof invokeGrantedToolInputSchema
>;

export const invokeGrantedToolOutputSchema = z.strictObject({
  providerId: providerIdSchema,
  tool: webmcpToolNameSchema,
  untrusted: z.literal(true),
  data: z.unknown(),
});

export type InvokeGrantedToolOutput = z.infer<
  typeof invokeGrantedToolOutputSchema
>;

export const prepareWorkflowOutputSchema = z.object({
  workflowId: workflowExecutionIdSchema,
  steps: z
    .array(preparedWorkflowStepSchema)
    .min(1)
    .max(MAX_PREPARED_WORKFLOW_STEPS),
});

export type PrepareWorkflowOutput = z.infer<typeof prepareWorkflowOutputSchema>;

export const executeWorkflowInputSchema = z.strictObject({
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

export const cancelWorkflowInputSchema = z.strictObject({
  workflowId: workflowExecutionIdSchema,
});

export type CancelWorkflowInput = z.infer<typeof cancelWorkflowInputSchema>;

export const cancelWorkflowOutputSchema = z.object({
  workflowId: workflowExecutionIdSchema,
});

export type CancelWorkflowOutput = z.infer<typeof cancelWorkflowOutputSchema>;

export const inspectWorkflowInputSchema = z.strictObject({
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

export const windowChromeInputSchema = z.strictObject({
  providerId: providerIdSchema,
});

export type WindowChromeInput = z.infer<typeof windowChromeInputSchema>;

export const windowChromeOutputSchema = z.strictObject({
  providerId: providerIdSchema,
});

export type WindowChromeOutput = z.infer<typeof windowChromeOutputSchema>;

const providerSummaryBase = {
  providerId: providerIdSchema,
  label: z.string().min(1).max(80),
};

const grantedToolNamesSchema = z
  .array(webmcpToolNameSchema)
  .max(MAX_PROVIDER_TOOLS)
  .superRefine((names, context) => {
    if (new Set(names).size !== names.length) {
      context.addIssue({
        code: "custom",
        message: "Granted tool names must be unique.",
      });
    }
  });

export const providerSummarySchema = z.discriminatedUnion("source", [
  z.strictObject({
    ...providerSummaryBase,
    source: z.literal("builtin"),
    capability: z.literal("workflow-ready"),
  }),
  z.strictObject({
    ...providerSummaryBase,
    source: z.literal("custom"),
    capability: z.enum(["discovery-only", "granted-invoke"]),
    grantedTools: grantedToolNamesSchema,
  }),
]);

export type ProviderSummary = z.infer<typeof providerSummarySchema>;

export const listProvidersOutputSchema = z.strictObject({
  providers: z.array(providerSummarySchema).max(32),
});

export type ListProvidersOutput = z.infer<typeof listProvidersOutputSchema>;

export const ROOT_GATEWAY_TOOLS = [
  "list_providers",
  "discover_capabilities",
  "invoke_granted_tool",
  "prepare_workflow",
  "execute_workflow",
  "cancel_workflow",
  "inspect_workflow",
  "minimize_window",
  "maximize_window",
  "close_window",
] as const;

export const gatewayToolNameSchema = z.enum(ROOT_GATEWAY_TOOLS);

export type GatewayToolName = z.infer<typeof gatewayToolNameSchema>;

export const trustedProviderEntrySchema = z.object({
  providerId: providerIdSchema,
  origin: originSchema,
  entryUrl: z.url(),
  contractVersion: contractVersionSchema,
  expectedTools: z.array(webmcpToolNameSchema).min(1),
});

export type TrustedProviderEntry = z.infer<typeof trustedProviderEntrySchema>;
