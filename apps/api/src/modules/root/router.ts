import { createTrpcRouter, publicProcedure } from "@api/trpc/trpc.js";

export const rootRouter = createTrpcRouter({
  ping: publicProcedure.query(() => ({
    ok: true as const,
    domain: "root" as const,
  })),
});
