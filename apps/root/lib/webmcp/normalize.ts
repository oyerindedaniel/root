import {
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
    throw new Error("origin_mismatch");
  }
  webmcpToolNameSchema.parse(options.tool.name);

  if (
    options.enforceCustomSchemaBounds &&
    typeof options.tool.inputSchema === "string" &&
    options.tool.inputSchema.length > MAX_CUSTOM_SCHEMA_CHARS
  ) {
    throw new Error("schema_too_large");
  }
  const { schema, invokeKind } = normalizeInputSchema(options.tool.inputSchema);
  if (options.enforceCustomSchemaBounds) {
    const bounds = boundJsonValue(schema, {
      maxChars: MAX_CUSTOM_SCHEMA_CHARS,
      maxDepth: MAX_CUSTOM_SCHEMA_DEPTH,
      maxNodes: MAX_CUSTOM_SCHEMA_NODES,
    });
    if (!bounds.ok) {
      throw new Error(
        bounds.reason === "too_large" ? "schema_too_large" : "invalid_schema",
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
    throw new Error("provider_tool_limit");
  }
}

export function rejectDuplicateToolNames(
  tools: DiscoveredTool[],
): DiscoveredTool[] {
  const seen = new Set<string>();
  for (const tool of tools) {
    const key = `${tool.descriptor.origin}:${tool.descriptor.name}`;
    if (seen.has(key)) {
      throw new Error("duplicate_tool_name");
    }
    seen.add(key);
  }
  return tools;
}
