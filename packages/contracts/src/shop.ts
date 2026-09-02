import { z } from "zod";

import { bindQuerySchema, portableReferenceSchema } from "./portable-reference.js";

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

export const productIdInputSchema = z.strictObject({
  id: z.string().min(1).max(64),
});

export type ProductIdInput = z.infer<typeof productIdInputSchema>;

export const openProductProposedArgumentsSchema = z.strictObject({
  id: z.union([z.string().min(1).max(64), bindQuerySchema]),
});

export type OpenProductProposedArguments = z.infer<
  typeof openProductProposedArgumentsSchema
>;

export const openProductOutputSchema = z.object({
  status: z.literal("success"),
  product: shopProductSchema,
});

export type OpenProductOutput = z.infer<typeof openProductOutputSchema>;

export const createProductInputSchema = z.strictObject({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(280),
  priceUsd: z.number().int().nonnegative(),
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

export const createProductOutputSchema = z.object({
  status: z.literal("success"),
  product: shopProductSchema,
});

export type CreateProductOutput = z.infer<typeof createProductOutputSchema>;

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

export const OPEN_PRODUCT_INPUT_SCHEMA = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: "Product id, or bind an earlier selected snapshot.",
    },
  },
  required: ["id"],
} as const;

export const CREATE_PRODUCT_INPUT_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Product name.",
    },
    description: {
      type: "string",
      description: "Product description.",
    },
    priceUsd: {
      type: "number",
      description: "Price in USD, whole dollars.",
    },
  },
  required: ["name", "description", "priceUsd"],
} as const;
