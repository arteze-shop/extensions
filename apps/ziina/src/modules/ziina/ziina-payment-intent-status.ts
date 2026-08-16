import { z } from "zod";

const ZiinaPaymentIntentStatusSchema = z
  .enum([
    "requires_payment_instrument",
    "requires_user_action",
    "pending",
    "completed",
    "failed",
    "canceled",
  ])
  .brand("ZiinaPaymentIntentStatus");

export const createZiinaPaymentIntentStatus = (raw: string) =>
  ZiinaPaymentIntentStatusSchema.parse(raw);

export type ZiinaPaymentIntentStatus = z.infer<typeof ZiinaPaymentIntentStatusSchema>;
