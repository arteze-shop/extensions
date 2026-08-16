import { type AuthData } from "@saleor/app-sdk/APL";
import { ObservabilityAttributes } from "@saleor/apps-otel/src/observability-attributes";
import { captureException } from "@sentry/nextjs";
import { err, ok, type Result } from "neverthrow";
import { after } from "next/server";
import { z } from "zod";

import { assertUnreachable } from "@/lib/assert-unreachable";
import { createLogger } from "@/lib/logger";
import { loggerContext } from "@/lib/logger-context";
import { type AppConfigRepo } from "@/modules/app-config/repositories/app-config-repo";
import { type ZiinaProblemReporter } from "@/modules/app-problems";
import { resolveSaleorMoneyFromZiinaPaymentIntent } from "@/modules/saleor/resolve-saleor-money-from-ziina-payment-intent";
import { SaleorMoney } from "@/modules/saleor/saleor-money";
import {
  type ITransactionEventReporter,
  TransactionEventReporterErrors,
} from "@/modules/saleor/transaction-event-reporter";
import { mapPaymentIntentStatusToTransactionResult } from "@/modules/transaction-result/map-payment-intent-status-to-transaction-result";
import { mapRefundStatusToTransactionResult } from "@/modules/transaction-result/map-refund-status-to-transaction-result";
import {
  TransactionRecorderError,
  type TransactionRecorderRepo,
} from "@/modules/transactions-recording/repositories/transaction-recorder-repo";
import { ZIINA_WEBHOOK_EVENTS } from "@/modules/ziina/supported-ziina-events";
import { createZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";
import { createZiinaPaymentIntentStatus } from "@/modules/ziina/ziina-payment-intent-status";
import { createZiinaRefundId } from "@/modules/ziina/ziina-refund-id";
import { createZiinaRefundStatus } from "@/modules/ziina/ziina-refund-status";
import { verifyZiinaWebhookSignature } from "@/modules/ziina/ziina-webhook-signature-validator";

import { TransactionEventReportVariablesResolver } from "./transaction-event-report-variables-resolver";
import { type ZiinaWebhookParams } from "./webhook-params";
import {
  type PossibleZiinaWebhookErrorResponses,
  type PossibleZiinaWebhookSuccessResponses,
  ZiinaWebhookFailureResponse,
  ZiinaWebhookMalformedRequestResponse,
  ZiinaWebhookSuccessResponse,
} from "./ziina-webhook-responses";

type R = Promise<Result<PossibleZiinaWebhookSuccessResponses, PossibleZiinaWebhookErrorResponses>>;

type SaleorTransactionEventReporterFactory = (authData: AuthData) => ITransactionEventReporter;
type ProblemReporterFactory = (authData: AuthData) => ZiinaProblemReporter;

/**
 * Validates only the subset of the Ziina webhook payload that the app consumes.
 * The rest of the object is intentionally ignored to stay forward compatible.
 */
const ZiinaWebhookEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal(ZIINA_WEBHOOK_EVENTS.PAYMENT_INTENT_STATUS_UPDATED),
    data: z.object({
      id: z.string().min(1),
      status: z.string().min(1),
      amount: z.number(),
      currency_code: z.string().min(1),
      redirect_url: z.string().optional(),
      embedded_url: z.string().optional(),
    }),
  }),
  z.object({
    event: z.literal(ZIINA_WEBHOOK_EVENTS.REFUND_STATUS_UPDATED),
    data: z.object({
      id: z.string().min(1),
      payment_intent_id: z.string().min(1),
      status: z.string().min(1),
      amount: z.number(),
      currency_code: z.string().min(1),
    }),
  }),
]);

export class ZiinaWebhookUseCase {
  private appConfigRepo: AppConfigRepo;
  private transactionRecorder: TransactionRecorderRepo;
  private transactionEventReporterFactory: SaleorTransactionEventReporterFactory;
  private problemReporterFactory: ProblemReporterFactory;
  private logger = createLogger("ZiinaWebhookUseCase");

