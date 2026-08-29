import { z } from "zod";

import { stableStringify } from "./stable-json.js";

export const providerIdSchema = z.enum(["shop", "accounts"]);

export type ProviderId = z.infer<typeof providerIdSchema>;

export const webmcpToolNameSchema = z.string().min(1).max(64);

export type WebmcpToolName = z.infer<typeof webmcpToolNameSchema>;

export function readOrigin(value: string): string {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("invalid_origin");
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("invalid_origin");
  }
  return url.origin;
}

export const originSchema = z.string().refine((value) => {
  try {
    readOrigin(value);
    return true;
  } catch {
    return false;
  }
});

export type Origin = z.infer<typeof originSchema>;

export const contractVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/);

export const invokeKindSchema = z.enum(["object", "json-string"]);

export type InvokeKind = z.infer<typeof invokeKindSchema>;

export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const webmcpAnnotationsSchema = z.object({
  readOnlyHint: z.boolean(),
  untrustedContentHint: z.boolean(),
});

export const normalizedToolDescriptorSchema = z.object({
  providerId: providerIdSchema,
  namespacedName: z.string().min(1).max(128),
  name: webmcpToolNameSchema,
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  origin: originSchema,
  inputSchema: jsonObjectSchema,
  schemaFingerprint: z.string().min(1),
  invokeKind: invokeKindSchema,
  readOnlyHint: z.boolean(),
  untrustedContentHint: z.boolean(),
});

export type NormalizedToolDescriptor = z.infer<
  typeof normalizedToolDescriptorSchema
>;

export const boundedErrorSchema = z.object({
  status: z.literal("error"),
  code: z.string().min(1).max(64),
  message: z.string().min(1).max(280),
});

export type BoundedError = z.infer<typeof boundedErrorSchema>;

export const boundedSuccessSchema = z.object({
  status: z.literal("success"),
  data: z.unknown(),
});

export type BoundedSuccess = z.infer<typeof boundedSuccessSchema>;

export const boundedResultEnvelopeSchema = z.discriminatedUnion("status", [
  boundedSuccessSchema,
  boundedErrorSchema,
]);

export type BoundedResultEnvelope = z.infer<typeof boundedResultEnvelopeSchema>;

export const SHOP_EXPECTED_TOOLS = ["search_products"] as const;

export const SHOP_CONTRACT_VERSION = "1.0.0";

export const ACCOUNTS_EXPECTED_TOOLS = ["search_customers"] as const;

export const ACCOUNTS_CONTRACT_VERSION = "1.0.0";

export const WEBMCP_DISCOVERY_TIMEOUT_MS = 8_000;

export const WEBMCP_DISCOVERY_POLL_MS = 200;

export const WEBMCP_MAX_RESULT_CHARS = 16_384;

export function namespacedToolName(
  providerId: ProviderId,
  toolName: string,
): string {
  return `${providerId}.${toolName}`;
}

export function toolHandleKey(
  instanceId: string,
  origin: string,
  toolName: string,
): string {
  return `${instanceId}:${origin}:${toolName}`;
}

export function schemaFingerprint(schema: Record<string, unknown>): string {
  return stableStringify(schema);
}

export function boundedError(code: string, message: string): BoundedError {
  return boundedErrorSchema.parse({
    status: "error",
    code,
    message,
  });
}

export function parseJsonObject(raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("invalid_json");
  }
  return jsonObjectSchema.parse(parsed);
}

export function normalizeInputSchema(raw: unknown): {
  schema: Record<string, unknown>;
  invokeKind: InvokeKind;
} {
  if (typeof raw === "string") {
    return {
      schema: parseJsonObject(raw),
      invokeKind: "json-string",
    };
  }

  return {
    schema: jsonObjectSchema.parse(raw),
    invokeKind: "object",
  };
}

export function serializeExecuteInput(
  invokeKind: InvokeKind,
  input: Record<string, unknown>,
): Record<string, unknown> | string {
  if (invokeKind === "json-string") {
    return JSON.stringify(input);
  }
  return input;
}

export function parseToolExecuteInput(input: unknown): unknown {
  if (typeof input === "string") {
    return JSON.parse(input);
  }
  return input;
}

export function parseExecuteResultText(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }
  return JSON.stringify(result);
}

export function parseBoundedJsonResult(resultText: string): unknown {
  if (resultText.length > WEBMCP_MAX_RESULT_CHARS) {
    throw new Error("result_too_large");
  }
  return JSON.parse(resultText);
}
