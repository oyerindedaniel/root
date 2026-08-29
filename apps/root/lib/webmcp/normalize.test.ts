import { describe, expect, it } from "vitest";

import { SEARCH_PRODUCTS_INPUT_SCHEMA, type RegisteredTool } from "@repo/contracts";

import { normalizeDiscoveredTool, rejectDuplicateToolNames } from "./normalize";

function tool(overrides: Partial<RegisteredTool> = {}): RegisteredTool {
  return {
    name: "search_products",
    title: "Search products",
    description: "Search the catalog.",
    origin: "http://localhost:3002",
    inputSchema: SEARCH_PRODUCTS_INPUT_SCHEMA,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    ...overrides,
  };
}

describe("normalizeDiscoveredTool", () => {
  it("namespaces a Catalog tool", () => {
    const discovered = normalizeDiscoveredTool({
      providerId: "shop",
      instanceId: "shop_1",
      expectedOrigin: "http://localhost:3002",
      tool: tool(),
    });
    expect(discovered.descriptor.namespacedName).toBe("shop.search_products");
    expect(discovered.descriptor.invokeKind).toBe("object");
    expect(discovered.handleKey).toBe(
      "shop_1:http://localhost:3002:search_products",
    );
  });

  it("parses stringified schemas as json-string invoke kind", () => {
    const discovered = normalizeDiscoveredTool({
      providerId: "shop",
      instanceId: "shop_1",
      expectedOrigin: "http://localhost:3002",
      tool: tool({
        inputSchema: JSON.stringify(SEARCH_PRODUCTS_INPUT_SCHEMA),
      }),
    });
    expect(discovered.descriptor.invokeKind).toBe("json-string");
  });

  it("namespaces a custom provider tool without granting workflow identity", () => {
    const discovered = normalizeDiscoveredTool({
      providerId: "custom-analytics-1",
      instanceId: "custom-analytics-1_instance",
      expectedOrigin: "https://analytics.example",
      tool: tool({
        name: "inspect",
        origin: "https://analytics.example",
      }),
    });
    expect(discovered.descriptor.namespacedName).toBe(
      "custom-analytics-1.inspect",
    );
    expect(discovered.descriptor.providerId).toBe("custom-analytics-1");
  });

  it("rejects an unexpected origin", () => {
    expect(() =>
      normalizeDiscoveredTool({
        providerId: "shop",
        instanceId: "shop_1",
        expectedOrigin: "http://localhost:3002",
        tool: tool({ origin: "http://localhost:3001" }),
      }),
    ).toThrow("origin_mismatch");
  });
});

describe("rejectDuplicateToolNames", () => {
  it("rejects two tools with the same name and origin", () => {
    const first = normalizeDiscoveredTool({
      providerId: "shop",
      instanceId: "shop_1",
      expectedOrigin: "http://localhost:3002",
      tool: tool(),
    });
    const second = normalizeDiscoveredTool({
      providerId: "shop",
      instanceId: "shop_1",
      expectedOrigin: "http://localhost:3002",
      tool: tool(),
    });
    expect(() => rejectDuplicateToolNames([first, second])).toThrow(
      "duplicate_tool_name",
    );
  });
});
