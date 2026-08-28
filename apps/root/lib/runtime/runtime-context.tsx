"use client";

import {
  createContext,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
  type RefObject,
} from "react";
import type { Account, TrustedProviderEntry } from "@repo/contracts";

import type { ProviderDirectory } from "@/lib/providers/directory";
import type { RuntimeAction, RuntimeState } from "@/lib/runtime/state";

export type RuntimeApi = {
  state: RuntimeState;
  dispatch: Dispatch<RuntimeAction>;
  directory: ProviderDirectory;
  account: Account;
  shop: TrustedProviderEntry;
  workspaceRef: RefObject<HTMLDivElement | null>;
  stageSlotRef: RefObject<HTMLDivElement | null>;
  traySlotRef: RefObject<HTMLDivElement | null>;
  surfaceRef: RefObject<HTMLDivElement | null>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  restoreButtonRef: RefObject<HTMLButtonElement | null>;
  requestPlacement: (placement: "stage" | "tray") => void;
  openCatalog: () => void;
};

const RuntimeContext = createContext<RuntimeApi | null>(null);

export function RuntimeContextProvider({
  value,
  children,
}: {
  value: RuntimeApi;
  children: ReactNode;
}) {
  const memo = useMemo(() => value, [value]);
  return (
    <RuntimeContext.Provider value={memo}>{children}</RuntimeContext.Provider>
  );
}

export function useRuntime() {
  const value = useContext(RuntimeContext);
  if (!value) {
    throw new Error("useRuntime requires RuntimeProvider.");
  }
  return value;
}
