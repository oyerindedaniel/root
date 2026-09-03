"use client";

import { CursorArrowRaysIcon } from "@heroicons/react/24/outline";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@repo/ui/lib/cn";
import { presentAskVariants } from "@repo/ui/present-ask";

const INTRO_MS = 2000;

export function TakeControlOverlay({
  pointerInside,
  onTakeControl,
}: {
  pointerInside: boolean;
  onTakeControl: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [introElapsed, setIntroElapsed] = useState(false);
  const showPill = !introElapsed || pointerInside;

  useEffect(() => {
    setIntroElapsed(false);
    const timer = window.setTimeout(() => {
      setIntroElapsed(true);
    }, INTRO_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="pointer-events-auto absolute inset-0 z-10">
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div
          className={cn(
            "relative",
            showPill && "pointer-events-auto",
            reduceMotion && (showPill ? "opacity-100" : "opacity-0"),
            !reduceMotion && "transition-[opacity,margin] duration-200",
            !reduceMotion &&
              (showPill ? "mt-0 opacity-100" : "mt-3 opacity-0"),
          )}
        >
          <TakeControlButton
            available={showPill}
            onTakeControl={onTakeControl}
          />
        </div>
      </div>
    </div>
  );
}

export function TakeControlButton({
  available = true,
  compact = false,
  onTakeControl,
}: {
  available?: boolean;
  compact?: boolean;
  onTakeControl: () => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute -inset-px overflow-hidden rounded-3xl">
        <span className="present-halo take-control-ring absolute inset-[-40%]" />
      </span>
      <button
        type="button"
        tabIndex={available ? undefined : -1}
        aria-hidden={available ? undefined : true}
        className={cn(
          presentAskVariants({ size: compact ? "compact" : "default" }),
          "gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onTakeControl}
      >
        <CursorArrowRaysIcon className={compact ? "size-3.5" : "size-4"} />
        Take control
      </button>
    </div>
  );
}
