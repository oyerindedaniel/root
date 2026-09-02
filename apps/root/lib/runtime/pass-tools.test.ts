import { describe, expect, expectTypeOf, it } from "vitest";

import {
  namespacedToolName,
  type Customer,
  type SearchCustomersOutput,
  type SearchProductsOutput,
  type ShopProduct,
} from "@repo/contracts";

import {
  bindPassReadStep,
  getPassReadTool,
  parsePassToolResult,
  PASS_READ_TOOLS,
} from "./pass-tools";

const customerPayload = {
  status: "success" as const,
  query: "ada",
  customers: [{ id: "c1", name: "Ada", email: "ada@localhost" }],
};

const productPayload = {
  status: "success" as const,
  query: "keyboard",
  products: [
    {
      id: "p1",
      name: "Keyboard",
      description: "A keyboard",
      priceUsd: 40,
    },
  ],
};

describe("PASS_READ_TOOLS", () => {
  it("keeps computed literal keys", () => {
    expectTypeOf(
      namespacedToolName("accounts", "search_customers"),
    ).toEqualTypeOf<"accounts.search_customers">();
    expectTypeOf(
      namespacedToolName("shop", "search_products"),
    ).toEqualTypeOf<"shop.search_products">();
    expectTypeOf(
      namespacedToolName("support", "search_cases"),
    ).toEqualTypeOf<"support.search_cases">();
    expectTypeOf(
      PASS_READ_TOOLS[namespacedToolName("accounts", "search_customers")]
        .namespacedName,
    ).toEqualTypeOf<"accounts.search_customers">();
    expectTypeOf(
      PASS_READ_TOOLS[namespacedToolName("shop", "search_products")]
        .namespacedName,
    ).toEqualTypeOf<"shop.search_products">();
  });

  it("correlates input output and evidence per entry", () => {
    const customers = getPassReadTool("accounts.search_customers");
    const catalog = getPassReadTool("shop.search_products");
    const customerResult = customers.parseResult(customerPayload);
    const productResult = catalog.parseResult(productPayload);
    if (!customerResult || !productResult) {
      throw new Error("expected both parses to succeed");
    }
    expectTypeOf(customerResult).toEqualTypeOf<{
      result: {
        tool: "accounts.search_customers";
        data: SearchCustomersOutput;
      };
      evidence: string;
    }>();
    expectTypeOf(productResult).toEqualTypeOf<{
      result: {
        tool: "shop.search_products";
        data: SearchProductsOutput;
      };
      evidence: string;
    }>();
    expectTypeOf(
      customerResult.result.data.customers,
    ).toEqualTypeOf<Customer[]>();
    expectTypeOf(
      productResult.result.data.products,
    ).toEqualTypeOf<ShopProduct[]>();
    expect(customers.evidence(customerResult.result.data)).toBe(
      '1 customers for "ada"',
    );
    expect(catalog.evidence(productResult.result.data)).toBe(
      '1 products for "keyboard"',
    );
  });
});

describe("parsePassToolResult", () => {
  it("keeps a customer payload after a successful parse", () => {
    const parsed = parsePassToolResult("accounts.search_customers", {
      status: "success",
      query: "ada",
      customers: [{ id: "c1", name: "Ada", email: "ada@localhost" }],
    });
    expect(parsed?.result.tool).toBe("accounts.search_customers");
    if (parsed?.result.tool === "accounts.search_customers") {
      expectTypeOf(
        parsed.result.data.customers,
      ).toEqualTypeOf<Customer[]>();
      expect(parsed.evidence).toBe('1 customers for "ada"');
    }
  });

  it("rejects a product payload for a customer tool", () => {
    expect(
      parsePassToolResult("accounts.search_customers", {
        status: "success",
        query: "keyboard",
        products: [],
      }),
    ).toBeNull();
  });

  it("rejects malformed output at the matching registry entry", () => {
    expect(
      parsePassToolResult("shop.search_products", {
        status: "success",
        query: "keyboard",
        products: [{ id: "p1" }],
      }),
    ).toBeNull();
    expect(
      parsePassToolResult("accounts.search_customers", {
        status: "success",
        query: "",
        customers: [],
      }),
    ).toBeNull();
  });
});

describe("bindPassReadStep", () => {
  it("freezes the matching prepared step from the registry", () => {
    const binding = bindPassReadStep({
      providerId: "accounts",
      tool: "search_customers",
      arguments: { query: "ada" },
    });
    if (!binding) {
      throw new Error("expected binding");
    }
    const step = binding.freeze("http://localhost:3001", null);
    expect(step.namespacedName).toBe("accounts.search_customers");
    expect(step.toolName).toBe("search_customers");
    if (step.toolName !== "search_customers") {
      throw new Error("expected search_customers");
    }
    expect(step.arguments.query).toBe("ada");
  });

  it("rejects mismatched and malformed proposed steps at the entry", () => {
    expect(
      bindPassReadStep({
        providerId: "shop",
        tool: "search_customers",
        arguments: { query: "ada" },
      }),
    ).toBeNull();
    expect(
      bindPassReadStep({
        providerId: "shop",
        tool: "search_products",
        arguments: { query: "", extra: true },
      }),
    ).toBeNull();
    expect(
      bindPassReadStep({
        providerId: "accounts",
        tool: "search_cases",
        arguments: { query: "hub" },
      }),
    ).toBeNull();
  });

  it("freezes a Cases search", () => {
    const binding = bindPassReadStep({
      providerId: "support",
      tool: "search_cases",
      arguments: { query: "hub" },
    });
    if (!binding) {
      throw new Error("expected binding");
    }
    const step = binding.freeze("http://localhost:3003", null);
    expect(step.namespacedName).toBe("support.search_cases");
  });

  it("freezes a Cases bind placeholder without resolving it", () => {
    const binding = bindPassReadStep({
      providerId: "support",
      tool: "search_cases",
      arguments: { query: { bind: { stepIndex: 0 } } },
    });
    if (!binding) {
      throw new Error("expected binding");
    }
    if (binding.proposed.tool !== "search_cases") {
      throw new Error("expected search_cases");
    }
    expect(binding.proposed.arguments.query).toEqual({
      bind: { stepIndex: 0 },
    });
    const frozen = binding.freeze("http://localhost:3003", null);
    if (frozen.toolName !== "search_cases") {
      throw new Error("expected search_cases");
    }
    expect(frozen.arguments.query).toEqual(
      { bind: { stepIndex: 0 } },
    );
  });
});
