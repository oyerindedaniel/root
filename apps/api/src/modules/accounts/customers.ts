import { ilike, or } from "drizzle-orm";
import type { Customer } from "@repo/contracts";
import { db } from "@repo/db";
import { customer } from "@repo/db/schema";

import { ilikeContains } from "@api/lib/ilike-contains.js";

export async function searchCustomers(query: string): Promise<Customer[]> {
  const pattern = ilikeContains(query.trim().toLowerCase());
  const where = or(
    ilike(customer.name, pattern),
    ilike(customer.email, pattern),
  );
  if (!where) {
    return [];
  }
  return db
    .select({
      id: customer.id,
      name: customer.name,
      email: customer.email,
    })
    .from(customer)
    .where(where)
    .limit(12);
}

export async function seedCustomers(): Promise<void> {
  await db
    .insert(customer)
    .values([
      {
        id: "cust-ada",
        name: "Ada Ortega",
        email: "ada.ortega@example.com",
      },
      {
        id: "cust-lin",
        name: "Lin Park",
        email: "lin.park@example.com",
      },
      {
        id: "cust-sam",
        name: "Sam Rivera",
        email: "sam.rivera@example.com",
      },
      {
        id: "cust-noor",
        name: "Noor Hassan",
        email: "noor.hassan@example.com",
      },
    ])
    .onConflictDoNothing();
}
