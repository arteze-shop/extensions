import { SuccessWebhookResponse } from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import {
  type TransactionRefundRequestedAsync,
  type TransactionRefundRequestedSyncFailure,
} from "@/generated/app-webhooks-types/transaction-refund-requested";
import { type AppContext } from "@/lib/app-context";
import { BaseError } from "@/lib/errors";
import { type RefundFailureResult } from "@/modules/transaction-result/refund-result";
import { type ZiinaApiError } from "@/modules/ziina/ziina-api-error";
import { type ZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";
import { type ZiinaRefundId } from "@/modules/ziina/ziina-refund-id";

class Success extends SuccessWebhookResponse {
  readonly ziinaRefundId: ZiinaRefundId;
  readonly message: string = "";

  constructor(args: { ziinaRefundId: ZiinaRefundId; appContext: AppContext }) {
    super(args.appContext);
    this.ziinaRefundId = args.ziinaRefundId;
  }

  getResponse(): Response {
    /*
     * We are using async flow here as currently Saleor doesn't allow `REFUND_REQUEST` to be returned in `TRANSACTION_REFUND_REQUESTED` webhook response. App will report actual refund status when handling Ziina webhook.
     * https://docs.saleor.io/developer/extending/webhooks/synchronous-events/transaction#async-flow-2
     */
    const typeSafeResponse: TransactionRefundRequestedAsync = {
      pspReference: this.ziinaRefundId,
      actions: [],
    };

    return Response.json(typeSafeResponse, { status: this.statusCode });
  }
}

class Failure extends SuccessWebhookResponse {
  readonly transactionResult: RefundFailureResult;
  readonly error: ZiinaApiError;
  readonly ziinaPaymentIntentId: ZiinaPaymentIntentId;
  readonly message: string;

  constructor(args: {
    transactionResult: RefundFailureResult;
    error: ZiinaApiError;
    ziinaPaymentIntentId: ZiinaPaymentIntentId;
    appContext: AppContext;
  }) {
    super(args.appContext);
    this.transactionResult = args.transactionResult;
    this.error = args.error;
    this.ziinaPaymentIntentId = args.ziinaPaymentIntentId;
    this.message = this.error.merchantMessage;
  }

  getResponse(): Response {
    if (!this.appContext.ziinaEnv) {
      throw new BaseError("Ziina environment is not set. Ensure AppContext is set earlier");
    }

    const typeSafeResponse: TransactionRefundRequestedSyncFailure = {
      result: this.transactionResult.result,
      pspReference: this.ziinaPaymentIntentId,
      message: this.messageFormatter.formatMessage(this.message, this.error),
      actions: this.transactionResult.actions,
    };

    return Response.json(typeSafeResponse, { status: this.statusCode });
  }
}

export const TransactionRefundRequestedUseCaseResponses = {
  Success,
  Failure,
};

export type TransactionRefundRequestedUseCaseResponsesType = InstanceType<
  | typeof TransactionRefundRequestedUseCaseResponses.Success
  | typeof TransactionRefundRequestedUseCaseResponses.Failure
>;
