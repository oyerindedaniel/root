import { z } from "zod";

export const WEBMCP_PRESENTATION_CANCEL_TYPE =
  "webmcp/presentation-cancel" as const;

export const presentationCancelMessageSchema = z.object({
  type: z.literal(WEBMCP_PRESENTATION_CANCEL_TYPE),
});

export type PresentationCancelMessage = z.infer<
  typeof presentationCancelMessageSchema
>;

export function presentationCancelMessage(): PresentationCancelMessage {
  return { type: WEBMCP_PRESENTATION_CANCEL_TYPE };
}

export function parsePresentationCancelMessage(
  data: unknown,
  origin: string,
  expectedOrigin: string,
): boolean {
  return (
    origin === expectedOrigin &&
    presentationCancelMessageSchema.safeParse(data).success
  );
}
