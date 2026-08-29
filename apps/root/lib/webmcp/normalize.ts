import {
  namespacedToolName,
  normalizeInputSchema,
  normalizedToolDescriptorSchema,
  schemaFingerprint,
  toolHandleKey,
  type NormalizedToolDescriptor,
  type ProviderId,
  type RegisteredTool,
} from "@repo/contracts";

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
}): DiscoveredTool {
  if (options.tool.origin !== options.expectedOrigin) {
    throw new Error("origin_mismatch");
  }

  const { schema, invokeKind } = normalizeInputSchema(options.tool.inputSchema);
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
