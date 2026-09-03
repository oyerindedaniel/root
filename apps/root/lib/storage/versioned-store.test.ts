import { describe, expect, it, vi } from "vitest";

import {
  MAX_ICON_DATA_URL_CHARS,
  createDefaultWorkspacePreferences,
  customProviderIconSchema,
  workspacePreferencesSchema,
} from "./workspace-preferences";
import { createVersionedStore } from "./versioned-store";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function store(
  storage: Storage | null,
  accountId = "account-1",
  storageEvents: EventTarget | null = null,
) {
  return createVersionedStore({
    accountId,
    keyPrefix: "root.workspace.v1",
    schema: workspacePreferencesSchema,
    defaults: createDefaultWorkspacePreferences(),
    maxChars: 128 * 1024,
    storage,
    storageEvents,
  });
}

describe("createVersionedStore", () => {
  it("returns one stable SSR snapshot", () => {
    const preferences = store(null);
    expect(preferences.getServerSnapshot()).toBe(
      preferences.getServerSnapshot(),
    );
    expect(preferences.getServerSnapshot().value.dock).toHaveLength(3);
    expect(preferences.getServerSnapshot().hydrated).toBe(false);
  });

  it("hydrates old account-scoped preferences with compatible defaults", () => {
    const storage = new MemoryStorage();
    const preferences = store(storage);
    storage.setItem(
      preferences.key,
      JSON.stringify({
        version: 1,
        customProviders: [],
        dock: [{ kind: "provider", id: "shop" }],
      }),
    );
    expect(preferences.getSnapshot().value.dock).toEqual([
      { kind: "provider", id: "shop" },
    ]);
    expect(preferences.getSnapshot().value.present).toEqual({
      fill: "default",
      preview: "default",
    });
    expect(preferences.getSnapshot().value.selectionMode).toBe("manual");
    expect(preferences.getSnapshot().value.notifyWait).toBe(false);
    expect(preferences.getSnapshot().failure).toBeNull();
    expect(preferences.getSnapshot().hydrated).toBe(true);
  });

  it("treats a leftover Cases system pin as corrupt storage", () => {
    const storage = new MemoryStorage();
    const preferences = store(storage, "account-cases");
    storage.setItem(
      preferences.key,
      JSON.stringify({
        version: 1,
        customProviders: [],
        dock: [
          { kind: "provider", id: "accounts" },
          { kind: "system", id: "cases" },
        ],
      }),
    );
    expect(preferences.getSnapshot().failure).toBe("corrupt");
    expect(preferences.getSnapshot().value.dock).toEqual(
      createDefaultWorkspacePreferences().dock,
    );
  });

  it("defaults old custom provider grants and rejects duplicates", () => {
    const oldProvider = {
      id: "custom-provider-1",
      label: "Analytics",
      origin: "https://analytics.example",
      entryUrl: "https://analytics.example/app",
      icon: "data:image/webp;base64,AAAA",
      source: "custom",
      capability: "discovery-only",
    };
    const parsed = workspacePreferencesSchema.parse({
      version: 1,
      customProviders: [oldProvider],
      dock: [],
    });
    expect(parsed.customProviders[0]?.grantedTools).toEqual([]);
    expect(
      workspacePreferencesSchema.safeParse({
        ...parsed,
        customProviders: [
          { ...oldProvider, grantedTools: ["read_report", "read_report"] },
        ],
      }).success,
    ).toBe(false);
  });

  it("falls back for malformed and unknown-version data", () => {
    const storage = new MemoryStorage();
    const malformed = store(storage);
    storage.setItem(malformed.key, "{");
    expect(malformed.getSnapshot().failure).toBe("corrupt");
    expect(malformed.getSnapshot().value.dock).toHaveLength(3);

    const versioned = store(storage, "account-2");
    storage.setItem(
      versioned.key,
      JSON.stringify({ version: 2, customProviders: [], dock: [] }),
    );
    expect(versioned.getSnapshot().failure).toBe("corrupt");
  });

  it("notifies same-tab and cross-tab subscribers", () => {
    const storage = new MemoryStorage();
    const events = new EventTarget();
    const preferences = store(storage, "account-1", events);
    const listener = vi.fn();
    const unsubscribe = preferences.subscribe(listener);
    preferences.update((current) => ({ ...current, dock: [] }));
    expect(listener).toHaveBeenCalledTimes(1);

    storage.setItem(
      preferences.key,
      JSON.stringify(createDefaultWorkspacePreferences()),
    );
    const event = new Event("storage");
    Object.defineProperties(event, {
      key: { value: preferences.key },
      storageArea: { value: storage },
    });
    events.dispatchEvent(event);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(preferences.getSnapshot().value.dock).toHaveLength(3);
    unsubscribe();
  });

  it("reports quota failure without replacing the previous value", () => {
    const storage = new MemoryStorage();
    const preferences = store(storage);
    preferences.update((current) => ({ ...current, dock: [] }));
    storage.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
    const result = preferences.update((current) => ({
      ...current,
      dock: [{ kind: "provider", id: "shop" }],
    }));
    expect(result.failure).toBe("quota");
    expect(result.value.dock).toEqual([]);
  });

  it("isolates accounts by storage key", () => {
    const storage = new MemoryStorage();
    const first = store(storage, "account-1");
    const second = store(storage, "account-2");
    first.update((current) => ({ ...current, dock: [] }));
    expect(first.key).not.toBe(second.key);
    expect(first.getSnapshot().value.dock).toEqual([]);
    expect(second.getSnapshot().value.dock).toHaveLength(3);
  });

  it("bounds normalized WebP data URLs", () => {
    expect(
      customProviderIconSchema.safeParse("data:image/png;base64,AAAA").success,
    ).toBe(false);
    expect(
      customProviderIconSchema.safeParse(
        `data:image/webp;base64,${"A".repeat(MAX_ICON_DATA_URL_CHARS)}`,
      ).success,
    ).toBe(false);
    expect(
      customProviderIconSchema.safeParse("data:image/webp;base64,AAAA").success,
    ).toBe(true);
  });
});
