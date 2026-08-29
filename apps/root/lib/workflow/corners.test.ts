import { describe, expect, it } from "vitest";

import {
  cornerAnchors,
  nearestCorner,
  WORKFLOW_ICON_SIZE,
  WORKFLOW_INSET,
} from "./corners";

const viewport = { width: 800, height: 600 };
const anchors = cornerAnchors(viewport, WORKFLOW_ICON_SIZE, WORKFLOW_INSET);

describe("cornerAnchors", () => {
  it("places icon top-left at the inset", () => {
    expect(anchors["top-left"]).toEqual({ x: 20, y: 20 });
  });

  it("places icon top-right inset from the right edge", () => {
    expect(anchors["top-right"]).toEqual({ x: 740, y: 20 });
  });

  it("places icon bottom-left inset from the bottom edge", () => {
    expect(anchors["bottom-left"]).toEqual({ x: 20, y: 540 });
  });

  it("places icon bottom-right inset from both far edges", () => {
    expect(anchors["bottom-right"]).toEqual({ x: 740, y: 540 });
  });
});

describe("nearestCorner", () => {
  it("picks the closest icon center by squared distance", () => {
    expect(
      nearestCorner({ x: 20, y: 20 }, anchors, WORKFLOW_ICON_SIZE, "bottom-left"),
    ).toBe("top-left");
    expect(
      nearestCorner({ x: 780, y: 20 }, anchors, WORKFLOW_ICON_SIZE, "bottom-left"),
    ).toBe("top-right");
    expect(
      nearestCorner({ x: 20, y: 500 }, anchors, WORKFLOW_ICON_SIZE, "top-left"),
    ).toBe("bottom-left");
    expect(
      nearestCorner({ x: 780, y: 500 }, anchors, WORKFLOW_ICON_SIZE, "top-left"),
    ).toBe("bottom-right");
  });

  it("keeps the current corner when two centers are equally far", () => {
    const mid = { x: 400, y: 300 };
    expect(nearestCorner(mid, anchors, WORKFLOW_ICON_SIZE, "bottom-left")).toBe(
      "bottom-left",
    );
    expect(nearestCorner(mid, anchors, WORKFLOW_ICON_SIZE, "bottom-right")).toBe(
      "bottom-right",
    );
  });
});
