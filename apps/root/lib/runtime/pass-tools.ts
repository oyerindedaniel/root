import {
  namespacedToolName,
  searchCustomersInputSchema,
  searchCustomersOutputSchema,
  searchProductsInputSchema,
  searchProductsOutputSchema,
  type ProviderId,
} from "@repo/contracts";

type PassReadTool = {
  providerId: ProviderId;
  tool: string;
  input: typeof searchProductsInputSchema | typeof searchCustomersInputSchema;
  parseOutput: (
    raw: unknown,
  ) => { data: unknown; evidence: string } | null;
};

export const PASS_READ_TOOLS: Record<string, PassReadTool> = {
  [namespacedToolName("shop", "search_products")]: {
    providerId: "shop",
    tool: "search_products",
    input: searchProductsInputSchema,
    parseOutput: (raw) => {
      const parsed = searchProductsOutputSchema.safeParse(raw);
      if (!parsed.success) {
        return null;
      }
      return {
        data: parsed.data,
        evidence: `${parsed.data.products.length} products for "${parsed.data.query}"`,
      };
    },
  },
  [namespacedToolName("accounts", "search_customers")]: {
    providerId: "accounts",
    tool: "search_customers",
    input: searchCustomersInputSchema,
    parseOutput: (raw) => {
      const parsed = searchCustomersOutputSchema.safeParse(raw);
      if (!parsed.success) {
        return null;
      }
      return {
        data: parsed.data,
        evidence: `${parsed.data.customers.length} customers for "${parsed.data.query}"`,
      };
    },
  },
};

export function getPassReadTool(namespacedName: string) {
  return PASS_READ_TOOLS[namespacedName];
}
