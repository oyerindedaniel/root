"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { authClient } from "@repo/api-client";

import {
  instanceIdsForProvider,
  LIBRARY_EDIT_HOLD_MS,
  libraryEditOccupiesClick,
  libraryJiggleOrigin,
  libraryJiggleRotate,
  libraryJiggleTransition,
} from "@/lib/desktop/library-edit";
import {
  readDockReference,
  ROOT_APP_DRAG_TYPE,
  writeDockReference,
} from "@/lib/dock/drag";
import { useProviderLibrary } from "@/lib/providers/provider-library";
import { useRuntime } from "@/lib/runtime/runtime-context";
import type { DockReference } from "@/lib/storage/workspace-preferences";

export function DesktopIcons() {
  const router = useRouter();
  const { activateProvider, closeProvider, state, workspaceRef } = useRuntime();
  const { apps, deleteProvider, unpin } = useProviderLibrary();
  const reduceMotion = useReducedMotion();
  const [stickyEdit, setStickyEdit] = useState(false);
  const [altEdit, setAltEdit] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const editing = stickyEdit || altEdit;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Alt") {
        setAltEdit(true);
      }
      if (event.key === "Escape") {
        setStickyEdit(false);
        setConfirmId(null);
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key === "Alt") {
        setAltEdit(false);
      }
    }
    function onBlur() {
      setAltEdit(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    const canvas = workspaceRef.current;
    if (!canvas || !editing) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (libraryEditOccupiesClick(event.target)) {
        return;
      }
      setStickyEdit(false);
      setConfirmId(null);
    }
    canvas.addEventListener("pointerdown", onPointerDown);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
    };
  }, [editing, workspaceRef]);

  function uninstall(providerId: string) {
    for (const instanceId of instanceIdsForProvider(
      Object.values(state.windows),
      providerId,
    )) {
      closeProvider(instanceId);
    }
    deleteProvider(providerId);
    setConfirmId(null);
    const remaining = apps.filter(
      (app) =>
        app.provider.source === "custom" && app.id !== providerId,
    );
    if (remaining.length === 0) {
      setStickyEdit(false);
    }
  }

  return (
    <aside
      dir="rtl"
      className="absolute top-5 right-5 bottom-28 z-10 grid auto-cols-[4.75rem] grid-flow-col grid-rows-[repeat(auto-fill,6.5rem)] items-start justify-items-center gap-5"
      aria-label="Workspace"
      data-caliper-id="root-desktop-icons"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(ROOT_APP_DRAG_TYPE)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => {
        const reference = readDockReference(event.dataTransfer);
        if (reference) {
          event.preventDefault();
          unpin(reference);
        }
      }}
    >
      {apps.map((app, index) => {
        const reference: DockReference = { kind: "provider", id: app.id };
        const custom = app.provider.source === "custom";
        return (
          <DesktopAlias
            key={`${app.kind}:${app.id}`}
            src={app.icon}
            name={app.label}
            reference={reference}
            editing={editing}
            deletable={custom}
            confirming={confirmId === app.id}
            jiggleIndex={index}
            reduceMotion={reduceMotion}
            onHoldEdit={() => {
              setStickyEdit(true);
              setConfirmId(null);
            }}
            onOpen={() => activateProvider(app.id)}
            onAskDelete={() => setConfirmId(app.id)}
            onConfirmDelete={() => uninstall(app.id)}
          />
        );
      })}
      <DesktopAlias
        src="/icons/operator-icon.webp"
        name="User"
        editing={editing}
      />
      <DesktopAlias
        src="/icons/signout-icon.webp"
        name="Sign out"
        editing={editing}
        onOpen={() => {
          void authClient.signOut().then(() => {
            router.replace("/sign-in");
            router.refresh();
          });
        }}
      />
    </aside>
  );
}

function DesktopAlias({
  src,
  name,
  onOpen,
  reference,
  editing = false,
  deletable = false,
  confirming = false,
  jiggleIndex = 0,
  reduceMotion = false,
  onHoldEdit,
  onAskDelete,
  onConfirmDelete,
}: {
  src: string;
  name: string;
  onOpen?: () => void;
  reference?: DockReference;
  editing?: boolean;
  deletable?: boolean;
  confirming?: boolean;
  jiggleIndex?: number;
  reduceMotion?: boolean | null;
  onHoldEdit?: () => void;
  onAskDelete?: () => void;
  onConfirmDelete?: () => void;
}) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const jiggling = editing && Boolean(reference);

  function clearHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  return (
    <div
      dir="ltr"
      data-library-alias={name}
      className="flex w-full min-w-0 flex-col items-center gap-1"
      draggable={Boolean(reference) && !editing}
      onPointerDown={() => {
        if (!reference || !onHoldEdit) {
          return;
        }
        clearHold();
        holdTimer.current = setTimeout(() => {
          holdTimer.current = null;
          suppressClick.current = true;
          onHoldEdit();
        }, LIBRARY_EDIT_HOLD_MS);
      }}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
      onDragStart={(event) => {
        clearHold();
        if (reference) {
          writeDockReference(event.dataTransfer, reference);
        }
      }}
    >
      <span className="relative size-12">
        {editing && deletable ? (
          <button
            type="button"
            aria-label={confirming ? `Confirm delete ${name}` : `Delete ${name}`}
            className={`absolute -top-1.5 -left-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-zinc-900 text-white ring-2 ${
              confirming ? "ring-white" : "ring-black/40"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              if (confirming) {
                onConfirmDelete?.();
              } else {
                onAskDelete?.();
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <XMarkIcon className="size-3" />
          </button>
        ) : null}
        <motion.button
          type="button"
          className={`block size-12 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            jiggling ? "will-change-transform" : ""
          }`}
          style={{ transformOrigin: libraryJiggleOrigin(jiggleIndex) }}
          animate={{
            rotate: jiggling
              ? libraryJiggleRotate(reduceMotion, jiggleIndex)
              : 0,
          }}
          transition={
            jiggling
              ? libraryJiggleTransition(reduceMotion, jiggleIndex)
              : { duration: reduceMotion === true ? 0 : 0.12 }
          }
          onClick={() => {
            if (editing) {
              return;
            }
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            onOpen?.();
          }}
        >
          <img
            src={src}
            alt=""
            width={48}
            height={48}
            className="pointer-events-none size-12 select-none"
          />
        </motion.button>
      </span>
      <span className="line-clamp-2 w-full text-center text-xs leading-tight text-white [text-shadow:0_1px_2px_rgb(0_0_0_/_0.85)]">
        {name}
      </span>
    </div>
  );
}
