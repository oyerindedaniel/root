import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@repo/db";
import { account, session, user, verification } from "@repo/db/schema/auth";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function parseCommaSeparatedOrigins(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getTrustedOrigins(nodeEnv: string): string[] {
  if (nodeEnv !== "production") {
    return ["*"];
  }

  return [
    ...new Set([
      ...parseCommaSeparatedOrigins(process.env.CORS_ORIGINS),
      ...parseCommaSeparatedOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
    ]),
  ];
}

const nodeEnv = process.env.NODE_ENV?.trim() || "development";

export const auth = betterAuth({
  appName: "Root",
  baseURL: requireEnv("BETTER_AUTH_URL"),
  secret: requireEnv("BETTER_AUTH_SECRET"),
  basePath: "/api/auth",
  trustedOrigins: getTrustedOrigins(nodeEnv),
  database: drizzleAdapter(db, {
    provider: "pg",
    camelCase: true,
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
  session: {
    expiresIn: 60 * 60 * 24,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
});

export type Auth = typeof auth;
