import { describe, expect, it } from "vitest";
import { MAX_PROVIDER_TOOLS } from "@repo/contracts";

import {
  addCustomProvider,
  createProviderCatalog,
  deleteCustomProvider,
  dockPinInsertIndex,
  getProvider,
  hasProvider,
  installedApps,
  isDockPinned,
  moveDockApp,
  pinDockApp,
  resolveDockApps,
  setCustomProviderGrantedTools,
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
  NEXT_PUBLIC_SUPPORT_ORIGIN: "http://localhost:3003",
  NEXT_PUBLIC_SUPPORT_ENTRY_URL: "http://localhost:3003/",
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
    grantedTools: [],
    ...overrides,
  };
}

describe("provider catalog", () => {
  it("installs Catalog, Customers, and Cases from the directory", () => {
    const catalog = createProviderCatalog(
      directory,
      createDefaultWorkspacePreferences(),
      true,
    );
    expect(installedApps(catalog).map((app) => app.id)).toEqual([
      "shop",
      "accounts",
      "support",
    ]);
    expect(installedApps(catalog).map((app) => app.label)).toEqual([
      "Catalog",
      "Customers",
      "Cases",
    ]);
  });

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
      "support",
    ]);
    const restored = pinDockApp(unpinned, { kind: "provider", id: "shop" }, 1);
    expect(restored.dock.map((entry) => entry.id)).toEqual([
      "accounts",
      "shop",
      "support",
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

  it("preserves grants for presentation edits and revokes trust-surface edits", () => {
    const added = addCustomProvider(
      createDefaultWorkspacePreferences(),
      custom(),
      directory.builtins,
    );
    const granted = setCustomProviderGrantedTools(added, "custom-provider-1", [
      "read_report",
    ]);
    const relabeled = updateCustomProvider(
      granted,
      custom({
        label: "Reports",
        icon: "data:image/webp;base64,BBBB",
        grantedTools: [],
      }),
      directory.builtins,
    );
    expect(relabeled.customProviders[0]?.grantedTools).toEqual(["read_report"]);
    const moved = updateCustomProvider(
      relabeled,
      custom({
        origin: "https://reports.example",
        entryUrl: "https://reports.example/app",
        grantedTools: ["read_report"],
      }),
      directory.builtins,
    );
    expect(moved.customProviders[0]?.grantedTools).toEqual([]);
    const regranted = setCustomProviderGrantedTools(
      relabeled,
      "custom-provider-1",
      ["read_report"],
    );
    const entryChanged = updateCustomProvider(
      regranted,
      custom({
        label: "Reports",
        icon: "data:image/webp;base64,BBBB",
        entryUrl: "https://analytics.example/reports",
        grantedTools: ["read_report"],
      }),
      directory.builtins,
    );
    expect(entryChanged.customProviders[0]?.grantedTools).toEqual([]);
  });

  it("rejects duplicate grants", () => {
    const added = addCustomProvider(
      createDefaultWorkspacePreferences(),
      custom(),
      directory.builtins,
    );
    expect(() =>
      setCustomProviderGrantedTools(added, "custom-provider-1", [
        "read_report",
        "read_report",
      ]),
    ).toThrow("invalid_granted_tools");
  });

  it("persists the full grant capacity without truncation and rejects overflow", () => {
    const added = addCustomProvider(
      createDefaultWorkspacePreferences(),
      custom(),
      directory.builtins,
    );
    const names = Array.from(
      { length: MAX_PROVIDER_TOOLS },
      (_, index) => `tool_${index}`,
    );
    const granted = setCustomProviderGrantedTools(
      added,
      "custom-provider-1",
      names,
    );
    expect(granted.customProviders[0]?.grantedTools).toEqual(names);
    expect(() =>
      setCustomProviderGrantedTools(added, "custom-provider-1", [
        ...names,
        "overflow",
      ]),
    ).toThrow("invalid_granted_tools");
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
      "support",
    ]);
    const unpinned = unpinDockApp(moved, {
      kind: "provider",
      id: "shop",
    });
    const catalog = createProviderCatalog(directory, unpinned);
    expect(
      resolveDockApps(catalog, unpinned.dock, ["shop"]).map((app) => app.id),
    ).toEqual(["accounts", "support", "shop"]);
    expect(createDefaultWorkspacePreferences().dock.map((entry) => entry.id)).toEqual([
      "accounts",
      "shop",
      "support",
    ]);
  });

  it("retains every live unpinned provider in the Dock", () => {
    const preferences = {
      ...createDefaultWorkspacePreferences(),
      dock: [],
    };
    const catalog = createProviderCatalog(directory, preferences);
    expect(
      resolveDockApps(catalog, preferences.dock, ["accounts", "support"]).map(
        (app) => app.id,
      ),
    ).toEqual(["accounts", "support"]);
  });

  it("maps Dock pin insert index past live unpinned marks", () => {
    const preferences = {
      ...createDefaultWorkspacePreferences(),
      dock: [
        { kind: "provider" as const, id: "accounts" },
        { kind: "provider" as const, id: "support" },
      ],
    };
    const catalog = createProviderCatalog(directory, preferences);
    const apps = resolveDockApps(catalog, preferences.dock, ["shop"]);
    expect(apps.map((app) => app.id)).toEqual([
      "accounts",
      "support",
      "shop",
    ]);
    expect(dockPinInsertIndex(preferences.dock, apps, 0)).toBe(0);
    expect(dockPinInsertIndex(preferences.dock, apps, 1)).toBe(1);
    expect(dockPinInsertIndex(preferences.dock, apps, 2)).toBe(2);
    expect(
      isDockPinned(preferences.dock, { kind: "provider", id: "shop" }),
    ).toBe(false);
    expect(
      isDockPinned(preferences.dock, { kind: "provider", id: "accounts" }),
    ).toBe(true);
  });
});
