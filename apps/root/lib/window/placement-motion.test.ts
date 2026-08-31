import { describe, expect, it } from "vitest";

import { placementPresentation } from "./placement-motion";

const source = {
  left: 100,
  top: 80,
  width: 800,
  height: 600,
};

const target = {
  left: 420,
  top: 920,
  width: 64,
  height: 64,
};

describe("placementPresentation", () => {
  it("starts at the stable stage frame", () => {
    const presentation = placementPresentation(source, target, 0);
    expect(presentation.transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
    expect(presentation.clipPath).toContain("0.000% 0.000%");
    expect(presentation.clipPath).toContain("100.000% 100.000%");
    expect(presentation.opacity).toBe(1);
  });

  it("lands on the Dock target before the final sliver disappears", () => {
    const presentation = placementPresentation(source, target, 1);
    const values = presentation.transform
      .slice("matrix(".length, -1)
      .split(", ")
      .map(Number);
    expect(values[0]).toBeCloseTo(target.width / source.width);
    expect(values[1]).toBe(0);
    expect(values[2]).toBe(0);
    expect(values[3]).toBeCloseTo(target.height / source.height);
    expect(values[4]).toBe(target.left - source.left);
    expect(values[5]).toBe(target.top - source.top);
    expect(presentation.clipPath).toContain("49.000%");
    expect(presentation.clipPath).toContain("51.000%");
    expect(presentation.opacity).toBe(0);
  });

  it("pulls the Dock-facing edge ahead of the far edge", () => {
    const presentation = placementPresentation(source, target, 0.3);
    expect(presentation.clipPath).not.toContain("0.000% 100.000%");
    expect(presentation.clipPath).toContain("0.000% 0.000%");
    expect(presentation.opacity).toBe(1);
  });

  it("clamps presentation progress at both rests", () => {
    expect(placementPresentation(source, target, -1)).toEqual(
      placementPresentation(source, target, 0),
    );
    expect(placementPresentation(source, target, 2)).toEqual(
      placementPresentation(source, target, 1),
    );
  });
});
