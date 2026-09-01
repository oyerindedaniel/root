import { afterEach, describe, expect, it, vi } from "vitest";

import { setPendingHumanTimer } from "./pending-human-timeout";

afterEach(() => {
  vi.useRealTimers();
});

describe("setPendingHumanTimer", () => {
  it("does not fire after the wait is closed", () => {
    vi.useFakeTimers();
    const fired: string[] = [];
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    setPendingHumanTimer(timers, "shop_1", true, (id) => fired.push(id), 1_000);
    setPendingHumanTimer(timers, "shop_1", false, (id) => fired.push(id), 1_000);
    vi.advanceTimersByTime(1_000);
    expect(fired).toEqual([]);
  });

  it("fires once when the wait stays open", () => {
    vi.useFakeTimers();
    const fired: string[] = [];
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    setPendingHumanTimer(timers, "shop_1", true, (id) => fired.push(id), 1_000);
    vi.advanceTimersByTime(1_000);
    vi.advanceTimersByTime(1_000);
    expect(fired).toEqual(["shop_1"]);
  });
});
