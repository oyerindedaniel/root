import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const customer = pgTable(
  "accounts_customer",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("accounts_customer_name_idx").on(table.name),
    index("accounts_customer_email_idx").on(table.email),
  ],
);

export type CustomerRow = typeof customer.$inferSelect;
export type CustomerInsert = typeof customer.$inferInsert;
