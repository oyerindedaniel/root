import { createTrpcRouter, publicProcedure } from "@api/trpc/trpc.js";

export const supportRouter = createTrpcRouter({
  ping: publicProcedure.query(() => ({
    ok: true as const,
    domain: "support" as const,
  })),
});
