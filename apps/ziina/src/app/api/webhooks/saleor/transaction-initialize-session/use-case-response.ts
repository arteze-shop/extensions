import { z } from "zod";

import {
  createFailureWebhookResponseDataSchema,
  createSuccessWebhookResponseDataSchema,
} from "@/app/api/webhooks/saleor/saleor-webhook-response-schema";
import { SuccessWebhookResponse } from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import {
  type TransactionSessionActionRequired,
  type TransactionSessionFailure,
} from "@/generated/app-webhooks-types/transaction-initialize-session";
import { type AppContext } from "@/lib/app-context";
import { BaseError } from "@/lib/errors";
import { type SaleorMoney } from "@/modules/saleor/saleor-money";
import { type ChargeActionRequiredResult } from "@/modules/transaction-result/action-required-result";
import { type ChargeFailureResult } from "@/modules/transaction-result/failure-result";
import { type ZiinaApiError, ZiinaApiErrorPublicCode } from "@/modules/ziina/ziina-api-error";
import { type ZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";

import { type ZiinaUnsupportedCurrencyError } from "./use-case";

class Success extends SuccessWebhookResponse {
  readonly transactionResult: ChargeActionRequiredResult;
  readonly saleorMoney: SaleorMoney;
  readonly ziinaPaymentIntentId: ZiinaPaymentIntentId;
  readonly redirectUrl: string;

  private static ResponseDataSchema = createSuccessWebhookResponseDataSchema(
    z.object({
      redirectUrl: z.string(),
    }),
  );

  constructor(args: {
    transactionResult: ChargeActionRequiredResult;
    saleorMoney: SaleorMoney;
    ziinaPaymentIntentId: ZiinaPaymentIntentId;
    redirectUrl: string;
    appContext: AppContext;
  }) {
    super(args.appContext);
    this.transactionResult = args.transactionResult;
    this.saleorMoney = args.saleorMoney;
    this.ziinaPaymentIntentId = args.ziinaPaymentIntentId;
    this.redirectUrl = args.redirectUrl;
  }

  getResponse() {
    if (!this.appContext.ziinaEnv) {
      throw new BaseError("Ziina environment is not set. Ensure AppContext is set earlier");
    }

    const typeSafeResponse: TransactionSessionActionRequired = {
      result: this.transactionResult.result,
      actions: this.transactionResult.actions,
      amount: this.saleorMoney.amount,
      pspReference: this.ziinaPaymentIntentId,
      message: this.transactionResult.message,
      externalUrl: this.redirectUrl,
      data: Success.ResponseDataSchema.parse({
        paymentIntent: {
          redirectUrl: this.redirectUrl,
        },
      }),
    };

    return Response.json(typeSafeResponse, { status: this.statusCode });
  }
}

class Failure extends SuccessWebhookResponse {
  readonly transactionResult: ChargeFailureResult;
  readonly error: ZiinaApiError | InstanceType<typeof ZiinaUnsupportedCurrencyError>;

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
    error: ZiinaApiError | InstanceType<typeof ZiinaUnsupportedCurrencyError>;
    appContext: AppContext;
  }) {
    super(args.appContext);
    this.transactionResult = args.transactionResult;
    this.error = args.error;
  }

  getResponse() {
    const typeSafeResponse: TransactionSessionFailure = {
      // We don't have pspReference in this case or actions because there is no payment intent created
      result: this.transactionResult.result,
      message: this.messageFormatter.formatMessage(this.error.publicMessage, this.error),
      actions: this.transactionResult.actions,
      data: Failure.ResponseDataSchema.parse({
        paymentIntent: {
          errors: [
            {
              code: this.error.publicCode,
              message: this.messageFormatter.formatMessage(this.error.publicMessage, this.error),
            },
          ],
        },
      }),
    };

    return Response.json(typeSafeResponse, { status: this.statusCode });
  }
}

export const TransactionInitializeSessionUseCaseResponses = {
  Success,
  Failure,
};

export type TransactionInitializeSessionUseCaseResponsesType = InstanceType<
  | typeof TransactionInitializeSessionUseCaseResponses.Success
  | typeof TransactionInitializeSessionUseCaseResponses.Failure
>;
