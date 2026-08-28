import "@repo/db/env";

import { APIError } from "better-auth";

import { auth } from "@repo/auth";

function requireSeedEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required in apps/api/.env.local.`);
  }
  return value;
}

async function seedAccount() {
  const email = requireSeedEnv("SEED_ACCOUNT_EMAIL");
  const password = requireSeedEnv("SEED_ACCOUNT_PASSWORD");
  const name = requireSeedEnv("SEED_ACCOUNT_NAME");

  try {
    await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    });
    console.log(`Seeded account: ${email}`);
  } catch (error) {
    if (error instanceof APIError && error.statusCode === 422) {
      console.log(`Account already seeded: ${email}`);
      return;
    }
    throw error;
  }
}

seedAccount()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
