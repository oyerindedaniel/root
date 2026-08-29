"use client";

import { animate, useReducedMotion } from "motion/react";
import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PropsWithChildren,
} from "react";

import {
  classifyClick,
  motionForInteraction,
  type MotionIntent,
} from "@/lib/ui/interaction";

type TabsContextValue = {
  value: string;
  setValue: (value: string, event: Pick<MouseEvent, "detail">) => void;
  id: string;
  motion: MotionIntent;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const tabs = useContext(TabsContext);
  if (!tabs) {
    throw new Error("Tabs parts require Tabs.Root.");
  }
  return tabs;
}

export function TabsRoot({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
}: PropsWithChildren<{
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string, motion: MotionIntent) => void;
}>) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [motion, setMotion] = useState<MotionIntent>("animate");
  const value = controlledValue ?? internalValue;
  const setValue = (next: string, event: Pick<MouseEvent, "detail">) => {
    const nextMotion = motionForInteraction(classifyClick(event));
    setMotion(nextMotion);
    if (controlledValue === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next, nextMotion);
  };
  const id = useId();
  return (
    <TabsContext.Provider value={{ value, setValue, id, motion }}>
      {children}
    </TabsContext.Provider>
  );
}

export function TabsList({ children }: PropsWithChildren) {
  const tabsContext = useTabs();
  const reduceMotion = useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const initializedRef = useRef(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    const selected = [
      ...(list?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []),
    ].find((tab) => tab.dataset.tabsValue === tabsContext.value);
    if (!list || !indicator || !selected) {
      return;
    }

    const listRect = list.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    const target = {
      opacity: 1,
      width: selectedRect.width,
      x: selectedRect.left - listRect.left,
    };
    if (
      !initializedRef.current ||
      reduceMotion ||
      tabsContext.motion === "instant"
    ) {
      indicator.style.opacity = String(target.opacity);
      indicator.style.width = `${target.width}px`;
      indicator.style.transform = `translateX(${target.x}px)`;
      initializedRef.current = true;
      return;
    }

    const controls = animate(indicator, target, {
      type: "spring",
      stiffness: 500,
      damping: 38,
      mass: 0.45,
    });
    return () => controls.stop();
  }, [reduceMotion, tabsContext.motion, tabsContext.value]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    const tabs = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]:not(:disabled)',
      ),
    ];
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
            tabs.length;
    const target = tabs[next];
    if (target) {
      event.preventDefault();
      target.focus();
      target.click();
    }
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Root panel"
      className="relative flex h-8 items-center gap-1 border-b border-white/12 px-1"
      onKeyDown={onKeyDown}
    >
      <span
        ref={indicatorRef}
        data-tabs-active-indicator
        aria-hidden="true"
        className="pointer-events-none absolute top-0.5 left-0 h-7 rounded-full bg-white/15 opacity-0"
      />
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  id,
  controlsId,
}: PropsWithChildren<{
  value: string;
  id?: string;
  controlsId?: string;
}>) {
  const tabs = useTabs();
  const selected = tabs.value === value;
  return (
    <button
      type="button"
      role="tab"
      id={id ?? `${tabs.id}-${value}-tab`}
      aria-controls={controlsId ?? `${tabs.id}-${value}-panel`}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      data-tabs-value={value}
      className="relative h-7 rounded-full px-3 text-sm text-white/60 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 aria-selected:text-white"
      onClick={(event) => tabs.setValue(value, event)}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
}

export function TabsPanel({
  value,
  children,
}: PropsWithChildren<{ value: string }>) {
  const tabs = useTabs();
  if (tabs.value !== value) {
    return null;
  }
  return (
    <div
      role="tabpanel"
      id={`${tabs.id}-${value}-panel`}
      aria-labelledby={`${tabs.id}-${value}-tab`}
      className="min-h-0"
    >
      {children}
    </div>
  );
}

export const Tabs = {
  Root: TabsRoot,
  List: TabsList,
  Trigger: TabsTrigger,
  Panel: TabsPanel,
} as const;
