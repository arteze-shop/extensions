import crypto from "node:crypto";

import { err, ok, type Result } from "neverthrow";

import { BaseError } from "@/lib/errors";

import { type ZiinaWebhookSecret } from "./ziina-webhook-secret";

export const ZiinaWebhookParsingError = BaseError.subclass("ZiinaWebhookParsingError", {
  props: {
    _internalName: "ZiinaWebhookParsingError" as const,
  },
});

/**
 * Verifies the `X-Hmac-Signature` header - a hexadecimal encoded SHA-256
 * HMAC of the request body, signed with the configured webhook secret.
 */
export const verifyZiinaWebhookSignature = (args: {
  rawBody: string;
  signatureHeader: string | null;
  webhookSecret: ZiinaWebhookSecret;
}): Result<null, InstanceType<typeof ZiinaWebhookParsingError>> => {
  const { rawBody, signatureHeader, webhookSecret } = args;

  if (!signatureHeader) {
    return err(new ZiinaWebhookParsingError("Missing X-Hmac-Signature header"));
  }

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const receivedBuffer = Buffer.from(signatureHeader, "utf8");

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return err(new ZiinaWebhookParsingError("Failed to validate Ziina webhook signature"));
  }

  return ok(null);
};
