import {
  MAX_PROVIDER_TOOLS,
  readOrigin,
  webmcpToolNameSchema,
  type ProviderId,
} from "@repo/contracts";

import {
  DirectoryError,
  type BuiltinProviderDefinition,
  type ProviderDirectory,
} from "./directory";
import {
  MAX_CUSTOM_PROVIDERS,
  type CustomProvider,
  type DockReference,
  type WorkspacePreferences,
} from "@/lib/storage/workspace-preferences";

export type ProviderDefinition = BuiltinProviderDefinition | CustomProvider;

export type ProviderApp = {
  kind: "provider";
  id: ProviderId;
  label: string;
  icon: string;
  provider: ProviderDefinition;
};

export type InstalledApp = ProviderApp;

export type ProviderCatalog = {
  providers: readonly ProviderDefinition[];
};

export function createProviderCatalog(
  directory: ProviderDirectory,
  preferences: WorkspacePreferences,
  allowLocalHttp = process.env.NODE_ENV !== "production",
): ProviderCatalog {
  const providers: ProviderDefinition[] = [...directory.builtins];
  const ids = new Set(providers.map(providerKey));
  const origins = new Set(providers.map((provider) => provider.origin));
  for (const raw of preferences.customProviders) {
    const provider = validateCustomProvider(raw, allowLocalHttp);
    if (ids.has(provider.id)) {
      throw new DirectoryError(
        "unknown_provider",
        "Provider ID is reserved or already installed.",
      );
    }
    if (origins.has(provider.origin)) {
      throw new DirectoryError(
        "entry_origin_mismatch",
        "Provider origin is already installed.",
      );
    }
    ids.add(provider.id);
    origins.add(provider.origin);
    providers.push(provider);
  }
  return { providers };
}

export function getProvider(
  catalog: ProviderCatalog,
  providerId: string,
): ProviderDefinition {
  const provider = catalog.providers.find((entry) =>
    entry.source === "builtin"
      ? entry.providerId === providerId
      : entry.id === providerId,
  );
  if (!provider) {
    throw new DirectoryError(
      "unknown_provider",
      "Provider is not installed in this app library.",
    );
  }
  return provider;
}

export function hasProvider(
  catalog: ProviderCatalog,
  providerId: string,
): boolean {
  return catalog.providers.some(
    (provider) => providerKey(provider) === providerId,
  );
}

export function providerKey(provider: ProviderDefinition): ProviderId {
  return provider.source === "builtin" ? provider.providerId : provider.id;
}

export function installedApps(catalog: ProviderCatalog): InstalledApp[] {
  return catalog.providers.map(
    (provider): ProviderApp => ({
      kind: "provider",
      id: providerKey(provider),
      label: provider.label,
      icon: provider.icon,
      provider,
    }),
  );
}

export function resolveDockApps(
  catalog: ProviderCatalog,
  dock: readonly DockReference[],
  activeProviderIds: readonly string[] = [],
): InstalledApp[] {
  const apps = installedApps(catalog);
  const byKey = new Map(apps.map((app) => [`${app.kind}:${app.id}`, app]));
  const resolved = dock.flatMap((reference) => {
    const app = byKey.get(`${reference.kind}:${reference.id}`);
    return app ? [app] : [];
  });
  for (const activeProviderId of activeProviderIds) {
    if (
      !resolved.some(
        (app) => app.kind === "provider" && app.id === activeProviderId,
      )
    ) {
      const active = byKey.get(`provider:${activeProviderId}`);
      if (active) {
        resolved.push(active);
      }
    }
  }
  return resolved;
}

export function addCustomProvider(
  preferences: WorkspacePreferences,
  provider: CustomProvider,
  builtins: readonly BuiltinProviderDefinition[],
  allowLocalHttp = process.env.NODE_ENV !== "production",
): WorkspacePreferences {
  if (preferences.customProviders.length >= MAX_CUSTOM_PROVIDERS) {
    throw new Error("custom_provider_limit");
  }
  createProviderCatalog(
    { rootOrigin: "http://localhost", builtins },
    {
      ...preferences,
      customProviders: [...preferences.customProviders, provider],
    },
    allowLocalHttp,
  );
  return {
    ...preferences,
    customProviders: [...preferences.customProviders, provider],
  };
}

