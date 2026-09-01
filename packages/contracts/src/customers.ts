import { z } from "zod";

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
  selectedId: z.string().min(1).max(64).optional(),
});

export type SearchCustomersOutput = z.infer<typeof searchCustomersOutputSchema>;

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
