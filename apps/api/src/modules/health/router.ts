import { healthStatusSchema } from "@repo/contracts";

import { getHealthStatus } from "@api/modules/health/service.js";
import { createTrpcRouter, publicProcedure } from "@api/trpc/trpc.js";

export const healthRouter = createTrpcRouter({
  check: publicProcedure.output(healthStatusSchema).query(() => {
    return getHealthStatus();
  }),
});
