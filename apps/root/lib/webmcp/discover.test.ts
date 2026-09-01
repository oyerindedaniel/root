import { describe, expect, it, vi } from "vitest";

import type { ModelContext, RegisteredTool } from "@repo/contracts";

import { DiscoveryTimeoutError, discoverTools } from "./discover";

function context(tools: RegisteredTool[]): ModelContext & EventTarget {
  const target = new EventTarget();
  return Object.assign(target, {
    registerTool: async () => undefined,
    getTools: async () => [...tools],
    executeTool: async () => {
      throw new Error("unused");
    },
  });
}

function pollingContext(tools: RegisteredTool[]): ModelContext {
  return {
    registerTool: async () => undefined,
    getTools: async () => [...tools],
    executeTool: async () => {
      throw new Error("unused");
    },
  };
}

describe("discoverTools", () => {
  it("returns tools from the expected origin", async () => {
    const search = {
      name: "search_products",
      origin: "http://localhost:3002",
      inputSchema: {},
    };
    const found = await discoverTools({
      modelContext: context([search]),
      origin: "http://localhost:3002",
      discovery: {
        mode: "builtin",
        expectedNames: ["search_products"],
      },
      signal: new AbortController().signal,
      timeoutMs: 50,
      pollMs: 5,
    });
    expect(found).toEqual([search]);
  });

  it("times out when the expected tool never appears", async () => {
    let time = 0;
    await expect(
      discoverTools({
        modelContext: pollingContext([]),
        origin: "http://localhost:3002",
        discovery: {
          mode: "builtin",
          expectedNames: ["search_products"],
        },
        signal: new AbortController().signal,
        timeoutMs: 20,
        pollMs: 10,
        now: () => time,
        sleep: async (ms: number) => {
          time += ms;
        },
      }),
    ).rejects.toBeInstanceOf(DiscoveryTimeoutError);
  });

  it("requeries on toolchange without polling", async () => {
    const tools: RegisteredTool[] = [];
    const modelContext = context(tools);
    const sleep = vi.fn(async () => undefined);
    const search = {
      name: "search_products",
      origin: "http://localhost:3002",
      inputSchema: {},
    };
    const discovery = discoverTools({
      modelContext,
      origin: search.origin,
      discovery: {
        mode: "builtin",
        expectedNames: [search.name],
      },
      signal: new AbortController().signal,
      timeoutMs: 100,
      pollMs: 5,
      sleep,
    });

    tools.push(search);
    modelContext.dispatchEvent(new Event("toolchange"));

    await expect(discovery).resolves.toEqual([search]);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("polls a host without toolchange support", async () => {
    const tools: RegisteredTool[] = [];
    let time = 0;
    const search = {
      name: "search_products",
      origin: "http://localhost:3002",
      inputSchema: {},
    };
    const found = await discoverTools({
      modelContext: pollingContext(tools),
      origin: search.origin,
      discovery: {
        mode: "builtin",
        expectedNames: [search.name],
      },
      signal: new AbortController().signal,
      timeoutMs: 20,
      pollMs: 5,
      now: () => time,
      sleep: async (ms) => {
        time += ms;
        tools.push(search);
      },
    });

    expect(found).toEqual([search]);
  });

  it("bounds an event-driven wait", async () => {
    await expect(
      discoverTools({
        modelContext: context([]),
        origin: "http://localhost:3002",
        discovery: {
          mode: "builtin",
          expectedNames: ["search_products"],
        },
        signal: new AbortController().signal,
        timeoutMs: 5,
      }),
    ).rejects.toBeInstanceOf(DiscoveryTimeoutError);
  });

  it("aborts while waiting for toolchange", async () => {
    const controller = new AbortController();
    const discovery = discoverTools({
      modelContext: context([]),
      origin: "http://localhost:3002",
      discovery: {
        mode: "builtin",
        expectedNames: ["search_products"],
      },
      signal: controller.signal,
      timeoutMs: 100,
    });
    controller.abort(new DOMException("Cancelled", "AbortError"));

    await expect(discovery).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("returns every custom tool from the exact configured origin", async () => {
    const first = {
      name: "inspect",
      origin: "https://analytics.example",
      inputSchema: {},
    };
    const second = {
      name: "export",
      origin: "https://analytics.example",
      inputSchema: {},
    };
    const found = await discoverTools({
      modelContext: context([
        first,
        second,
        { ...second, name: "wrong", origin: "https://other.example" },
      ]),
      origin: "https://analytics.example",
      discovery: { mode: "custom" },
      signal: new AbortController().signal,
      timeoutMs: 50,
      pollMs: 5,
    });
    expect(found).toEqual([first, second]);
  });
});
