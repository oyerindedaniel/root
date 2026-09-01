import type { ComponentProps } from "react";

import { cn } from "./lib/cn";
import { PresentHalo } from "./present-halo";

type SearchHitProps = Omit<ComponentProps<"li">, "className"> & {
  revealed?: boolean;
  onSelect?: () => void;
};

export function SearchHit({
  revealed,
  onSelect,
  children,
  ...props
}: SearchHitProps) {
  return (
    <li
      className={cn(
        "relative rounded-lg border border-border p-4",
        onSelect ? "cursor-pointer" : null,
      )}
      {...props}
      onClick={onSelect}
    >
      <PresentHalo active={revealed} rounded="lg" />
      <div className="relative">{children}</div>
    </li>
  );
}
