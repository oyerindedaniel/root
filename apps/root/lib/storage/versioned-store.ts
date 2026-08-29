import { useSyncExternalStore } from "react";
import type { z } from "zod";

export type StorageFailure =
  | "corrupt"
  | "invalid-update"
  | "quota"
  | "too-large";

export type StorageSnapshot<T> = {
  value: T;
  failure: StorageFailure | null;
};

type StorageEventSource = {
  addEventListener: (type: "storage", listener: (event: Event) => void) => void;
  removeEventListener: (
    type: "storage",
    listener: (event: Event) => void,
  ) => void;
};

export type VersionedStoreOptions<T> = {
  accountId: string;
  keyPrefix: string;
  schema: z.ZodType<T>;
  defaults: T;
  maxChars: number;
  storage?: Storage | null;
  storageEvents?: StorageEventSource | null;
};

export type VersionedStore<T> = {
  key: string;
  getSnapshot: () => StorageSnapshot<T>;
  getServerSnapshot: () => StorageSnapshot<T>;
  subscribe: (listener: () => void) => () => void;
  update: (updater: (current: T) => T) => StorageSnapshot<T>;
  reset: () => StorageSnapshot<T>;
};

const sameTabEvents = new EventTarget();

export function createVersionedStore<T>(
  options: VersionedStoreOptions<T>,
): VersionedStore<T> {
  const key = `${options.keyPrefix}:${encodeURIComponent(options.accountId)}`;
  const storage =
    options.storage === undefined
      ? typeof window === "undefined"
        ? null
        : window.localStorage
      : options.storage;
  const storageEvents =
    options.storageEvents === undefined
      ? typeof window === "undefined"
        ? null
        : window
      : options.storageEvents;
  const defaults = options.schema.parse(options.defaults);
  const serverSnapshot: StorageSnapshot<T> = {
    value: defaults,
    failure: null,
  };
  let cachedRaw: string | null | undefined;
  let cachedSnapshot = serverSnapshot;

  function read(): StorageSnapshot<T> {
    if (!storage) {
      return serverSnapshot;
    }
    const raw = storage.getItem(key);
    if (raw === cachedRaw) {
      return cachedSnapshot;
    }
    cachedRaw = raw;
    if (raw === null) {
      cachedSnapshot = serverSnapshot;
      return cachedSnapshot;
    }
    if (raw.length > options.maxChars) {
      cachedSnapshot = { value: defaults, failure: "too-large" };
      return cachedSnapshot;
    }
    try {
      const parsed = options.schema.safeParse(JSON.parse(raw));
      cachedSnapshot = parsed.success
        ? { value: parsed.data, failure: null }
        : { value: defaults, failure: "corrupt" };
    } catch {
      cachedSnapshot = { value: defaults, failure: "corrupt" };
    }
    return cachedSnapshot;
  }

  function announce() {
    sameTabEvents.dispatchEvent(new CustomEvent("change", { detail: key }));
  }

  function update(updater: (current: T) => T): StorageSnapshot<T> {
    const next = options.schema.safeParse(updater(read().value));
    if (!next.success) {
      cachedSnapshot = { value: read().value, failure: "invalid-update" };
      announce();
      return cachedSnapshot;
    }
    const raw = JSON.stringify(next.data);
    if (raw.length > options.maxChars) {
      cachedSnapshot = { value: read().value, failure: "too-large" };
      announce();
      return cachedSnapshot;
    }
    if (!storage) {
      cachedRaw = raw;
      cachedSnapshot = { value: next.data, failure: null };
      announce();
      return cachedSnapshot;
    }
    try {
      storage.setItem(key, raw);
      cachedRaw = raw;
      cachedSnapshot = { value: next.data, failure: null };
    } catch {
      cachedSnapshot = { value: read().value, failure: "quota" };
    }
    announce();
    return cachedSnapshot;
  }

  function reset(): StorageSnapshot<T> {
    if (storage) {
      try {
        storage.removeItem(key);
      } catch {
        cachedSnapshot = { value: read().value, failure: "quota" };
        announce();
        return cachedSnapshot;
      }
    }
    cachedRaw = null;
    cachedSnapshot = serverSnapshot;
    announce();
    return cachedSnapshot;
  }

  function subscribe(listener: () => void) {
    const onSameTab = (event: Event) => {
      if ((event as CustomEvent<string>).detail === key) {
        listener();
      }
    };
    const onStorage = (event: Event) => {
      const storageEvent = event as Event & {
        key: string | null;
        storageArea: Storage | null;
      };
      if (
        storageEvent.key === key &&
        (!storageEvent.storageArea || storageEvent.storageArea === storage)
      ) {
        cachedRaw = undefined;
        listener();
      }
    };
    sameTabEvents.addEventListener("change", onSameTab);
    storageEvents?.addEventListener("storage", onStorage);
    return () => {
      sameTabEvents.removeEventListener("change", onSameTab);
      storageEvents?.removeEventListener("storage", onStorage);
    };
  }

  return {
    key,
    getSnapshot: read,
    getServerSnapshot: () => serverSnapshot,
    subscribe,
    update,
    reset,
  };
}

export function useVersionedStore<T>(store: VersionedStore<T>) {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}
