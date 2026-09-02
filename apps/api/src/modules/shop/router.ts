import { TRPCError } from "@trpc/server";
import {
  createProductInputSchema,
  createProductOutputSchema,
  openProductOutputSchema,
  productIdInputSchema,
  searchProductsInputSchema,
  searchProductsOutputSchema,
} from "@repo/contracts";

import {
  createProduct,
  getProduct,
  searchCatalog,
} from "@api/modules/shop/catalog.js";
import { createTrpcRouter, publicProcedure } from "@api/trpc/trpc.js";

export const shopRouter = createTrpcRouter({
  ping: publicProcedure.query(() => ({
    ok: true as const,
    domain: "shop" as const,
  })),
  searchProducts: publicProcedure
    .input(searchProductsInputSchema)
    .output(searchProductsOutputSchema)
    .query(async ({ input }) => ({
      status: "success" as const,
      query: input.query,
      products: await searchCatalog(input.query),
    })),
  getProduct: publicProcedure
    .input(productIdInputSchema)
    .output(openProductOutputSchema)
    .query(async ({ input }) => {
      const row = await getProduct(input.id);
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found.",
        });
      }
      return { status: "success" as const, product: row };
    }),
  createProduct: publicProcedure
    .input(createProductInputSchema)
    .output(createProductOutputSchema)
    .mutation(async ({ input }) => {
      return {
        status: "success" as const,
        product: await createProduct(input),
      };
    }),
});
