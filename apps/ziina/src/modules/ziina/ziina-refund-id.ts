import { z } from "zod";

const ZiinaRefundIdSchema = z
  .string({
    required_error: "Refund id is required",
  })
  .min(1)
  .brand("ZiinaRefundId");

export const createZiinaRefundId = (raw: string) => ZiinaRefundIdSchema.parse(raw);

export type ZiinaRefundId = z.infer<typeof ZiinaRefundIdSchema>;
