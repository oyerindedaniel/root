import { createTrpcRouter, protectedProcedure } from "@api/trpc/trpc.js";

export const authRouter = createTrpcRouter({
  me: protectedProcedure.query(({ ctx }) => ctx.sessionUser),
});
