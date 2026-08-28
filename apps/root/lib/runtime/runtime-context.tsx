"use client";

import {
  createContext,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
  type RefObject,
} from "react";
import type { OperatorIdentity, TrustedProviderEntry } from "@repo/contracts";

import type { ProviderDirectory } from "@/lib/providers/directory";
import type { RuntimeAction, RuntimeState } from "@/lib/runtime/state";

export type RootRuntimeApi = {
  state: RuntimeState;
  dispatch: Dispatch<RuntimeAction>;
  directory: ProviderDirectory;
  operator: OperatorIdentity;
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

const RootRuntimeContext = createContext<RootRuntimeApi | null>(null);

export function RootRuntimeContextProvider({
  value,
  children,
}: {
  value: RootRuntimeApi;
  children: ReactNode;
}) {
  const memo = useMemo(() => value, [value]);
  return (
    <RootRuntimeContext.Provider value={memo}>
      {children}
    </RootRuntimeContext.Provider>
  );
}

export function useRootRuntime() {
  const value = useContext(RootRuntimeContext);
  if (!value) {
    throw new Error("useRootRuntime requires RootRuntimeProvider.");
  }
  return value;
}
