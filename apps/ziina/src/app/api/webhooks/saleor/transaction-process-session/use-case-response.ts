import { z } from "zod";

import { createFailureWebhookResponseDataSchema } from "@/app/api/webhooks/saleor/saleor-webhook-response-schema";
import { SuccessWebhookResponse } from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import {
  type TransactionSessionActionRequired,
  type TransactionSessionFailure,
  type TransactionSessionSuccess,
} from "@/generated/app-webhooks-types/transaction-process-session";
import { type AppContext } from "@/lib/app-context";
import { BaseError } from "@/lib/errors";
import { type SaleorMoney } from "@/modules/saleor/saleor-money";
import { type ChargeActionRequiredResult } from "@/modules/transaction-result/action-required-result";
import { type ChargeFailureResult } from "@/modules/transaction-result/failure-result";
import { type ChargeRequestResult } from "@/modules/transaction-result/request-result";
import { type ChargeSuccessResult } from "@/modules/transaction-result/success-result";
import { type ZiinaApiError, ZiinaApiErrorPublicCode } from "@/modules/ziina/ziina-api-error";
import { type ZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";

type TransactionResult = ChargeSuccessResult | ChargeActionRequiredResult | ChargeRequestResult;

class Success extends SuccessWebhookResponse {
  readonly transactionResult: TransactionResult;
  readonly saleorMoney: SaleorMoney;
  readonly ziinaPaymentIntentId: ZiinaPaymentIntentId;

  constructor(args: {
    transactionResult: TransactionResult;
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

    const typeSafeResponse: TransactionSessionSuccess | TransactionSessionActionRequired = {
      result: this.transactionResult.result,
      amount: this.saleorMoney.amount,
      pspReference: this.ziinaPaymentIntentId,
      message: this.transactionResult.message,
      actions: this.transactionResult.actions,
    };

    return Response.json(typeSafeResponse, { status: this.statusCode });
  }
}

class Failure extends SuccessWebhookResponse {
  readonly transactionResult: ChargeFailureResult;
  readonly error: ZiinaApiError;
  readonly ziinaPaymentIntentId: ZiinaPaymentIntentId;

  private static ResponseDataSchema = createFailureWebhookResponseDataSchema(
    z.array(
      z.object({
        code: z.literal(ZiinaApiErrorPublicCode),
        message: z.string(),
      }),
    ),
  );

  constructor(args: {
    transactionResult: ChargeFailureResult;
    error: ZiinaApiError;
    ziinaPaymentIntentId: ZiinaPaymentIntentId;
    appContext: AppContext;
  }) {
    super(args.appContext);
    this.transactionResult = args.transactionResult;
    this.error = args.error;
    this.ziinaPaymentIntentId = args.ziinaPaymentIntentId;
  }

  getResponse() {
    const typeSafeResponse: TransactionSessionFailure = {
      result: this.transactionResult.result,
      message: this.error.merchantMessage,
      pspReference: this.ziinaPaymentIntentId,
      data: Failure.ResponseDataSchema.parse({
        paymentIntent: {
          errors: [
            {
              code: this.error.publicCode,
              message: this.error.publicMessage,
            },
          ],
        },
      }),
      actions: this.transactionResult.actions,
    };

    return Response.json(typeSafeResponse, { status: this.statusCode });
  }
}

export const TransactionProcessSessionUseCaseResponses = {
  Success,
  Failure,
};

export type TransactionProcessSessionUseCaseResponsesType = InstanceType<
  | typeof TransactionProcessSessionUseCaseResponses.Success
  | typeof TransactionProcessSessionUseCaseResponses.Failure
>;
