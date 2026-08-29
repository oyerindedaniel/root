import { describe, expect, it } from "vitest";

import {
  addCustomProvider,
  createProviderCatalog,
  deleteCustomProvider,
  getProvider,
  hasProvider,
  installedApps,
  moveDockApp,
  pinDockApp,
  resolveDockApps,
  unpinDockApp,
  updateCustomProvider,
} from "./catalog";
import { loadProviderDirectory } from "./directory";
import {
  createDefaultWorkspacePreferences,
  type CustomProvider,
} from "@/lib/storage/workspace-preferences";

const directory = loadProviderDirectory({
  NEXT_PUBLIC_ROOT_ORIGIN: "http://localhost:3000",
  NEXT_PUBLIC_SHOP_ORIGIN: "http://localhost:3002",
  NEXT_PUBLIC_SHOP_ENTRY_URL: "http://localhost:3002/",
  NEXT_PUBLIC_ACCOUNTS_ORIGIN: "http://localhost:3001",
  NEXT_PUBLIC_ACCOUNTS_ENTRY_URL: "http://localhost:3001/",
});

function custom(overrides: Partial<CustomProvider> = {}): CustomProvider {
  return {
    id: "custom-provider-1",
    label: "Analytics",
    origin: "https://analytics.example",
    entryUrl: "https://analytics.example/app",
    icon: "data:image/webp;base64,AAAA",
    source: "custom",
    capability: "discovery-only",
    ...overrides,
  };
}

describe("provider catalog", () => {
  it("keeps built-ins installed when they are unpinned", () => {
    const defaults = createDefaultWorkspacePreferences();
    const unpinned = unpinDockApp(defaults, {
      kind: "provider",
      id: "shop",
    });
    const catalog = createProviderCatalog(directory, unpinned, true);
    expect(getProvider(catalog, "shop").source).toBe("builtin");
    expect(resolveDockApps(catalog, unpinned.dock).map((app) => app.id)).toEqual([
      "accounts",
      "cases",
    ]);
    const restored = pinDockApp(unpinned, { kind: "provider", id: "shop" }, 1);
    expect(restored.dock.map((entry) => entry.id)).toEqual([
      "accounts",
      "shop",
      "cases",
    ]);
  });

  it("adds and edits validated discovery-only custom providers", () => {
    const defaults = createDefaultWorkspacePreferences();
    const added = addCustomProvider(defaults, custom(), directory.builtins);
    const catalog = createProviderCatalog(directory, added);
    expect(getProvider(catalog, "custom-provider-1").capability).toBe(
      "discovery-only",
    );
    expect(installedApps(catalog).map((app) => app.label)).toContain(
      "Analytics",
    );
    const updated = updateCustomProvider(
      added,
      custom({ label: "Reports" }),
      directory.builtins,
    );
    expect(updated.customProviders[0]?.label).toBe("Reports");
  });

  it("rejects reserved identities, duplicate origins, and unsafe URLs", () => {
    const defaults = createDefaultWorkspacePreferences();
    expect(() =>
      addCustomProvider(
        defaults,
        custom({ id: "shop" }),
        directory.builtins,
      ),
    ).toThrow();
    expect(() =>
      addCustomProvider(
        defaults,
        custom({
          origin: "http://localhost:3002",
          entryUrl: "http://localhost:3002/custom",
        }),
        directory.builtins,
        true,
      ),
    ).toThrow(/already installed/);
    expect(() =>
      addCustomProvider(
        defaults,
        custom({
          origin: "http://remote.example",
          entryUrl: "http://remote.example/app",
        }),
        directory.builtins,
        false,
      ),
    ).toThrow(/HTTPS/);
    expect(() =>
      addCustomProvider(
        defaults,
        custom({ entryUrl: "https://other.example/app" }),
        directory.builtins,
      ),
    ).toThrow(/match the provider origin/);
  });

  it("deletes a custom provider and its Dock reference", () => {
    const added = addCustomProvider(
      createDefaultWorkspacePreferences(),
      custom(),
      directory.builtins,
    );
    const pinned = pinDockApp(added, {
      kind: "provider",
      id: "custom-provider-1",
    });
    const deleted = deleteCustomProvider(pinned, "custom-provider-1");
    expect(deleted.customProviders).toEqual([]);
    expect(deleted.dock.some((entry) => entry.id === "custom-provider-1")).toBe(
      false,
    );
    expect(
      hasProvider(createProviderCatalog(directory, deleted), "custom-provider-1"),
    ).toBe(false);
  });

  it("orders Dock references deterministically and retains an active unpinned app", () => {
    const defaults = createDefaultWorkspacePreferences();
    const moved = moveDockApp(
      defaults,
      { kind: "provider", id: "shop" },
      -1,
    );
    expect(moved.dock.map((entry) => entry.id)).toEqual([
      "shop",
      "accounts",
      "cases",
    ]);
    const unpinned = unpinDockApp(moved, {
      kind: "provider",
      id: "shop",
    });
    const catalog = createProviderCatalog(directory, unpinned);
    expect(
      resolveDockApps(catalog, unpinned.dock, "shop").map((app) => app.id),
    ).toEqual(["accounts", "cases", "shop"]);
    expect(createDefaultWorkspacePreferences().dock.map((entry) => entry.id)).toEqual([
      "accounts",
      "shop",
      "cases",
    ]);
  });
});
