"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Tabs } from "@/components/ui/tabs";
import { ProviderAppsPanel } from "@/components/workspace/provider-apps-panel";
import { WorkflowMotionDebug } from "@/components/workspace/workflow-motion-debug";
import { useProviderLibrary } from "@/lib/providers/provider-library";

export type WorkflowActivityRow = {
  label: string;
  value: string;
};

export function WorkflowPanel({ rows }: { rows: WorkflowActivityRow[] }) {
  const library = useProviderLibrary();
  const [animateTransition, setAnimateTransition] = useState(true);
  const tab = library.preferences.panel.tab;
  const reduceMotion = useReducedMotion();
  const animateContent = !reduceMotion && animateTransition;
  const activityRowPx = 32;
  const activityPadPx = 16;
  const initialHeight = rows.length * activityRowPx + activityPadPx;
  const viewportRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const observedContentVersionRef = useRef(0);
  const heightAnimationRef = useRef<{ stop: () => void } | null>(null);
  const heightAnimationVersionRef = useRef(0);
  const targetHeightRef = useRef(initialHeight);
  const skipNextHeightAnimationRef = useRef(false);

  const observeActiveContent = useCallback(
    (content: HTMLDivElement | null) => {
      if (!content) {
        return;
      }

      observerRef.current?.disconnect();
      const contentVersion = observedContentVersionRef.current + 1;
      observedContentVersionRef.current = contentVersion;
      const resizeViewport = () => {
        if (observedContentVersionRef.current !== contentVersion) {
          return;
        }
        const viewport = viewportRef.current;
        const targetHeight = content.offsetHeight;
        if (
          !viewport ||
          Math.abs(targetHeightRef.current - targetHeight) < 0.5
        ) {
          return;
        }

        targetHeightRef.current = targetHeight;
        viewport.dataset.targetHeight = String(targetHeight);
        heightAnimationRef.current?.stop();
        const heightAnimationVersion =
          heightAnimationVersionRef.current + 1;
        heightAnimationVersionRef.current = heightAnimationVersion;
        const animateHeight =
          !reduceMotion && !skipNextHeightAnimationRef.current;
        skipNextHeightAnimationRef.current = false;
        if (!animateHeight) {
          viewport.style.height = `${targetHeight}px`;
          viewport.dataset.motionPhase = "idle";
          return;
        }

        viewport.dataset.motionPhase = "height";
        const controls = animate(
          viewport,
          { height: targetHeight },
          { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
        );
        heightAnimationRef.current = controls;
        void controls.finished.then(() => {
          if (
            heightAnimationVersionRef.current === heightAnimationVersion &&
            viewportRef.current
          ) {
            viewportRef.current.dataset.motionPhase = "idle";
          }
        });
      };

      resizeViewport();
      const observer = new ResizeObserver(resizeViewport);
      observer.observe(content);
      observerRef.current = observer;
    },
    [reduceMotion],
  );

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      heightAnimationRef.current?.stop();
    },
    [],
  );

  return (
    <Tabs.Root
      value={tab}
      onValueChange={(value, motion) => {
        if (value === "activity" || value === "apps") {
          const animate = motion === "animate";
          setAnimateTransition(animate);
          skipNextHeightAnimationRef.current = !animate;
          library.setPanelTab(value);
        }
      }}
    >
      <Tabs.List>
        <Tabs.Trigger
          value="activity"
          id="workflow-activity-tab"
          controlsId="workflow-activity-panel"
        >
          Activity
        </Tabs.Trigger>
        <Tabs.Trigger
          value="apps"
          id="workflow-apps-tab"
          controlsId="workflow-apps-panel"
        >
          Apps
        </Tabs.Trigger>
      </Tabs.List>
      <motion.div
        ref={viewportRef}
        data-workflow-layout
        data-motion-phase="idle"
        data-target-height={initialHeight}
        className="relative overflow-hidden"
        style={{ height: initialHeight }}
      >
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            ref={observeActiveContent}
            key={tab}
            data-workflow-content
            role="tabpanel"
            id={`workflow-${tab}-panel`}
            aria-labelledby={`workflow-${tab}-tab`}
            className="absolute inset-x-0 top-0"
            initial={!animateContent ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={!animateContent ? undefined : { opacity: 0, y: -4 }}
            transition={
              !animateContent
                ? { duration: 0 }
                : { duration: 0.16, ease: [0.16, 1, 0.3, 1] }
            }
          >
            {tab === "activity" ? (
              <div className="p-2">
                {rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex h-8 items-center justify-between gap-3 px-2"
                  >
                    <span>{row.label}</span>
                    <span className="min-w-0 truncate text-white/55">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <ProviderAppsPanel />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
      <WorkflowMotionDebug />
    </Tabs.Root>
  );
}
