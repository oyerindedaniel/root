import { describe, expect, it } from "vitest";

import {
  instanceIdsForProvider,
  libraryJiggleOrigin,
  libraryJiggleRotate,
  libraryJiggleTransition,
} from "./library-edit";

describe("libraryJiggleTransition", () => {
  it("is instant when motion is reduced", () => {
    expect(libraryJiggleTransition(true, 2)).toEqual({ duration: 0 });
    expect(libraryJiggleRotate(true, 2)).toBe(0);
  });

  it("repeats around rest and desyncs neighbors", () => {
    const even = libraryJiggleRotate(false, 0);
    const odd = libraryJiggleRotate(false, 1);
    expect(even).toBeInstanceOf(Array);
    expect(odd).toBeInstanceOf(Array);
    if (!Array.isArray(even) || !Array.isArray(odd)) {
      throw new Error("expected keyframes");
    }
    expect(even[0]).toBe(0);
    expect(even.at(-1)).toBe(0);
    expect(odd).not.toEqual(even);
    expect(libraryJiggleOrigin(0)).not.toBe(libraryJiggleOrigin(1));
    const a = libraryJiggleTransition(false, 0);
    const b = libraryJiggleTransition(false, 1);
    expect(a.repeat).toBe(Number.POSITIVE_INFINITY);
    expect(a.repeatType).toBe("loop");
    expect(a.duration).not.toBe(b.duration);
  });
});

describe("instanceIdsForProvider", () => {
  it("collects every live window for that provider", () => {
    expect(
      instanceIdsForProvider(
        [
          { instanceId: "custom-a_1", providerId: "custom-provider-1" },
          { instanceId: "shop_1", providerId: "shop" },
          { instanceId: "custom-a_2", providerId: "custom-provider-1" },
        ],
        "custom-provider-1",
      ),
    ).toEqual(["custom-a_1", "custom-a_2"]);
  });
});
