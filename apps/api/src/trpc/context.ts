import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "@repo/auth";

export type SessionUser = typeof auth.$Infer.Session.user;

export async function createTrpcContext(
  options: CreateExpressContextOptions,
): Promise<TrpcContext> {
  const sessionResult = await auth.api.getSession({
    headers: fromNodeHeaders(options.req.headers),
  });

  return {
    sessionUser: sessionResult?.user ?? null,
  };
}

export type TrpcContext = {
  sessionUser: SessionUser | null;
};
