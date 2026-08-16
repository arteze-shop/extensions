import { z } from "zod";

const ZiinaRefundStatusSchema = z
  .enum(["pending", "completed", "failed"])
  .brand("ZiinaRefundStatus");

export const createZiinaRefundStatus = (raw: string) => ZiinaRefundStatusSchema.parse(raw);

export type ZiinaRefundStatus = z.infer<typeof ZiinaRefundStatusSchema>;
