import type { ComponentProps } from "react";
import { cn } from "./lib/cn";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-8 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none inset-shadow-highlight placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
