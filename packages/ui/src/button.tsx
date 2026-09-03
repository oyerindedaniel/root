import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { BusySpinner } from "./busy-spinner";
import { cn } from "./lib/cn";
import { presentAskVariants } from "./present-ask";
import { PresentHalo } from "./present-halo";

export const buttonVariants = cva(
  "inline-flex h-8 w-fit shrink-0 cursor-pointer items-center justify-center gap-2 self-start rounded-3xl px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-hover",
        ghost: "text-foreground hover:bg-foreground/10",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive-hover",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    pending?: boolean;
    intent?: boolean;
    approval?: boolean;
  };

export function Button({
  className,
  variant,
  type = "button",
  pending = false,
  intent = false,
  approval = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <span className="relative inline-flex w-fit self-start">
      <PresentHalo active={intent} rounded="3xl" />
      {approval ? (
        <span className="absolute bottom-full left-1/2 z-10 mb-3 w-52 -translate-x-1/2">
          <span className="relative block w-full">
            <PresentHalo active rounded="3xl" />
            <span
              className={cn(
                presentAskVariants({ size: "compact" }),
                "w-full justify-center px-3 py-1.5 text-center whitespace-normal",
              )}
            >
              Review the details, then approve Create
            </span>
            <span className="absolute left-1/2 top-full size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white shadow-[0_8px_24px_rgb(0_0_0_/_0.18)]" />
          </span>
        </span>
      ) : null}
      <button
        type={type}
        className={cn("relative", buttonVariants({ variant }), className)}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        {...props}
      >
        {pending ? (
          <>
            <BusySpinner />
            {children}
          </>
        ) : (
          children
        )}
      </button>
    </span>
  );
}
