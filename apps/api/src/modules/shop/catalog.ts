import { ilike, or } from "drizzle-orm";
import type { ShopProduct } from "@repo/contracts";
import { db } from "@repo/db";
import { product } from "@repo/db/schema";

import { ilikeContains } from "@api/lib/ilike-contains.js";

export async function searchCatalog(query: string): Promise<ShopProduct[]> {
  const pattern = ilikeContains(query.trim().toLowerCase());
  const where = or(
    ilike(product.name, pattern),
    ilike(product.description, pattern),
  );
  if (!where) {
    return [];
  }
  return db
    .select({
      id: product.id,
      name: product.name,
      description: product.description,
      priceUsd: product.priceUsd,
    })
    .from(product)
    .where(where)
    .limit(12);
}

export async function seedCatalog(): Promise<void> {
  await db
    .insert(product)
    .values([
      {
        id: "kbd-wireless",
        name: "Wireless Keyboard",
        description: "Compact wireless keyboard for desk kits.",
        priceUsd: 42,
      },
      {
        id: "mse-silent",
        name: "Silent Mouse",
        description: "Low-profile silent mouse for desk kits.",
        priceUsd: 18,
      },
      {
        id: "usb-hub",
        name: "USB-C Hub",
        description: "Four-port USB-C hub for peripherals.",
        priceUsd: 36,
      },
      {
        id: "desk-mat",
        name: "Desk Mat",
        description: "Large desk mat in charcoal.",
        priceUsd: 24,
      },
      {
        id: "hdmi-cable",
        name: "HDMI Cable",
        description: "Two-meter HDMI cable.",
        priceUsd: 12,
      },
    ])
    .onConflictDoNothing();
}
