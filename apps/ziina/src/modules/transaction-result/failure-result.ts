import { type Actions } from "@/generated/app-webhooks-types/transaction-charge-requested";

export class ChargeFailureResult {
  readonly result = "CHARGE_FAILURE" as const;
  readonly actions: Actions = ["CHARGE"];
  readonly message = "Payment intent failed";
}
