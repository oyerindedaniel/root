export const APP_ORIGINS = {
  root: "http://localhost:3000",
  accounts: "http://localhost:3001",
  shop: "http://localhost:3002",
  support: "http://localhost:3003",
  api: "http://localhost:4000",
} as const;

export type AppName = keyof typeof APP_ORIGINS;

export const APP_DEFAULTS = {
  query: {
    staleTimeMs: 60_000,
    gcTimeMs: 5 * 60_000,
    queryRetryCount: 1,
    mutationRetryCount: 0,
  },
} as const;
