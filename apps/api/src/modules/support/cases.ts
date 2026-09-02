import { eq, ilike, or } from "drizzle-orm";
import type { CreateCaseInput, SupportCase } from "@repo/contracts";
import { db } from "@repo/db";
import { supportCase } from "@repo/db/schema";

import { ilikeContains } from "@api/lib/ilike-contains.js";

export async function searchCases(query: string): Promise<SupportCase[]> {
  const pattern = ilikeContains(query.trim().toLowerCase());
  const where = or(
    ilike(supportCase.title, pattern),
    ilike(supportCase.customerName, pattern),
    ilike(supportCase.customerEmail, pattern),
    ilike(supportCase.orderRef, pattern),
  );
  if (!where) {
    return [];
  }
  return db
    .select({
      id: supportCase.id,
      title: supportCase.title,
      customerName: supportCase.customerName,
      customerEmail: supportCase.customerEmail,
      orderRef: supportCase.orderRef,
      status: supportCase.status,
    })
    .from(supportCase)
    .where(where)
    .limit(12);
}

export async function getCase(id: string): Promise<SupportCase | null> {
  const rows = await db
    .select({
      id: supportCase.id,
      title: supportCase.title,
      customerName: supportCase.customerName,
      customerEmail: supportCase.customerEmail,
      orderRef: supportCase.orderRef,
      status: supportCase.status,
    })
    .from(supportCase)
    .where(eq(supportCase.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createCase(input: CreateCaseInput): Promise<SupportCase> {
  const rows = await db
    .insert(supportCase)
    .values({
      id: `case_${crypto.randomUUID()}`,
      title: input.title,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      orderRef: input.orderRef,
      status: "open",
    })
    .returning({
      id: supportCase.id,
      title: supportCase.title,
      customerName: supportCase.customerName,
      customerEmail: supportCase.customerEmail,
      orderRef: supportCase.orderRef,
      status: supportCase.status,
    });
  const created = rows[0];
  if (!created) {
    throw new Error("Case insert returned no row.");
  }
  return created;
}

export async function seedCases(): Promise<void> {
  await db
    .insert(supportCase)
    .values([
      {
        id: "case-ada-hub",
        title: "USB-C hub not detected",
        customerName: "Ada Ortega",
        customerEmail: "ada.ortega@example.com",
        orderRef: "usb-hub",
        status: "open",
      },
      {
        id: "case-lin-keyboard",
        title: "Wireless keyboard pairing loop",
        customerName: "Lin Park",
        customerEmail: "lin.park@example.com",
        orderRef: "kbd-wireless",
        status: "pending",
      },
      {
        id: "case-sam-mat",
        title: "Desk mat arrived creased",
        customerName: "Sam Rivera",
        customerEmail: "sam.rivera@example.com",
        orderRef: "desk-mat",
        status: "closed",
      },
      {
        id: "case-noor-mouse",
        title: "Silent mouse double-click",
        customerName: "Noor Hassan",
        customerEmail: "noor.hassan@example.com",
        orderRef: "mse-silent",
        status: "open",
      },
    ])
    .onConflictDoNothing();
}
