import {
  applyFrame,
  clampDesktopFrame,
  layoutFromRect,
  resizeFrame,
  defaultLaunchFrame,
  writeDragTransform,
  type Frame,
  type ResizeEdge,
} from "./frame";

export type WindowGesture = "move" | ResizeEdge;

export type WindowSession = {
  bind: (options: {
    window: HTMLElement;
    workspace: HTMLElement;
    workArea: HTMLElement;
    iframe: HTMLIFrameElement | null;
  }) => void;
  unbind: () => void;
  fillWorkArea: () => void;
  openStage: () => void;
  applyCurrent: () => void;
  snapshotStage: () => void;
  restoreStage: () => void;
  toggleZoom: () => void;
  begin: (gesture: WindowGesture, event: PointerEvent) => void;
  isMaximized: () => boolean;
  hasFrame: () => boolean;
  relayout: () => void;
};

function cursorFor(next: WindowGesture) {
  if (next === "move") {
    return "default";
  }
  if (next === "n" || next === "s") {
    return "ns-resize";
  }
  if (next === "e" || next === "w") {
    return "ew-resize";
  }
  if (next === "ne" || next === "sw") {
    return "nesw-resize";
  }
  return "nwse-resize";
}

function lockCursor(cursor: string) {
  document.documentElement.dataset.windowCursor = cursor;
  document.documentElement.style.setProperty("--window-cursor", cursor);
}

function unlockCursor() {
  delete document.documentElement.dataset.windowCursor;
  document.documentElement.style.removeProperty("--window-cursor");
}

