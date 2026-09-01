"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ComponentProps,
  type Dispatch,
  type RefObject,
} from "react";
import type {
  Account,
  BoundedResultEnvelope,
  DiscoverCapabilitiesOutput,
} from "@repo/contracts";

import type { ProviderDirectory } from "@/lib/providers/directory";
import type { RuntimeAction, RuntimeState } from "@/lib/runtime/state";

export type RuntimeApi = {
  state: RuntimeState;
  dispatch: Dispatch<RuntimeAction>;
  directory: ProviderDirectory;
  account: Account;
  workspaceRef: RefObject<HTMLDivElement | null>;
  stageSlotRef: RefObject<HTMLDivElement | null>;
  openProvider: (providerId: string) => void;
  activateProvider: (providerId: string) => void;
  registerTrayTarget: (
    providerId: string,
    target: HTMLSpanElement | null,
    restoreButton: HTMLButtonElement | null,
  ) => void;
  testProvider: (
    providerId: string,
  ) => Promise<BoundedResultEnvelope<DiscoverCapabilitiesOutput>>;
  waitingOnHuman: boolean;
  waitingInstanceIds: string[];
};

const RuntimeContext = createContext<RuntimeApi | null>(null);

export function RuntimeContextProvider({
  value,
  children,
}: ComponentProps<typeof RuntimeContext.Provider>) {
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
