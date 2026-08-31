import { animate } from "motion/react";
import type { ProviderPlacement } from "@repo/contracts";

import type { Frame } from "./frame";

const ROWS = 8;
const SPREAD = 0.48;
const FINAL_INSET = 49;

type Axis = "horizontal" | "vertical";

export type PlacementPresentation = {
  transform: string;
  clipPath: string;
  opacity: number;
};

export type PlacementAnimation = {
  stop: () => void;
  clear: () => void;
};

function clamp(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function clampSigned(value: number) {
  return Math.min(Math.max(value, -1), 1);
}

function smooth(value: number) {
  const bounded = clamp(value);
  return bounded * bounded * (3 - 2 * bounded);
}

function targetAxis(source: Frame, target: Frame): {
  axis: Axis;
  forward: boolean;
} {
  const sourceX = source.left + source.width / 2;
  const sourceY = source.top + source.height / 2;
  const targetX = target.left + target.width / 2;
  const targetY = target.top + target.height / 2;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  return Math.abs(dy) >= Math.abs(dx)
    ? { axis: "vertical", forward: dy >= 0 }
    : { axis: "horizontal", forward: dx >= 0 };
}

function localProgress(
  progress: number,
  position: number,
  forward: boolean,
) {
  const facing = forward ? position : 1 - position;
  return smooth((progress - (1 - facing) * SPREAD) / (1 - SPREAD));
}

function verticalClip(progress: number, forward: boolean) {
  const left: string[] = [];
  const right: string[] = [];
  for (let index = 0; index <= ROWS; index += 1) {
    const position = index / ROWS;
    const inset =
      localProgress(progress, position, forward) * FINAL_INSET;
    left.push(`${inset.toFixed(3)}% ${(position * 100).toFixed(3)}%`);
    right.unshift(
      `${(100 - inset).toFixed(3)}% ${(position * 100).toFixed(3)}%`,
    );
  }
  return `polygon(${[...left, ...right].join(", ")})`;
}

function horizontalClip(progress: number, forward: boolean) {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let index = 0; index <= ROWS; index += 1) {
    const position = index / ROWS;
    const inset =
      localProgress(progress, position, forward) * FINAL_INSET;
    top.push(`${(position * 100).toFixed(3)}% ${inset.toFixed(3)}%`);
    bottom.unshift(
      `${(position * 100).toFixed(3)}% ${(100 - inset).toFixed(3)}%`,
    );
  }
  return `polygon(${[...top, ...bottom].join(", ")})`;
}

export function placementPresentation(
  source: Frame,
  target: Frame,
  progress: number,
): PlacementPresentation {
  const bounded = clamp(progress);
  const sourceX = source.left + source.width / 2;
  const sourceY = source.top + source.height / 2;
  const targetX = target.left + target.width / 2;
  const targetY = target.top + target.height / 2;
  const scaleX = 1 + (target.width / source.width - 1) * bounded;
  const scaleY = 1 + (target.height / source.height - 1) * bounded;
  const translateX = (target.left - source.left) * bounded;
  const translateY = (target.top - source.top) * bounded;
  const { axis, forward } = targetAxis(source, target);
  const bend =
    bounded === 0 || bounded === 1 ? 0 : Math.sin(Math.PI * bounded);
  const shear =
    axis === "vertical"
      ? clampSigned((targetX - sourceX) / source.height) * 0.12 * bend
      : clampSigned((targetY - sourceY) / source.width) * 0.12 * bend;
  const matrix =
    axis === "vertical"
      ? `matrix(${scaleX}, 0, ${shear}, ${scaleY}, ${
          translateX - shear * source.height / 2
        }, ${translateY})`
      : `matrix(${scaleX}, ${shear}, 0, ${scaleY}, ${translateX}, ${
          translateY - shear * source.width / 2
        })`;
  return {
    transform: matrix,
    clipPath:
      axis === "vertical"
        ? verticalClip(bounded, forward)
        : horizontalClip(bounded, forward),
    opacity: 1 - smooth((bounded - 0.88) / 0.12),
  };
}

export function clearPlacementPresentation(surface: HTMLElement) {
  surface.style.transform = "translate3d(0,0,0)";
  surface.style.transformOrigin = "";
  surface.style.clipPath = "";
  surface.style.opacity = "";
  surface.style.willChange = "";
}

export function animatePlacement({
  surface,
  source,
  target,
  placement,
  onComplete,
}: {
  surface: HTMLElement;
  source: Frame;
  target: Frame;
  placement: ProviderPlacement;
  onComplete: () => void;
}): PlacementAnimation {
  surface.style.transformOrigin = "0 0";
  surface.style.willChange = "transform, clip-path, opacity";
  const paint = (progress: number) => {
    const presentation = placementPresentation(source, target, progress);
    surface.style.transform = presentation.transform;
    surface.style.clipPath = presentation.clipPath;
    surface.style.opacity = String(presentation.opacity);
  };
  const from = placement === "tray" ? 0 : 1;
  const to = placement === "tray" ? 1 : 0;
  paint(from);
  const controls = animate(from, to, {
    duration: 0.38,
    ease: [0.32, 0, 0.18, 1],
    onUpdate: paint,
    onComplete,
  });
  return {
    stop: () => controls.stop(),
    clear: () => clearPlacementPresentation(surface),
  };
}
