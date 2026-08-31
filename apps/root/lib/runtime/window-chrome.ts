import {
  boundedError,
  type BoundedError,
  type ProviderId,
} from "@repo/contracts";

import {
  getProvider,
  providerKey,
  type ProviderCatalog,
} from "@/lib/providers/catalog";
import { DirectoryError } from "@/lib/providers/directory";

import { findProviderWindow, type ProviderWindow, type RuntimeState } from "./state";

export function resolveOpenWindow(
  catalog: ProviderCatalog,
  state: RuntimeState,
  providerId: string,
): ProviderWindow | BoundedError {
  let providerIdKey: ProviderId;
  try {
    providerIdKey = providerKey(getProvider(catalog, providerId));
  } catch (error) {
    if (error instanceof DirectoryError) {
      return boundedError(error.code, error.message);
    }
    throw error;
  }
  const windowState = findProviderWindow(state, providerIdKey);
  if (!windowState) {
    return boundedError(
      "window_not_found",
      "That provider has no open window.",
    );
  }
  return windowState;
}
