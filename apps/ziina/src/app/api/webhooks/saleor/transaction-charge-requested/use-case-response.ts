import { SuccessWebhookResponse } from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import {
  type TransactionChargeRequestedAsync,
  type TransactionChargeRequestedSyncFailure,
  type TransactionChargeRequestedSyncSuccess,
} from "@/generated/app-webhooks-types/transaction-charge-requested";
import { type AppContext } from "@/lib/app-context";
import { BaseError } from "@/lib/errors";
import { type SaleorMoney } from "@/modules/saleor/saleor-money";
import { ChargeActionRequiredResult } from "@/modules/transaction-result/action-required-result";
import { type ChargeFailureResult } from "@/modules/transaction-result/failure-result";
import { type ChargeSuccessResult } from "@/modules/transaction-result/success-result";
import { type ZiinaApiError } from "@/modules/ziina/ziina-api-error";
import { type ZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";

class Success extends SuccessWebhookResponse {
  readonly transactionResult: ChargeSuccessResult | ChargeActionRequiredResult;
  readonly saleorMoney: SaleorMoney;
  readonly ziinaPaymentIntentId: ZiinaPaymentIntentId;

  constructor(args: {
    transactionResult: ChargeSuccessResult | ChargeActionRequiredResult;
    saleorMoney: SaleorMoney;
    ziinaPaymentIntentId: ZiinaPaymentIntentId;
    appContext: AppContext;
  }) {
    super(args.appContext);
    this.transactionResult = args.transactionResult;
    this.saleorMoney = args.saleorMoney;
    this.ziinaPaymentIntentId = args.ziinaPaymentIntentId;
  }

  getResponse(): Response {
    if (!this.appContext.ziinaEnv) {
      throw new BaseError("Ziina environment is not set. Ensure AppContext is set earlier");
    }

    if (this.transactionResult instanceof ChargeActionRequiredResult) {
      /*
       * Ziina payment intents are charged asynchronously. When the intent is still pending,
       * app returns async flow and reports the final status via Ziina webhooks.
       */
      const typeSafeResponse: TransactionChargeRequestedAsync = {
        pspReference: this.ziinaPaymentIntentId,
        actions: ["CHARGE"],
      };

      return Response.json(typeSafeResponse, { status: this.statusCode });
    }

    const typeSafeResponse: TransactionChargeRequestedSyncSuccess = {
      result: this.transactionResult.result,
      amount: this.saleorMoney.amount,
      pspReference: this.ziinaPaymentIntentId,
      message: this.messageFormatter.formatMessage(this.transactionResult.message),
      actions: this.transactionResult.actions,
    };

    return Response.json(typeSafeResponse, { status: this.statusCode });
  }
}

class Failure extends SuccessWebhookResponse {
  readonly transactionResult: ChargeFailureResult;
  readonly error: ZiinaApiError;
  readonly ziinaPaymentIntentId: ZiinaPaymentIntentId;

  constructor(args: {
    error: ZiinaApiError;
    transactionResult: ChargeFailureResult;
    ziinaPaymentIntentId: ZiinaPaymentIntentId;
    appContext: AppContext;
  }) {
    super(args.appContext);
    this.error = args.error;
    this.transactionResult = args.transactionResult;
    this.ziinaPaymentIntentId = args.ziinaPaymentIntentId;
  }

  getResponse(): Response {
    if (!this.appContext.ziinaEnv) {
      throw new BaseError("Ziina environment is not set. Ensure AppContext is set earlier");
    }

    const typeSafeResponse: TransactionChargeRequestedSyncFailure = {
      result: this.transactionResult.result,
      pspReference: this.ziinaPaymentIntentId,
      message: this.messageFormatter.formatMessage(this.transactionResult.message, this.error),
      actions: this.transactionResult.actions,
    };

    return Response.json(typeSafeResponse, { status: this.statusCode });
  }
}

export const TransactionChargeRequestedUseCaseResponses = {
  Success,
  Failure,
};

export type TransactionChargeRequestedUseCaseResponsesType = InstanceType<
  | typeof TransactionChargeRequestedUseCaseResponses.Success
  | typeof TransactionChargeRequestedUseCaseResponses.Failure
>;
