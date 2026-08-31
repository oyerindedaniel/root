"use client";

import type { ProviderPlacement } from "@repo/contracts";
import { cn } from "@repo/ui/lib/cn";
import type {
  PointerEvent as ReactPointerEvent,
  PropsWithChildren,
  RefObject,
} from "react";

import type { ResizeEdge } from "@/lib/window/frame";
import type { WindowSession } from "@/lib/window/session";

export function AppWindowRoot({
  providerId,
  instanceId,
  title,
  icon,
  placement,
  suctioning,
  motionTarget,
  surfaceRef,
  windowSession,
  onFocus,
  onClose,
  onMinimize,
  children,
}: PropsWithChildren<{
  providerId: string;
  instanceId: string;
  title: string;
  icon: string;
  placement: ProviderPlacement;
  suctioning: boolean;
  motionTarget: ProviderPlacement | null;
  surfaceRef: RefObject<HTMLDivElement | null>;
  windowSession: WindowSession;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
}>) {
  const onStage = placement === "stage";
  const interactive = onStage && !suctioning;

  return (
    <div
      ref={surfaceRef}
      data-provider-window={instanceId}
      data-provider-id={providerId}
      data-placement={placement}
      data-suctioning={suctioning ? "" : undefined}
      data-motion-target={motionTarget ?? undefined}
      onPointerDownCapture={onFocus}
      className={
        onStage
          ? "absolute z-10 flex flex-col overflow-hidden rounded-xl border border-black/10 bg-background shadow-[0_24px_80px_rgb(0_0_0_/_0.28)]"
          : "pointer-events-none absolute z-20 flex flex-col overflow-hidden rounded-2xl bg-background"
      }
    >
      <div
        role="group"
        aria-label={`${title} title bar`}
        className="flex h-7 shrink-0 cursor-default items-center gap-2 pr-3 select-none"
        onPointerDown={(event) => {
          if (!interactive || event.button !== 0) {
            return;
          }
          if ((event.target as HTMLElement).closest("button")) {
            return;
          }
          event.preventDefault();
          windowSession.begin("move", event.nativeEvent);
        }}
      >
        <div className="group/lights flex items-center gap-1.5 pl-3">
          <TrafficLight
            tone="close"
            label={`Close ${title}`}
            onPress={onClose}
          />
          <TrafficLight
            tone="min"
            label={`Minimize ${title}`}
            onPress={onMinimize}
          />
          <TrafficLight
            tone="zoom"
            label={`Zoom ${title}`}
            onPress={() => windowSession.toggleZoom()}
          />
        </div>
        <img
          src={icon}
          alt=""
          width={16}
          height={16}
          className="pointer-events-none size-4 rounded-[20%] select-none"
        />
        <p className="min-w-0 truncate text-sm font-medium text-foreground">
          {title}
        </p>
      </div>
      <div className="app-scroll min-h-0 min-w-0 flex-1">{children}</div>
      {interactive ? <WindowEdges onBegin={windowSession.begin} /> : null}
    </div>
  );
}

function TrafficLight({
  tone,
  label,
  onPress,
}: {
  tone: "close" | "min" | "zoom";
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "relative size-3 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tone === "close" && "bg-[#ff5f57]",
        tone === "min" && "bg-[#febc2e]",
        tone === "zoom" && "bg-[#28c840]",
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onPress}
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] leading-none text-black/70 opacity-0 group-hover/lights:opacity-100">
        {tone === "close" ? "×" : tone === "min" ? "–" : "+"}
      </span>
    </button>
  );
}

function WindowEdges({
  onBegin,
}: {
  onBegin: (edge: ResizeEdge, event: PointerEvent) => void;
}) {
  function start(edge: ResizeEdge) {
    return (event: ReactPointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      onBegin(edge, event.nativeEvent);
    };
  }

  return (
    <>
      <div
        className="absolute top-0 right-2 left-2 z-20 h-1.5 cursor-ns-resize"
        onPointerDown={start("n")}
      />
      <div
        className="absolute right-2 bottom-0 left-2 z-20 h-1.5 cursor-ns-resize"
        onPointerDown={start("s")}
      />
      <div
        className="absolute top-2 bottom-2 left-0 z-20 w-1.5 cursor-ew-resize"
        onPointerDown={start("w")}
      />
      <div
        className="absolute top-2 right-0 bottom-2 z-20 w-1.5 cursor-ew-resize"
        onPointerDown={start("e")}
      />
      <div
        className="absolute top-0 left-0 z-30 size-3 cursor-nwse-resize"
        onPointerDown={start("nw")}
      />
      <div
        className="absolute top-0 right-0 z-30 size-3 cursor-nesw-resize"
        onPointerDown={start("ne")}
      />
      <div
        className="absolute bottom-0 left-0 z-30 size-3 cursor-nesw-resize"
        onPointerDown={start("sw")}
      />
      <div
        className="absolute right-0 bottom-0 z-30 size-3 cursor-nwse-resize"
        onPointerDown={start("se")}
      />
    </>
  );
}

export const AppWindow = {
  Root: AppWindowRoot,
} as const;
