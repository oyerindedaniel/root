import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.js";

function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required.");
  }
  return value;
}

const client = postgres(requireDatabaseUrl(), { max: 10 });

export const db = drizzle(client, { schema });
