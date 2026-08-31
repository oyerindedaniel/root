"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type RectSample = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type WindowSample = {
  providerId: string | null;
  instanceId: string | null;
  placement: string | null;
  motionTarget: string | null;
  suctioning: boolean;
  surface: RectSample;
  iframe: RectSample | null;
  tray: RectSample | null;
  transform: string;
  clipPath: string;
  opacity: string;
  visibility: string;
  layoutWidth: string;
  layoutHeight: string;
};

type PlacementSample = {
  frame: number;
  time: number;
  windows: WindowSample[];
};

const MAX_SAMPLES = 1_200;

function subscribeDebugFlag() {
  return () => undefined;
}

function debugFlagSnapshot() {
  return new URLSearchParams(window.location.search).has(
    "placement-motion-debug",
  );
}

function serverDebugFlagSnapshot() {
  return false;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function readRect(element: Element | null): RectSample | null {
  if (!element) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  return {
    x: round(rect.x),
    y: round(rect.y),
    width: round(rect.width),
    height: round(rect.height),
  };
}

function sampleWindow(surface: HTMLElement): WindowSample {
  const providerId = surface.dataset.providerId ?? null;
  const tray = providerId
    ? document.querySelector(`[data-tray-target="${CSS.escape(providerId)}"]`)
    : null;
  const style = getComputedStyle(surface);
  const surfaceRect = readRect(surface);
  if (!surfaceRect) {
    throw new Error("Provider window must have a frame.");
  }
  return {
    providerId,
    instanceId: surface.dataset.providerWindow ?? null,
    placement: surface.dataset.placement ?? null,
    motionTarget: surface.dataset.motionTarget ?? null,
    suctioning: "suctioning" in surface.dataset,
    surface: surfaceRect,
    iframe: readRect(surface.querySelector("iframe")),
    tray: readRect(tray),
    transform: style.transform,
    clipPath: style.clipPath,
    opacity: style.opacity,
    visibility: style.visibility,
    layoutWidth: surface.style.width,
    layoutHeight: surface.style.height,
  };
}

function sampleFrame(frame: number, startedAt: number): PlacementSample {
  return {
    frame,
    time: round(performance.now() - startedAt),
    windows: [
      ...document.querySelectorAll<HTMLElement>("[data-provider-window]"),
    ].map(sampleWindow),
  };
}

export function PlacementMotionDebug() {
  const enabled = useSyncExternalStore(
    subscribeDebugFlag,
    debugFlagSnapshot,
    serverDebugFlagSnapshot,
  );
  const samplesRef = useRef<PlacementSample[]>([]);
  const startedAtRef = useRef(0);
  const frameRef = useRef(0);
  const [locked, setLocked] = useState(false);
  const [display, setDisplay] = useState<PlacementSample | null>(null);

  useEffect(() => {
    if (!enabled || locked) {
      return;
    }
    startedAtRef.current ||= performance.now();
    let animationFrame = 0;
    let lastDisplay = 0;
    const capture = (time: number) => {
      const sample = sampleFrame(frameRef.current, startedAtRef.current);
      frameRef.current += 1;
      samplesRef.current.push(sample);
      if (samplesRef.current.length > MAX_SAMPLES) {
        samplesRef.current.splice(
          0,
          samplesRef.current.length - MAX_SAMPLES,
        );
      }
      if (time - lastDisplay >= 100) {
        lastDisplay = time;
        setDisplay(sample);
      }
      animationFrame = requestAnimationFrame(capture);
    };
    animationFrame = requestAnimationFrame(capture);
    return () => cancelAnimationFrame(animationFrame);
  }, [enabled, locked]);

  if (!enabled || typeof document === "undefined") {
    return null;
  }

  const active =
    display?.windows.find((windowSample) => windowSample.suctioning) ??
    display?.windows.find(
      (windowSample) => windowSample.visibility === "visible",
    ) ??
    display?.windows[0] ??
    null;

  return createPortal(
    <aside className="pointer-events-none fixed top-3 left-3 z-[2147483647] w-96 rounded-xl bg-black/92 p-3 font-mono text-xs text-white shadow-2xl ring-1 ring-white/15">
      <div className="flex items-center justify-between gap-2">
        <strong>Placement motion</strong>
        <span className="text-white/50">
          {display ? `${display.frame} · ${display.time}ms` : "waiting"}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-[5rem_1fr] gap-x-2 gap-y-1">
        <dt className="text-white/45">Provider</dt>
        <dd>{active?.providerId ?? "—"}</dd>
        <dt className="text-white/45">State</dt>
        <dd>
          {active?.placement ?? "—"}
          {active?.suctioning ? ` → ${active.motionTarget ?? "—"}` : ""}
        </dd>
        <dt className="text-white/45">Surface</dt>
        <dd>{formatRect(active?.surface)}</dd>
        <dt className="text-white/45">Iframe</dt>
        <dd>{formatRect(active?.iframe)}</dd>
        <dt className="text-white/45">Tray</dt>
        <dd>{formatRect(active?.tray)}</dd>
        <dt className="text-white/45">Layout</dt>
        <dd>
          {active?.layoutWidth || "—"} × {active?.layoutHeight || "—"}
        </dd>
        <dt className="text-white/45">Transform</dt>
        <dd className="truncate">{active?.transform ?? "—"}</dd>
        <dt className="text-white/45">Clip</dt>
        <dd className="truncate">{active?.clipPath ?? "—"}</dd>
        <dt className="text-white/45">Opacity</dt>
        <dd>
          {active?.opacity ?? "—"} · {active?.visibility ?? "—"}
        </dd>
      </dl>
      <div className="pointer-events-auto mt-3 flex gap-2">
        <button
          type="button"
          className="h-7 rounded-full bg-white/15 px-3 hover:bg-white/20"
          onClick={() => setLocked((value) => !value)}
        >
          {locked ? "Resume" : "Lock frame"}
        </button>
        <button
          type="button"
          className="h-7 rounded-full bg-white/15 px-3 hover:bg-white/20"
          onClick={() => {
            samplesRef.current = [];
            frameRef.current = 0;
            startedAtRef.current = performance.now();
            setDisplay(null);
          }}
        >
          Clear
        </button>
        <button
          type="button"
          className="h-7 rounded-full bg-white/15 px-3 hover:bg-white/20"
          onClick={() => {
            void navigator.clipboard.writeText(
              JSON.stringify(samplesRef.current),
            );
          }}
        >
          Copy JSON
        </button>
      </div>
    </aside>,
    document.body,
  );
}

function formatRect(rect: RectSample | null | undefined) {
  return rect
    ? `${rect.x},${rect.y} · ${rect.width}×${rect.height}`
    : "—";
}
