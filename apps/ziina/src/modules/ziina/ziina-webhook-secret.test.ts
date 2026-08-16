import { describe, expect, it } from "vitest";

import {
  createZiinaWebhookSecret,
  type ZiinaWebhookSecret,
  ZiinaWebhookSecretValidationError,
} from "./ziina-webhook-secret";

describe("ZiinaWebhookSecret", () => {
  it("Creates from valid string", () => {
    const brandedString = createZiinaWebhookSecret("ziina_whsec_XYZ")._unsafeUnwrap();

    expect(brandedString).toStrictEqual("ziina_whsec_XYZ");
  });

  it("Throws if empty value passed", () => {
    expect(createZiinaWebhookSecret("")._unsafeUnwrapErr()).toBeInstanceOf(
      ZiinaWebhookSecretValidationError,
    );
  });

  it("Throws if null passed", () => {
    expect(createZiinaWebhookSecret(null)._unsafeUnwrapErr()).toBeInstanceOf(
      ZiinaWebhookSecretValidationError,
    );
  });

  it("Nominal typing works", () => {
    const fn = (v: ZiinaWebhookSecret) => v;

    // @ts-expect-error - should be error, only string must be accepted
    fn("ziina_whsec_XXX");

    expect(() => fn(createZiinaWebhookSecret("ziina_whsec_XXX")._unsafeUnwrap())).not.toThrow();
  });
});
