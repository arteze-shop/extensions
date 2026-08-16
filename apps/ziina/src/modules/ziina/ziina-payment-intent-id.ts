import { z } from "zod";

import { BaseError } from "@/lib/errors";

export const ZiinaPaymentIntentValidationError = BaseError.subclass(
  "ZiinaPaymentIntentValidationError",
  {
    props: {
      _internalName: "ZiinaPaymentIntentValidationError" as const,
    },
  },
);

const ZiinaPaymentIntentIdSchema = z
  .string({
    required_error: "Payment intent id is required",
  })
  .min(1)
  .brand("ZiinaPaymentIntentId");

export const createZiinaPaymentIntentId = (raw: string) => ZiinaPaymentIntentIdSchema.parse(raw);

export type ZiinaPaymentIntentId = z.infer<typeof ZiinaPaymentIntentIdSchema>;
