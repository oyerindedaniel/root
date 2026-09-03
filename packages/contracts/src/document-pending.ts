import { z } from "zod";

export const WEBMCP_PENDING_HUMAN_TYPE = "webmcp/pending-human" as const;

export const PENDING_HUMAN_TIMEOUT_MS = 5 * 60_000;

export const pendingHumanMessageSchema = z.object({
  type: z.literal(WEBMCP_PENDING_HUMAN_TYPE),
  open: z.boolean(),
});

export type PendingHumanMessage = z.infer<typeof pendingHumanMessageSchema>;


export function pendingHumanMessage(open: boolean): PendingHumanMessage {
  return {
    type: WEBMCP_PENDING_HUMAN_TYPE,
    open,
  };
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
