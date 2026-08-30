import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const supportCaseStatus = pgEnum("support_case_status", [
  "open",
  "pending",
  "closed",
]);

export const supportCase = pgTable(
  "support_case",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    customerName: text("customerName").notNull(),
    customerEmail: text("customerEmail").notNull(),
    orderRef: text("orderRef").notNull(),
    status: supportCaseStatus("status").notNull(),
    createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("support_case_title_idx").on(table.title),
    index("support_case_customer_email_idx").on(table.customerEmail),
    index("support_case_order_ref_idx").on(table.orderRef),
  ],
);

export type SupportCaseRow = typeof supportCase.$inferSelect;
export type SupportCaseInsert = typeof supportCase.$inferInsert;
