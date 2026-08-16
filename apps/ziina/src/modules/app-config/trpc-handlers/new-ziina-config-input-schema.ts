import { z } from "zod";

export const newZiinaConfigInputSchema = z.object({
  name: z.string().min(1),
  accessToken: z.string().min(1),
  ziinaEnv: z.enum(["TEST", "LIVE"]),
});

export type NewZiinaConfigInput = z.infer<typeof newZiinaConfigInputSchema>;
