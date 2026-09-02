import { describe, expect, it } from "vitest";

import {
  DirectoryError,
  getBuiltinProvider,
  loadProviderDirectory,
} from "./directory";

const env = {
  NEXT_PUBLIC_ROOT_ORIGIN: "http://localhost:3000",
  NEXT_PUBLIC_SHOP_ORIGIN: "http://localhost:3002",
  NEXT_PUBLIC_SHOP_ENTRY_URL: "http://localhost:3002/",
  NEXT_PUBLIC_ACCOUNTS_ORIGIN: "http://localhost:3001",
  NEXT_PUBLIC_ACCOUNTS_ENTRY_URL: "http://localhost:3001/",
  NEXT_PUBLIC_SUPPORT_ORIGIN: "http://localhost:3003",
  NEXT_PUBLIC_SUPPORT_ENTRY_URL: "http://localhost:3003/",
};

describe("loadProviderDirectory", () => {
  it("loads immutable workflow-ready shop, accounts, and support entries", () => {
    const directory = loadProviderDirectory(env);
    const shop = getBuiltinProvider(directory, "shop");
    const accounts = getBuiltinProvider(directory, "accounts");
    const support = getBuiltinProvider(directory, "support");
    expect(shop.origin).toBe("http://localhost:3002");
    expect(shop.expectedTools).toEqual([
      "search_products",
      "open_product",
      "create_product",
    ]);
    expect(shop.source).toBe("builtin");
    expect(shop.capability).toBe("workflow-ready");
    expect(accounts.origin).toBe("http://localhost:3001");
    expect(accounts.expectedTools).toEqual([
      "search_customers",
      "open_customer",
      "create_customer",
    ]);
    expect(support.origin).toBe("http://localhost:3003");
    expect(support.expectedTools).toEqual([
      "search_cases",
      "open_case",
      "create_case",
    ]);
    expect(shop.label).toBe("Catalog");
    expect(accounts.label).toBe("Customers");
    expect(support.label).toBe("Cases");
  });

  it("rejects a missing env value", () => {
    expect(() =>
      loadProviderDirectory({ ...env, NEXT_PUBLIC_SHOP_ORIGIN: "" }),
    ).toThrow(DirectoryError);
    expect(() =>
      loadProviderDirectory({ ...env, NEXT_PUBLIC_SUPPORT_ORIGIN: "" }),
    ).toThrow(DirectoryError);
  });

  it("rejects an entry URL on another origin", () => {
    expect(() =>
      loadProviderDirectory({
        ...env,
        NEXT_PUBLIC_SHOP_ENTRY_URL: "http://localhost:3001/",
      }),
    ).toThrow(/match the provider origin/);
  });
});

describe("getBuiltinProvider", () => {
  it("looks up shop, accounts, and support by id", () => {
    const directory = loadProviderDirectory(env);
    expect(getBuiltinProvider(directory, "shop").providerId).toBe("shop");
    expect(getBuiltinProvider(directory, "accounts").providerId).toBe(
      "accounts",
    );
    expect(getBuiltinProvider(directory, "support").providerId).toBe("support");
  });

  it("rejects unknown providers", () => {
    const directory = loadProviderDirectory(env);
    expect(() => getBuiltinProvider(directory, "billing")).toThrow(
      /not in the built-in directory/,
    );
  });
});
