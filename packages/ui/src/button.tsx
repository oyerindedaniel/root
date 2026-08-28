import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { BusySpinner } from "./busy-spinner";
import { cn } from "./lib/cn";

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
  };

export function Button({
  className,
  variant,
  type = "button",
  pending = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant }), className)}
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
  );
}
