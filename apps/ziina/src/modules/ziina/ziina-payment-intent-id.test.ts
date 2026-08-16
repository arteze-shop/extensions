import { describe, expect, it } from "vitest";

import { createZiinaPaymentIntentId, type ZiinaPaymentIntentId } from "./ziina-payment-intent-id";

describe("createZiinaPaymentIntentId", () => {
  it("should successfully create Ziina payment intent id when valid", () => {
    const result = createZiinaPaymentIntentId("ziina_pi_valid123");

    expect(result).toBe("ziina_pi_valid123");
  });

  it("should throw when payment intent id is empty", () => {
    expect(() => createZiinaPaymentIntentId("")).toThrowError();
  });

  it("should NOT throw when payment intent id does not start with a prefix", () => {
    expect(() => createZiinaPaymentIntentId("valid123")).not.toThrow();
  });

  it("shouldn't be assignable without createZiinaPaymentIntentId", () => {
    const fn = (v: ZiinaPaymentIntentId) => v;

    // @ts-expect-error - if this fails - it means the type is not branded
    fn("");

    expect(() => fn(createZiinaPaymentIntentId("valid123"))).not.toThrow();
  });
});
