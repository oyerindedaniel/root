"use client";

import {
  Children,
  createContext,
  useContext,
  useEffect,
  useRef,
  type CSSProperties,
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";

import {
  dockIconOffset,
  dockIconScale,
  dockPitch,
  dockPointerAllowed,
} from "@/lib/dock/magnify";

type DockMagnify = {
  pointerX: MotionValue<number>;
  hovering: MotionValue<number>;
  rowLeft: MotionValue<number>;
  rowWidth: MotionValue<number>;
  itemCount: number;
};

type DockItemMotion = {
  scale: MotionValue<number>;
};

const DockContext = createContext<DockMagnify | null>(null);
const DockItemContext = createContext<DockItemMotion | null>(null);

function useDock() {
  const dock = useContext(DockContext);
  if (!dock) {
    throw new Error("Dock parts require Dock.Root.");
  }
  return dock;
}

function useDockItem() {
  const item = useContext(DockItemContext);
  if (!item) {
    throw new Error("Dock parts require Dock.Item.");
  }
  return item;
}

function useDockMotion(index: number) {
  const { pointerX, hovering, rowLeft, rowWidth, itemCount } = useDock();
  const raw = useTransform(
    [pointerX, hovering, rowLeft, rowWidth],
    (input: number[]) =>
      dockIconScale(
        index,
        input[0] ?? 0,
        input[1] ?? 0,
        input[2] ?? 0,
        input[3] ?? 0,
        itemCount,
      ),
  );
  const rawOffset = useTransform(
    [pointerX, hovering, rowLeft, rowWidth],
    (input: number[]) =>
      dockIconOffset(
        index,
        input[0] ?? 0,
        input[1] ?? 0,
        input[2] ?? 0,
        input[3] ?? 0,
        itemCount,
      ),
  );
  const scale = useSpring(raw, { stiffness: 400, damping: 28, mass: 0.35 });
  const offset = useSpring(rawOffset, {
    stiffness: 400,
    damping: 28,
    mass: 0.35,
  });
  const zIndex = useTransform(scale, (value) => Math.round(value * 20));
  return { scale, offset, zIndex };
}

export function DockRoot({
  children,
  locked = false,
  ...props
}: Omit<ComponentProps<"nav">, "className"> & {
  locked?: boolean;
}) {
  const navRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const watching = useRef(false);
  const pointerX = useMotionValue(0);
  const hovering = useMotionValue(0);
  const rowLeft = useMotionValue(0);
  const rowWidth = useMotionValue(0);
  const holdRest = useRef(false);
  const wasLocked = useRef(locked);
  const itemCount = Children.count(children);
  const onWindowPointerRef = useRef<(event: PointerEvent) => void>(() => undefined);

  function pointerOnDock(clientX: number, clientY: number) {
    const nav = navRef.current;
    if (!nav) {
      return false;
    }
    const hit = document.elementFromPoint(clientX, clientY);
    return Boolean(hit && nav.contains(hit));
  }

  function rest() {
    hovering.set(0);
    if (!watching.current) {
      return;
    }
    watching.current = false;
    window.removeEventListener("pointermove", onWindowPointerStable);
  }

  function onWindowPointerStable(event: PointerEvent) {
    onWindowPointerRef.current(event);
  }

  onWindowPointerRef.current = (event: PointerEvent) => {
    if (locked) {
      return;
    }
    const onDock = pointerOnDock(event.clientX, event.clientY);
    if (holdRest.current) {
      holdRest.current = false;
      if (!onDock) {
        rest();
        return;
      }
    }
    if (onDock) {
      if (!dockPointerAllowed(event.pointerType)) {
        return;
      }
      const row = rowRef.current;
      if (!row) {
        return;
      }
      const rect = row.getBoundingClientRect();
      pointerX.set(event.clientX);
      rowLeft.set(rect.left);
      rowWidth.set(rect.width);
      hovering.set(1);
      return;
    }
    rest();
  };

  function watchWindow() {
    if (watching.current) {
      return;
    }
    watching.current = true;
    window.addEventListener("pointermove", onWindowPointerStable);
  }

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onWindowPointerStable);
    };
  }, []);

  useEffect(() => {
    if (wasLocked.current && !locked) {
      holdRest.current = true;
      hovering.set(0);
      if (!watching.current) {
        watching.current = true;
        window.addEventListener("pointermove", onWindowPointerStable);
      }
    }
    wasLocked.current = locked;
  }, [hovering, locked]);

  function track(event: ReactPointerEvent<HTMLElement>) {
    if (
      locked ||
      holdRest.current ||
      !dockPointerAllowed(event.pointerType)
    ) {
      return;
    }
    const row = rowRef.current;
    if (!row) {
      return;
    }
    const rect = row.getBoundingClientRect();
    pointerX.set(event.clientX);
    rowLeft.set(rect.left);
    rowWidth.set(rect.width);
    hovering.set(1);
    watchWindow();
  }

  return (
    <DockContext.Provider
      value={{ pointerX, hovering, rowLeft, rowWidth, itemCount }}
    >
      <nav
        ref={navRef}
        {...props}
        className="absolute inset-x-0 bottom-3 z-20 flex justify-center overflow-visible"
        aria-label="Providers"
        data-caliper-id="root-dock"
        onPointerEnter={track}
        onClick={(event) => {
          holdRest.current = true;
          const restoring = Boolean(
            (event.target as Element).closest(
              '[data-window-placement="tray"]',
            ),
          );
          if (!restoring) {
            hovering.set(0);
          }
          watchWindow();
        }}
        onPointerLeave={(event) => {
          if (pointerOnDock(event.clientX, event.clientY)) {
            return;
          }
          holdRest.current = false;
          rest();
        }}
      >
        <div
          ref={rowRef}
          className="dock-glass flex items-end overflow-visible rounded-[22px] px-2 py-2"
          style={
            {
              "--dock-pitch": dockPitch(itemCount),
              "--dock-icon-size": "calc(var(--dock-pitch) * 0.875)",
            } as CSSProperties
          }
        >
          {children}
        </div>
      </nav>
    </DockContext.Provider>
  );
}

export function DockItem({
  index,
  children,
  ...props
}: Omit<ComponentProps<typeof motion.div>, "className" | "style"> & {
  index: number;
}) {
  const { scale, offset, zIndex } = useDockMotion(index);
  return (
    <DockItemContext.Provider value={{ scale }}>
      <motion.div
        {...props}
        className="relative overflow-visible"
        style={{
          width: "var(--dock-pitch)",
          height: "var(--dock-icon-size)",
          x: offset,
          zIndex,
        }}
      >
        {children}
      </motion.div>
    </DockItemContext.Provider>
  );
}

export function DockTrigger({
  style,
  type = "button",
  children,
  ...props
}: Omit<ComponentProps<typeof motion.button>, "className">) {
  const { scale } = useDockItem();
  return (
    <motion.button
      type={type}
      className="absolute bottom-0 left-1/2 flex items-end justify-center overflow-visible rounded-[22%] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        width: "var(--dock-icon-size)",
        height: "var(--dock-icon-size)",
        x: "-50%",
        scale,
        transformOrigin: "50% 100%",
        ...style,
      }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function DockRunning() {
  return (
    <span className="pointer-events-none absolute -bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-black/55" />
  );
}

export const Dock = {
  Root: DockRoot,
  Item: DockItem,
  Trigger: DockTrigger,
  Running: DockRunning,
} as const;
