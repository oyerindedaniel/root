"use client";

import { CursorArrowRaysIcon } from "@heroicons/react/24/outline";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@repo/ui/lib/cn";

const INTRO_MS = 2000;

export function TakeControlOverlay({
  pointerInside,
  passThrough,
  onTakeControl,
}: {
  pointerInside: boolean;
  passThrough: boolean;
  onTakeControl: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [introElapsed, setIntroElapsed] = useState(false);
  const showPill = passThrough || !introElapsed || pointerInside;

  useEffect(() => {
    setIntroElapsed(false);
    const timer = window.setTimeout(() => {
      setIntroElapsed(true);
    }, INTRO_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={cn(
        "absolute inset-0 z-10",
        passThrough ? "pointer-events-none" : "pointer-events-auto",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex justify-center",
          passThrough ? "items-end pb-3" : "items-center",
        )}
      >
        <div
          className={cn(
            "relative",
            showPill ? "pointer-events-auto" : null,
            reduceMotion
              ? showPill
                ? "opacity-100"
                : "opacity-0"
              : cn(
                  "transition-[opacity,margin] duration-200",
                  showPill ? "mt-0 opacity-100" : "mt-3 opacity-0",
                ),
          )}
        >
          <span className="pointer-events-none absolute -inset-px overflow-hidden rounded-3xl">
            <span className="present-halo take-control-ring absolute inset-[-40%]" />
          </span>
          <button
            type="button"
            tabIndex={showPill ? undefined : -1}
            aria-hidden={showPill ? undefined : true}
            className="relative flex h-10 items-center gap-2 rounded-3xl bg-white px-4 text-sm font-medium text-zinc-900 shadow-[0_8px_24px_rgb(0_0_0_/_0.18)] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onTakeControl}
          >
            <CursorArrowRaysIcon className="size-5" />
            Take control
          </button>
        </div>
      </div>
    </div>
  );
}
