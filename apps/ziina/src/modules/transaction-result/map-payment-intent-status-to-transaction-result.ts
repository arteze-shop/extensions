import { assertUnreachable } from "@/lib/assert-unreachable";
import { type ZiinaPaymentIntentStatus } from "@/modules/ziina/ziina-payment-intent-status";

import { ChargeActionRequiredResult } from "./action-required-result";
import { ChargeFailureResult } from "./failure-result";
import { ChargeSuccessResult } from "./success-result";

export const mapPaymentIntentStatusToTransactionResult = (
  ziinaPaymentIntentStatus: ZiinaPaymentIntentStatus,
): ChargeSuccessResult | ChargeActionRequiredResult | ChargeFailureResult => {
  switch (ziinaPaymentIntentStatus) {
    case "completed":
      return new ChargeSuccessResult();
    case "requires_payment_instrument":
    case "requires_user_action":
    case "pending":
    case "canceled":
      return new ChargeActionRequiredResult(ziinaPaymentIntentStatus);
    case "failed":
      return new ChargeFailureResult();
    default:
      assertUnreachable(ziinaPaymentIntentStatus);
  }
};
