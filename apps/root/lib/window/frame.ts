export type Frame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const MIN_WINDOW_WIDTH = 480;
export const MIN_WINDOW_HEIGHT = 320;
export const TITLEBAR_HEIGHT = 28;
export const TITLEBAR_GRIP = 48;

export function layoutFromRect(
  parent: DOMRect,
  slot: DOMRect,
): Frame {
  return {
    top: slot.top - parent.top,
    left: slot.left - parent.left,
    width: slot.width,
    height: slot.height,
  };
}

export function clampFrame(frame: Frame, bounds: Frame): Frame {
  const width = Math.min(
    Math.max(frame.width, MIN_WINDOW_WIDTH),
    Math.max(bounds.width, MIN_WINDOW_WIDTH),
  );
  const height = Math.min(
    Math.max(frame.height, MIN_WINDOW_HEIGHT),
    Math.max(bounds.height, MIN_WINDOW_HEIGHT),
  );
  const maxLeft = bounds.left + Math.max(bounds.width - width, 0);
  const maxTop = bounds.top + Math.max(bounds.height - height, 0);
  return {
    width,
    height,
    left: Math.min(Math.max(frame.left, bounds.left), maxLeft),
    top: Math.min(Math.max(frame.top, bounds.top), maxTop),
  };
}

export function clampDesktopFrame(frame: Frame, canvas: Frame): Frame {
  const width = Math.max(frame.width, MIN_WINDOW_WIDTH);
  const height = Math.max(frame.height, MIN_WINDOW_HEIGHT);
  const keepX = Math.min(TITLEBAR_GRIP, width);
  const keepY = Math.min(TITLEBAR_HEIGHT, height);
  const minLeft = canvas.left + keepX - width;
  const maxLeft = canvas.left + canvas.width - keepX;
  const minTop = canvas.top;
  const maxTop = canvas.top + canvas.height - keepY;
  return {
    width,
    height,
    left: Math.min(Math.max(frame.left, minLeft), maxLeft),
    top: Math.min(Math.max(frame.top, minTop), maxTop),
  };
}

export function defaultLaunchFrame(bounds: Frame): Frame {
  const width = Math.min(
    Math.max(Math.round(bounds.width * 0.72), MIN_WINDOW_WIDTH),
    bounds.width,
  );
  const height = Math.min(
    Math.max(Math.round(bounds.height * 0.78), MIN_WINDOW_HEIGHT),
    bounds.height,
  );
  return clampFrame(
    {
      left: bounds.left + Math.round((bounds.width - width) / 2),
      top: bounds.top,
      width,
      height,
    },
    bounds,
  );
}

export function framesClose(a: Frame, b: Frame, epsilon = 2): boolean {
  return (
    Math.abs(a.left - b.left) <= epsilon &&
    Math.abs(a.top - b.top) <= epsilon &&
    Math.abs(a.width - b.width) <= epsilon &&
    Math.abs(a.height - b.height) <= epsilon
  );
}

export function resizeFrame(
  start: Frame,
  edge: ResizeEdge,
  dx: number,
  dy: number,
): Frame {
  let left = start.left;
  let top = start.top;
  let width = start.width;
  let height = start.height;
  if (edge.includes("e")) {
    width = start.width + dx;
  }
  if (edge.includes("s")) {
    height = start.height + dy;
  }
  if (edge.includes("w")) {
    left = start.left + dx;
    width = start.width - dx;
  }
  if (edge.includes("n")) {
    top = start.top + dy;
    height = start.height - dy;
  }
  return { left, top, width, height };
}

export function applyFrame(el: HTMLElement, frame: Frame) {
  el.style.left = `${frame.left}px`;
  el.style.top = `${frame.top}px`;
  el.style.width = `${frame.width}px`;
  el.style.height = `${frame.height}px`;
  el.style.transform = "translate3d(0,0,0)";
}

export function writeDragTransform(el: HTMLElement, dx: number, dy: number) {
  el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
}
