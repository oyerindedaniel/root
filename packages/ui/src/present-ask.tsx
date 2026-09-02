import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { cn } from "./lib/cn";
import { PresentHalo } from "./present-halo";

export const presentAskVariants = cva(
  "relative flex items-center rounded-3xl bg-white font-medium text-zinc-900 shadow-[0_8px_24px_rgb(0_0_0_/_0.18)]",
  {
    variants: {
      size: {
        default: "h-8 px-3 text-sm",
        compact: "px-2 py-1 text-xs",
        relaxed: "h-10 px-4 text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export function PresentAsk({
  children,
  size,
}: {
  children: ReactNode;
} & VariantProps<typeof presentAskVariants>) {
  return (
    <div className="relative w-fit self-start">
      <PresentHalo active rounded="3xl" />
      <p className={cn(presentAskVariants({ size }))}>{children}</p>
    </div>
  );
}
