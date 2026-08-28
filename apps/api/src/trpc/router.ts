import { accountsRouter } from "@api/modules/accounts/router.js";
import { authRouter } from "@api/modules/auth/router.js";
import { healthRouter } from "@api/modules/health/router.js";
import { rootRouter } from "@api/modules/root/router.js";
import { shopRouter } from "@api/modules/shop/router.js";
import { supportRouter } from "@api/modules/support/router.js";
import { createTrpcRouter } from "@api/trpc/trpc.js";

export const appTrpcRouter = createTrpcRouter({
  v1: createTrpcRouter({
    health: healthRouter,
    auth: authRouter,
    accounts: accountsRouter,
    shop: shopRouter,
    support: supportRouter,
    root: rootRouter,
  }),
});

export type AppRouter = typeof appTrpcRouter;
export type { SessionUser, TrpcContext } from "@api/trpc/context.js";
