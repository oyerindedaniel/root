import { describe, expect, it } from "vitest";

import {
  DOCK_ICON_SIZE,
  DOCK_PITCH,
  DOCK_ROW_PADDING,
  dockIconOffset,
  dockIconScale,
  dockShelfMinHeight,
  dockShelfMinWidth,
} from "./magnify";

describe("Dock magnification geometry", () => {
  it.each([2, 3, 12, 32])(
    "keeps adjacent icons separate across a %i-item fixed shelf",
    (itemCount) => {
      const pitch = Math.min(DOCK_PITCH, 832 / itemCount);
      const iconSize = pitch * (DOCK_ICON_SIZE / DOCK_PITCH);
      const rowLeft = 0;
      const rowWidth = itemCount * pitch + DOCK_ROW_PADDING;
      for (const hoverIndex of [
        0,
        Math.floor(itemCount / 2),
        itemCount - 1,
      ]) {
        const pointerX =
          DOCK_ROW_PADDING / 2 + hoverIndex * pitch + pitch / 2;
        const scales = Array.from({ length: itemCount }, (_, index) =>
          dockIconScale(index, pointerX, 1, rowLeft, rowWidth, itemCount),
        );
        const centers = scales.map(
          (_, index) =>
            DOCK_ROW_PADDING / 2 +
            index * pitch +
            pitch / 2 +
            dockIconOffset(
              index,
              pointerX,
              1,
              rowLeft,
              rowWidth,
              itemCount,
            ),
        );
        const overlaps = scales.slice(0, -1).map((scale, index) => {
          const nextScale = scales[index + 1] ?? 1;
          const currentRight =
            (centers[index] ?? 0) + (iconSize * scale) / 2;
          const nextLeft =
            (centers[index + 1] ?? 0) - (iconSize * nextScale) / 2;
          return currentRight - nextLeft;
        });

        expect(Math.max(...overlaps)).toBeLessThanOrEqual(0);
        expect(rowWidth).toBe(itemCount * pitch + DOCK_ROW_PADDING);
      }
    },
  );
});

describe("empty Dock shelf", () => {
  it("keeps rest tile height, not padding collapse", () => {
    expect(dockShelfMinHeight()).toBeGreaterThan(DOCK_ROW_PADDING);
    expect(dockShelfMinHeight() - DOCK_ICON_SIZE).toBe(DOCK_ROW_PADDING);
    expect(dockShelfMinWidth() - DOCK_PITCH).toBe(DOCK_ROW_PADDING);
  });
});
