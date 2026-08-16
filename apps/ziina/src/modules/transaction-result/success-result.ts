import { type Actions } from "@/generated/app-webhooks-types/transaction-charge-requested";

export class ChargeSuccessResult {
  readonly result = "CHARGE_SUCCESS" as const;
  readonly actions: Actions = ["REFUND"];
  readonly message = "Payment intent has been successful";
}
