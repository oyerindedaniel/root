import {
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
};

export type ProviderDirectory = {
  rootOrigin: string;
  shop: TrustedProviderEntry;
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
    throw new DirectoryError("invalid_entry_url", "Shop entry URL is invalid.");
  }
  if (url.origin !== origin) {
    throw new DirectoryError(
      "entry_origin_mismatch",
      "Shop entry URL must match the Shop origin.",
    );
  }
  return url.href;
}

export function loadProviderDirectory(
  env: ProviderDirectoryEnv,
): ProviderDirectory {
  const rootOrigin = readOrigin(requiredEnv(env, "NEXT_PUBLIC_ROOT_ORIGIN"));
  const shopOrigin = readOrigin(requiredEnv(env, "NEXT_PUBLIC_SHOP_ORIGIN"));
  const shopEntryUrl = readEntryUrl(
    requiredEnv(env, "NEXT_PUBLIC_SHOP_ENTRY_URL"),
    shopOrigin,
  );

  return {
    rootOrigin,
    shop: {
      providerId: "shop",
      origin: shopOrigin,
      entryUrl: shopEntryUrl,
      contractVersion: SHOP_CONTRACT_VERSION,
      expectedTools: [...SHOP_EXPECTED_TOOLS],
    },
  };
}

export function getTrustedProvider(
  directory: ProviderDirectory,
  providerId: string,
): TrustedProviderEntry {
  if (providerId !== "shop") {
    throw new DirectoryError(
      "unknown_provider",
      "Provider is not in the trusted directory.",
    );
  }
  return directory.shop;
}

export function isProviderId(value: string): value is ProviderId {
  return value === "shop";
}
