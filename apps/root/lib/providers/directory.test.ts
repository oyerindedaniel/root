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
};

describe("loadProviderDirectory", () => {
  it("loads the trusted shop entry and ordered pins", () => {
    const directory = loadProviderDirectory(env);
    expect(directory.shop.providerId).toBe("shop");
    expect(directory.shop.origin).toBe("http://localhost:3002");
    expect(directory.shop.expectedTools).toEqual(["search_products"]);
    expect(directory.pins.map((pin) => pin.id)).toEqual([
      "customers",
      "shop",
      "cases",
    ]);
    expect(pinForProvider(directory, "shop").label).toBe("Catalog");
    expect(directory.pins.filter((pin) => pin.providerId).map((pin) => pin.providerId)).toEqual([
      "shop",
    ]);
  });

  it("rejects a missing env value", () => {
    expect(() =>
      loadProviderDirectory({ ...env, NEXT_PUBLIC_SHOP_ORIGIN: "" }),
    ).toThrow(DirectoryError);
  });

  it("rejects an entry URL on another origin", () => {
    expect(() =>
      loadProviderDirectory({
        ...env,
        NEXT_PUBLIC_SHOP_ENTRY_URL: "http://localhost:3001/",
      }),
    ).toThrow(/match the Shop origin/);
  });
});

describe("getTrustedProvider", () => {
  it("rejects unknown providers", () => {
    const directory = loadProviderDirectory(env);
    expect(() => getTrustedProvider(directory, "accounts")).toThrow(
      /not in the trusted directory/,
    );
  });
});
