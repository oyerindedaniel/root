import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./lib/cn";

export const badgeVariants = cva(
  "inline-flex h-6 items-center gap-1 rounded-sm px-2 text-sm font-medium",
  {
    variants: {
      variant: {
        muted: "bg-muted text-muted-foreground",
        primary: "bg-primary-wash text-primary-ink",
        success: "bg-success-wash text-success-ink",
        warning: "bg-warning-wash text-warning-ink",
        destructive: "bg-destructive-wash text-destructive-ink",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  },
);

export type BadgeProps = ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
