import "@repo/db/env";

import { seedCustomers } from "@api/modules/accounts/customers.js";
import { seedCatalog } from "@api/modules/shop/catalog.js";
import { seedCases } from "@api/modules/support/cases.js";

async function seedProviders() {
  await seedCustomers();
  await seedCatalog();
  await seedCases();
  console.log("Seeded provider domain rows.");
}

seedProviders()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
