import { z } from "zod";

import { searchCasesProposedArgumentsSchema, searchCasesOutputSchema, openCaseProposedArgumentsSchema, openCaseOutputSchema, createCaseInputSchema, createCaseOutputSchema } from "./cases.js";
import { searchCustomersInputSchema, searchCustomersOutputSchema, openCustomerProposedArgumentsSchema, openCustomerOutputSchema, createCustomerInputSchema, createCustomerOutputSchema } from "./customers.js";
import { searchProductsInputSchema, searchProductsOutputSchema, openProductProposedArgumentsSchema, openProductOutputSchema, createProductInputSchema, createProductOutputSchema } from "./shop.js";
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
  "accounts.open_customer",
  "accounts.create_customer",
  "shop.search_products",
  "shop.open_product",
  "shop.create_product",
  "support.search_cases",
  "support.open_case",
  "support.create_case",
] as const;

export const passReadToolNameSchema = z.enum(PASS_READ_TOOL_NAMES);

export type PassReadToolName = z.infer<typeof passReadToolNameSchema>;

export const MAX_PREPARED_WORKFLOW_STEPS = 32;

function shortPassToolName(namespaced: string): string | null {
  for (const candidate of PASS_READ_TOOL_NAMES) {
    if (candidate !== namespaced) {
      continue;
    }
    return candidate.slice(candidate.indexOf(".") + 1);
  }
  return null;
}

export function explainPrepareWorkflowIngress(input: unknown): string {
  const fallback = `prepare_workflow requires 1 to ${MAX_PREPARED_WORKFLOW_STEPS} allowlisted steps. Each step uses providerId and the short tool from list_providers passTools (search_products, not shop.search_products).`;
  if (input === null || typeof input !== "object") {
    return fallback;
  }
  if (!("steps" in input) || !Array.isArray(input.steps)) {
    return fallback;
  }
  const steps = input.steps;
  if (steps.length < 1 || steps.length > MAX_PREPARED_WORKFLOW_STEPS) {
    return fallback;
  }
  for (const step of steps) {
    if (step === null || typeof step !== "object" || !("tool" in step)) {
      continue;
    }
    const tool = step.tool;
    if (typeof tool !== "string" || !tool.includes(".")) {
      continue;
    }
    const shortName = shortPassToolName(tool);
    if (shortName) {
      return `prepare_workflow tool must be ${shortName}, not ${tool}.`;
    }
    return "prepare_workflow tool is the short name from list_providers passTools, not a namespaced name.";
  }
  return fallback;
}

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

export const proposedCustomerOpenStepSchema = z.strictObject({
  providerId: z.literal("accounts"),
  tool: z.literal("open_customer"),
  arguments: openCustomerProposedArgumentsSchema,
});

export const proposedProductOpenStepSchema = z.strictObject({
  providerId: z.literal("shop"),
  tool: z.literal("open_product"),
  arguments: openProductProposedArgumentsSchema,
});

export const proposedCaseOpenStepSchema = z.strictObject({
  providerId: z.literal("support"),
  tool: z.literal("open_case"),
  arguments: openCaseProposedArgumentsSchema,
});

export const proposedCustomerCreateStepSchema = z.strictObject({
  providerId: z.literal("accounts"),
  tool: z.literal("create_customer"),
  arguments: createCustomerInputSchema,
});

export const proposedProductCreateStepSchema = z.strictObject({
  providerId: z.literal("shop"),
  tool: z.literal("create_product"),
  arguments: createProductInputSchema,
});

export const proposedCaseCreateStepSchema = z.strictObject({
  providerId: z.literal("support"),
  tool: z.literal("create_case"),
  arguments: createCaseInputSchema,
});

export const proposedWorkflowStepSchema = z.discriminatedUnion("tool", [
  proposedCustomerSearchStepSchema,
  proposedProductSearchStepSchema,
  proposedCaseSearchStepSchema,
  proposedCustomerOpenStepSchema,
  proposedProductOpenStepSchema,
  proposedCaseOpenStepSchema,
  proposedCustomerCreateStepSchema,
  proposedProductCreateStepSchema,
  proposedCaseCreateStepSchema,
]);

export type ProposedWorkflowStep = z.infer<typeof proposedWorkflowStepSchema>;

