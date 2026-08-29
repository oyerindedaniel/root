import { describe, expect, it } from "vitest";

import {
  DirectoryError,
  getTrustedProvider,
  loadProviderDirectory,
  pinForProvider,
} from "./directory";

const env = {
  NEXT_PUBLIC_ROOT_ORIGIN: "http://localhost:3000",
  NEXT_PUBLIC_SHOP_ORIGIN: "http://localhost:3002",
  NEXT_PUBLIC_SHOP_ENTRY_URL: "http://localhost:3002/",
  NEXT_PUBLIC_ACCOUNTS_ORIGIN: "http://localhost:3001",
  NEXT_PUBLIC_ACCOUNTS_ENTRY_URL: "http://localhost:3001/",
};

describe("loadProviderDirectory", () => {
  it("loads trusted shop and accounts entries and ordered pins", () => {
    const directory = loadProviderDirectory(env);
    expect(directory.providers.shop.providerId).toBe("shop");
    expect(directory.providers.shop.origin).toBe("http://localhost:3002");
    expect(directory.providers.shop.expectedTools).toEqual(["search_products"]);
    expect(directory.providers.accounts.providerId).toBe("accounts");
    expect(directory.providers.accounts.origin).toBe("http://localhost:3001");
    expect(directory.providers.accounts.expectedTools).toEqual([
      "search_customers",
    ]);
    expect(directory.pins.map((pin) => pin.id)).toEqual([
      "customers",
      "shop",
      "cases",
    ]);
    expect(pinForProvider(directory, "shop").label).toBe("Catalog");
    expect(pinForProvider(directory, "accounts").label).toBe("Customers");
    expect(
      directory.pins.filter((pin) => pin.providerId).map((pin) => pin.providerId),
    ).toEqual(["accounts", "shop"]);
  });

  it("rejects a missing env value", () => {
    expect(() =>
      loadProviderDirectory({ ...env, NEXT_PUBLIC_SHOP_ORIGIN: "" }),
    ).toThrow(DirectoryError);
    expect(() =>
      loadProviderDirectory({ ...env, NEXT_PUBLIC_ACCOUNTS_ORIGIN: "" }),
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

describe("getTrustedProvider", () => {
  it("looks up shop and accounts by id", () => {
    const directory = loadProviderDirectory(env);
    expect(getTrustedProvider(directory, "shop").providerId).toBe("shop");
    expect(getTrustedProvider(directory, "accounts").providerId).toBe(
      "accounts",
    );
  });

  it("rejects unknown providers", () => {
    const directory = loadProviderDirectory(env);
    expect(() => getTrustedProvider(directory, "support")).toThrow(
      /not in the trusted directory/,
    );
  });
});
