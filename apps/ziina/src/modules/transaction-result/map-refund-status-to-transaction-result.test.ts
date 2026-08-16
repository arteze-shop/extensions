import { describe, expect, it } from "vitest";

import { createZiinaRefundStatus } from "@/modules/ziina/ziina-refund-status";

import { mapRefundStatusToTransactionResult } from "./map-refund-status-to-transaction-result";
import { RefundFailureResult, RefundRequestResult, RefundSuccessResult } from "./refund-result";

describe("mapRefundStatusToTransactionResult", () => {
  it.each([
    { status: "completed", expectedResult: RefundSuccessResult },
    { status: "failed", expectedResult: RefundFailureResult },
    { status: "pending", expectedResult: RefundRequestResult },
  ])(
    "maps Ziina Refund status: $status to transactionResult: $expectedResult.name",
    ({ status, expectedResult }) => {
      const ziinaStatus = createZiinaRefundStatus(status);
      const result = mapRefundStatusToTransactionResult(ziinaStatus);

      expect(result).toBeInstanceOf(expectedResult);
    },
  );
});
