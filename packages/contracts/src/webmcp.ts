import { z } from "zod";

import { stableStringify } from "./stable-json.js";

export const providerIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/);

export type ProviderId = z.infer<typeof providerIdSchema>;

export const webmcpToolNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_.-]+$/);

export type WebmcpToolName = z.infer<typeof webmcpToolNameSchema>;

export const MAX_PROVIDER_TOOLS = 256;

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

export type ContractVersion = z.infer<typeof contractVersionSchema>;

export const invokeKindSchema = z.enum(["object", "json-string"]);

export type InvokeKind = z.infer<typeof invokeKindSchema>;

export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const webmcpAnnotationsSchema = z.object({
  readOnlyHint: z.boolean(),
  untrustedContentHint: z.boolean(),
});

export const normalizedToolDescriptorSchema = z.object({
  providerId: providerIdSchema,
  namespacedName: z.string().min(1).max(193),
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

export const gatewayErrorCodeSchema = z.enum([
  "invalid_arguments",
  "input_too_large",
  "schema_too_large",
  "invalid_schema",
  "output_too_large",
  "provider_tool_limit",
  "unsupported_graph",
  "tool_not_found",
  "tool_not_granted",
  "provider_not_invokable",
  "revalidation_failed",
  "webmcp_unavailable",
  "discovery_timeout",
  "discovery_failed",
  "cancelled",
  "execution_failed",
  "operation_in_progress",
  "workflow_not_prepared",
  "workflow_not_found",
  "missing_env",
  "invalid_entry_url",
  "entry_origin_mismatch",
  "unknown_provider",
  "stale_handle",
  "window_not_found",
]);

export type GatewayErrorCode = z.infer<typeof gatewayErrorCodeSchema>;

export const boundedErrorSchema = z.object({
  status: z.literal("error"),
  code: gatewayErrorCodeSchema,
  message: z.string().min(1).max(280),
});

export type BoundedError<TCode extends GatewayErrorCode = GatewayErrorCode> = {
  status: "error";
  code: TCode;
  message: string;
};

export const boundedSuccessSchema = z.object({
  status: z.literal("success"),
  data: z.unknown(),
});

export type BoundedSuccess<TData = unknown> = {
  status: "success";
  data: TData;
};

export const boundedResultEnvelopeSchema = z.discriminatedUnion("status", [
  boundedSuccessSchema,
  boundedErrorSchema,
]);

export type BoundedResultEnvelope<
  TData = unknown,
  TCode extends GatewayErrorCode = GatewayErrorCode,
> = BoundedSuccess<TData> | BoundedError<TCode>;

export const SHOP_EXPECTED_TOOLS = ["search_products"] as const;

export const SHOP_CONTRACT_VERSION = "1.0.0" satisfies ContractVersion;

export const ACCOUNTS_EXPECTED_TOOLS = ["search_customers"] as const;

export const ACCOUNTS_CONTRACT_VERSION = "1.0.0" satisfies ContractVersion;

export const SUPPORT_EXPECTED_TOOLS = ["search_cases"] as const;

export const SUPPORT_CONTRACT_VERSION = "1.0.0" satisfies ContractVersion;

export const WEBMCP_DISCOVERY_TIMEOUT_MS = 8_000;

export const WEBMCP_DISCOVERY_POLL_MS = 200;

export const WEBMCP_MAX_RESULT_CHARS = 16_384;

export function namespacedToolName<
  const TProvider extends string,
  const TTool extends string,
>(providerId: TProvider, toolName: TTool): `${TProvider}.${TTool}` {
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

export function boundedError<TCode extends GatewayErrorCode>(
  code: TCode,
  message: string,
): BoundedError<TCode> {
  const parsed = boundedErrorSchema.parse({
    status: "error",
    code,
    message,
  });
  return {
    status: "error",
    code: parsed.code as TCode,
    message: parsed.message,
  };
}

export function boundedSuccess<TData>(data: TData): BoundedSuccess<TData> {
  return { status: "success", data };
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
  input: object,
): object | string {
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
