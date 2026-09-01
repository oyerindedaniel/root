import { cn } from "./lib/cn";

export function PresentHalo({
  active,
  rounded,
}: {
  active?: boolean;
  rounded: "lg" | "3xl";
}) {
  if (!active) {
    return null;
  }
  return (
    <span
      className={cn(
        "pointer-events-none absolute -inset-px overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200",
        rounded === "3xl" ? "rounded-3xl" : "rounded-lg",
      )}
    >
      <span className="present-halo absolute inset-[-40%]" />
    </span>
  );
}
