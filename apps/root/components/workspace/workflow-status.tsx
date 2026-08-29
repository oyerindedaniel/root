"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type PanInfo,
} from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@repo/ui/lib/cn";

import { WorkflowPanel } from "@/components/workspace/workflow-panel";
import {
  providerKey,
  type ProviderCatalog,
} from "@/lib/providers/catalog";
import { useProviderLibrary } from "@/lib/providers/provider-library";
import { useRuntime } from "@/lib/runtime/runtime-context";
import type { RuntimeState } from "@/lib/runtime/state";
import {
  cornerAnchors,
  DEFAULT_WORKFLOW_CORNER,
  isBottomCorner,
  isRightCorner,
  nearestCorner,
  WORKFLOW_ICON_SIZE,
  WORKFLOW_INSET,
  type WorkflowCorner,
} from "@/lib/workflow/corners";

const DRAG_CLICK_SLOP = 8;
const LABEL_COLLAPSE_GRACE = 240;
const LABEL_EASE = [0.16, 1, 0.3, 1] as const;

function snapTransition(reduceMotion: boolean | null) {
  if (reduceMotion === true) {
    return { type: false as const };
  }
  return { type: "spring" as const, stiffness: 460, damping: 38, mass: 0.7 };
}

function labelTransition(reduceMotion: boolean | null) {
  if (reduceMotion === true) {
    return { duration: 0 };
  }
  return { duration: 0.2, ease: LABEL_EASE };
}

function positionedCanvas(node: HTMLElement | null) {
  const parent = node?.offsetParent;
  return parent instanceof HTMLElement ? parent : null;
}

