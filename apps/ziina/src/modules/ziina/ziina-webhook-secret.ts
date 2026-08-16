import { fromThrowable } from "neverthrow";
import { z } from "zod";

import { BaseError } from "@/lib/errors";

export const ZiinaWebhookSecretValidationError = BaseError.subclass(
  "ZiinaWebhookSecretValidationError",
  {
    props: {
      _internalName: "ZiinaWebhookSecretValidationError" as const,
    },
  },
);

export const ZiinaWebhookSecretSchema = z.string().min(1).brand("ZiinaWebhookSecret");

export const createZiinaWebhookSecret = (raw: string | null) =>
  fromThrowable(ZiinaWebhookSecretSchema.parse, (error) =>
    ZiinaWebhookSecretValidationError.normalize(error),
  )(raw);

export type ZiinaWebhookSecret = z.infer<typeof ZiinaWebhookSecretSchema>;
