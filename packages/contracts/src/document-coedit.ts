import { z } from "zod";

export const WEBMCP_COEDIT_TYPE = "webmcp/coedit" as const;

export const coeditMessageSchema = z.object({
  type: z.literal(WEBMCP_COEDIT_TYPE),
  open: z.boolean(),
});

export type CoeditMessage = z.infer<typeof coeditMessageSchema>;

export function coeditMessage(open: boolean): CoeditMessage {
  return {
    type: WEBMCP_COEDIT_TYPE,
    open,
  };
}

export function parseCoeditMessage(
  data: unknown,
  origin: string,
  expectedOrigin: string,
): boolean | null {
  if (origin !== expectedOrigin) {
    return null;
  }
  const parsed = coeditMessageSchema.safeParse(data);
  if (!parsed.success) {
    return null;
  }
  return parsed.data.open;
}
