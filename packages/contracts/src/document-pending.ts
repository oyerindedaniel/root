import { z } from "zod";

export const WEBMCP_PENDING_HUMAN_TYPE = "webmcp/pending-human" as const;
export const WEBMCP_SELECTION_MODE_TYPE = "webmcp/selection-mode" as const;

export const PENDING_HUMAN_TIMEOUT_MS = 5 * 60_000;

export const pendingHumanMessageSchema = z.object({
  type: z.literal(WEBMCP_PENDING_HUMAN_TYPE),
  open: z.boolean(),
});

export type PendingHumanMessage = z.infer<typeof pendingHumanMessageSchema>;

export const selectionModeSchema = z.enum(["manual", "auto"]);

export type SelectionMode = z.infer<typeof selectionModeSchema>;

export const selectionModeMessageSchema = z.object({
  type: z.literal(WEBMCP_SELECTION_MODE_TYPE),
  selectionMode: selectionModeSchema,
});

export type SelectionModeMessage = z.infer<typeof selectionModeMessageSchema>;

export function pendingHumanMessage(open: boolean): PendingHumanMessage {
  return {
    type: WEBMCP_PENDING_HUMAN_TYPE,
    open,
  };
}

export function selectionModeMessage(
  selectionMode: SelectionMode,
): SelectionModeMessage {
  return { type: WEBMCP_SELECTION_MODE_TYPE, selectionMode };
}

export function parseSelectionModeMessage(
  data: unknown,
  origin: string,
  expectedOrigin: string,
): SelectionMode | null {
  if (origin !== expectedOrigin) {
    return null;
  }
  const parsed = selectionModeMessageSchema.safeParse(data);
  return parsed.success ? parsed.data.selectionMode : null;
}

export function parsePendingHumanMessage(
  data: unknown,
  origin: string,
  expectedOrigin: string,
): boolean | null {
  if (origin !== expectedOrigin) {
    return null;
  }
  const parsed = pendingHumanMessageSchema.safeParse(data);
  if (!parsed.success) {
    return null;
  }
  return parsed.data.open;
}
