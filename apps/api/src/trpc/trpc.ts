import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

import { toClientTrpcMessage } from "@api/trpc/client-error-message.js";
import type { TrpcContext } from "@api/trpc/context.js";

const trpc = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const dataWithoutStack = { ...shape.data };
    delete dataWithoutStack.stack;
    return {
      ...shape,
      message: toClientTrpcMessage({
        code: error.code,
        message: shape.message,
      }),
      data: {
        ...dataWithoutStack,
        zodError:
          error.cause instanceof z.ZodError ? z.treeifyError(error.cause) : null,
      },
    };
  },
});

export const createTrpcRouter = trpc.router;
export const createCallerFactory = trpc.createCallerFactory;
export const trpcMiddleware = trpc.middleware;
export const mergeTrpcRouters = trpc.mergeRouters;

const requestLoggingMiddleware = trpc.middleware(async ({ path, type, next }) => {
  const startedAt = Date.now();
  const result = await next();
  const elapsedMilliseconds = Date.now() - startedAt;
  const outcome = result.ok ? "ok" : "error";
  console.info(
    `[trpc] ${type.toUpperCase()} ${path} ${outcome} ${elapsedMilliseconds}ms`,
  );
  return result;
});

export const publicProcedure = trpc.procedure.use(requestLoggingMiddleware);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.sessionUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      sessionUser: ctx.sessionUser,
    },
  });
});
