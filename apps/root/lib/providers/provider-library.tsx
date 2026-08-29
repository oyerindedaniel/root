"use client";

import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";

import {
  addCustomProvider,
  createProviderCatalog,
  deleteCustomProvider,
  installedApps,
  moveDockApp,
  pinDockApp,
  unpinDockApp,
  updateCustomProvider,
  type InstalledApp,
  type ProviderCatalog,
} from "@/lib/providers/catalog";
import type { ProviderDirectory } from "@/lib/providers/directory";
import {
  createDefaultWorkspacePreferences,
  workspacePreferencesSchema,
  type CustomProvider,
  type DockReference,
  type WorkspacePreferences,
} from "@/lib/storage/workspace-preferences";
import {
  createVersionedStore,
  useVersionedStore,
  type StorageFailure,
} from "@/lib/storage/versioned-store";

type NewCustomProvider = Omit<
  CustomProvider,
  "id" | "source" | "capability"
>;

export type ProviderLibraryApi = {
  catalog: ProviderCatalog;
  preferences: WorkspacePreferences;
  apps: InstalledApp[];
  storageFailure: StorageFailure | null;
  addProvider: (provider: NewCustomProvider) => CustomProvider;
  updateProvider: (provider: CustomProvider) => void;
  deleteProvider: (providerId: string) => void;
  pin: (reference: DockReference, index?: number) => void;
  unpin: (reference: DockReference) => void;
  move: (reference: DockReference, offset: -1 | 1) => void;
  resetDock: () => void;
  isPinned: (reference: DockReference) => boolean;
  setPanelTab: (tab: WorkspacePreferences["panel"]["tab"]) => void;
  setAppsScrollTop: (scrollTop: number) => void;
};

const ProviderLibraryContext = createContext<ProviderLibraryApi | null>(null);

export function ProviderLibraryProvider({
  accountId,
  directory,
  children,
}: PropsWithChildren<{
  accountId: string;
  directory: ProviderDirectory;
}>) {
  const defaults = useMemo(() => createDefaultWorkspacePreferences(), []);
  const store = useMemo(
    () =>
      createVersionedStore({
        accountId,
        keyPrefix: "root.workspace.v1",
        schema: workspacePreferencesSchema,
        defaults,
        maxChars: 128 * 1024,
      }),
    [accountId, defaults],
  );
  const snapshot = useVersionedStore(store);
  const resolved = useMemo(() => {
    try {
      return {
        preferences: snapshot.value,
        catalog: createProviderCatalog(directory, snapshot.value),
        storageFailure: snapshot.failure,
      };
    } catch {
      return {
        preferences: defaults,
        catalog: createProviderCatalog(directory, defaults),
        storageFailure: "corrupt" as const,
      };
    }
  }, [defaults, directory, snapshot]);

  const api = useMemo<ProviderLibraryApi>(() => {
    function update(
      transform: (current: WorkspacePreferences) => WorkspacePreferences,
    ) {
      store.update(transform);
    }
    return {
      catalog: resolved.catalog,
      preferences: resolved.preferences,
      apps: installedApps(resolved.catalog),
      storageFailure: resolved.storageFailure,
      addProvider(provider) {
        const entry: CustomProvider = {
          ...provider,
          id: `custom-${crypto.randomUUID()}`,
          source: "custom",
          capability: "discovery-only",
        };
        update((current) =>
          addCustomProvider(current, entry, directory.builtins),
        );
        return entry;
      },
      updateProvider(provider) {
        update((current) =>
          updateCustomProvider(current, provider, directory.builtins),
        );
      },
      deleteProvider(providerId) {
        update((current) => deleteCustomProvider(current, providerId));
      },
      pin(reference, index) {
        update((current) => pinDockApp(current, reference, index));
      },
      unpin(reference) {
        update((current) => unpinDockApp(current, reference));
      },
      move(reference, offset) {
        update((current) => moveDockApp(current, reference, offset));
      },
      resetDock() {
        update((current) => ({ ...current, dock: defaults.dock }));
      },
      isPinned(reference) {
        return resolved.preferences.dock.some(
          (entry) =>
            entry.kind === reference.kind && entry.id === reference.id,
        );
      },
      setPanelTab(tab) {
        update((current) => ({
          ...current,
          panel: { ...current.panel, tab },
        }));
      },
      setAppsScrollTop(scrollTop) {
        update((current) => ({
          ...current,
          panel: {
            ...current.panel,
            appsScrollTop: Math.max(0, Math.round(scrollTop)),
          },
        }));
      },
    };
  }, [defaults.dock, directory.builtins, resolved, store]);

  return (
    <ProviderLibraryContext.Provider value={api}>
      {children}
    </ProviderLibraryContext.Provider>
  );
}

export function useProviderLibrary() {
  const library = useContext(ProviderLibraryContext);
  if (!library) {
    throw new Error("useProviderLibrary requires ProviderLibraryProvider.");
  }
  return library;
}
