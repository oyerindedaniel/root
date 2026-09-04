import { z } from "zod";

export const WEBMCP_DOCUMENT_TOOL_GRANTS_TYPE =
  "webmcp/document-tool-grants" as const;

export const documentToolGrantsMessageSchema = z.object({
  type: z.literal(WEBMCP_DOCUMENT_TOOL_GRANTS_TYPE),
  tools: z.array(z.string().min(1).max(128)).max(256),
});

export type DocumentToolGrantsMessage = z.infer<
  typeof documentToolGrantsMessageSchema
>;

export function documentToolGrantsMessage(
  tools: readonly string[],
): DocumentToolGrantsMessage {
  return { type: WEBMCP_DOCUMENT_TOOL_GRANTS_TYPE, tools: [...tools] };
}

export function parseDocumentToolGrantsMessage(
  data: unknown,
  origin: string,
  expectedOrigin: string,
): readonly string[] | null {
  if (origin !== expectedOrigin) {
    return null;
  }
  const parsed = documentToolGrantsMessageSchema.safeParse(data);
  return parsed.success ? parsed.data.tools : null;
}

export function createDocumentToolGrantGate(expectedOrigin: string) {
  let granted = new Set<string>();

  function applyMessage(data: unknown, origin: string) {
    const tools = parseDocumentToolGrantsMessage(
      data,
      origin,
      expectedOrigin,
    );
    if (tools) {
      granted = new Set(tools);
    }
  }

  function requireGranted(tool: string) {
    if (!granted.has(tool)) {
      throw new Error("This tool has not been granted by the user.");
    }
  }

  function listen(target: Window = window) {
    const onMessage = (event: MessageEvent) => {
      applyMessage(event.data, event.origin);
    };
    target.addEventListener("message", onMessage);
    return () => target.removeEventListener("message", onMessage);
  }

  function guard<Args extends unknown[], Result>(
    tool: string,
    execute: (...args: Args) => Result,
  ): (...args: Args) => Result {
    return (...args: Args) => {
      requireGranted(tool);
      return execute(...args);
    };
  }

  return {
    applyMessage,
    requireGranted,
    listen,
    guard,
    has(tool: string) {
      return granted.has(tool);
    },
  };
}
