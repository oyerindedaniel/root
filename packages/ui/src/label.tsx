import type { ComponentProps } from "react";
import { cn } from "./lib/cn";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("flex flex-col gap-2 text-[0.9375rem] leading-snug", className)}
      {...props}
    />
  );
}
