import { TRPCError } from "@trpc/server";
import {
  caseIdInputSchema,
  createCaseInputSchema,
  createCaseOutputSchema,
  openCaseOutputSchema,
  searchCasesInputSchema,
  searchCasesOutputSchema,
} from "@repo/contracts";

import {
  createCase,
  getCase,
  searchCases,
} from "@api/modules/support/cases.js";
import { createTrpcRouter, publicProcedure } from "@api/trpc/trpc.js";

export const supportRouter = createTrpcRouter({
  ping: publicProcedure.query(() => ({
    ok: true as const,
    domain: "support" as const,
  })),
  searchCases: publicProcedure
    .input(searchCasesInputSchema)
    .output(searchCasesOutputSchema)
    .query(async ({ input }) => ({
      status: "success" as const,
      query: input.query,
      cases: await searchCases(input.query),
    })),
  getCase: publicProcedure
    .input(caseIdInputSchema)
    .output(openCaseOutputSchema)
    .query(async ({ input }) => {
      const row = await getCase(input.id);
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Case not found.",
        });
      }
      return { status: "success" as const, case: row };
    }),
  createCase: publicProcedure
    .input(createCaseInputSchema)
    .output(createCaseOutputSchema)
    .mutation(async ({ input }) => {
      return {
        status: "success" as const,
        case: await createCase(input),
      };
    }),
});
