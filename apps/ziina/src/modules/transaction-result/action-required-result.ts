import { type Actions } from "@/generated/app-webhooks-types/transaction-initialize-session";
import { BaseError } from "@/lib/errors";
import { type ZiinaPaymentIntentStatus } from "@/modules/ziina/ziina-payment-intent-status";

export class ChargeActionRequiredResult {
  readonly result = "CHARGE_ACTION_REQUIRED" as const;
  readonly actions: Actions = ["CANCEL"];

  readonly message: string;

  private getMessageFromZiinaStatus(ziinaStatus: ZiinaPaymentIntentStatus) {
    switch (ziinaStatus) {
      case "requires_user_action":
        return "Payment intent requires action";
      case "requires_payment_instrument":
        return "Payment intent requires payment instrument";
      case "pending":
        return "Payment intent is pending";
      case "canceled":
        return "Payment intent was canceled";
      default:
        throw new BaseError(
          `Payment intent status ${ziinaStatus} is not supported for CHARGE_ACTION_REQUIRED transaction flow`,
        );
    }
  }

  constructor(ziinaStatus: ZiinaPaymentIntentStatus) {
    this.message = this.getMessageFromZiinaStatus(ziinaStatus);
  }
}
