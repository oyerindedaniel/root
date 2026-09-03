import { z } from "zod";

import { bindQuerySchema } from "./portable-reference.js";

export const searchCustomersInputSchema = z.strictObject({
  query: z.string().min(1).max(120),
});

export type SearchCustomersInput = z.infer<typeof searchCustomersInputSchema>;

export const customerSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  email: z.string().min(1).max(120),
});

export type Customer = z.infer<typeof customerSchema>;

export const searchCustomersOutputSchema = z.object({
  status: z.literal("success"),
  query: z.string().min(1).max(120),
  customers: z.array(customerSchema).max(12),
});

export type SearchCustomersOutput = z.infer<typeof searchCustomersOutputSchema>;

export const customerIdInputSchema = z.strictObject({
  id: z.string().min(1).max(64),
});

export type CustomerIdInput = z.infer<typeof customerIdInputSchema>;

export const openCustomerProposedArgumentsSchema = z.strictObject({
  id: bindQuerySchema,
});

export type OpenCustomerProposedArguments = z.infer<
  typeof openCustomerProposedArgumentsSchema
>;

export const openCustomerByIdProposedArgumentsSchema = customerIdInputSchema;

export const openCustomerOutputSchema = z.object({
  status: z.literal("success"),
  customer: customerSchema,
});

export type OpenCustomerOutput = z.infer<typeof openCustomerOutputSchema>;

export const createCustomerInputSchema = z.strictObject({
  name: z.string().min(1).max(120),
  email: z.string().min(1).max(120),
});

export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;

export const createCustomerOutputSchema = z.object({
  status: z.literal("success"),
  customer: customerSchema,
});

export type CreateCustomerOutput = z.infer<typeof createCustomerOutputSchema>;

export const SEARCH_CUSTOMERS_INPUT_SCHEMA = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Customer text to match against the directory.",
    },
  },
  required: ["query"],
} as const;

export const OPEN_CUSTOMER_INPUT_SCHEMA = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: "Customer id resolved from an earlier selected snapshot.",
    },
  },
  required: ["id"],
} as const;

export const CREATE_CUSTOMER_INPUT_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Customer display name.",
    },
    email: {
      type: "string",
      description: "Customer email.",
    },
  },
  required: ["name", "email"],
} as const;
