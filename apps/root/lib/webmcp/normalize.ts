import {
  GatewayError,
  MAX_PROVIDER_TOOLS,
  namespacedToolName,
  normalizeInputSchema,
  normalizedToolDescriptorSchema,
  schemaFingerprint,
  toolHandleKey,
  webmcpToolNameSchema,
  type NormalizedToolDescriptor,
  type ProviderId,
  type RegisteredTool,
} from "@repo/contracts";

import {
  boundJsonValue,
  MAX_CUSTOM_SCHEMA_CHARS,
  MAX_CUSTOM_SCHEMA_DEPTH,
  MAX_CUSTOM_SCHEMA_NODES,
} from "./json-bounds";

export type DiscoveredTool = {
  descriptor: NormalizedToolDescriptor;
  handle: RegisteredTool;
  handleKey: string;
};

export function normalizeDiscoveredTool(options: {
  providerId: ProviderId;
  instanceId: string;
  expectedOrigin: string;
  tool: RegisteredTool;
  enforceCustomSchemaBounds?: boolean;
}): DiscoveredTool {
  if (options.tool.origin !== options.expectedOrigin) {
    throw new GatewayError(
      "discovery_failed",
      "Tool origin does not match the provider.",
    );
  }
  webmcpToolNameSchema.parse(options.tool.name);

  if (
    options.enforceCustomSchemaBounds &&
    typeof options.tool.inputSchema === "string" &&
    options.tool.inputSchema.length > MAX_CUSTOM_SCHEMA_CHARS
  ) {
    throw new GatewayError(
      "schema_too_large",
      "Tool schema exceeds the size limit.",
    );
  }
  const { schema, invokeKind } = normalizeInputSchema(options.tool.inputSchema);
  if (options.enforceCustomSchemaBounds) {
    const bounds = boundJsonValue(schema, {
      maxChars: MAX_CUSTOM_SCHEMA_CHARS,
      maxDepth: MAX_CUSTOM_SCHEMA_DEPTH,
      maxNodes: MAX_CUSTOM_SCHEMA_NODES,
    });
    if (!bounds.ok) {
      throw new GatewayError(
        bounds.reason === "too_large" ? "schema_too_large" : "invalid_schema",
        bounds.reason === "too_large"
          ? "Tool schema exceeds the size limit."
          : "Tool schema is invalid.",
      );
    }
  }
  const descriptor = normalizedToolDescriptorSchema.parse({
    providerId: options.providerId,
    namespacedName: namespacedToolName(options.providerId, options.tool.name),
    name: options.tool.name,
    title: options.tool.title || options.tool.name,
    description: options.tool.description || options.tool.name,
    origin: options.tool.origin,
    inputSchema: schema,
    schemaFingerprint: schemaFingerprint(schema),
    invokeKind,
    readOnlyHint: options.tool.annotations?.readOnlyHint === true,
    untrustedContentHint:
      options.tool.annotations?.untrustedContentHint === true,
  });

  return {
    descriptor,
    handle: options.tool,
    handleKey: toolHandleKey(
      options.instanceId,
      options.tool.origin,
      options.tool.name,
    ),
  };
}

export function assertProviderToolCapacity(
  tools: readonly RegisteredTool[],
): void {
  if (tools.length > MAX_PROVIDER_TOOLS) {
    throw new GatewayError(
      "provider_tool_limit",
      "Provider registered more tools than allowed.",
    );
  }
}

export function rejectDuplicateToolNames(
  tools: DiscoveredTool[],
): DiscoveredTool[] {
  const seen = new Set<string>();
  for (const tool of tools) {
    const key = `${tool.descriptor.origin}:${tool.descriptor.name}`;
    if (seen.has(key)) {
      throw new GatewayError(
        "discovery_failed",
        "Provider registered duplicate tool names.",
      );
    }
    seen.add(key);
  }
  return tools;
}
