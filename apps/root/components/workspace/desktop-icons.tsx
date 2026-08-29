"use client";

import { useRouter } from "next/navigation";

import { authClient } from "@repo/api-client";

import { useRuntime } from "@/lib/runtime/runtime-context";

export function DesktopIcons() {
  const router = useRouter();
  const { directory, activateProvider } = useRuntime();

  return (
    <aside
      className="absolute top-16 right-5 z-10 flex w-[76px] flex-col items-center gap-5"
      aria-label="Desktop"
      data-caliper-id="root-desktop-icons"
    >
      {directory.pins.map((pin) => {
        const providerId = pin.providerId;
        return (
          <DesktopAlias
            key={pin.id}
            src={pin.icon}
            name={pin.label}
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
