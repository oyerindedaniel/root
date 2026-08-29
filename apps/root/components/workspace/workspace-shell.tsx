"use client";

import type { Account } from "@repo/contracts";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/tooltip";

import { DesktopIcons } from "@/components/workspace/desktop-icons";
import { Dock } from "@/components/workspace/dock";
import { ProviderStage } from "@/components/workspace/provider-stage";
import { SignedOutState } from "@/components/workspace/signed-out-state";
import { WorkflowStatus } from "@/components/workspace/workflow-status";
import { DOCK_ICON_SIZE } from "@/lib/dock/magnify";
import type { ProviderDirectory } from "@/lib/providers/directory";
import { useRuntime } from "@/lib/runtime/runtime-context";
import { RuntimeProvider } from "@/lib/runtime/runtime-provider";

export function WorkspaceShell({
  account,
  directory,
}: {
  account: Account;
  directory: ProviderDirectory;
}) {
  return (
    <RuntimeProvider account={account} directory={directory}>
      <TooltipProvider>
        <WorkflowStatus />
        <DesktopIcons />
        <ProviderStage />
        <WorkspaceDock />
        <SignedOutState />
      </TooltipProvider>
    </RuntimeProvider>
  );
}

function WorkspaceDock() {
  const {
    directory,
    state,
    traySlotRef,
    restoreButtonRef,
    activateProvider,
  } = useRuntime();

  return (
    <Dock.Root>
      {directory.pins.map((pin, index) => {
        const providerId = pin.providerId;
        const mounted =
          Boolean(providerId) &&
          state.provider.providerId === providerId &&
          state.provider.lifecycle !== "unmounted";
        return (
          <Dock.Item key={pin.id} index={index}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Dock.Trigger
                  ref={mounted ? restoreButtonRef : undefined}
                  aria-label={pin.label}
                  onClick={
                    providerId ? () => activateProvider(providerId) : undefined
                  }
                >
                  <img
                    src={pin.icon}
                    alt=""
                    width={DOCK_ICON_SIZE}
                    height={DOCK_ICON_SIZE}
                    className="pointer-events-none size-full select-none"
                  />
                  {mounted ? (
                    <span
                      ref={traySlotRef}
                      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22%]"
                    />
                  ) : null}
                </Dock.Trigger>
              </TooltipTrigger>
              <TooltipContent>{pin.label}</TooltipContent>
            </Tooltip>
            {mounted ? <Dock.Running /> : null}
          </Dock.Item>
        );
      })}
    </Dock.Root>
  );
}
