import { ObservabilityAttributes } from "@saleor/apps-otel/src/observability-attributes";
import { err, ok, type Result } from "neverthrow";
import { after } from "next/server";

import {
  AppIsNotConfiguredResponse,
  BrokenAppResponse,
  MalformedRequestResponse,
} from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import { type TransactionRefundRequestedEventFragment } from "@/generated/graphql";
import { appContextContainer } from "@/lib/app-context";
import { BaseError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { loggerContext } from "@/lib/logger-context";
import { RandomId } from "@/lib/random-id";
import { type AppConfigRepo } from "@/modules/app-config/repositories/app-config-repo";
import { type ZiinaProblemReporter } from "@/modules/app-problems";
import { type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";
import { SaleorMoney } from "@/modules/saleor/saleor-money";
import {
  getChannelIdFromRequestedEventPayload,
  getTransactionFromRequestedEventPayload,
} from "@/modules/saleor/transaction-requested-event-helpers";
import { RefundFailureResult } from "@/modules/transaction-result/refund-result";
import { ZiinaMoney } from "@/modules/ziina/ziina-money";
import { createZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";
import { createZiinaRefundId } from "@/modules/ziina/ziina-refund-id";

import { type ZiinaClientFactory } from "../transaction-initialize-session/use-case";
import {
  TransactionRefundRequestedUseCaseResponses,
  type TransactionRefundRequestedUseCaseResponsesType,
} from "./use-case-response";

type UseCaseExecuteResult = Result<
  TransactionRefundRequestedUseCaseResponsesType,
  AppIsNotConfiguredResponse | BrokenAppResponse | MalformedRequestResponse
>;

export class TransactionRefundRequestedUseCase {
  private logger = createLogger("TransactionRefundRequestedUseCase");
  private appConfigRepo: AppConfigRepo;
  private ziinaClientFactory: ZiinaClientFactory;
  private randomId = new RandomId();

  constructor(deps: { appConfigRepo: AppConfigRepo; ziinaClientFactory: ZiinaClientFactory }) {
    this.appConfigRepo = deps.appConfigRepo;
    this.ziinaClientFactory = deps.ziinaClientFactory;
  }

  async execute(args: {
    appId: string;
    saleorApiUrl: SaleorApiUrl;
    event: TransactionRefundRequestedEventFragment;
    problemReporter: ZiinaProblemReporter;
  }): Promise<UseCaseExecuteResult> {
    const { appId, saleorApiUrl, event } = args;

    const transaction = getTransactionFromRequestedEventPayload(event);
    const channelId = getChannelIdFromRequestedEventPayload(event);

    loggerContext.set(ObservabilityAttributes.PSP_REFERENCE, transaction.pspReference);

    const ziinaConfigForThisChannel = await this.appConfigRepo.getZiinaConfig({
      channelId,
      appId,
      saleorApiUrl,
    });

    if (ziinaConfigForThisChannel.isErr()) {
      this.logger.error("Failed to get configuration", {
        error: ziinaConfigForThisChannel.error,
      });

      return err(
        new BrokenAppResponse(
          appContextContainer.getContextValue(),
          ziinaConfigForThisChannel.error,
        ),
      );
    }

    if (!ziinaConfigForThisChannel.value) {
      this.logger.warn("Config for channel not found", {
        channelId,
      });

      return err(
        new AppIsNotConfiguredResponse(
          appContextContainer.getContextValue(),
          new BaseError("Config for channel not found"),
        ),
      );
    }

    appContextContainer.set({
      ziinaEnv: ziinaConfigForThisChannel.value.getZiinaEnvValue(),
    });

    const restrictedKey = ziinaConfigForThisChannel.value.accessToken;

    const ziinaClient = this.ziinaClientFactory.create({
      restrictedKey,
    });

    this.logger.debug("Refunding Ziina payment intent with id", {
      id: transaction.pspReference,
      action: event.action,
    });

    const ziinaPaymentIntentId = createZiinaPaymentIntentId(transaction.pspReference);

    const ziinaMoneyResult = ZiinaMoney.createFromSaleorAmount({
      amount: event.action.amount,
      currency: event.action.currency,
    });

    if (ziinaMoneyResult.isErr()) {
      this.logger.error("Failed to create Ziina money", {
        error: ziinaMoneyResult.error,
      });

      return err(
        new MalformedRequestResponse(appContextContainer.getContextValue(), ziinaMoneyResult.error),
      );
    }

    const createRefundResult = await ziinaClient.createRefund({
      id: createZiinaRefundId(this.randomId.generate()),
      paymentIntentId: ziinaPaymentIntentId,
      amount: ziinaMoneyResult.value.amount,
      currencyCode: ziinaMoneyResult.value.currency,
      test: appContextContainer.getContextValue().ziinaEnv === "TEST",
    });

    if (createRefundResult.isErr()) {
      const error = createRefundResult.error;

      const config = {
        id: ziinaConfigForThisChannel.value.id,
        name: ziinaConfigForThisChannel.value.name,
      };

      after(() => args.problemReporter.reportApiProblem(error, config));

      this.logger.warn("Failed to create refund", {
        error,
      });

      return ok(
        new TransactionRefundRequestedUseCaseResponses.Failure({
          transactionResult: new RefundFailureResult(),
          ziinaPaymentIntentId,
          error,
          appContext: appContextContainer.getContextValue(),
        }),
      );
    }

    const refund = createRefundResult.value;

    this.logger.debug("Refund created", {
      refund,
    });

    const saleorMoneyResult = SaleorMoney.createFromZiina({
      amount: refund.amount,
      currency: refund.currency_code,
    });

    if (saleorMoneyResult.isErr()) {
      this.logger.error("Failed to create Saleor money", {
        error: saleorMoneyResult.error,
      });
    }

    return ok(
      new TransactionRefundRequestedUseCaseResponses.Success({
        ziinaRefundId: createZiinaRefundId(refund.id),
        appContext: appContextContainer.getContextValue(),
      }),
    );
  }
}
