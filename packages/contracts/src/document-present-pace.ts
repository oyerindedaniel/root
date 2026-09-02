import { z } from "zod";

export const WEBMCP_PRESENT_PACE_TYPE = "webmcp/present-pace" as const;

export const presentPaceNameSchema = z.enum(["slow", "default", "fast"]);

export type PresentPaceName = z.infer<typeof presentPaceNameSchema>;

export const presentPaceSchema = z.object({
  fill: presentPaceNameSchema.default("default"),
  preview: presentPaceNameSchema.default("default"),
});

export type PresentPace = z.infer<typeof presentPaceSchema>;

export const DEFAULT_PRESENT_PACE: PresentPace = {
  fill: "default",
  preview: "default",
};

export const presentPaceMessageSchema = z.object({
  type: z.literal(WEBMCP_PRESENT_PACE_TYPE),
  fill: presentPaceNameSchema,
  preview: presentPaceNameSchema,
});

export type PresentPaceMessage = z.infer<typeof presentPaceMessageSchema>;

export function presentPaceMessage(pace: PresentPace): PresentPaceMessage {
  return {
    type: WEBMCP_PRESENT_PACE_TYPE,
    fill: pace.fill,
    preview: pace.preview,
  };
}

export function parsePresentPaceMessage(
  data: unknown,
  origin: string,
  expectedOrigin: string,
): PresentPace | null {
  if (origin !== expectedOrigin) {
    return null;
  }
  const parsed = presentPaceMessageSchema.safeParse(data);
  if (!parsed.success) {
    return null;
  }
  return {
    fill: parsed.data.fill,
    preview: parsed.data.preview,
  };
}
