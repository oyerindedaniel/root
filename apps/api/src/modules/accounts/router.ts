import { createTrpcRouter, publicProcedure } from "@api/trpc/trpc.js";

export const accountsRouter = createTrpcRouter({
  ping: publicProcedure.query(() => ({
    ok: true as const,
    domain: "accounts" as const,
  })),
});
