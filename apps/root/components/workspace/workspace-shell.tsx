"use client";

import type { OperatorIdentity } from "@repo/contracts";

import { TooltipProvider } from "@repo/ui/tooltip";

import { DesktopIcons } from "@/components/workspace/desktop-icons";
import { Dock } from "@/components/workspace/dock-system";
import { ProviderStage } from "@/components/workspace/provider-stage";
import { SignedOutState } from "@/components/workspace/signed-out-state";
import { WorkflowCapsule } from "@/components/workspace/workflow-capsule";
import type { ProviderDirectory } from "@/lib/providers/directory";
import { RootRuntimeProvider } from "@/lib/runtime/root-runtime-provider";

export function WorkspaceShell({
  operator,
  directory,
}: {
  operator: OperatorIdentity;
  directory: ProviderDirectory;
}) {
  return (
    <RootRuntimeProvider operator={operator} directory={directory}>
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
    </RootRuntimeProvider>
  );
}
