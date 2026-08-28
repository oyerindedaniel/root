import { z } from "zod";

export const healthStatusSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("root-api"),
  timestamp: z.iso.datetime(),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
