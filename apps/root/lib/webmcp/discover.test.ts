import { describe, expect, it } from "vitest";

import type { ModelContext, RegisteredTool } from "@repo/contracts";

import { DiscoveryTimeoutError, discoverTools } from "./discover";

function context(tools: RegisteredTool[]): ModelContext {
  const target = new EventTarget();
  return Object.assign(target, {
    registerTool: async () => undefined,
    getTools: async () => tools,
    executeTool: async () => {
      throw new Error("unused");
    },
  });
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
      expectedNames: ["search_products"],
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
        modelContext: context([]),
        origin: "http://localhost:3002",
        expectedNames: ["search_products"],
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
});
