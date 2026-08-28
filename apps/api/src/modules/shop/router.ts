import {
  searchProductsInputSchema,
  searchProductsOutputSchema,
} from "@repo/contracts";

import { searchTestCatalog } from "@api/modules/shop/catalog.js";
import { createTrpcRouter, publicProcedure } from "@api/trpc/trpc.js";

export const shopRouter = createTrpcRouter({
  ping: publicProcedure.query(() => ({
    ok: true as const,
    domain: "shop" as const,
  })),
  searchProducts: publicProcedure
    .input(searchProductsInputSchema)
    .output(searchProductsOutputSchema)
    .query(({ input }) => ({
      status: "success" as const,
      query: input.query,
      products: searchTestCatalog(input.query),
    })),
});
