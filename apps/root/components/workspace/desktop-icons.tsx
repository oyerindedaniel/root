"use client";

import { useRouter } from "next/navigation";

import { authClient } from "@repo/api-client";

import { useRootRuntime } from "@/lib/runtime/runtime-context";

export function DesktopIcons() {
  const router = useRouter();
  const { state, openCatalog, requestPlacement } = useRootRuntime();
  const mounted = state.provider.lifecycle !== "unmounted";

  return (
    <aside
      className="absolute top-16 right-5 z-10 flex w-[76px] flex-col items-center gap-5"
      aria-label="Desktop"
      data-caliper-id="root-desktop-icons"
    >
      <DesktopAlias src="/icons/customers-icon.webp" name="Customers" />
      <DesktopAlias
        src="/icons/catalog-icon.webp"
        name="Catalog"
        onOpen={() => {
          if (!mounted) {
            openCatalog();
            return;
          }
          if (state.provider.placement === "tray") {
            requestPlacement("stage");
          }
        }}
      />
      <DesktopAlias src="/icons/cases-icon.webp" name="Cases" />
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
}: {
  src: string;
  name: string;
  onOpen?: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full flex-col items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}
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