export function WorkflowStatus() {
  const { state } = useRuntime();
  const { catalog } = useProviderLibrary();
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const cornerRef = useRef<WorkflowCorner>(DEFAULT_WORKFLOW_CORNER);
  const [corner, setCorner] = useState<WorkflowCorner>(DEFAULT_WORKFLOW_CORNER);
  const [open, setOpen] = useState(false);
  const [issueHidden, setIssueHidden] = useState(false);
  const dragOffset = useRef(0);
  const dragging = useRef(false);
  const hadLabel = useRef(false);
  const { running, failed } = indicatorActivity(state, issueHidden);
  const nextLabel = pillLabel(state, catalog, running, failed);
  const [content, setContent] = useState<{
    label: string;
    running: boolean;
  } | null>(() =>
    nextLabel
      ? {
          label: nextLabel,
          running,
        }
      : null,
  );
  const expanded = Boolean(content);
  const right = isRightCorner(corner);
  const bottom = isBottomCorner(corner);
  const transition = snapTransition(reduceMotion);
  const labelPhase = content && hadLabel.current ? "swap" : "fold";

  useLayoutEffect(() => {
    hadLabel.current = Boolean(content);
  }, [content]);

  useEffect(() => {
    if (nextLabel) {
      setContent({
        label: nextLabel,
        running,
      });
      return;
    }
    const timeout = window.setTimeout(() => {
      setContent(null);
    }, LABEL_COLLAPSE_GRACE);
    return () => window.clearTimeout(timeout);
  }, [nextLabel, running]);

  useEffect(() => {
    function placeAtCorner() {
      const canvas = positionedCanvas(rootRef.current);
      if (!canvas) {
        return;
      }
      const box = canvas.getBoundingClientRect();
      const anchors = cornerAnchors(
        { width: box.width, height: box.height },
        WORKFLOW_ICON_SIZE,
        WORKFLOW_INSET,
      );
      const base = anchors[DEFAULT_WORKFLOW_CORNER];
      const target = anchors[cornerRef.current];
      x.stop();
      y.stop();
      x.set(target.x - base.x);
      y.set(target.y - base.y);
    }
    function onResize() {
      if (dragging.current) {
        return;
      }
      placeAtCorner();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [x, y]);

  useEffect(() => {
    setIssueHidden(false);
  }, [
    state.workflow.lifecycle,
    state.workflow.failureReason,
    state.provider.lifecycle,
    state.provider.failureReason,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function snapFromPointer() {
    const mark = rootRef.current;
    const canvas = positionedCanvas(mark);
    if (!canvas || !mark) {
      return;
    }
    const bounds = canvas.getBoundingClientRect();
    const markBox = mark.getBoundingClientRect();
    const dropLeft = markBox.left - bounds.left;
    const dropTop = markBox.top - bounds.top;
    const dropX = dropLeft + markBox.width / 2;
    const dropY = dropTop + markBox.height / 2;
    const anchors = cornerAnchors(
      { width: bounds.width, height: bounds.height },
      WORKFLOW_ICON_SIZE,
      WORKFLOW_INSET,
    );
    const from = cornerRef.current;
    const next = nearestCorner(
      { x: dropX, y: dropY },
      anchors,
      WORKFLOW_ICON_SIZE,
      from,
    );
    const base = anchors[DEFAULT_WORKFLOW_CORNER];
    const target = anchors[next];
    cornerRef.current = next;
    setCorner(next);
    animate(x, target.x - base.x, transition);
    animate(y, target.y - base.y, transition);
  }

  function onDrag(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const distance = Math.hypot(info.offset.x, info.offset.y);
    dragOffset.current = Math.max(dragOffset.current, distance);
    if (dragOffset.current >= DRAG_CLICK_SLOP) {
      setOpen(false);
    }
  }

  function onDragEnd() {
    dragging.current = false;
    snapFromPointer();
  }

  const rows = inspectRows(state, catalog);

  return (
    <motion.div
      ref={rootRef}
      drag
      dragMomentum={false}
      aria-expanded={open}
      aria-label="Workflow"
      role="button"
      tabIndex={0}
      onPointerDown={() => {
        dragOffset.current = 0;
      }}
      onDragStart={() => {
        dragging.current = true;
      }}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (dragOffset.current >= DRAG_CLICK_SLOP) {
          return;
        }
        setOpen((value) => !value);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        setOpen((value) => !value);
      }}
      style={{
        top: "auto",
        right: "auto",
        bottom: WORKFLOW_INSET,
        left: WORKFLOW_INSET,
        x,
        y,
      }}
      className="absolute z-[2147483647] size-10 cursor-pointer touch-none will-change-transform active:cursor-grabbing"
      data-caliper-id="root-workflow"
    >
      <motion.div
        layout="size"
        layoutAnchor={right ? { x: 1, y: 0.5 } : { x: 0, y: 0.5 }}
        transition={{
          layout: labelTransition(reduceMotion),
        }}
        style={{ borderRadius: 9999 }}
        className={cn(
          "absolute top-0 flex h-10 max-w-xs items-center overflow-hidden ring-1",
          right ? "right-0 flex-row-reverse" : "left-0",
          failed
            ? "bg-destructive text-destructive-foreground ring-black/25"
            : "bg-black/90 text-white ring-white/15",
        )}
      >
        <motion.span
          layout="position"
          className="relative z-10 flex size-10 shrink-0 items-center justify-center"
        >
          <span
            className={cn(
              "flex size-8 items-center justify-center overflow-hidden rounded-full",
              failed && "bg-white/15",
            )}
          >
            <img
              src="/icons/root-icon.webp"
              alt={expanded ? "" : "Workflow"}
              width={32}
              height={32}
              className="pointer-events-none size-8 select-none"
            />
          </span>
        </motion.span>
        <AnimatePresence
          initial={false}
          mode="popLayout"
          custom={labelPhase}
          anchorX={right ? "right" : "left"}
        >
          {content ? (
            <motion.span
              key={`${content.label}:${content.running}`}
              custom={labelPhase}
              variants={{
                hidden: (phase: "fold" | "swap") =>
                  phase === "swap"
                    ? { opacity: 0, x: 0, y: 10 }
                    : { opacity: 0, x: right ? 12 : -12, y: 0 },
                shown: { opacity: 1, x: 0, y: 0 },
                gone: (phase: "fold" | "swap") =>
                  phase === "swap"
                    ? { opacity: 0, x: 0, y: -10 }
                    : { opacity: 0, x: right ? 12 : -12, y: 0 },
              }}
              initial={reduceMotion === true ? false : "hidden"}
              animate="shown"
              exit={reduceMotion === true ? undefined : "gone"}
              transition={labelTransition(reduceMotion)}
              className={cn(
                "flex min-w-0 items-center gap-1 text-sm font-medium whitespace-nowrap",
                right ? "pl-3" : "pr-3",
              )}
            >
              <span className="min-w-0 truncate">{content.label}</span>
              {content.running ? (
                <OscillatingDots reduceMotion={reduceMotion === true} />
              ) : null}
            </motion.span>
          ) : null}
        </AnimatePresence>
        {failed ? (
          <button
            type="button"
            aria-label="Dismiss"
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-white/20",
              right ? "ml-1" : "mr-1",
            )}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setIssueHidden(true);
              setOpen(false);
            }}
          >
            <XMarkIcon className="size-4" />
          </button>
        ) : null}
      </motion.div>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-label="Workflow"
            initial={
              reduceMotion === true ? false : { opacity: 0, scale: 0.97 }
            }
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion === true ? undefined : { opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{
              transformOrigin: bottom
                ? right
                  ? "bottom right"
                  : "bottom left"
                : right
                  ? "top right"
                  : "top left",
            }}
            className={cn(
              "absolute w-96 overflow-hidden rounded-2xl bg-black/90 text-sm text-white shadow-[0_12px_40px_rgb(0_0_0_/_0.4)] ring-1 ring-white/12",
              bottom ? "bottom-[calc(100%+0.5rem)]" : "top-[calc(100%+0.5rem)]",
              right ? "right-0" : "left-0",
            )}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <WorkflowPanel rows={rows} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function indicatorActivity(state: RuntimeState, issueHidden: boolean) {
  const provider = state.provider.lifecycle;
  const workflow = state.workflow.lifecycle;
  return {
    running:
      workflow === "executing" ||
      provider === "mounting" ||
      provider === "discovering" ||
      provider === "executing",
    failed: !issueHidden && (workflow === "failed" || provider === "failed"),
  };
}

