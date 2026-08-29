"use client";

import { useRouter } from "next/navigation";

import { authClient } from "@repo/api-client";

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
  const { activateProvider } = useRuntime();
  const { apps, unpin } = useProviderLibrary();

  return (
    <aside
      className="absolute top-16 right-5 z-10 flex w-[76px] flex-col items-center gap-5"
      aria-label="Desktop"
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
      {apps.map((app) => {
        const providerId = app.kind === "provider" ? app.id : null;
        const reference: DockReference =
          app.kind === "provider"
            ? { kind: "provider", id: app.id }
            : { kind: "system", id: app.id };
        return (
          <DesktopAlias
            key={`${app.kind}:${app.id}`}
            src={app.icon}
            name={app.label}
            reference={reference}
            onOpen={providerId ? () => activateProvider(providerId) : undefined}
          />
        );
      })}
      <DesktopAlias src="/icons/operator-icon.webp" name="User" />
      <DesktopAlias
        src="/icons/signout-icon.webp"
        name="Sign out"
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
}: {
  src: string;
  name: string;
  onOpen?: () => void;
  reference?: DockReference;
}) {
  return (
    <button
      type="button"
      className="flex w-full flex-col items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}
      draggable={Boolean(reference)}
      onDragStart={(event) => {
        if (reference) {
          writeDockReference(event.dataTransfer, reference);
        }
      }}
    >
      <img
        src={src}
        alt=""
        width={48}
        height={48}
        className="pointer-events-none size-12 select-none"
      />
      <span className="w-full text-center text-xs leading-tight text-white [text-shadow:0_1px_2px_rgb(0_0_0_/_0.85)]">
        {name}
      </span>
    </button>
  );
}
