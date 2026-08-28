"use client";

import type { Account } from "@repo/contracts";

import { TooltipProvider } from "@repo/ui/tooltip";

import { DesktopIcons } from "@/components/workspace/desktop-icons";
import { Dock } from "@/components/workspace/dock-system";
import { ProviderStage } from "@/components/workspace/provider-stage";
import { SignedOutState } from "@/components/workspace/signed-out-state";
import { WorkflowCapsule } from "@/components/workspace/workflow-capsule";
import type { ProviderDirectory } from "@/lib/providers/directory";
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
        <WorkflowCapsule />
        <DesktopIcons />
        <ProviderStage />
        <Dock.Root>
          <Dock.Customers />
          <Dock.Catalog />
          <Dock.Cases />
        </Dock.Root>
        <SignedOutState />
      </TooltipProvider>
    </RuntimeProvider>
  );
}
