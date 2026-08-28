import type { ComponentProps } from "react";

import { cn } from "./lib/cn";

export function BusySpinner({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn(
        "size-3.5 animate-spin [animation-duration:350ms]",
        className,
      )}
      {...props}
    >
      <path
        d="M12 3a9 9 0 1 1-9 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
