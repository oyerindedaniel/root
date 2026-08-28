import { describe, expect, it } from "vitest";

import { ToolHandleRegistry } from "./handles";
import type { RegisteredTool } from "./model-context";

const tool = {
  name: "search_products",
  origin: "http://localhost:3002",
  inputSchema: {},
} satisfies RegisteredTool;

describe("ToolHandleRegistry", () => {
  it("stores and returns a handle", () => {
    const registry = new ToolHandleRegistry();
    registry.set("shop_1", tool.origin, tool.name, tool);
    expect(registry.get("shop_1", tool.origin, tool.name)).toBe(tool);
  });

  it("invalidates every handle for an instance", () => {
    const registry = new ToolHandleRegistry();
    registry.set("shop_1", tool.origin, tool.name, tool);
    registry.set("shop_2", tool.origin, tool.name, tool);
    registry.invalidateInstance("shop_1");
    expect(registry.get("shop_1", tool.origin, tool.name)).toBeUndefined();
    expect(registry.get("shop_2", tool.origin, tool.name)).toBe(tool);
  });
});