export function updateCustomProvider(
  preferences: WorkspacePreferences,
  provider: CustomProvider,
  builtins: readonly BuiltinProviderDefinition[],
  allowLocalHttp = process.env.NODE_ENV !== "production",
): WorkspacePreferences {
  const index = preferences.customProviders.findIndex(
    (entry) => entry.id === provider.id,
  );
  if (index < 0) {
    throw new DirectoryError("unknown_provider", "Custom provider not found.");
  }
  const current = preferences.customProviders[index];
  if (!current) {
    throw new DirectoryError("unknown_provider", "Custom provider not found.");
  }
  const validated = validateCustomProvider(provider, allowLocalHttp);
  const updated = {
    ...validated,
    grantedTools:
      current.origin === validated.origin &&
      current.entryUrl === validated.entryUrl
        ? current.grantedTools
        : [],
  };
  const customProviders = preferences.customProviders.map((entry) =>
    entry.id === provider.id ? updated : entry,
  );
  createProviderCatalog(
    { rootOrigin: "http://localhost", builtins },
    { ...preferences, customProviders },
    allowLocalHttp,
  );
  return { ...preferences, customProviders };
}

export function setCustomProviderGrantedTools(
  preferences: WorkspacePreferences,
  providerId: string,
  grantedTools: readonly string[],
): WorkspacePreferences {
  const provider = preferences.customProviders.find(
    (entry) => entry.id === providerId,
  );
  if (!provider) {
    throw new DirectoryError("unknown_provider", "Custom provider not found.");
  }
  const unique = [...new Set(grantedTools)];
  if (
    unique.length !== grantedTools.length ||
    unique.length > MAX_PROVIDER_TOOLS ||
    unique.some((name) => !webmcpToolNameSchema.safeParse(name).success)
  ) {
    throw new Error("invalid_granted_tools");
  }
  return {
    ...preferences,
    customProviders: preferences.customProviders.map((entry) =>
      entry.id === providerId ? { ...entry, grantedTools: unique } : entry,
    ),
  };
}

export function deleteCustomProvider(
  preferences: WorkspacePreferences,
  providerId: string,
): WorkspacePreferences {
  if (!preferences.customProviders.some((entry) => entry.id === providerId)) {
    throw new DirectoryError("unknown_provider", "Custom provider not found.");
  }
  return {
    ...preferences,
    customProviders: preferences.customProviders.filter(
      (entry) => entry.id !== providerId,
    ),
    dock: preferences.dock.filter(
      (entry) => !(entry.kind === "provider" && entry.id === providerId),
    ),
  };
}

export function pinDockApp(
  preferences: WorkspacePreferences,
  reference: DockReference,
  index = preferences.dock.length,
): WorkspacePreferences {
  const without = preferences.dock.filter(
    (entry) => !(entry.kind === reference.kind && entry.id === reference.id),
  );
  const target = Math.max(0, Math.min(index, without.length));
  return {
    ...preferences,
    dock: [...without.slice(0, target), reference, ...without.slice(target)],
  };
}

export function unpinDockApp(
  preferences: WorkspacePreferences,
  reference: DockReference,
): WorkspacePreferences {
  return {
    ...preferences,
    dock: preferences.dock.filter(
      (entry) => !(entry.kind === reference.kind && entry.id === reference.id),
    ),
  };
}

export function moveDockApp(
  preferences: WorkspacePreferences,
  reference: DockReference,
  offset: -1 | 1,
): WorkspacePreferences {
  const index = preferences.dock.findIndex(
    (entry) => entry.kind === reference.kind && entry.id === reference.id,
  );
  if (index < 0) {
    return preferences;
  }
  return pinDockApp(preferences, reference, index + offset);
}

export function validateCustomProvider(
  raw: CustomProvider,
  allowLocalHttp: boolean,
): CustomProvider {
  const provider = raw;
  const origin = readOrigin(provider.origin);
  const originUrl = new URL(origin);
  const entryUrl = new URL(provider.entryUrl);
  const local =
    originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1";
  if (originUrl.protocol !== "https:" && !(allowLocalHttp && local)) {
    throw new DirectoryError(
      "invalid_entry_url",
      "Custom providers require HTTPS outside local development.",
    );
  }
  if (entryUrl.origin !== origin) {
    throw new DirectoryError(
      "entry_origin_mismatch",
      "Entry URL must match the provider origin.",
    );
  }
  return { ...provider, origin, entryUrl: entryUrl.href };
}
