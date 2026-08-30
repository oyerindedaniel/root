import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const product = pgTable(
  "shop_product",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    priceUsd: integer("priceUsd").notNull(),
    createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("shop_product_name_idx").on(table.name),
  ],
);

export type ProductRow = typeof product.$inferSelect;
export type ProductInsert = typeof product.$inferInsert;
