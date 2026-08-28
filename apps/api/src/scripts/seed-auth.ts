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

async function seedOperator() {
  const email = requireSeedEnv("SEED_OPERATOR_EMAIL");
  const password = requireSeedEnv("SEED_OPERATOR_PASSWORD");
  const name = requireSeedEnv("SEED_OPERATOR_NAME");

  try {
    await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    });
    console.log(`Seeded operator: ${email}`);
  } catch (error) {
    if (error instanceof APIError && error.statusCode === 422) {
      console.log(`Operator already seeded: ${email}`);
      return;
    }
    throw error;
  }
}

seedOperator()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
