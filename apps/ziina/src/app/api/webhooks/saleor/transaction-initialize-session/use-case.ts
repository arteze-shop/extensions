import { type SaleorSchemaVersion } from "@saleor/app-sdk/types";
import { ObservabilityAttributes } from "@saleor/apps-otel/src/observability-attributes";
import { captureException } from "@sentry/nextjs";
import { err, fromThrowable, ok, type Result } from "neverthrow";
import { after } from "next/server";

import {
  AppIsNotConfiguredResponse,
  BrokenAppResponse,
  MalformedRequestResponse,
} from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import { type TransactionInitializeSessionEventFragment } from "@/generated/graphql";
import { appContextContainer } from "@/lib/app-context";
import { BaseError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { loggerContext } from "@/lib/logger-context";
import { type AppConfigRepo } from "@/modules/app-config/repositories/app-config-repo";
import { type ZiinaProblemReporter } from "@/modules/app-problems";
import { createResolvedTransactionFlow } from "@/modules/resolved-transaction-flow";
import { resolveSaleorMoneyFromZiinaPaymentIntent } from "@/modules/saleor/resolve-saleor-money-from-ziina-payment-intent";
import { type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";
import {
  createSaleorTransactionFlow,
  type SaleorTransationFlow,
} from "@/modules/saleor/saleor-transaction-flow";
import { createSaleorTransactionId } from "@/modules/saleor/saleor-transaction-id";
import { ChargeActionRequiredResult } from "@/modules/transaction-result/action-required-result";
import { ChargeFailureResult } from "@/modules/transaction-result/failure-result";
import { RecordedTransaction } from "@/modules/transactions-recording/domain/recorded-transaction";
import { type TransactionRecorderRepo } from "@/modules/transactions-recording/repositories/transaction-recorder-repo";
import { SUPPORTED_ZIINA_CURRENCIES } from "@/modules/ziina/supported-ziina-currencies";
import { type IZiinaClient, type ZiinaPaymentIntentApiCreateArgs } from "@/modules/ziina/types";
import { ZiinaApiErrorPublicCode } from "@/modules/ziina/ziina-api-error";
import { type ZiinaEnv } from "@/modules/ziina/ziina-env";
import { ZiinaMoney } from "@/modules/ziina/ziina-money";
import { createZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";
import { createZiinaPaymentIntentStatus } from "@/modules/ziina/ziina-payment-intent-status";
import { type ZiinaRestrictedKey } from "@/modules/ziina/ziina-restricted-key";

import {
  TransactionInitializeSessionUseCaseResponses,
  type TransactionInitializeSessionUseCaseResponsesType,
} from "./use-case-response";

export type ZiinaClientFactory = {
  create: (args: { restrictedKey: ZiinaRestrictedKey }) => IZiinaClient;
};

export const ZiinaUnsupportedCurrencyError = BaseError.subclass("ZiinaUnsupportedCurrencyError", {
  props: {
    _internalName: "TransactionInitializeSession.ZiinaUnsupportedCurrencyError" as const,
    publicCode: ZiinaApiErrorPublicCode,
    publicMessage: "The currency of the transaction is not supported by Ziina",
  },
});

type UseCaseExecuteResult = Result<
  TransactionInitializeSessionUseCaseResponsesType,
  AppIsNotConfiguredResponse | BrokenAppResponse | MalformedRequestResponse
>;

export class TransactionInitializeSessionUseCase {
  private logger = createLogger("TransactionInitializeSessionUseCase");
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

  private isSupportedCurrency(currency: string) {
    return (SUPPORTED_ZIINA_CURRENCIES as readonly string[]).includes(currency);
  }

  private resolveStorefrontReturnUrl(
    data: TransactionInitializeSessionEventFragment["data"],
  ): string | null {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return null;
    }

    const rawReturnUrl = data.returnUrl ?? data.return_url;

    if (typeof rawReturnUrl !== "string") {
      return null;
    }

    const trimmedReturnUrl = rawReturnUrl.trim();

    return trimmedReturnUrl.length > 0 ? trimmedReturnUrl : null;
  }

  private buildRedirectUrlWithZiinaStatus(
    returnUrl: string,
    ziinaStatus: "cancelled" | "failed",
  ): string | null {
    try {
      const redirectUrl = new URL(returnUrl);

      redirectUrl.searchParams.set("ziina_status", ziinaStatus);

      return redirectUrl.toString();
    } catch {
      return null;
    }
  }

  private prepareZiinaCreatePaymentIntentParams(args: {
    saleorMoney: ZiinaMoney;
    idempotencyKey: string;
    ziinaEnv: ZiinaEnv;
    successUrl?: string | null;
    cancelUrl?: string | null;
    failureUrl?: string | null;
  }): ZiinaPaymentIntentApiCreateArgs {
    return {
      amount: args.saleorMoney.amount,
      currencyCode: args.saleorMoney.currency,
      message: "Payment for your order",
      test: args.ziinaEnv === "TEST",
      operationId: args.idempotencyKey,
      allowTips: false,
      successUrl: args.successUrl ?? undefined,
      cancelUrl: args.cancelUrl ?? undefined,
      failureUrl: args.failureUrl ?? undefined,
    };
  }

  async execute(args: {
    appId: string;
    saleorApiUrl: SaleorApiUrl;
    event: TransactionInitializeSessionEventFragment;
    saleorSchemaVersion: SaleorSchemaVersion;
    problemReporter: ZiinaProblemReporter;
    appUrl: string;
  }): Promise<UseCaseExecuteResult> {
    const { appId, saleorApiUrl, event, saleorSchemaVersion } = args;

    const saleorTransactionFlow: SaleorTransationFlow = createSaleorTransactionFlow(
      event.action.actionType,
    );

    const saleorMoneyResult = ZiinaMoney.createFromSaleorAmount({
      amount: event.action.amount,
      currency: event.action.currency,
    });

    if (saleorMoneyResult.isErr()) {
      captureException(saleorMoneyResult.error);

      return err(
        new MalformedRequestResponse(
          appContextContainer.getContextValue(),
          saleorMoneyResult.error,
        ),
      );
    }

    if (!this.isSupportedCurrency(saleorMoneyResult.value.currency)) {
      this.logger.warn("Currency not supported by Ziina", {
        currency: saleorMoneyResult.value.currency,
      });

      return ok(
        new TransactionInitializeSessionUseCaseResponses.Failure({
          transactionResult: new ChargeFailureResult(),
          error: new ZiinaUnsupportedCurrencyError(
            `Currency ${saleorMoneyResult.value.currency} is not supported by Ziina`,
          ),
          appContext: appContextContainer.getContextValue(),
        }),
      );
    }

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

    this.logger.debug("Creating Ziina payment intent with params", {
      params: event.action,
    });

    const storefrontReturnUrl = this.resolveStorefrontReturnUrl(event.data);

    const successUrl = storefrontReturnUrl ?? undefined;
    const cancelUrl = storefrontReturnUrl
      ? this.buildRedirectUrlWithZiinaStatus(storefrontReturnUrl, "cancelled")
      : undefined;
    const failureUrl = storefrontReturnUrl
      ? this.buildRedirectUrlWithZiinaStatus(storefrontReturnUrl, "failed")
      : undefined;

    const createPaymentIntentResult = await ziinaClient.createPaymentIntent(
      this.prepareZiinaCreatePaymentIntentParams({
        saleorMoney: saleorMoneyResult.value,
        idempotencyKey: event.idempotencyKey,
        ziinaEnv: appContextContainer.getContextValue().ziinaEnv ?? "LIVE",
        successUrl,
        cancelUrl,
        failureUrl,
      }),
    );

    if (createPaymentIntentResult.isErr()) {
      const error = createPaymentIntentResult.error;

      const config = {
        id: ziinaConfigForThisChannel.value.id,
        name: ziinaConfigForThisChannel.value.name,
      };

      after(() => args.problemReporter.reportApiProblem(error, config));

      this.logger.warn("Failed to create payment intent", { error });

      return ok(
        new TransactionInitializeSessionUseCaseResponses.Failure({
          transactionResult: new ChargeFailureResult(),
          error,
          appContext: appContextContainer.getContextValue(),
        }),
      );
    }

    const paymentIntent = createPaymentIntentResult.value;

    loggerContext.set(ObservabilityAttributes.PSP_REFERENCE, paymentIntent.id);

    this.logger.debug("Ziina created payment intent", { ziinaResponse: paymentIntent });

    const saleorMoney = resolveSaleorMoneyFromZiinaPaymentIntent(paymentIntent);

    if (saleorMoney.isErr()) {
      captureException(saleorMoney.error);
      this.logger.error("Failed to map Ziina payment intent to webhook response", {
        error: saleorMoney.error,
      });

      return err(new BrokenAppResponse(appContextContainer.getContextValue(), saleorMoney.error));
    }

    const ziinaPaymentIntentIdResult = fromThrowable(createZiinaPaymentIntentId)(paymentIntent.id);

    const ziinaPaymentIntentStatusResult = fromThrowable(createZiinaPaymentIntentStatus)(
      paymentIntent.status,
    );

    if (ziinaPaymentIntentIdResult.isErr()) {
      const error = BaseError.normalize(ziinaPaymentIntentIdResult.error);

      captureException(error);
      this.logger.error("Failed to map Ziina payment intent to webhook response", {
        error,
      });

      return err(new BrokenAppResponse(appContextContainer.getContextValue(), error));
    }

    if (ziinaPaymentIntentStatusResult.isErr()) {
      const error = BaseError.normalize(ziinaPaymentIntentStatusResult.error);

      captureException(error);
      this.logger.error("Failed to map Ziina payment intent to webhook response", {
        error,
      });

      return err(new BrokenAppResponse(appContextContainer.getContextValue(), error));
    }

    const ziinaPaymentIntentId = ziinaPaymentIntentIdResult.value;
    const ziinaPaymentIntentStatus = ziinaPaymentIntentStatusResult.value;

    /*
     * When a storefront return URL is provided, the redirect URLs are sent to Ziina so the
     * hosted payment page can redirect the shopper back to the storefront after payment.
     * Otherwise the URLs are app-internal and only logged here for observability.
     */
    const displaySuccessUrl =
      successUrl ?? `${args.appUrl}/payment-success?payment_intent_id=${paymentIntent.id}`;
    const displayCancelUrl =
      cancelUrl ?? `${args.appUrl}/payment-cancel?payment_intent_id=${paymentIntent.id}`;
    const displayFailureUrl =
      failureUrl ?? `${args.appUrl}/payment-failure?payment_intent_id=${paymentIntent.id}`;

    this.logger.debug("Ziina payment intent redirect URLs", {
      successUrl: displaySuccessUrl,
      cancelUrl: displayCancelUrl,
      failureUrl: displayFailureUrl,
    });

    const recordedTransaction = new RecordedTransaction({
      saleorTransactionId: createSaleorTransactionId(event.transaction.id),
      ziinaPaymentIntentId,
      saleorTransactionFlow,
      resolvedTransactionFlow: createResolvedTransactionFlow("CHARGE"),
      saleorSchemaVersion,
    });

    const recordResult = await this.transactionRecorder.recordTransaction(
      {
        saleorApiUrl: args.saleorApiUrl,
        appId: args.appId,
      },
      recordedTransaction,
    );

    if (recordResult.isErr()) {
      captureException(recordResult.error);
      this.logger.error("Failed to record transaction", {
        error: recordResult.error,
      });
    }

    this.logger.info("Wrote Transaction to DynamoDB", {
      transaction: recordedTransaction,
    });

    const transactionResult = new ChargeActionRequiredResult(ziinaPaymentIntentStatus);

    return ok(
      new TransactionInitializeSessionUseCaseResponses.Success({
        saleorMoney: saleorMoney.value,
        ziinaPaymentIntentId,
        transactionResult,
        redirectUrl: paymentIntent.redirect_url,
        appContext: appContextContainer.getContextValue(),
      }),
    );
  }
}
