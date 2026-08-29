"use client";

import { useRuntime } from "@/lib/runtime/runtime-context";

export function ProviderStage() {
  const { stageSlotRef } = useRuntime();

  return (
    <section
      ref={stageSlotRef}
      tabIndex={-1}
      className="pointer-events-none absolute inset-x-0 top-0 bottom-24 outline-none"
      aria-hidden
    />
  );
}
