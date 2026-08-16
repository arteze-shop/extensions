import { type Result } from "neverthrow";

import { assertUnreachable } from "@/lib/assert-unreachable";
import { createZiinaPaymentIntentStatus } from "@/modules/ziina/ziina-payment-intent-status";

import { SaleorMoney } from "./saleor-money";

export const resolveSaleorMoneyFromZiinaPaymentIntent = (paymentIntent: {
  amount: number;
  currency_code: string;
  status: string;
}): Result<SaleorMoney, InstanceType<typeof SaleorMoney.ValidationError>> => {
  const ziinaPaymentIntentStatus = createZiinaPaymentIntentStatus(paymentIntent.status);

  switch (ziinaPaymentIntentStatus) {
    case "canceled":
    case "failed":
    case "pending":
    case "requires_payment_instrument":
    case "requires_user_action":
    case "completed":
      // Ziina reports the full amount charged for the intent - there is no partial capture
      return SaleorMoney.createFromZiina({
        amount: paymentIntent.amount,
        currency: paymentIntent.currency_code,
      });
    default:
      return assertUnreachable(ziinaPaymentIntentStatus);
  }
};
