import { z } from "zod";

import type { SupportCase } from "./cases.js";
import type { Customer } from "./customers.js";
import type { ShopProduct } from "./shop.js";

export const portableEntityTypeSchema = z.enum([
  "customer",
  "product",
  "case",
]);

export type PortableEntityType = z.infer<typeof portableEntityTypeSchema>;

export const portableReferenceSchema = z.strictObject({
  sourceProvider: z.enum(["accounts", "shop", "support"]),
  entityType: portableEntityTypeSchema,
  sourceId: z.string().min(1).max(64),
  displayName: z.string().min(1).max(160),
  summary: z.record(
    z.string().min(1).max(64),
    z.union([z.string().min(1).max(280), z.number()]),
  ),
  capturedAt: z.iso.datetime(),
});

export type PortableReference = z.infer<typeof portableReferenceSchema>;

export const bindQuerySchema = z.strictObject({
  bind: z.strictObject({
    stepIndex: z.number().int().nonnegative(),
  }),
});

export type BindQuery = z.infer<typeof bindQuerySchema>;

export const searchQueryTextSchema = z.string().min(1).max(120);

export function isBindQuery(value: unknown): value is BindQuery {
  return bindQuerySchema.safeParse(value).success;
}

export function isPortableReference(value: unknown): value is PortableReference {
  return portableReferenceSchema.safeParse(value).success;
}

export function workflowQueryLabel(query: unknown): string | null {
  if (typeof query === "string" && query.length > 0) {
    return query;
  }
  if (isBindQuery(query)) {
    return "Bound";
  }
  if (isPortableReference(query)) {
    return query.displayName;
  }
  return null;
}

export function caseSearchText(reference: PortableReference): string | null {
  if (reference.entityType !== "customer") {
    return null;
  }
  const email = reference.summary.email;
  return typeof email === "string" ? email : null;
}

export function portableCustomerReference(
  customer: Customer,
  capturedAt: string,
): PortableReference {
  return portableReferenceSchema.parse({
    sourceProvider: "accounts",
    entityType: "customer",
    sourceId: customer.id,
    displayName: customer.name,
    summary: { email: customer.email },
    capturedAt,
  });
}

export function portableProductReference(
  product: ShopProduct,
  capturedAt: string,
): PortableReference {
  return portableReferenceSchema.parse({
    sourceProvider: "shop",
    entityType: "product",
    sourceId: product.id,
    displayName: product.name,
    summary: {
      description: product.description,
      priceUsd: product.priceUsd,
    },
    capturedAt,
  });
}

export function portableCaseReference(
  supportCase: SupportCase,
  capturedAt: string,
): PortableReference {
  return portableReferenceSchema.parse({
    sourceProvider: "support",
    entityType: "case",
    sourceId: supportCase.id,
    displayName: supportCase.title,
    summary: {
      customerEmail: supportCase.customerEmail,
      status: supportCase.status,
    },
    capturedAt,
  });
}

export const PORTABLE_REFERENCE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "sourceProvider",
    "entityType",
    "sourceId",
    "displayName",
    "summary",
    "capturedAt",
  ],
  properties: {
    sourceProvider: { type: "string" },
    entityType: { type: "string", enum: ["customer", "product", "case"] },
    sourceId: { type: "string" },
    displayName: { type: "string" },
    summary: { type: "object" },
    capturedAt: { type: "string" },
  },
} as const;
