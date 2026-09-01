import { describe, expect, it, vi } from "vitest";

import {
  fillPaceMs,
  fillPresentedInput,
  TOOL_PRESENT_FILL_MIN_MS,
  TOOL_PRESENT_FILL_MS,
  TOOL_PRESENT_PREVIEW_MS,
  waitPresent,
} from "./fill-input";

function record() {
  const values: string[] = [];
  const events: string[] = [];
  const input = {
    value: "",
    dispatchEvent(event: Event) {
      events.push(event.type);
      return true;
    },
  };
  return {
    values,
    events,
    input,
    setValue: (value: string) => {
      input.value = value;
      values.push(value);
    },
  };
}

describe("fillPaceMs", () => {
  it("keeps 32ms through the reference length", () => {
    expect(fillPaceMs(1)).toBe(TOOL_PRESENT_FILL_MS);
    expect(fillPaceMs(8)).toBe(TOOL_PRESENT_FILL_MS);
  });

  it("shortens the delay as length grows and floors at 8ms", () => {
    expect(fillPaceMs(16)).toBe(16);
    expect(fillPaceMs(32)).toBe(TOOL_PRESENT_FILL_MIN_MS);
    expect(fillPaceMs(120)).toBe(TOOL_PRESENT_FILL_MIN_MS);
  });
});

describe("fillPresentedInput", () => {
  it("writes the full string once when instant", async () => {
    const session = record();
    await expect(
      fillPresentedInput({
        text: "keyboard",
        setValue: session.setValue,
        input: session.input,
        instant: true,
      }),
    ).resolves.toEqual({ text: "keyboard", yielded: false });
    expect(session.values).toEqual(["keyboard"]);
    expect(session.events).toEqual(["input"]);
  });

  it("writes one prefix per character when paced", async () => {
    vi.useFakeTimers();
    const session = record();
    const done = fillPresentedInput({
      text: "ab",
      setValue: session.setValue,
      input: session.input,
      instant: false,
      paceMs: 32,
    });
    await vi.advanceTimersByTimeAsync(32);
    await expect(done).resolves.toEqual({ text: "ab", yielded: false });
    expect(session.values).toEqual(["a", "ab"]);
    expect(session.events).toEqual(["input", "input"]);
    vi.useRealTimers();
  });

  it("stops writing when the live value leaves the agent prefix", async () => {
    vi.useFakeTimers();
    const session = record();
    const done = fillPresentedInput({
      text: "ab",
      setValue: session.setValue,
      input: session.input,
      instant: false,
      paceMs: 32,
    });
    session.input.value = "television";
    await vi.advanceTimersByTimeAsync(32);
    await expect(done).resolves.toEqual({ text: "television", yielded: true });
    expect(session.values).toEqual(["a"]);
    vi.useRealTimers();
  });

  it("stops before the fetch wait when the signal aborts", async () => {
    vi.useFakeTimers();
    const session = record();
    const controller = new AbortController();
    const done = fillPresentedInput({
      text: "ab",
      setValue: session.setValue,
      input: session.input,
      instant: false,
      paceMs: 32,
      signal: controller.signal,
    });
    controller.abort();
    await expect(done).rejects.toMatchObject({ name: "AbortError" });
    expect(session.values).toEqual(["a"]);
    vi.useRealTimers();
  });
});

describe("waitPresent", () => {
  it("rejects when the signal aborts during the pause", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const done = waitPresent(TOOL_PRESENT_PREVIEW_MS, controller.signal);
    controller.abort();
    await expect(done).rejects.toMatchObject({ name: "AbortError" });
    vi.useRealTimers();
  });
});
