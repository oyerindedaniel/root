import { z } from "zod";

import {
  bindQuerySchema,
  PORTABLE_REFERENCE_JSON_SCHEMA,
  portableReferenceSchema,
  searchQueryTextSchema,
} from "./portable-reference.js";

export const searchCasesInputSchema = z.strictObject({
  query: searchQueryTextSchema,
});

export type SearchCasesInput = z.infer<typeof searchCasesInputSchema>;

export const searchCasesToolQuerySchema = z.union([
  searchQueryTextSchema,
  portableReferenceSchema,
]);

export const searchCasesToolInputSchema = z.strictObject({
  query: searchCasesToolQuerySchema,
});

export type SearchCasesToolInput = z.infer<typeof searchCasesToolInputSchema>;

export const searchCasesProposedQuerySchema = z.union([
  searchQueryTextSchema,
  bindQuerySchema,
]);

export const searchCasesProposedArgumentsSchema = z.strictObject({
  query: searchCasesProposedQuerySchema,
});

export type SearchCasesProposedArguments = z.infer<
  typeof searchCasesProposedArgumentsSchema
>;

export const supportCaseSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(160),
  customerName: z.string().min(1).max(120),
  customerEmail: z.string().min(1).max(120),
  orderRef: z.string().min(1).max(64),
  status: z.enum(["open", "pending", "closed"]),
});

export type SupportCase = z.infer<typeof supportCaseSchema>;

export const searchCasesOutputQuerySchema = z.union([
  searchQueryTextSchema,
  portableReferenceSchema,
]);

export const searchCasesOutputSchema = z.object({
  status: z.literal("success"),
  query: searchCasesOutputQuerySchema,
  cases: z.array(supportCaseSchema).max(12),
  selectedId: z.string().min(1).max(64).optional(),
  selected: portableReferenceSchema.optional(),
});

export type SearchCasesOutput = z.infer<typeof searchCasesOutputSchema>;

export const caseIdInputSchema = z.strictObject({
  id: z.string().min(1).max(64),
});

export type CaseIdInput = z.infer<typeof caseIdInputSchema>;

export const openCaseProposedArgumentsSchema = z.strictObject({
  id: z.union([z.string().min(1).max(64), bindQuerySchema]),
});

export type OpenCaseProposedArguments = z.infer<
  typeof openCaseProposedArgumentsSchema
>;

export const openCaseOutputSchema = z.object({
  status: z.literal("success"),
  case: supportCaseSchema,
});

export type OpenCaseOutput = z.infer<typeof openCaseOutputSchema>;

export const createCaseInputSchema = z.strictObject({
  title: z.string().min(1).max(160),
  customerName: z.string().min(1).max(120),
  customerEmail: z.string().min(1).max(120),
  orderRef: z.string().min(1).max(64),
});

export type CreateCaseInput = z.infer<typeof createCaseInputSchema>;

export const createCaseOutputSchema = z.object({
  status: z.literal("success"),
  case: supportCaseSchema,
});

export type CreateCaseOutput = z.infer<typeof createCaseOutputSchema>;

export const SEARCH_CASES_INPUT_SCHEMA = {
  type: "object",
  properties: {
    query: {
      anyOf: [
        {
          type: "string",
          description: "Case text to match against support projections.",
        },
        PORTABLE_REFERENCE_JSON_SCHEMA,
      ],
    },
  },
  required: ["query"],
} as const;

export const OPEN_CASE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: "Case id, or bind an earlier selected snapshot.",
    },
  },
  required: ["id"],
} as const;

export const CREATE_CASE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Case title.",
    },
    customerName: {
      type: "string",
      description: "Customer display name stored on the case.",
    },
    customerEmail: {
      type: "string",
      description: "Customer email stored on the case.",
    },
    orderRef: {
      type: "string",
      description: "Order or product reference stored on the case.",
    },
  },
  required: ["title", "customerName", "customerEmail", "orderRef"],
} as const;
