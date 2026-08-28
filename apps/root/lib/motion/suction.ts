export function prefersReducedMotion(media: Pick<Window, "matchMedia"> = window) {
  return media.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function layoutFromRect(
  parent: DOMRect,
  slot: DOMRect,
): { top: number; left: number; width: number; height: number } {
  return {
    top: slot.top - parent.top,
    left: slot.left - parent.left,
    width: slot.width,
    height: slot.height,
  };
}

export async function animateSuction(options: {
  surface: HTMLElement;
  from: DOMRect;
  to: DOMRect;
  signal: AbortSignal;
}): Promise<void> {
  if (options.signal.aborted) {
    throw options.signal.reason ?? new DOMException("Aborted", "AbortError");
  }
  if (prefersReducedMotion()) {
    return;
  }

  const dx = options.from.left - options.to.left;
  const dy = options.from.top - options.to.top;
  const sx = options.from.width / Math.max(options.to.width, 1);
  const sy = options.from.height / Math.max(options.to.height, 1);

  options.surface.style.willChange = "transform";
  const animation = options.surface.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      {
        transform: `translate(${dx * 0.42}px, ${dy * 0.18}px) scale(${sx * 0.94}, ${sy * 0.52})`,
        offset: 0.42,
      },
      {
        transform: `translate(${dx * 0.12}px, ${dy * 0.04}px) scale(${sx * 0.4}, ${sy * 0.28})`,
        offset: 0.72,
      },
      { transform: "translate(0px, 0px) scale(1, 1)" },
    ],
    {
      duration: 280,
      easing: "cubic-bezier(0.32, 0.72, 0, 1)",
      fill: "none",
    },
  );

  const onAbort = () => {
    animation.cancel();
  };
  options.signal.addEventListener("abort", onAbort, { once: true });

  try {
    await animation.finished;
  } finally {
    options.signal.removeEventListener("abort", onAbort);
    options.surface.style.willChange = "";
  }
}
