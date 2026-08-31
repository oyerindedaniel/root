import { describe, expect, it } from "vitest";

import {
  GatewayError,
  MAX_PROVIDER_TOOLS,
  SEARCH_PRODUCTS_INPUT_SCHEMA,
  type GatewayErrorCode,
  type RegisteredTool,
} from "@repo/contracts";

import {
  MAX_CUSTOM_SCHEMA_CHARS,
  MAX_CUSTOM_SCHEMA_DEPTH,
  MAX_CUSTOM_SCHEMA_NODES,
} from "./json-bounds";
import {
  assertProviderToolCapacity,
  normalizeDiscoveredTool,
  rejectDuplicateToolNames,
} from "./normalize";

function expectGatewayCode(run: () => void, code: GatewayErrorCode) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(GatewayError);
    expect(error).toMatchObject({ code });
    return;
  }
  throw new Error(`expected GatewayError ${code}`);
}

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
    expectGatewayCode(
      () =>
        normalizeDiscoveredTool({
          providerId: "shop",
          instanceId: "shop_1",
          expectedOrigin: "http://localhost:3002",
          tool: tool({ origin: "http://localhost:3001" }),
        }),
      "discovery_failed",
    );
  });

  it("rejects invalid protocol tool identities", () => {
    expect(() =>
      normalizeDiscoveredTool({
        providerId: "custom-analytics-1",
        instanceId: "custom-analytics-1_instance",
        expectedOrigin: "https://analytics.example",
        tool: tool({
          name: "invalid tool",
          origin: "https://analytics.example",
        }),
      }),
    ).toThrow();
  });

  it("bounds custom schemas before normalization", () => {
    expectGatewayCode(
      () =>
        normalizeDiscoveredTool({
          providerId: "custom-analytics-1",
          instanceId: "custom-analytics-1_instance",
          expectedOrigin: "https://analytics.example",
          enforceCustomSchemaBounds: true,
          tool: tool({
            origin: "https://analytics.example",
            inputSchema: `{"description":"${"x".repeat(MAX_CUSTOM_SCHEMA_CHARS)}"}`,
          }),
        }),
      "schema_too_large",
    );
    let nested: Record<string, unknown> = { type: "string" };
    for (let depth = 0; depth <= MAX_CUSTOM_SCHEMA_DEPTH; depth += 1) {
      nested = { type: "object", properties: { value: nested } };
    }
    expectGatewayCode(
      () =>
        normalizeDiscoveredTool({
          providerId: "custom-analytics-1",
          instanceId: "custom-analytics-1_instance",
          expectedOrigin: "https://analytics.example",
          enforceCustomSchemaBounds: true,
          tool: tool({
            origin: "https://analytics.example",
            inputSchema: nested,
          }),
        }),
      "schema_too_large",
    );
    const properties = Object.fromEntries(
      Array.from({ length: MAX_CUSTOM_SCHEMA_NODES }, (_, index) => [
        `field_${index}`,
        { type: "string" },
      ]),
    );
    expectGatewayCode(
      () =>
        normalizeDiscoveredTool({
          providerId: "custom-analytics-1",
          instanceId: "custom-analytics-1_instance",
          expectedOrigin: "https://analytics.example",
          enforceCustomSchemaBounds: true,
          tool: tool({
            origin: "https://analytics.example",
            inputSchema: { type: "object", properties },
          }),
        }),
      "schema_too_large",
    );
  });
});

describe("assertProviderToolCapacity", () => {
  it("accepts the full capacity without truncation and rejects overflow", () => {
    const tools = Array.from({ length: MAX_PROVIDER_TOOLS }, (_, index) =>
      tool({ name: `tool_${index}` }),
    );
    expect(() => assertProviderToolCapacity(tools)).not.toThrow();
    expectGatewayCode(
      () =>
        assertProviderToolCapacity([...tools, tool({ name: "overflow" })]),
      "provider_tool_limit",
    );
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
    expectGatewayCode(
      () => rejectDuplicateToolNames([first, second]),
      "discovery_failed",
    );
  });
});
