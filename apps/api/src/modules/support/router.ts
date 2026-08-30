import {
  searchCasesInputSchema,
  searchCasesOutputSchema,
} from "@repo/contracts";

import { searchCases } from "@api/modules/support/cases.js";
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
});
