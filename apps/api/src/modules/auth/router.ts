import { accountSchema } from "@repo/contracts";

import { createTrpcRouter, protectedProcedure } from "@api/trpc/trpc.js";

export const authRouter = createTrpcRouter({
  me: protectedProcedure.output(accountSchema).query(({ ctx }) => ({
    id: ctx.sessionUser.id,
    email: ctx.sessionUser.email,
    name: ctx.sessionUser.name,
  })),
});
