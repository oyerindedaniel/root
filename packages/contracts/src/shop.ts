import { z } from "zod";

import { portableReferenceSchema } from "./portable-reference.js";

export const searchProductsInputSchema = z.strictObject({
  query: z.string().min(1).max(120),
});

export type SearchProductsInput = z.infer<typeof searchProductsInputSchema>;

export const shopProductSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(280),
  priceUsd: z.number().nonnegative(),
});

export type ShopProduct = z.infer<typeof shopProductSchema>;

export const searchProductsOutputSchema = z.object({
  status: z.literal("success"),
  query: z.string().min(1).max(120),
  products: z.array(shopProductSchema).max(12),
  selectedId: z.string().min(1).max(64).optional(),
  selected: portableReferenceSchema.optional(),
});

export type SearchProductsOutput = z.infer<typeof searchProductsOutputSchema>;

export const SEARCH_PRODUCTS_INPUT_SCHEMA = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Product text to match against the catalog.",
    },
  },
  required: ["query"],
} as const;
