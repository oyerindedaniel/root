import "server-only";

import type { AppRouter } from "@repo/api/trpc";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import { trpcUpstreamHttpUrl } from "./env";
import { makeQueryClient } from "./query-client";

export function makeServerTrpcClient(cookieHeader: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: trpcUpstreamHttpUrl,
        transformer: superjson,
        headers() {
          return cookieHeader ? { cookie: cookieHeader } : {};
        },
      }),
    ],
  });
}

export function createServerTrpc(cookieHeader: string) {
  const queryClient = makeQueryClient();
  const client = makeServerTrpcClient(cookieHeader);
  const trpc = createTRPCOptionsProxy<AppRouter>({
    client,
    queryClient,
  });
  return { queryClient, trpc };
}
