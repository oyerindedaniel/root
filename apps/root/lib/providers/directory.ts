import {
  ACCOUNTS_CONTRACT_VERSION,
  ACCOUNTS_EXPECTED_TOOLS,
  SHOP_CONTRACT_VERSION,
  SHOP_EXPECTED_TOOLS,
  SUPPORT_CONTRACT_VERSION,
  SUPPORT_EXPECTED_TOOLS,
  readOrigin,
  type BuiltinProviderId,
  type GatewayErrorCode,
  type TrustedProviderEntry,
} from "@repo/contracts";

export class DirectoryError extends Error {
  readonly code: GatewayErrorCode;

  constructor(code: GatewayErrorCode, message: string) {
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
  NEXT_PUBLIC_SUPPORT_ORIGIN?: string;
  NEXT_PUBLIC_SUPPORT_ENTRY_URL?: string;
};

export type BuiltinProviderDefinition = TrustedProviderEntry & {
  label: string;
  icon: string;
  source: "builtin";
  capability: "workflow-ready";
};

export type ProviderDirectory = {
  rootOrigin: string;
  builtins: readonly BuiltinProviderDefinition[];
};

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
  providerId: BuiltinProviderId,
  label: string,
  icon: string,
  contractVersion: string,
  expectedTools: readonly string[],
): BuiltinProviderDefinition {
  const origin = readOrigin(requiredEnv(env, originKey));
  const entryUrl = readEntryUrl(requiredEnv(env, entryKey), origin);
  return {
    providerId,
    label,
    icon,
    source: "builtin",
    capability: "workflow-ready",
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
    builtins: [
      loadTrustedEntry(
        env,
        "NEXT_PUBLIC_SHOP_ORIGIN",
        "NEXT_PUBLIC_SHOP_ENTRY_URL",
        "shop",
        "Catalog",
        "/icons/catalog-icon.webp",
        SHOP_CONTRACT_VERSION,
        SHOP_EXPECTED_TOOLS,
      ),
      loadTrustedEntry(
        env,
        "NEXT_PUBLIC_ACCOUNTS_ORIGIN",
        "NEXT_PUBLIC_ACCOUNTS_ENTRY_URL",
        "accounts",
        "Customers",
        "/icons/customers-icon.webp",
        ACCOUNTS_CONTRACT_VERSION,
        ACCOUNTS_EXPECTED_TOOLS,
      ),
      loadTrustedEntry(
        env,
        "NEXT_PUBLIC_SUPPORT_ORIGIN",
        "NEXT_PUBLIC_SUPPORT_ENTRY_URL",
        "support",
        "Cases",
        "/icons/cases-icon.webp",
        SUPPORT_CONTRACT_VERSION,
        SUPPORT_EXPECTED_TOOLS,
      ),
    ],
  };
}

export function getBuiltinProvider(
  directory: ProviderDirectory,
  providerId: string,
): BuiltinProviderDefinition {
  const provider = directory.builtins.find(
    (entry) => entry.providerId === providerId,
  );
  if (!provider) {
    throw new DirectoryError(
      "unknown_provider",
      "Provider is not in the built-in directory.",
    );
  }
  return provider;
}
