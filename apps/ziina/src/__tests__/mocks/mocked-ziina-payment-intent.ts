import { type ZiinaPaymentIntent } from "@/modules/ziina/types";
import { createZiinaPaymentIntentStatus } from "@/modules/ziina/ziina-payment-intent-status";

export const mockedZiinaPaymentIntent: ZiinaPaymentIntent = {
  id: "ziina_payment_intent_test",
  account_id: "acct_test",
  amount: 200,
  tip_amount: 0,
  fee_amount: 0,
  currency_code: "AED",
  created_at: "1700000000000",
  status: createZiinaPaymentIntentStatus("requires_payment_instrument"),
  operation_id: "operation-id",
  message: "Test payment",
  redirect_url: "https://pay.ziina.com/test",
  embedded_url: "https://pay.ziina.com/embedded/test",
  success_url: "https://example.com/success",
  cancel_url: "https://example.com/cancel",
};
