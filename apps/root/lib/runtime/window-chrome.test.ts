import { describe, expect, it } from "vitest";

import { createProviderCatalog } from "@/lib/providers/catalog";
import { loadProviderDirectory } from "@/lib/providers/directory";
import { createDefaultWorkspacePreferences } from "@/lib/storage/workspace-preferences";

import { runtimeReducer } from "./reducer";
import { createInitialRuntimeState } from "./state";
import { resolveOpenWindow } from "./window-chrome";

const account = { id: "user_1", email: "dev@localhost", name: "Dev" };
const directory = loadProviderDirectory({
  NEXT_PUBLIC_ROOT_ORIGIN: "http://localhost:3000",
  NEXT_PUBLIC_SHOP_ORIGIN: "http://localhost:3002",
  NEXT_PUBLIC_SHOP_ENTRY_URL: "http://localhost:3002/",
  NEXT_PUBLIC_ACCOUNTS_ORIGIN: "http://localhost:3001",
  NEXT_PUBLIC_ACCOUNTS_ENTRY_URL: "http://localhost:3001/",
  NEXT_PUBLIC_SUPPORT_ORIGIN: "http://localhost:3003",
  NEXT_PUBLIC_SUPPORT_ENTRY_URL: "http://localhost:3003/",
});
const catalog = createProviderCatalog(
  directory,
  createDefaultWorkspacePreferences(),
);

describe("resolveOpenWindow", () => {
  it("rejects an id that is not installed", () => {
    const state = createInitialRuntimeState(account);
    expect(resolveOpenWindow(catalog, state, "missing")).toMatchObject({
      status: "error",
      code: "unknown_provider",
    });
  });

  it("rejects an installed provider with no live window", () => {
    const state = createInitialRuntimeState(account);
    expect(resolveOpenWindow(catalog, state, "shop")).toMatchObject({
      status: "error",
      code: "window_not_found",
    });
  });

  it("returns the open window for that provider", () => {
    let state = createInitialRuntimeState(account);
    state = runtimeReducer(state, {
      type: "provider/mount",
      providerId: "shop",
      instanceId: "shop_1",
      origin: "http://localhost:3002",
      entryUrl: "http://localhost:3002/",
      openedBy: "human",
      touchedAt: 1,
    });
    const resolved = resolveOpenWindow(catalog, state, "shop");
    expect("instanceId" in resolved && resolved.instanceId).toBe("shop_1");
  });
});
