"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
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
import { WorkflowStatus } from "@/components/workspace/workflow-status";
import { DOCK_ICON_SIZE } from "@/lib/dock/magnify";
import {
  dockRemovalCandidate,
  readDockReference,
  ROOT_APP_DRAG_TYPE,
  writeDockReference,
} from "@/lib/dock/drag";
import { resolveDockApps } from "@/lib/providers/catalog";
import type { ProviderDirectory } from "@/lib/providers/directory";
import {
  ProviderLibraryProvider,
  useProviderLibrary,
} from "@/lib/providers/provider-library";
import type { DockReference } from "@/lib/storage/workspace-preferences";
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
    <ProviderLibraryProvider accountId={account.id} directory={directory}>
      <RuntimeProvider account={account} directory={directory}>
        <TooltipProvider>
          <WorkflowStatus />
          <DesktopIcons />
          <ProviderStage />
          <WorkspaceDock />
        </TooltipProvider>
      </RuntimeProvider>
    </ProviderLibraryProvider>
  );
}

function WorkspaceDock() {
  const {
    state,
    traySlotRef,
    restoreButtonRef,
    activateProvider,
  } = useRuntime();
  const { catalog, preferences, pin, unpin } = useProviderLibrary();
  const reduceMotion = useReducedMotion();
  const [removeCandidate, setRemoveCandidate] = useState<string | null>(null);
  const draggedRef = useRef<DockReference | null>(null);
  const removeCandidateRef = useRef(false);
  const cancelledRef = useRef(false);
  const dockBoundsRef = useRef<DOMRect | null>(null);
  const apps = resolveDockApps(
    catalog,
    preferences.dock,
    state.provider.providerId,
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && draggedRef.current) {
        cancelledRef.current = true;
        removeCandidateRef.current = false;
        setRemoveCandidate(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function finishDrag() {
    const reference = draggedRef.current;
    if (reference && removeCandidateRef.current && !cancelledRef.current) {
      unpin(reference);
    }
    draggedRef.current = null;
    dockBoundsRef.current = null;
    removeCandidateRef.current = false;
    cancelledRef.current = false;
    setRemoveCandidate(null);
  }

  return (
    <>
      <AnimatePresence>
        {removeCandidate ? (
          <motion.div
            role="status"
            initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion ? undefined : { opacity: 0, y: 4, scale: 0.98 }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.16, ease: [0.16, 1, 0.3, 1] }
            }
            className="pointer-events-none absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/80 px-3 py-1.5 text-sm text-white shadow-lg ring-1 ring-white/15"
          >
            Remove from Dock
          </motion.div>
        ) : null}
      </AnimatePresence>
      <Dock.Root
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(ROOT_APP_DRAG_TYPE)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            removeCandidateRef.current = false;
            setRemoveCandidate(null);
          }
        }}
        onDrop={(event) => {
          const reference = readDockReference(event.dataTransfer);
          if (reference) {
            event.preventDefault();
            pin(reference);
            removeCandidateRef.current = false;
            setRemoveCandidate(null);
          }
        }}
      >
        {apps.map((app, index) => {
        const providerId = app.kind === "provider" ? app.id : null;
        const reference: DockReference =
          app.kind === "provider"
            ? { kind: "provider", id: app.id }
            : { kind: "system", id: app.id };
        const mounted =
          Boolean(providerId) &&
          state.provider.providerId === providerId &&
          state.provider.lifecycle !== "unmounted";
        return (
          <Dock.Item
            key={`${app.kind}:${app.id}`}
            index={index}
            layout="position"
            transition={{
              layout: reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 420, damping: 36, mass: 0.5 },
            }}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes(ROOT_APP_DRAG_TYPE)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }
            }}
            onDrop={(event) => {
              const dropped = readDockReference(event.dataTransfer);
              if (dropped) {
                event.preventDefault();
                event.stopPropagation();
                pin(dropped, index);
                removeCandidateRef.current = false;
                setRemoveCandidate(null);
              }
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Dock.Trigger
                  ref={mounted ? restoreButtonRef : undefined}
                  aria-label={app.label}
                  draggable
                  onDragStartCapture={(event) => {
                    writeDockReference(event.dataTransfer, reference);
                    draggedRef.current = reference;
                    dockBoundsRef.current =
                      event.currentTarget.closest("nav")?.getBoundingClientRect() ??
                      null;
                    cancelledRef.current = false;
                    removeCandidateRef.current = false;
                  }}
                  onDragCapture={(event) => {
                    const bounds = dockBoundsRef.current;
                    if (
                      !bounds ||
                      (event.clientX === 0 && event.clientY === 0)
                    ) {
                      return;
                    }
                    const outside = dockRemovalCandidate(
                      bounds,
                      { x: event.clientX, y: event.clientY },
                      DOCK_ICON_SIZE * 1.5,
                    );
                    removeCandidateRef.current = outside;
                    setRemoveCandidate(
                      outside ? `${reference.kind}:${reference.id}` : null,
                    );
                  }}
                  onDragEndCapture={finishDrag}
                  onClick={
                    providerId ? () => activateProvider(providerId) : undefined
                  }
                >
                  <img
                    src={app.icon}
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
              <TooltipContent>{app.label}</TooltipContent>
            </Tooltip>
            {mounted ? <Dock.Running /> : null}
          </Dock.Item>
        );
        })}
      </Dock.Root>
    </>
  );
}
