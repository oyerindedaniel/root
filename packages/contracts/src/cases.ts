import { z } from "zod";

export const searchCasesInputSchema = z.strictObject({
  query: z.string().min(1).max(120),
});

export type SearchCasesInput = z.infer<typeof searchCasesInputSchema>;

export const supportCaseSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(160),
  customerName: z.string().min(1).max(120),
  customerEmail: z.string().min(1).max(120),
  orderRef: z.string().min(1).max(64),
  status: z.enum(["open", "pending", "closed"]),
});

export type SupportCase = z.infer<typeof supportCaseSchema>;

export const searchCasesOutputSchema = z.object({
  status: z.literal("success"),
  query: z.string().min(1).max(120),
  cases: z.array(supportCaseSchema).max(12),
  selectedId: z.string().min(1).max(64).optional(),
});

export type SearchCasesOutput = z.infer<typeof searchCasesOutputSchema>;

export const SEARCH_CASES_INPUT_SCHEMA = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Case text to match against support projections.",
    },
  },
  required: ["query"],
} as const;
