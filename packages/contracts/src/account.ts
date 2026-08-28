import { z } from "zod";

export const accountSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  name: z.string().min(1),
});

export type Account = z.infer<typeof accountSchema>;