  constructor(deps: {
    appConfigRepo: AppConfigRepo;
    transactionRecorder: TransactionRecorderRepo;
    transactionEventReporterFactory: SaleorTransactionEventReporterFactory;
    problemReporterFactory: ProblemReporterFactory;
  }) {
    this.appConfigRepo = deps.appConfigRepo;
    this.transactionRecorder = deps.transactionRecorder;
    this.transactionEventReporterFactory = deps.transactionEventReporterFactory;
    this.problemReporterFactory = deps.problemReporterFactory;
  }

  private async reportEvent({
    transactionEventReporter,
    variables,
  }: {
    transactionEventReporter: ITransactionEventReporter;
    variables: TransactionEventReportVariablesResolver;
  }): Promise<Result<ZiinaWebhookSuccessResponse, ZiinaWebhookFailureResponse>> {
    loggerContext.set(ObservabilityAttributes.TRANSACTION_ID, variables.saleorTransactionId);
    loggerContext.set("amount", variables.saleorMoney.amount);
    loggerContext.set("result", variables.transactionResult.result);

    const reportResult = await transactionEventReporter.reportTransactionEvent(
      variables.resolveEventReportVariables(),
    );

    if (reportResult.isErr()) {
      if (reportResult.error instanceof TransactionEventReporterErrors.AlreadyReportedError) {
        this.logger.info("Transaction event already reported");

        return ok(new ZiinaWebhookSuccessResponse());
      }

      this.logger.error("Failed to report transaction event", {
        error: reportResult.error,
      });

      return err(new ZiinaWebhookFailureResponse());
    }

    this.logger.info("Transaction event reported");

    return ok(new ZiinaWebhookSuccessResponse());
  }

