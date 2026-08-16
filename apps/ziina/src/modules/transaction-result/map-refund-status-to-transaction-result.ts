import { assertUnreachable } from "@/lib/assert-unreachable";
import { type ZiinaRefundStatus } from "@/modules/ziina/ziina-refund-status";

import { RefundFailureResult, RefundRequestResult, RefundSuccessResult } from "./refund-result";

export const mapRefundStatusToTransactionResult = (
  ziinaRefundStatus: ZiinaRefundStatus,
): RefundRequestResult | RefundSuccessResult | RefundFailureResult => {
  switch (ziinaRefundStatus) {
    case "completed":
      return new RefundSuccessResult();
    case "pending":
      return new RefundRequestResult();
    case "failed":
      return new RefundFailureResult();
    default:
      assertUnreachable(ziinaRefundStatus);
  }
};
