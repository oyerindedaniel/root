import {
  namespacedToolName,
  proposedCustomerSearchStepSchema,
  proposedProductSearchStepSchema,
  searchCustomersInputSchema,
  searchCustomersOutputSchema,
  searchProductsInputSchema,
  searchProductsOutputSchema,
  type PassReadToolName,
  type PreparedWorkflowStep,
  type ProposedWorkflowStep,
  type WorkflowStepResult,
} from "@repo/contracts";
import type { z } from "zod";

function definePassTool<
  const TProvider extends "accounts" | "shop",
  const TTool extends string,
  TInputSchema extends z.ZodType,
  TOutputSchema extends z.ZodType,
  TProposedSchema extends z.ZodType<{
    providerId: TProvider;
    tool: TTool;
    arguments: z.output<TInputSchema>;
  }>,
>(config: {
  providerId: TProvider;
  tool: TTool;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  proposedSchema: TProposedSchema;
  evidence: (data: z.output<TOutputSchema>) => string;
}) {
  const namespacedName = namespacedToolName(config.providerId, config.tool);
  return {
    namespacedName,
    providerId: config.providerId,
    tool: config.tool,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    proposedSchema: config.proposedSchema,
    bindProposed(raw: unknown) {
      const parsed = config.proposedSchema.safeParse(raw);
      if (!parsed.success) {
        return null;
      }
      return {
        proposed: parsed.data,
        freeze(origin: string, schemaFingerprint: string | null) {
          return {
            providerId: config.providerId,
            origin,
            toolName: config.tool,
            namespacedName,
            schemaFingerprint,
            arguments: parsed.data.arguments,
            readOnly: true as const,
          };
        },
      };
    },
    parseResult(raw: unknown) {
      const parsed = config.outputSchema.safeParse(raw);
      if (!parsed.success) {
        return null;
      }
      return {
        result: { tool: namespacedName, data: parsed.data },
        evidence: config.evidence(parsed.data),
      };
    },
    evidence: config.evidence,
  };
}

export const PASS_READ_TOOLS = {
  [namespacedToolName("shop", "search_products")]: definePassTool({
    providerId: "shop",
    tool: "search_products",
    inputSchema: searchProductsInputSchema,
    outputSchema: searchProductsOutputSchema,
    proposedSchema: proposedProductSearchStepSchema,
    evidence: (data) => `${data.products.length} products for "${data.query}"`,
  }),
  [namespacedToolName("accounts", "search_customers")]: definePassTool({
    providerId: "accounts",
    tool: "search_customers",
    inputSchema: searchCustomersInputSchema,
    outputSchema: searchCustomersOutputSchema,
    proposedSchema: proposedCustomerSearchStepSchema,
    evidence: (data) => `${data.customers.length} customers for "${data.query}"`,
  }),
} satisfies Record<PassReadToolName, unknown>;

export type PassReadTool = (typeof PASS_READ_TOOLS)[PassReadToolName];

type _AssertRegistryKeys = keyof typeof PASS_READ_TOOLS extends PassReadToolName
  ? PassReadToolName extends keyof typeof PASS_READ_TOOLS
    ? true
    : never
  : never;
const _registryKeys: _AssertRegistryKeys = true;
void _registryKeys;

export function isPassReadToolName(value: string): value is PassReadToolName {
  return Object.hasOwn(PASS_READ_TOOLS, value);
}

export function getPassReadTool<T extends PassReadToolName>(
  namespacedName: T,
): (typeof PASS_READ_TOOLS)[T];
export function getPassReadTool(
  namespacedName: string,
): PassReadTool | undefined;
export function getPassReadTool(namespacedName: string) {
  if (!isPassReadToolName(namespacedName)) {
    return undefined;
  }
  return PASS_READ_TOOLS[namespacedName];
}

export function bindPassReadStep(raw: unknown) {
  const namespacedName = proposedNamespacedName(raw);
  if (!namespacedName) {
    return null;
  }
  return PASS_READ_TOOLS[namespacedName].bindProposed(raw);
}

export function parsePassToolResult(
  namespacedName: PassReadToolName,
  raw: unknown,
) {
  return PASS_READ_TOOLS[namespacedName].parseResult(raw);
}

function proposedNamespacedName(raw: unknown): PassReadToolName | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const providerId = Reflect.get(raw, "providerId");
  const tool = Reflect.get(raw, "tool");
  if (typeof providerId !== "string" || typeof tool !== "string") {
    return null;
  }
  const namespacedName = namespacedToolName(providerId, tool);
  return isPassReadToolName(namespacedName) ? namespacedName : null;
}

type RegistryBinding = NonNullable<
  ReturnType<PassReadTool["bindProposed"]>
>;
type RegistryPreparedStep = ReturnType<RegistryBinding["freeze"]>;
type RegistryProposedStep = RegistryBinding["proposed"];
type RegistryResult = NonNullable<
  ReturnType<PassReadTool["parseResult"]>
>["result"];
type _AssertPreparedOutput = RegistryPreparedStep extends PreparedWorkflowStep
  ? true
  : never;
type _AssertProposedOutput = RegistryProposedStep extends ProposedWorkflowStep
  ? true
  : never;
type _AssertResultOutput = RegistryResult extends WorkflowStepResult
  ? true
  : never;
const _registryOutputs: [
  _AssertPreparedOutput,
  _AssertProposedOutput,
  _AssertResultOutput,
] = [true, true, true];
void _registryOutputs;
