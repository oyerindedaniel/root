"use client";

import { cn } from "@repo/ui/lib/cn";

import { useRootRuntime } from "@/lib/runtime/runtime-context";
import type { RuntimeState } from "@/lib/runtime/state";

export function WorkflowCapsule() {
  const { state } = useRootRuntime();
  const running =
    state.workflow.lifecycle === "executing" ||
    state.provider.lifecycle === "mounting" ||
    state.provider.lifecycle === "discovering" ||
    state.provider.lifecycle === "executing";

  const label = capsuleLabel(state);
  if (!label) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute top-4 right-4 z-20 flex h-8 max-w-xs min-w-0 items-center truncate rounded-3xl px-3 text-sm font-medium",
        running
          ? "animate-workflow bg-size-[200%_100%] bg-linear-to-r from-primary-wash via-primary-mute to-primary-wash text-primary-ink"
          : capsuleTone(state.workflow.lifecycle),
      )}
    >
      {label}
    </div>
  );
}

function capsuleTone(lifecycle: string) {
  if (lifecycle === "passed") {
    return "bg-success-wash/90 text-success-ink backdrop-blur-md";
  }
  if (lifecycle === "failed" || lifecycle === "cancelled") {
    return "bg-destructive-wash/90 text-destructive-ink backdrop-blur-md";
  }
  return "bg-white/80 text-foreground backdrop-blur-md";
}

function capsuleLabel(state: RuntimeState) {
  if (state.sessionStatus === "signed-out") {
    return "Session ended";
  }
  if (state.provider.lifecycle === "mounting") {
    return "Opening Catalog";
  }
  if (state.provider.lifecycle === "discovering") {
    return "Discovering Catalog";
  }
  if (state.workflow.lifecycle === "executing") {
    return state.workflow.step
      ? `Searching "${state.workflow.step.arguments.query}"`
      : "Running";
  }
  if (state.workflow.lifecycle === "prepared" && state.workflow.step) {
    return `Ready: ${state.workflow.step.arguments.query}`;
  }
  if (state.workflow.lifecycle === "passed" && state.workflow.evidence) {
    return state.workflow.evidence;
  }
  if (state.workflow.lifecycle === "failed") {
    return state.workflow.failureReason ?? "Failed";
  }
  if (state.workflow.lifecycle === "cancelled") {
    return "Cancelled";
  }
  return null;
}
