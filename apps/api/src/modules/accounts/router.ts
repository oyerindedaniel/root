import {
  searchCustomersInputSchema,
  searchCustomersOutputSchema,
} from "@repo/contracts";

import { searchCustomers } from "@api/modules/accounts/customers.js";
import { createTrpcRouter, publicProcedure } from "@api/trpc/trpc.js";

export const accountsRouter = createTrpcRouter({
  ping: publicProcedure.query(() => ({
    ok: true as const,
    domain: "accounts" as const,
  })),
  searchCustomers: publicProcedure
    .input(searchCustomersInputSchema)
    .output(searchCustomersOutputSchema)
    .query(({ input }) => ({
      status: "success" as const,
      query: input.query,
      customers: searchCustomers(input.query),
    })),
});
