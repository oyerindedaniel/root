import { describe, expect, expectTypeOf, it } from "vitest";

import {
  boundedError,
  GatewayError,
  namespacedToolName,
  normalizeInputSchema,
  parseBoundedJsonResult,
  parseJsonObject,
  providerIdSchema,
  schemaFingerprint,
  serializeExecuteInput,
  toolHandleKey,
  WEBMCP_MAX_RESULT_CHARS,
} from "../src/webmcp.js";
import { searchProductsInputSchema } from "../src/shop.js";
import { searchCasesInputSchema } from "../src/cases.js";

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
    expect(() => normalizeInputSchema("{")).toThrow(GatewayError);
    try {
      normalizeInputSchema("{");
    } catch (error) {
      expect(error).toMatchObject({ code: "invalid_schema" });
    }
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
    expect(namespacedToolName("accounts", "search_customers")).toBe(
      "accounts.search_customers",
    );
    expect(namespacedToolName("support", "search_cases")).toBe(
      "support.search_cases",
    );
    expectTypeOf(namespacedToolName("shop", "search_products")).toEqualTypeOf<
      "shop.search_products"
    >();
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
    expect(searchCasesInputSchema.safeParse({ query: "" }).success).toBe(false);
  });

  it("builds a bounded error envelope", () => {
    expect(boundedError("unsupported_graph", "Only one step.").code).toBe(
      "unsupported_graph",
    );
  });

  it("throws GatewayError when the result exceeds the byte limit", () => {
    expect(() =>
      parseBoundedJsonResult("x".repeat(WEBMCP_MAX_RESULT_CHARS + 1)),
    ).toThrow(GatewayError);
    try {
      parseBoundedJsonResult("x".repeat(WEBMCP_MAX_RESULT_CHARS + 1));
    } catch (error) {
      expect(error).toMatchObject({ code: "output_too_large" });
    }
  });
});

describe("provider identities", () => {
  it("accepts bounded dynamic provider keys", () => {
    expect(providerIdSchema.parse("custom-analytics-1")).toBe(
      "custom-analytics-1",
    );
    expect(providerIdSchema.safeParse("Shop").success).toBe(false);
    expect(providerIdSchema.safeParse(`a${"b".repeat(64)}`).success).toBe(false);
  });
});
