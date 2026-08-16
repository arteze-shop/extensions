import { ObservabilityAttributes } from "@saleor/apps-otel/src/observability-attributes";
import { err, ok, type Result } from "neverthrow";
import { after } from "next/server";

import {
  AppIsNotConfiguredResponse,
  BrokenAppResponse,
  type MalformedRequestResponse,
} from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import { type TransactionCancelationRequestedEventFragment } from "@/generated/graphql";
import { appContextContainer } from "@/lib/app-context";
import { BaseError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { loggerContext } from "@/lib/logger-context";
import { type AppConfigRepo } from "@/modules/app-config/repositories/app-config-repo";
import { type ZiinaProblemReporter } from "@/modules/app-problems";
import { resolveSaleorMoneyFromZiinaPaymentIntent } from "@/modules/saleor/resolve-saleor-money-from-ziina-payment-intent";
import { type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";
import {
  getChannelIdFromRequestedEventPayload,
  getTransactionFromRequestedEventPayload,
} from "@/modules/saleor/transaction-requested-event-helpers";
import {
  CancelFailureResult,
  CancelSuccessResult,
} from "@/modules/transaction-result/cancel-result";
import { createZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";
import { createZiinaPaymentIntentStatus } from "@/modules/ziina/ziina-payment-intent-status";

import { type ZiinaClientFactory } from "../transaction-initialize-session/use-case";
import {
  TransactionCancelationRequestedUseCaseResponses,
  type TransactionCancelationRequestedUseCaseResponsesType,
} from "./use-case-response";

type UseCaseExecuteResult = Result<
  TransactionCancelationRequestedUseCaseResponsesType,
  AppIsNotConfiguredResponse | BrokenAppResponse | MalformedRequestResponse
>;

export class TransactionCancelationRequestedUseCase {
  private logger = createLogger("TransactionCancelationRequestedUseCase");
  private appConfigRepo: AppConfigRepo;
  private ziinaClientFactory: ZiinaClientFactory;

  constructor(deps: { appConfigRepo: AppConfigRepo; ziinaClientFactory: ZiinaClientFactory }) {
    this.appConfigRepo = deps.appConfigRepo;
    this.ziinaClientFactory = deps.ziinaClientFactory;
  }

  async execute(args: {
    appId: string;
    saleorApiUrl: SaleorApiUrl;
    event: TransactionCancelationRequestedEventFragment;
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
          new BaseError("No config found for channel"),
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

    this.logger.debug("Fetching Ziina payment intent for cancel with id", {
      id: transaction.pspReference,
    });

    const ziinaPaymentIntentId = createZiinaPaymentIntentId(transaction.pspReference);

    const getPaymentIntentResult = await ziinaClient.getPaymentIntent({
      id: ziinaPaymentIntentId,
    });

    if (getPaymentIntentResult.isErr()) {
      const error = getPaymentIntentResult.error;

      const config = {
        id: ziinaConfigForThisChannel.value.id,
        name: ziinaConfigForThisChannel.value.name,
      };

      after(() => args.problemReporter.reportApiProblem(error, config));

      this.logger.warn("Failed to get payment intent", {
        error,
      });

      return ok(
        new TransactionCancelationRequestedUseCaseResponses.Failure({
          ziinaPaymentIntentId,
          transactionResult: new CancelFailureResult(),
          error,
          appContext: appContextContainer.getContextValue(),
        }),
      );
    }

    const saleorMoneyResult = resolveSaleorMoneyFromZiinaPaymentIntent(
      getPaymentIntentResult.value,
    );

    if (saleorMoneyResult.isErr()) {
      this.logger.error("Failed to create Saleor money", {
        error: saleorMoneyResult.error,
      });

      return err(
        new BrokenAppResponse(appContextContainer.getContextValue(), saleorMoneyResult.error),
      );
    }

    const paymentIntentStatus = createZiinaPaymentIntentStatus(getPaymentIntentResult.value.status);

    if (paymentIntentStatus === "completed") {
      this.logger.warn("Cannot cancel payment intent - it is already completed", {
        ziinaPaymentIntentId,
      });

      return ok(
        new TransactionCancelationRequestedUseCaseResponses.Failure({
          ziinaPaymentIntentId,
          transactionResult: new CancelFailureResult(),
          error: null,
          appContext: appContextContainer.getContextValue(),
        }),
      );
    }

    return ok(
      new TransactionCancelationRequestedUseCaseResponses.Success({
        saleorMoney: saleorMoneyResult.value,
        ziinaPaymentIntentId,
        transactionResult: new CancelSuccessResult(),
        appContext: appContextContainer.getContextValue(),
      }),
    );
  }
}
