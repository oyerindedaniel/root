import { APP_DEFAULTS } from "@repo/contracts";
import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: APP_DEFAULTS.query.staleTimeMs,
        gcTime: APP_DEFAULTS.query.gcTimeMs,
        retry: APP_DEFAULTS.query.queryRetryCount,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: APP_DEFAULTS.query.mutationRetryCount,
      },
    },
  });
}
