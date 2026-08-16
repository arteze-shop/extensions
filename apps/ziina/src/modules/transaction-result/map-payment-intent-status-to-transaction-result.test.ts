import { describe, expect, it } from "vitest";

import { createZiinaPaymentIntentStatus } from "@/modules/ziina/ziina-payment-intent-status";

import { ChargeActionRequiredResult } from "./action-required-result";
import { ChargeFailureResult } from "./failure-result";
import { mapPaymentIntentStatusToTransactionResult } from "./map-payment-intent-status-to-transaction-result";
import { ChargeSuccessResult } from "./success-result";

describe("mapPaymentIntentStatusToTransactionResult", () => {
  it.each([
    {
      status: "completed",
      expectedResult: ChargeSuccessResult,
    },
    {
      status: "requires_payment_instrument",
      expectedResult: ChargeActionRequiredResult,
    },
    {
      status: "requires_user_action",
      expectedResult: ChargeActionRequiredResult,
    },
    {
      status: "pending",
      expectedResult: ChargeActionRequiredResult,
    },
    {
      status: "canceled",
      expectedResult: ChargeActionRequiredResult,
    },
    {
      status: "failed",
      expectedResult: ChargeFailureResult,
    },
  ])(
    "maps Ziina PaymentIntent status: $status to transactionResult: $expectedResult.name",
    ({ status, expectedResult }) => {
      const ziinaStatus = createZiinaPaymentIntentStatus(status);
      const result = mapPaymentIntentStatusToTransactionResult(ziinaStatus);

      expect(result).toBeInstanceOf(expectedResult);
    },
  );
});
