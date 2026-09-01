import type { ReactNode } from "react";

import { PresentHalo } from "./present-halo";

export function PresentAsk({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-fit self-start">
      <PresentHalo active rounded="3xl" />
      <p className="relative flex h-10 items-center rounded-3xl bg-white px-4 text-base font-medium text-zinc-900 shadow-[0_8px_24px_rgb(0_0_0_/_0.18)]">
        {children}
      </p>
    </div>
  );
}
