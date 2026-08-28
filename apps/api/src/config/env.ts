import { requireEnv } from "@api/config/require-env.js";

function parseCommaSeparatedOrigins(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const nodeEnv = requireEnv("NODE_ENV");

export const serverEnv = {
  port: Number(requireEnv("PORT")),
  listenHost: requireEnv("LISTEN_HOST"),
  nodeEnv,
  databaseUrl: requireEnv("DATABASE_URL"),
  betterAuth: {
    baseUrl: requireEnv("BETTER_AUTH_URL"),
    secret: requireEnv("BETTER_AUTH_SECRET"),
  },
};

export function getTrustedOrigins(): string[] {
  if (serverEnv.nodeEnv !== "production") {
    return ["*"];
  }

  return [
    ...new Set([
      ...parseCommaSeparatedOrigins(process.env.CORS_ORIGINS),
      ...parseCommaSeparatedOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
    ]),
  ];
}

export function getExpressCorsOrigin(): boolean | string[] {
  if (serverEnv.nodeEnv !== "production") {
    return true;
  }
  const origins = getTrustedOrigins();
  return origins.length > 0 ? origins : false;
}
