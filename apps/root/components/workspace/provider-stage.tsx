"use client";

import { MinusIcon } from "@heroicons/react/24/outline";

import { cn } from "@repo/ui/lib/cn";

import { useRuntime } from "@/lib/runtime/runtime-context";

export function ProviderStage() {
  const { state, stageSlotRef, requestPlacement } = useRuntime();
  const mounted = state.provider.lifecycle !== "unmounted";
  const onStage = mounted && state.provider.placement === "stage";
  const framed = onStage && state.motion !== "suction";

  return (
    <section className="flex min-h-0 flex-1 justify-center px-10 pt-16 pb-28">
      <div
        className={cn(
          "flex h-full w-full max-w-5xl flex-col",
          framed && "overflow-hidden rounded-xl border border-border bg-background shadow-lg",
        )}
      >
        <div className="flex h-8 shrink-0 items-center justify-between gap-3 px-3">
          {framed ? (
            <>
              <p className="text-sm font-medium">Catalog</p>
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-3xl outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => requestPlacement("tray")}
                aria-label="Minimize Catalog"
              >
                <MinusIcon className="size-4" />
              </button>
            </>
          ) : null}
        </div>
        <div
          ref={stageSlotRef}
          tabIndex={-1}
          className="min-h-0 min-w-0 flex-1 outline-none"
        />
      </div>
    </section>
  );
}
