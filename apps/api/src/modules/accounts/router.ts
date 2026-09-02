import { TRPCError } from "@trpc/server";
import {
  createCustomerInputSchema,
  createCustomerOutputSchema,
  customerIdInputSchema,
  openCustomerOutputSchema,
  searchCustomersInputSchema,
  searchCustomersOutputSchema,
} from "@repo/contracts";

import {
  createCustomer,
  getCustomer,
  searchCustomers,
} from "@api/modules/accounts/customers.js";
import { createTrpcRouter, publicProcedure } from "@api/trpc/trpc.js";

export const accountsRouter = createTrpcRouter({
  ping: publicProcedure.query(() => ({
    ok: true as const,
    domain: "accounts" as const,
  })),
  searchCustomers: publicProcedure
    .input(searchCustomersInputSchema)
    .output(searchCustomersOutputSchema)
    .query(async ({ input }) => ({
      status: "success" as const,
      query: input.query,
      customers: await searchCustomers(input.query),
    })),
  getCustomer: publicProcedure
    .input(customerIdInputSchema)
    .output(openCustomerOutputSchema)
    .query(async ({ input }) => {
      const row = await getCustomer(input.id);
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found.",
        });
      }
      return { status: "success" as const, customer: row };
    }),
  createCustomer: publicProcedure
    .input(createCustomerInputSchema)
    .output(createCustomerOutputSchema)
    .mutation(async ({ input }) => {
      try {
        return {
          status: "success" as const,
          customer: await createCustomer(input),
        };
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "That email is already in the directory.",
          });
        }
        throw error;
      }
    }),
});

function isUniqueViolation(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  return "code" in error && error.code === "23505";
}
