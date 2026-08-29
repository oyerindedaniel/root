import {
  ACCOUNTS_CONTRACT_VERSION,
  ACCOUNTS_EXPECTED_TOOLS,
  SHOP_CONTRACT_VERSION,
  SHOP_EXPECTED_TOOLS,
  readOrigin,
  type ProviderId,
  type TrustedProviderEntry,
} from "@repo/contracts";

export class DirectoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DirectoryError";
    this.code = code;
  }
}

export type ProviderDirectoryEnv = {
  NEXT_PUBLIC_ROOT_ORIGIN?: string;
  NEXT_PUBLIC_SHOP_ORIGIN?: string;
  NEXT_PUBLIC_SHOP_ENTRY_URL?: string;
  NEXT_PUBLIC_ACCOUNTS_ORIGIN?: string;
  NEXT_PUBLIC_ACCOUNTS_ENTRY_URL?: string;
};

export type WorkspacePin = {
  id: string;
  label: string;
  icon: string;
  providerId: ProviderId | null;
};

export type ProviderDirectory = {
  rootOrigin: string;
  providers: Record<ProviderId, TrustedProviderEntry>;
  pins: readonly WorkspacePin[];
};

export const WORKSPACE_PINS: readonly WorkspacePin[] = [
  {
    id: "customers",
    label: "Customers",
    icon: "/icons/customers-icon.webp",
    providerId: "accounts",
  },
  {
    id: "shop",
    label: "Catalog",
    icon: "/icons/catalog-icon.webp",
    providerId: "shop",
  },
  {
    id: "cases",
    label: "Cases",
    icon: "/icons/cases-icon.webp",
    providerId: null,
  },
];

function requiredEnv(
  env: ProviderDirectoryEnv,
  key: keyof ProviderDirectoryEnv,
): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new DirectoryError(
      "missing_env",
      `Set ${key} in the app .env.local (see .env.example).`,
    );
  }
  return value;
}

function readEntryUrl(value: string, origin: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DirectoryError("invalid_entry_url", "Entry URL is invalid.");
  }
  if (url.origin !== origin) {
    throw new DirectoryError(
      "entry_origin_mismatch",
      "Entry URL must match the provider origin.",
    );
  }
  return url.href;
}

function loadTrustedEntry(
  env: ProviderDirectoryEnv,
  originKey: keyof ProviderDirectoryEnv,
  entryKey: keyof ProviderDirectoryEnv,
  providerId: ProviderId,
  contractVersion: string,
  expectedTools: readonly string[],
): TrustedProviderEntry {
  const origin = readOrigin(requiredEnv(env, originKey));
  const entryUrl = readEntryUrl(requiredEnv(env, entryKey), origin);
  return {
    providerId,
    origin,
    entryUrl,
    contractVersion,
    expectedTools: [...expectedTools],
  };
}

export function loadProviderDirectory(
  env: ProviderDirectoryEnv,
): ProviderDirectory {
  const rootOrigin = readOrigin(requiredEnv(env, "NEXT_PUBLIC_ROOT_ORIGIN"));
  return {
    rootOrigin,
    providers: {
      shop: loadTrustedEntry(
        env,
        "NEXT_PUBLIC_SHOP_ORIGIN",
        "NEXT_PUBLIC_SHOP_ENTRY_URL",
        "shop",
        SHOP_CONTRACT_VERSION,
        SHOP_EXPECTED_TOOLS,
      ),
      accounts: loadTrustedEntry(
        env,
        "NEXT_PUBLIC_ACCOUNTS_ORIGIN",
        "NEXT_PUBLIC_ACCOUNTS_ENTRY_URL",
        "accounts",
        ACCOUNTS_CONTRACT_VERSION,
        ACCOUNTS_EXPECTED_TOOLS,
      ),
    },
    pins: WORKSPACE_PINS,
  };
}

export function pinForProvider(
  directory: ProviderDirectory,
  providerId: ProviderId,
): WorkspacePin {
  const pin = directory.pins.find((entry) => entry.providerId === providerId);
  if (!pin) {
    throw new DirectoryError(
      "unknown_provider",
      "Provider is not in the trusted directory.",
    );
  }
  return pin;
}

export function getTrustedProvider(
  directory: ProviderDirectory,
  providerId: string,
): TrustedProviderEntry {
  if (!isProviderId(providerId)) {
    throw new DirectoryError(
      "unknown_provider",
      "Provider is not in the trusted directory.",
    );
  }
  return directory.providers[providerId];
}

export function isProviderId(value: string): value is ProviderId {
  return value === "shop" || value === "accounts";
}