export function createWindowSession(): WindowSession {
  let windowEl: HTMLElement | null = null;
  let workspaceEl: HTMLElement | null = null;
  let workAreaEl: HTMLElement | null = null;
  let iframeEl: HTMLIFrameElement | null = null;
  let frame: Frame = { left: 0, top: 0, width: 0, height: 0 };
  let stageSnapshot: Frame | null = null;
  let lastFrame: Frame | null = null;
  let restoreFrame: Frame | null = null;
  let lastRestoreFrame: Frame | null = null;
  let fullscreen = false;
  let lastFullscreen = false;
  let stageSnapshotFullscreen = false;
  let raf = 0;
  let gesture: WindowGesture | null = null;
  let startX = 0;
  let startY = 0;
  let startFrame: Frame = frame;
  let pendingX = 0;
  let pendingY = 0;
  let gestureBounds: Frame = frame;

  function readWorkArea(): Frame {
    if (!workspaceEl || !workAreaEl) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }
    return layoutFromRect(
      workspaceEl.getBoundingClientRect(),
      workAreaEl.getBoundingClientRect(),
    );
  }

  function readCanvas(): Frame {
    if (!workspaceEl) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }
    const rect = workspaceEl.getBoundingClientRect();
    return { left: 0, top: 0, width: rect.width, height: rect.height };
  }

  function paintChrome() {
    if (!windowEl) {
      return;
    }
    windowEl.style.zIndex = fullscreen ? "30" : "";
    windowEl.style.borderRadius = fullscreen ? "0px" : "";
  }

  function commit() {
    if (!windowEl) {
      return;
    }
    applyFrame(windowEl, frame);
    paintChrome();
  }

  function setIframeCapture(active: boolean) {
    if (!iframeEl) {
      return;
    }
    iframeEl.style.pointerEvents = active ? "none" : "";
  }

  function paintMove() {
    if (!windowEl || gesture !== "move") {
      return;
    }
    const next = clampDesktopFrame(
      {
        ...startFrame,
        left: startFrame.left + pendingX - startX,
        top: startFrame.top + pendingY - startY,
      },
      gestureBounds,
    );
    writeDragTransform(
      windowEl,
      next.left - startFrame.left,
      next.top - startFrame.top,
    );
  }

  function paintResize() {
    if (!windowEl || !gesture || gesture === "move") {
      return;
    }
    frame = clampDesktopFrame(
      resizeFrame(startFrame, gesture, pendingX - startX, pendingY - startY),
      gestureBounds,
    );
    applyFrame(windowEl, frame);
    lastFrame = { ...frame };
  }

  function tick() {
    raf = 0;
    if (gesture === "move") {
      paintMove();
      return;
    }
    if (gesture) {
      paintResize();
    }
  }

  function schedule() {
    if (raf) {
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function onPointerMove(event: PointerEvent) {
    pendingX = event.clientX;
    pendingY = event.clientY;
    schedule();
  }

  function onPointerUp(event: PointerEvent) {
    if (!windowEl || !gesture) {
      return;
    }
    const dx = pendingX - startX;
    const dy = pendingY - startY;
    windowEl.releasePointerCapture(event.pointerId);
    windowEl.removeEventListener("pointermove", onPointerMove);
    windowEl.removeEventListener("pointerup", onPointerUp);
    windowEl.removeEventListener("pointercancel", onPointerUp);
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    const ended = gesture;
    if (ended === "move") {
      frame = clampDesktopFrame(
        {
          ...startFrame,
          left: startFrame.left + dx,
          top: startFrame.top + dy,
        },
        gestureBounds,
      );
    } else {
      frame = clampDesktopFrame(
        resizeFrame(startFrame, ended, dx, dy),
        gestureBounds,
      );
    }
    applyFrame(windowEl, frame);
    paintChrome();
    lastFrame = { ...frame };
    windowEl.style.willChange = "";
    setIframeCapture(false);
    unlockCursor();
    gesture = null;
  }

  return {
    bind(options) {
      windowEl = options.window;
      workspaceEl = options.workspace;
      workAreaEl = options.workArea;
      iframeEl = options.iframe;
    },
    unbind() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (windowEl && gesture) {
        windowEl.removeEventListener("pointermove", onPointerMove);
        windowEl.removeEventListener("pointerup", onPointerUp);
        windowEl.removeEventListener("pointercancel", onPointerUp);
      }
      setIframeCapture(false);
      unlockCursor();
      windowEl = null;
      workspaceEl = null;
      workAreaEl = null;
      iframeEl = null;
      gesture = null;
      if (frame.width > 0 && frame.height > 0) {
        lastFrame = { ...frame };
        lastFullscreen = fullscreen;
        lastRestoreFrame = restoreFrame;
      }
      frame = { left: 0, top: 0, width: 0, height: 0 };
      stageSnapshot = null;
      fullscreen = false;
    },
    fillWorkArea() {
      if (gesture) {
        return;
      }
      const next = readCanvas();
      if (next.width <= 0 || next.height <= 0 || !windowEl) {
        return;
      }
      restoreFrame = { ...frame };
      lastFrame = { ...frame };
      fullscreen = true;
      frame = next;
      commit();
    },
    openStage() {
      if (gesture || !windowEl) {
        return;
      }
      const canvas = readCanvas();
      const area = readWorkArea();
      if (canvas.width <= 0 || canvas.height <= 0) {
        return;
      }
      if (lastFullscreen) {
        frame = canvas;
        fullscreen = true;
        restoreFrame = lastRestoreFrame;
      } else if (lastFrame) {
        frame = clampDesktopFrame(lastFrame, canvas);
        fullscreen = false;
      } else {
        frame = defaultLaunchFrame(area);
        fullscreen = false;
      }
      lastFrame = { ...frame };
      commit();
    },
    applyCurrent() {
      if (gesture || !windowEl || frame.width <= 0) {
        return;
      }
      commit();
    },
    snapshotStage() {
      if (frame.width > 0) {
        stageSnapshot = { ...frame };
        lastFrame = { ...frame };
        stageSnapshotFullscreen = fullscreen;
      }
      if (windowEl) {
        windowEl.style.zIndex = "";
        windowEl.style.borderRadius = "";
      }
    },
    restoreStage() {
      if (gesture || !windowEl) {
        return;
      }
      const canvas = readCanvas();
      const area = readWorkArea();
      const saved = stageSnapshot ?? lastFrame;
      const savedFullscreen = stageSnapshot
        ? stageSnapshotFullscreen
        : lastFullscreen;
      if (savedFullscreen) {
        frame = canvas;
        fullscreen = true;
      } else if (saved) {
        frame = clampDesktopFrame(saved, canvas);
        fullscreen = false;
      } else {
        frame = defaultLaunchFrame(area);
        fullscreen = false;
      }
      lastFrame = { ...frame };
      commit();
    },
    toggleZoom() {
      if (gesture || !windowEl) {
        return;
      }
      const canvas = readCanvas();
      const area = readWorkArea();
      if (fullscreen) {
        const previous = restoreFrame ?? lastFrame ?? defaultLaunchFrame(area);
        frame = clampDesktopFrame(previous, canvas);
        fullscreen = false;
        lastFullscreen = false;
        lastFrame = { ...frame };
      } else {
        restoreFrame = { ...frame };
        lastFrame = { ...frame };
        frame = canvas;
        fullscreen = true;
        lastFullscreen = true;
      }
      commit();
    },
    begin(nextGesture, event) {
      if (!windowEl || event.button !== 0 || gesture || fullscreen) {
        return;
      }
      gestureBounds = readCanvas();
      startX = event.clientX;
      startY = event.clientY;
      pendingX = event.clientX;
      pendingY = event.clientY;
      startFrame = { ...frame };
      gesture = nextGesture;
      windowEl.style.willChange =
        nextGesture === "move" ? "transform" : "left, top, width, height";
      setIframeCapture(true);
      lockCursor(cursorFor(nextGesture));
      windowEl.setPointerCapture(event.pointerId);
      windowEl.addEventListener("pointermove", onPointerMove);
      windowEl.addEventListener("pointerup", onPointerUp);
      windowEl.addEventListener("pointercancel", onPointerUp);
    },
    isMaximized() {
      return fullscreen;
    },
    hasFrame() {
      return frame.width > 0 && frame.height > 0;
    },
    relayout() {
      if (gesture || !windowEl) {
        return;
      }
      const canvas = readCanvas();
      if (canvas.width <= 0 || canvas.height <= 0) {
        return;
      }
      if (fullscreen) {
        frame = canvas;
      } else if (frame.width > 0) {
        frame = clampDesktopFrame(frame, canvas);
      } else {
        return;
      }
      lastFrame = { ...frame };
      commit();
    },
  };
}