function OscillatingDots({ reduceMotion }: { reduceMotion: boolean }) {
  if (reduceMotion) {
    return <span aria-hidden="true">...</span>;
  }
  return (
    <span className="inline-flex w-[1.05em] justify-between" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="inline-block"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: index * 0.18,
            ease: "easeInOut",
          }}
        >
          .
        </motion.span>
      ))}
    </span>
  );
}

function pillLabel(
  state: RuntimeState,
  catalog: ProviderCatalog,
  running: boolean,
  failed: boolean,
) {
  if (state.sessionStatus === "signed-out") {
    return "Session ended";
  }
  if (failed) {
    return "Failed";
  }
  if (!running) {
    return null;
  }
  const provider = currentProvider(catalog, state.provider.providerId);
  if (state.provider.lifecycle === "mounting") {
    return provider ? `Opening ${provider.label}` : "Opening";
  }
  if (state.provider.lifecycle === "discovering") {
    return provider ? `Discovering ${provider.label}` : "Discovering";
  }
  if (state.workflow.lifecycle === "executing") {
    const query = state.workflow.step?.arguments.query;
    return query ? `Searching "${query}"` : "Running";
  }
  return "Running";
}

function inspectRows(state: RuntimeState, catalog: ProviderCatalog) {
  const provider = currentProvider(catalog, state.provider.providerId);
  const query = state.workflow.step?.arguments.query ?? null;
  const rows: { label: string; value: string }[] = [
    { label: "Provider", value: provider?.label ?? "None" },
    {
      label: "App",
      value:
        state.provider.lifecycle === "unmounted"
          ? "Idle"
          : titleCase(state.provider.lifecycle),
    },
    {
      label: "Workflow",
      value:
        state.workflow.lifecycle === "draft"
          ? "Idle"
          : titleCase(state.workflow.lifecycle),
    },
  ];
  if (query) {
    rows.push({ label: "Query", value: query });
  }
  if (state.workflow.evidence) {
    rows.push({ label: "Result", value: state.workflow.evidence });
  }
  const issue =
    state.workflow.failureReason ?? state.provider.failureReason;
  if (issue) {
    rows.push({ label: "Issue", value: issue });
  }
  return rows;
}

function currentProvider(
  catalog: ProviderCatalog,
  providerId: string | null,
) {
  return providerId
    ? catalog.providers.find((provider) => providerKey(provider) === providerId)
    : undefined;
}

function titleCase(value: string) {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}
