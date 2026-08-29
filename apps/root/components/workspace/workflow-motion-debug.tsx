"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type RectSample = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MotionSample = {
  frame: number;
  time: number;
  tab: string | null;
  phase: string | null;
  dialog: RectSample | null;
  layout: RectSample | null;
  tabList: RectSample | null;
  activeTab: RectSample | null;
  indicator: RectSample | null;
  content: RectSample | null;
  transform: string | null;
  styleHeight: string | null;
  targetHeight: number | null;
  presenceChildren: number;
};

const MAX_SAMPLES = 1_200;

function subscribeDebugFlag() {
  return () => undefined;
}

function debugFlagSnapshot() {
  return new URLSearchParams(window.location.search).has(
    "workflow-motion-debug",
  );
}

function serverDebugFlagSnapshot() {
  return false;
}

function readRect(selector: string): RectSample | null {
  const element = document.querySelector<HTMLElement>(selector);
  return readElementRect(element);
}

function readElementRect(element: HTMLElement | null): RectSample | null {
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

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function sampleFrame(frame: number, startedAt: number): MotionSample {
  const layout = document.querySelector<HTMLElement>(
    "[data-workflow-layout]",
  );
  const activeTab = document.querySelector<HTMLElement>(
    '[role="tab"][aria-selected="true"]',
  );
  const content = [
    ...document.querySelectorAll<HTMLElement>("[data-workflow-content]"),
  ].find((element) => element.getAttribute("aria-labelledby") === activeTab?.id);
  return {
    frame,
    time: round(performance.now() - startedAt),
    tab:
      activeTab?.textContent?.trim() ?? null,
    phase: layout?.dataset.motionPhase ?? null,
    dialog: readRect('[role="dialog"][aria-label="Workflow"]'),
    layout: readRect("[data-workflow-layout]"),
    tabList: readRect('[role="tablist"][aria-label="Root panel"]'),
    activeTab: readElementRect(activeTab),
    indicator: readRect("[data-tabs-active-indicator]"),
    content: readElementRect(content ?? null),
    transform: layout ? getComputedStyle(layout).transform : null,
    styleHeight: layout?.style.height || null,
    targetHeight: layout?.dataset.targetHeight
      ? Number(layout.dataset.targetHeight)
      : null,
    presenceChildren: layout?.childElementCount ?? 0,
  };
}

export function WorkflowMotionDebug() {
  const enabled = useSyncExternalStore(
    subscribeDebugFlag,
    debugFlagSnapshot,
    serverDebugFlagSnapshot,
  );
  const samplesRef = useRef<MotionSample[]>([]);
  const startedAtRef = useRef(0);
  const frameRef = useRef(0);
  const [locked, setLocked] = useState(false);
  const [display, setDisplay] = useState<MotionSample | null>(null);

  useEffect(() => {
    if (!enabled || locked) {
      return;
    }
    startedAtRef.current ||= performance.now();
    let animationFrame = 0;
    let lastDisplay = 0;
    const capture = (time: number) => {
      const sample = sampleFrame(
        frameRef.current,
        startedAtRef.current,
      );
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

  return createPortal(
    <aside className="fixed top-3 right-3 z-[2147483647] w-80 rounded-xl bg-black/92 p-3 font-mono text-xs text-white shadow-2xl ring-1 ring-white/15">
      <div className="flex items-center justify-between gap-2">
        <strong>Workflow motion</strong>
        <span className="text-white/50">
          {display ? `${display.frame} · ${display.time}ms` : "waiting"}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-[5rem_1fr] gap-x-2 gap-y-1">
        <dt className="text-white/45">Tab</dt>
        <dd>{display?.tab ?? "—"}</dd>
        <dt className="text-white/45">Phase</dt>
        <dd>{display?.phase ?? "—"}</dd>
        <dt className="text-white/45">Dialog</dt>
        <dd>{formatRect(display?.dialog)}</dd>
        <dt className="text-white/45">Layout</dt>
        <dd>{formatRect(display?.layout)}</dd>
        <dt className="text-white/45">Tab list</dt>
        <dd>{formatRect(display?.tabList)}</dd>
        <dt className="text-white/45">Active tab</dt>
        <dd>{formatRect(display?.activeTab)}</dd>
        <dt className="text-white/45">Indicator</dt>
        <dd>{formatRect(display?.indicator)}</dd>
        <dt className="text-white/45">Content</dt>
        <dd>{formatRect(display?.content)}</dd>
        <dt className="text-white/45">Transform</dt>
        <dd className="truncate">{display?.transform ?? "—"}</dd>
        <dt className="text-white/45">Height</dt>
        <dd>
          {display?.styleHeight ?? "—"} → {display?.targetHeight ?? "—"}
        </dd>
        <dt className="text-white/45">Presence</dt>
        <dd>{display?.presenceChildren ?? 0}</dd>
      </dl>
      <div className="mt-3 flex gap-2">
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
