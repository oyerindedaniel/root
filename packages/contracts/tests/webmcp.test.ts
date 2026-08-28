import { describe, expect, it } from "vitest";

import {
  boundedError,
  namespacedToolName,
  normalizeInputSchema,
  parseJsonObject,
  schemaFingerprint,
  serializeExecuteInput,
  toolHandleKey,
} from "../src/webmcp.js";
import { searchProductsInputSchema } from "../src/shop.js";

describe("input schema normalization", () => {
  it("keeps object schemas as object invoke kind", () => {
    const normalized = normalizeInputSchema({
      type: "object",
      properties: { query: { type: "string" } },
    });
    expect(normalized.invokeKind).toBe("object");
    expect(normalized.schema.type).toBe("object");
  });

  it("parses stringified Chrome schemas as json-string invoke kind", () => {
    const normalized = normalizeInputSchema(
      JSON.stringify({
        type: "object",
        properties: { query: { type: "string" } },
      }),
    );
    expect(normalized.invokeKind).toBe("json-string");
    expect(normalized.schema.type).toBe("object");
  });

  it("rejects invalid schema JSON", () => {
    expect(() => parseJsonObject("{")).toThrow("invalid_json");
  });
});

describe("execute serialization", () => {
  it("serializes Chrome input as JSON once", () => {
    expect(serializeExecuteInput("json-string", { query: "keyboard" })).toBe(
      '{"query":"keyboard"}',
    );
  });

  it("passes draft input as an object", () => {
    expect(serializeExecuteInput("object", { query: "keyboard" })).toEqual({
      query: "keyboard",
    });
  });
});

describe("fingerprints and namespacing", () => {
  it("is stable across key order", () => {
    expect(schemaFingerprint({ b: 1, a: 2 })).toBe(
      schemaFingerprint({ a: 2, b: 1 }),
    );
  });

  it("namespaces tools by provider", () => {
    expect(namespacedToolName("shop", "search_products")).toBe(
      "shop.search_products",
    );
  });

  it("keys handles by instance origin and name", () => {
    expect(toolHandleKey("shop_1", "http://localhost:3002", "search_products")).toBe(
      "shop_1:http://localhost:3002:search_products",
    );
  });
});

describe("bounded errors and shop input", () => {
  it("rejects empty search queries", () => {
    expect(searchProductsInputSchema.safeParse({ query: "" }).success).toBe(
      false,
    );
  });

  it("builds a bounded error envelope", () => {
    expect(boundedError("unsupported_graph", "Only one step.").code).toBe(
      "unsupported_graph",
    );
  });
});
