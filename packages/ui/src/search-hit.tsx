import type { ComponentProps } from "react";

type SearchHitProps = Omit<ComponentProps<"li">, "className"> & {
  revealed?: boolean;
};

export function SearchHit({ revealed, ...props }: SearchHitProps) {
  return (
    <li
      className={
        revealed
          ? "rounded-lg border border-border p-4 ring-2 ring-ring"
          : "rounded-lg border border-border p-4"
      }
      {...props}
    />
  );
}
