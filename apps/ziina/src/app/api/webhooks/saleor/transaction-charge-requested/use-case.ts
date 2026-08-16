import { ObservabilityAttributes } from "@saleor/apps-otel/src/observability-attributes";
import { err, ok, type Result } from "neverthrow";
import { after } from "next/server";

import {
  AppIsNotConfiguredResponse,
  BrokenAppResponse,
  type MalformedRequestResponse,
} from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import { type TransactionChargeRequestedEventFragment } from "@/generated/graphql";
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
import { ChargeFailureResult } from "@/modules/transaction-result/failure-result";
import { mapPaymentIntentStatusToTransactionResult } from "@/modules/transaction-result/map-payment-intent-status-to-transaction-result";
import { ZiinaApiUnknownError } from "@/modules/ziina/ziina-api-error";
import { createZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";
import { createZiinaPaymentIntentStatus } from "@/modules/ziina/ziina-payment-intent-status";

import { type ZiinaClientFactory } from "../transaction-initialize-session/use-case";
import {
  TransactionChargeRequestedUseCaseResponses,
  type TransactionChargeRequestedUseCaseResponsesType,
} from "./use-case-response";

type UseCaseExecuteResult = Result<
  TransactionChargeRequestedUseCaseResponsesType,
  AppIsNotConfiguredResponse | BrokenAppResponse | MalformedRequestResponse
>;

export class TransactionChargeRequestedUseCase {
  private logger = createLogger("TransactionChargeRequestedUseCase");
  private appConfigRepo: AppConfigRepo;
  private ziinaClientFactory: ZiinaClientFactory;

  constructor(deps: { appConfigRepo: AppConfigRepo; ziinaClientFactory: ZiinaClientFactory }) {
    this.appConfigRepo = deps.appConfigRepo;
    this.ziinaClientFactory = deps.ziinaClientFactory;
  }

  async execute(args: {
    appId: string;
    saleorApiUrl: SaleorApiUrl;
    event: TransactionChargeRequestedEventFragment;
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

    this.logger.debug("Fetching Ziina payment intent for charge with id", {
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
        new TransactionChargeRequestedUseCaseResponses.Failure({
          transactionResult: new ChargeFailureResult(),
          ziinaPaymentIntentId,
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

    const saleorMoney = saleorMoneyResult.value;

    const transactionResult = mapPaymentIntentStatusToTransactionResult(
      createZiinaPaymentIntentStatus(getPaymentIntentResult.value.status),
    );

    if (transactionResult instanceof ChargeFailureResult) {
      this.logger.warn("Cannot charge payment intent - it already failed", {
        ziinaPaymentIntentId,
      });

      return ok(
        new TransactionChargeRequestedUseCaseResponses.Failure({
          transactionResult,
          ziinaPaymentIntentId,
          error: new ZiinaApiUnknownError("Payment intent failed", {
            props: {
              publicMessage:
                getPaymentIntentResult.value.latest_error?.message ?? "Payment intent failed",
            },
          }),
          appContext: appContextContainer.getContextValue(),
        }),
      );
    }

    return ok(
      new TransactionChargeRequestedUseCaseResponses.Success({
        transactionResult,
        ziinaPaymentIntentId,
        saleorMoney,
        appContext: appContextContainer.getContextValue(),
      }),
    );
  }
}
