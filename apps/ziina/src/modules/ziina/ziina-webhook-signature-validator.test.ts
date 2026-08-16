import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { createZiinaWebhookSecret } from "@/modules/ziina/ziina-webhook-secret";
import {
  verifyZiinaWebhookSignature,
  ZiinaWebhookParsingError,
} from "@/modules/ziina/ziina-webhook-signature-validator";

const webhookSecret = createZiinaWebhookSecret("mysecret")._unsafeUnwrap();
const rawBody = "hello world";

/**
 * Known value - independent computation of the SHA-256 HMAC of the raw body
 */
const knownSignature = crypto.createHmac("sha256", "mysecret").update("hello world").digest("hex");

describe("verifyZiinaWebhookSignature", () => {
  it("returns ok for a valid signature", () => {
    const result = verifyZiinaWebhookSignature({
      rawBody,
      signatureHeader: knownSignature,
      webhookSecret,
    });

    expect(result.isOk()).toBe(true);
  });

  it("returns err when the signature header is missing", () => {
    const result = verifyZiinaWebhookSignature({
      rawBody,
      signatureHeader: null,
      webhookSecret,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ZiinaWebhookParsingError);
  });

  it("returns err when the signature header is empty", () => {
    const result = verifyZiinaWebhookSignature({
      rawBody,
      signatureHeader: "",
      webhookSecret,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ZiinaWebhookParsingError);
  });

  it("returns err when the signature does not match", () => {
    const result = verifyZiinaWebhookSignature({
      rawBody,
      signatureHeader: "deadbeef",
      webhookSecret,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ZiinaWebhookParsingError);
  });

  it("returns err when the signature is for a different body", () => {
    const signatureForDifferentBody = crypto
      .createHmac("sha256", "mysecret")
      .update("other body")
      .digest("hex");

    const result = verifyZiinaWebhookSignature({
      rawBody,
      signatureHeader: signatureForDifferentBody,
      webhookSecret,
    });

    expect(result.isErr()).toBe(true);
  });

  it("returns err when the signature was signed with a different secret", () => {
    const signatureWithDifferentSecret = crypto
      .createHmac("sha256", "othersecret")
      .update("hello world")
      .digest("hex");

    const result = verifyZiinaWebhookSignature({
      rawBody,
      signatureHeader: signatureWithDifferentSecret,
      webhookSecret,
    });

    expect(result.isErr()).toBe(true);
  });
});
