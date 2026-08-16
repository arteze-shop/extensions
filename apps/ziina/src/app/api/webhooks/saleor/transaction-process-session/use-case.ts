import { ObservabilityAttributes } from "@saleor/apps-otel/src/observability-attributes";
import { captureException } from "@sentry/nextjs";
import { err, ok, type Result } from "neverthrow";
import { after } from "next/server";

import {
  AppIsNotConfiguredResponse,
  BrokenAppResponse,
  MalformedRequestResponse,
} from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import { type TransactionProcessSessionEventFragment } from "@/generated/graphql";
import { appContextContainer } from "@/lib/app-context";
import { BaseError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { loggerContext } from "@/lib/logger-context";
import { type AppConfigRepo } from "@/modules/app-config/repositories/app-config-repo";
import { type ZiinaProblemReporter } from "@/modules/app-problems";
import { resolveSaleorMoneyFromZiinaPaymentIntent } from "@/modules/saleor/resolve-saleor-money-from-ziina-payment-intent";
import { type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";
import { ChargeFailureResult } from "@/modules/transaction-result/failure-result";
import { mapPaymentIntentStatusToTransactionResult } from "@/modules/transaction-result/map-payment-intent-status-to-transaction-result";
import { type TransactionRecorderRepo } from "@/modules/transactions-recording/repositories/transaction-recorder-repo";
import { ZiinaApiUnknownError } from "@/modules/ziina/ziina-api-error";
import { createZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";
import { createZiinaPaymentIntentStatus } from "@/modules/ziina/ziina-payment-intent-status";

import { type ZiinaClientFactory } from "../transaction-initialize-session/use-case";
import {
  TransactionProcessSessionUseCaseResponses,
  type TransactionProcessSessionUseCaseResponsesType,
} from "./use-case-response";

type UseCaseExecuteResult = Result<
  TransactionProcessSessionUseCaseResponsesType,
  AppIsNotConfiguredResponse | BrokenAppResponse | MalformedRequestResponse
>;

export class TransactionProcessSessionUseCase {
  private logger = createLogger("TransactionProcessSessionUseCase");
  private appConfigRepo: AppConfigRepo;
  private ziinaClientFactory: ZiinaClientFactory;
  private transactionRecorder: TransactionRecorderRepo;

  constructor(deps: {
    appConfigRepo: AppConfigRepo;
    ziinaClientFactory: ZiinaClientFactory;
    transactionRecorder: TransactionRecorderRepo;
  }) {
    this.appConfigRepo = deps.appConfigRepo;
    this.ziinaClientFactory = deps.ziinaClientFactory;
    this.transactionRecorder = deps.transactionRecorder;
  }

  async execute(args: {
    appId: string;
    saleorApiUrl: SaleorApiUrl;
    event: TransactionProcessSessionEventFragment;
    problemReporter: ZiinaProblemReporter;
  }): Promise<UseCaseExecuteResult> {
    const { appId, saleorApiUrl, event } = args;

    loggerContext.set(ObservabilityAttributes.PSP_REFERENCE, event.transaction.pspReference);

    const ziinaConfigForThisChannel = await this.appConfigRepo.getZiinaConfig({
      channelId: event.sourceObject.channel.id,
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
        channelId: event.sourceObject.channel.id,
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

    const ziinaPaymentIntentId = createZiinaPaymentIntentId(event.transaction.pspReference);

    const getPaymentIntentResult = await ziinaClient.getPaymentIntent({
      id: ziinaPaymentIntentId,
    });

    const recordedTransactionResult =
      await this.transactionRecorder.getTransactionByZiinaPaymentIntentId(
        {
          appId: args.appId,
          saleorApiUrl: args.saleorApiUrl,
        },
        ziinaPaymentIntentId,
      );

    if (recordedTransactionResult.isErr()) {
      this.logger.error("Failed to get recorded transaction", {
        error: recordedTransactionResult.error,
      });

      return err(
        new MalformedRequestResponse(
          appContextContainer.getContextValue(),
          recordedTransactionResult.error,
        ),
      );
    }

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
        new TransactionProcessSessionUseCaseResponses.Failure({
          error,
          transactionResult: new ChargeFailureResult(),
          ziinaPaymentIntentId,
          appContext: appContextContainer.getContextValue(),
        }),
      );
    }

    const saleorMoneyResult = resolveSaleorMoneyFromZiinaPaymentIntent(
      getPaymentIntentResult.value,
    );

    if (saleorMoneyResult.isErr()) {
      captureException(saleorMoneyResult.error);

      this.logger.error("Failed to create Saleor Money from Ziina getPaymentIntent call", {
        error: saleorMoneyResult.error,
      });

      return err(
        new BrokenAppResponse(appContextContainer.getContextValue(), saleorMoneyResult.error),
      );
    }

    const transactionResult = mapPaymentIntentStatusToTransactionResult(
      createZiinaPaymentIntentStatus(getPaymentIntentResult.value.status),
    );

    if (transactionResult instanceof ChargeFailureResult) {
      this.logger.warn("Payment intent has failed", {
        ziinaPaymentIntentId,
      });

      return ok(
        new TransactionProcessSessionUseCaseResponses.Failure({
          error: new ZiinaApiUnknownError("Payment intent failed", {
            props: {
              publicMessage:
                getPaymentIntentResult.value.latest_error?.message ?? "Payment intent failed",
            },
          }),
          transactionResult,
          ziinaPaymentIntentId,
          appContext: appContextContainer.getContextValue(),
        }),
      );
    }

    return ok(
      new TransactionProcessSessionUseCaseResponses.Success({
        transactionResult,
        ziinaPaymentIntentId,
        saleorMoney: saleorMoneyResult.value,
        appContext: appContextContainer.getContextValue(),
      }),
    );
  }
}