export const prepareWorkflowInputSchema = z.strictObject({
  steps: z
    .array(proposedWorkflowStepSchema)
    .min(1)
    .max(MAX_PREPARED_WORKFLOW_STEPS),
});

export type PrepareWorkflowInput = z.infer<typeof prepareWorkflowInputSchema>;

export const prepareWorkflowInputJsonSchema = z.toJSONSchema(
  prepareWorkflowInputSchema,
  { target: "draft-07", io: "input" },
);

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

export const preparedCustomerOpenStepSchema = z.object({
  providerId: z.literal("accounts"),
  origin: originSchema,
  toolName: z.literal("open_customer"),
  namespacedName: z.literal("accounts.open_customer"),
  schemaFingerprint: z.string().min(1).nullable(),
  arguments: openCustomerProposedArgumentsSchema,
  readOnly: z.literal(true),
});

export const preparedProductOpenStepSchema = z.object({
  providerId: z.literal("shop"),
  origin: originSchema,
  toolName: z.literal("open_product"),
  namespacedName: z.literal("shop.open_product"),
  schemaFingerprint: z.string().min(1).nullable(),
  arguments: openProductProposedArgumentsSchema,
  readOnly: z.literal(true),
});

export const preparedCaseOpenStepSchema = z.object({
  providerId: z.literal("support"),
  origin: originSchema,
  toolName: z.literal("open_case"),
  namespacedName: z.literal("support.open_case"),
  schemaFingerprint: z.string().min(1).nullable(),
  arguments: openCaseProposedArgumentsSchema,
  readOnly: z.literal(true),
});

export const preparedCustomerCreateStepSchema = z.object({
  providerId: z.literal("accounts"),
  origin: originSchema,
  toolName: z.literal("create_customer"),
  namespacedName: z.literal("accounts.create_customer"),
  schemaFingerprint: z.string().min(1).nullable(),
  arguments: createCustomerInputSchema,
  readOnly: z.literal(false),
});

export const preparedProductCreateStepSchema = z.object({
  providerId: z.literal("shop"),
  origin: originSchema,
  toolName: z.literal("create_product"),
  namespacedName: z.literal("shop.create_product"),
  schemaFingerprint: z.string().min(1).nullable(),
  arguments: createProductInputSchema,
  readOnly: z.literal(false),
});

export const preparedCaseCreateStepSchema = z.object({
  providerId: z.literal("support"),
  origin: originSchema,
  toolName: z.literal("create_case"),
  namespacedName: z.literal("support.create_case"),
  schemaFingerprint: z.string().min(1).nullable(),
  arguments: createCaseInputSchema,
  readOnly: z.literal(false),
});

export const preparedWorkflowStepSchema = z.discriminatedUnion(
  "namespacedName",
  [
    preparedCustomerSearchStepSchema,
    preparedProductSearchStepSchema,
    preparedCaseSearchStepSchema,
    preparedCustomerOpenStepSchema,
    preparedProductOpenStepSchema,
    preparedCaseOpenStepSchema,
    preparedCustomerCreateStepSchema,
    preparedProductCreateStepSchema,
    preparedCaseCreateStepSchema,
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

export const customerOpenResultSchema = z.object({
  tool: z.literal("accounts.open_customer"),
  data: openCustomerOutputSchema,
});

export const productOpenResultSchema = z.object({
  tool: z.literal("shop.open_product"),
  data: openProductOutputSchema,
});

export const caseOpenResultSchema = z.object({
  tool: z.literal("support.open_case"),
  data: openCaseOutputSchema,
});

export const customerCreateResultSchema = z.object({
  tool: z.literal("accounts.create_customer"),
  data: createCustomerOutputSchema,
});

export const productCreateResultSchema = z.object({
  tool: z.literal("shop.create_product"),
  data: createProductOutputSchema,
});

export const caseCreateResultSchema = z.object({
  tool: z.literal("support.create_case"),
  data: createCaseOutputSchema,
});

export const workflowStepResultSchema = z.discriminatedUnion("tool", [
  customerSearchResultSchema,
  productSearchResultSchema,
  caseSearchResultSchema,
  customerOpenResultSchema,
  productOpenResultSchema,
  caseOpenResultSchema,
  customerCreateResultSchema,
  productCreateResultSchema,
  caseCreateResultSchema,
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
    passTools: z.array(webmcpToolNameSchema).min(1).max(MAX_PROVIDER_TOOLS),
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
