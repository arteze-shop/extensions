import { describe, expect, it } from "vitest";

import { createZiinaPaymentIntentStatus } from "@/modules/ziina/ziina-payment-intent-status";

import { ChargeActionRequiredResult } from "./action-required-result";

describe("ChargeActionRequiredResult", () => {
  it.each([
    {
      ziinaStatus: "requires_user_action",
      expectedMessage: "Payment intent requires action",
    },
    {
      ziinaStatus: "requires_payment_instrument",
      expectedMessage: "Payment intent requires payment instrument",
    },
    {
      ziinaStatus: "pending",
      expectedMessage: "Payment intent is pending",
    },
    {
      ziinaStatus: "canceled",
      expectedMessage: "Payment intent was canceled",
    },
  ])(
    "should create instance with message: $expectedMessage for Ziina status:$ziinaStatus",
    ({ ziinaStatus, expectedMessage }) => {
      const result = new ChargeActionRequiredResult(createZiinaPaymentIntentStatus(ziinaStatus));

      expect(result.message).toBe(expectedMessage);
    },
  );

  it.each(["completed", "failed"])(
    "should throw error for unsupported status: %s",
    (ziinaStatus) => {
      expect(() => {
        new ChargeActionRequiredResult(createZiinaPaymentIntentStatus(ziinaStatus));
      }).toThrow(
        `Payment intent status ${ziinaStatus} is not supported for CHARGE_ACTION_REQUIRED transaction flow`,
      );
    },
  );
});