  async execute({
    rawBody,
    signatureHeader,
    webhookParams,
    authData,
  }: {
    /**
     * Raw request body for signature verification
     */
    rawBody: string;
    /**
     * Header that Ziina sends with the webhook
     */
    signatureHeader: string | null;
    /**
     * Parsed params that come from Ziina webhook URL
     */
    webhookParams: ZiinaWebhookParams;
    authData: AuthData;
  }): R {
    this.logger.debug("Executing");

    const transactionEventReporter = this.transactionEventReporterFactory(authData);
    const problemReporter = this.problemReporterFactory(authData);

    const config = await this.appConfigRepo.getZiinaConfig({
      configId: webhookParams.configurationId,
      appId: webhookParams.appId,
      saleorApiUrl: webhookParams.saleorApiUrl,
    });

    if (config.isErr()) {
      this.logger.error("Failed to fetch config from database", {
        error: config.error,
      });

      captureException(config.error);

      return err(new ZiinaWebhookFailureResponse());
    }

    if (!config.value) {
      /*
       * Not an app error - Ziina may keep sending events for a deleted config (orphaned webhook).
       * Surfaced to the user via AppProblems below instead of alerting us.
       */
      this.logger.warn("Config for given webhook is missing");

      after(() => problemReporter.reportConfigMissing(webhookParams.configurationId));

      return err(new ZiinaWebhookFailureResponse());
    }

    const signatureVerification = verifyZiinaWebhookSignature({
      rawBody,
      signatureHeader,
      webhookSecret: config.value.webhookSecret,
    });

    if (signatureVerification.isErr()) {
      this.logger.warn("Failed to verify Ziina webhook signature", {
        error: signatureVerification.error,
      });

      const configId = config.value.id;
      const configName = config.value.name;

      after(() => problemReporter.reportWebhookSecretMismatch(configId, configName));

      return err(new ZiinaWebhookMalformedRequestResponse());
    }

    let rawEvent: unknown;

    try {
      rawEvent = JSON.parse(rawBody);
    } catch (error) {
      this.logger.warn("Failed to parse Ziina webhook body as JSON", {
        error,
      });

      return err(new ZiinaWebhookFailureResponse());
    }

    const parsedEvent = ZiinaWebhookEventSchema.safeParse(rawEvent);

    if (!parsedEvent.success) {
      this.logger.warn("Failed to validate Ziina webhook event", {
        error: parsedEvent.error,
      });

      return err(new ZiinaWebhookFailureResponse());
    }

    const event = parsedEvent.data;

    if (event.event === ZIINA_WEBHOOK_EVENTS.PAYMENT_INTENT_STATUS_UPDATED) {
      const paymentIntentId = createZiinaPaymentIntentId(event.data.id);

      loggerContext.set(ObservabilityAttributes.PSP_REFERENCE, paymentIntentId);

      const recordedTransactionResult =
        await this.transactionRecorder.getTransactionByZiinaPaymentIntentId(
          {
            saleorApiUrl: webhookParams.saleorApiUrl,
            appId: webhookParams.appId,
          },
          paymentIntentId,
        );

      if (recordedTransactionResult.isErr()) {
        if (
          recordedTransactionResult.error instanceof
          TransactionRecorderError.TransactionMissingError
        ) {
          /*
           * Payment intent was likely created outside of this app or has already been handled.
           * Return success so that Ziina stops retrying - there is nothing to report.
           */
          this.logger.warn("Received payment intent webhook without a recorded transaction", {
            paymentIntentId,
          });

          return ok(new ZiinaWebhookSuccessResponse());
        }

        this.logger.error("Failed to fetch recorded transaction", {
          error: recordedTransactionResult.error,
        });

        captureException(recordedTransactionResult.error);

        return err(new ZiinaWebhookFailureResponse());
      }

      const transactionResult = mapPaymentIntentStatusToTransactionResult(
        createZiinaPaymentIntentStatus(event.data.status),
      );
      const saleorMoney = resolveSaleorMoneyFromZiinaPaymentIntent(event.data)._unsafeUnwrap();
      const externalUrl = event.data.redirect_url || event.data.embedded_url || "";

      const variables = new TransactionEventReportVariablesResolver({
        saleorTransactionId: recordedTransactionResult.value.saleorTransactionId,
        timestamp: new Date(),
        transactionResult,
        saleorMoney,
        pspReference: paymentIntentId,
        externalUrl,
      });

      return this.reportEvent({
        transactionEventReporter,
        variables,
      });
    }

    if (event.event === ZIINA_WEBHOOK_EVENTS.REFUND_STATUS_UPDATED) {
      const paymentIntentId = createZiinaPaymentIntentId(event.data.payment_intent_id);

      loggerContext.set(ObservabilityAttributes.PSP_REFERENCE, event.data.id);

      const recordedTransactionResult =
        await this.transactionRecorder.getTransactionByZiinaPaymentIntentId(
          {
            saleorApiUrl: webhookParams.saleorApiUrl,
            appId: webhookParams.appId,
          },
          paymentIntentId,
        );

      if (recordedTransactionResult.isErr()) {
        if (
          recordedTransactionResult.error instanceof
          TransactionRecorderError.TransactionMissingError
        ) {
          this.logger.warn("Received refund webhook without a recorded transaction", {
            paymentIntentId,
          });

          return ok(new ZiinaWebhookSuccessResponse());
        }

        this.logger.error("Failed to fetch recorded transaction", {
          error: recordedTransactionResult.error,
        });

        captureException(recordedTransactionResult.error);

        return err(new ZiinaWebhookFailureResponse());
      }

      const transactionResult = mapRefundStatusToTransactionResult(
        createZiinaRefundStatus(event.data.status),
      );
      const saleorMoney = SaleorMoney.createFromZiina({
        amount: event.data.amount,
        currency: event.data.currency_code,
      })._unsafeUnwrap();

      const variables = new TransactionEventReportVariablesResolver({
        saleorTransactionId: recordedTransactionResult.value.saleorTransactionId,
        timestamp: new Date(),
        transactionResult,
        saleorMoney,
        pspReference: createZiinaRefundId(event.data.id),
        externalUrl: "",
      });

      return this.reportEvent({
        transactionEventReporter,
        variables,
      });
    }

    assertUnreachable(event);
  }
}
