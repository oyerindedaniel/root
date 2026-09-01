import type { ComponentProps } from "react";

import { PresentHalo } from "./present-halo";

type SearchHitProps = Omit<ComponentProps<"li">, "className"> & {
  revealed?: boolean;
};

export function SearchHit({ revealed, children, ...props }: SearchHitProps) {
  return (
    <li className="relative rounded-lg border border-border p-4" {...props}>
      <PresentHalo active={revealed} rounded="lg" />
      <div className="relative">{children}</div>
    </li>
  );
}
