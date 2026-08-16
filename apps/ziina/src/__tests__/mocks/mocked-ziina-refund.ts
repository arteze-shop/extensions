import { type ZiinaRefund } from "@/modules/ziina/types";
import { createZiinaRefundStatus } from "@/modules/ziina/ziina-refund-status";

export const mockedZiinaRefund: ZiinaRefund = {
  id: "ziina_refund_test",
  payment_intent_id: "ziina_payment_intent_test",
  amount: 200,
  currency_code: "AED",
  status: createZiinaRefundStatus("pending"),
  created_at: "1700000000000",
};
