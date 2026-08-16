import { fromThrowable } from "neverthrow";
import { z } from "zod";

import { BaseError } from "@/lib/errors";

export const ZiinaRestrictedKeyValidationError = BaseError.subclass(
  "ZiinaRestrictedKeyValidationError",
  {
    props: {
      _internalName: "ZiinaRestrictedKeyValidationError" as const,
    },
  },
);

export const ZiinaRestrictedKeySchema = z.string().min(1).brand("ZiinaRestrictedKey");

export const createZiinaRestrictedKey = (raw: string | null) =>
  fromThrowable(ZiinaRestrictedKeySchema.parse, (error) =>
    ZiinaRestrictedKeyValidationError.normalize(error),
  )(raw);

export type ZiinaRestrictedKey = z.infer<typeof ZiinaRestrictedKeySchema>;
