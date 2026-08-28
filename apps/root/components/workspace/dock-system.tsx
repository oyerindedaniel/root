"use client";

import {
  createContext,
  useContext,
  type PropsWithChildren,
} from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/tooltip";

import { useRuntime } from "@/lib/runtime/runtime-context";

const DockContext = createContext(false);

function useDock() {
  const dock = useContext(DockContext);
  if (!dock) {
    throw new Error("Dock parts require Dock.Root.");
  }
}

export function DockRoot({ children }: PropsWithChildren) {
  return (
    <DockContext.Provider value={true}>
      <nav
        className="absolute inset-x-0 bottom-3 z-20 flex justify-center"
        aria-label="Providers"
        data-caliper-id="root-dock"
      >
        <div className="dock-glass flex items-end gap-2 rounded-[22px] px-2 py-1.5">
          {children}
        </div>
      </nav>
    </DockContext.Provider>
  );
}

export function DockCustomers() {
  useDock();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="relative flex size-14 items-end justify-center rounded-[22%] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img
            src="/icons/customers-icon.webp"
            alt=""
            width={56}
            height={56}
            className="pointer-events-none size-14 select-none"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>Customers</TooltipContent>
    </Tooltip>
  );
}

export function DockCatalog() {
  useDock();
  const { state, traySlotRef, restoreButtonRef, openCatalog, requestPlacement } =
    useRuntime();
  const mounted = state.provider.lifecycle !== "unmounted";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={restoreButtonRef}
          type="button"
          className="relative flex size-14 items-end justify-center rounded-[22%] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            if (!mounted) {
              openCatalog();
              return;
            }
            if (state.provider.placement === "tray") {
              requestPlacement("stage");
            }
          }}
        >
          <span className="relative size-14">
            <img
              src="/icons/catalog-icon.webp"
              alt=""
              width={56}
              height={56}
              className="pointer-events-none size-14 select-none"
            />
            <span
              ref={traySlotRef}
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22%]"
            />
          </span>
          <span
            className={
              mounted
                ? "absolute -bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-black/55"
                : "absolute -bottom-0.5 left-1/2 size-1 -translate-x-1/2"
            }
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>Catalog</TooltipContent>
    </Tooltip>
  );
}

export function DockCases() {
  useDock();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="relative flex size-14 items-end justify-center rounded-[22%] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img
            src="/icons/cases-icon.webp"
            alt=""
            width={56}
            height={56}
            className="pointer-events-none size-14 select-none"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>Cases</TooltipContent>
    </Tooltip>
  );
}

export const Dock = {
  Root: DockRoot,
  Customers: DockCustomers,
  Catalog: DockCatalog,
  Cases: DockCases,
} as const;
