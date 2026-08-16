import { SuccessWebhookResponse } from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import {
  type TransactionCancelationRequestedSyncFailure,
  type TransactionCancelationRequestedSyncSuccess,
} from "@/generated/app-webhooks-types/transaction-cancelation-requested";
import { type AppContext } from "@/lib/app-context";
import { BaseError } from "@/lib/errors";
import { type SaleorMoney } from "@/modules/saleor/saleor-money";
import {
  type CancelFailureResult,
  type CancelSuccessResult,
} from "@/modules/transaction-result/cancel-result";
import { type ZiinaApiError } from "@/modules/ziina/ziina-api-error";
import { type ZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";

class Success extends SuccessWebhookResponse {
  readonly transactionResult: CancelSuccessResult;
  readonly saleorMoney: SaleorMoney;
  readonly ziinaPaymentIntentId: ZiinaPaymentIntentId;

  constructor(args: {
    transactionResult: CancelSuccessResult;
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

    const typeSafeResponse: TransactionCancelationRequestedSyncSuccess = {
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
  readonly transactionResult: CancelFailureResult;
  readonly error: ZiinaApiError | null;
  readonly ziinaPaymentIntentId: ZiinaPaymentIntentId;

  constructor(args: {
    transactionResult: CancelFailureResult;
    error: ZiinaApiError | null;
    ziinaPaymentIntentId: ZiinaPaymentIntentId;
    appContext: AppContext;
  }) {
    super(args.appContext);
    this.transactionResult = args.transactionResult;
    this.error = args.error;
    this.ziinaPaymentIntentId = args.ziinaPaymentIntentId;
  }

  getResponse(): Response {
    if (!this.appContext.ziinaEnv) {
      throw new BaseError("Ziina environment is not set. Ensure AppContext is set earlier");
    }

    const typeSafeResponse: TransactionCancelationRequestedSyncFailure = {
      result: this.transactionResult.result,
      pspReference: this.ziinaPaymentIntentId,
      message: this.messageFormatter.formatMessage(
        this.transactionResult.message,
        this.error ?? undefined,
      ),
      actions: this.transactionResult.actions,
    };

    return Response.json(typeSafeResponse, { status: this.statusCode });
  }
}

export const TransactionCancelationRequestedUseCaseResponses = {
  Success,
  Failure,
};

export type TransactionCancelationRequestedUseCaseResponsesType = InstanceType<
  | typeof TransactionCancelationRequestedUseCaseResponses.Success
  | typeof TransactionCancelationRequestedUseCaseResponses.Failure
>;
