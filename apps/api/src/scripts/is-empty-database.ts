import "@repo/db/env";

import postgres from "postgres";

async function run() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = postgres(databaseUrl, { max: 1 });
  try {
    const [{ count }] = await client<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    process.exit(Number(count) === 0 ? 0 : 1);
  } finally {
    await client.end();
  }
}

run().catch((error: unknown) => {
  console.error("Could not check whether the database is empty.", error);
  process.exit(2);
});
