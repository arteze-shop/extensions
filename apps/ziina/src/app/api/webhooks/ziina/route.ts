import { trace } from "@opentelemetry/api";
import { ObservabilityAttributes } from "@saleor/apps-otel/src/observability-attributes";
import { withSpanAttributesAppRouter } from "@saleor/apps-otel/src/with-span-attributes";
import { compose } from "@saleor/apps-shared/compose";
import { captureException } from "@sentry/nextjs";
import { type NextRequest } from "next/server";

import { appContextContainer } from "@/lib/app-context";
import { BaseError } from "@/lib/errors";
import { createInstrumentedGraphqlClient } from "@/lib/graphql-client";
import { createLogger } from "@/lib/logger";
import { loggerContext, withLoggerContext } from "@/lib/logger-context";
import { setObservabilitySaleorApiUrl } from "@/lib/observability-saleor-api-url";
import { saleorApp } from "@/lib/saleor-app";
import { appConfigRepoImpl } from "@/modules/app-config/repositories/app-config-repo-impl";
import { createZiinaProblemReporter } from "@/modules/app-problems";
import { TransactionEventReporter } from "@/modules/saleor/transaction-event-reporter";
import { transactionRecorder } from "@/modules/transactions-recording/repositories/transaction-recorder-impl";

import { ZiinaWebhookUseCase } from "./use-case";
import { ZiinaWebhookParams } from "./webhook-params";
import {
  ZiinaWebhookFailureResponse,
  ZiinaWebhookMalformedRequestResponse,
} from "./ziina-webhook-responses";

const useCase = new ZiinaWebhookUseCase({
  appConfigRepo: appConfigRepoImpl,
  transactionRecorder: transactionRecorder,
  transactionEventReporterFactory(authData) {
    return new TransactionEventReporter({
      graphqlClient: createInstrumentedGraphqlClient(authData),
    });
  },
  problemReporterFactory: (authData) => createZiinaProblemReporter(authData),
});

const logger = createLogger("ZiinaWebhookHandler");

const ZiinaWebhookHandler = async (request: NextRequest): Promise<Response> => {
  const webhookParamsResult = ZiinaWebhookParams.createFromWebhookUrl(request.url);

  if (webhookParamsResult.isErr()) {
    logger.warn("Received webhook from Ziina with invalid parameters", {
      error: webhookParamsResult.error,
    });

    return new ZiinaWebhookMalformedRequestResponse().getResponse();
  }

  const webhookParams = webhookParamsResult.value;

  setObservabilitySaleorApiUrl(webhookParams.saleorApiUrl);
  loggerContext.set(ObservabilityAttributes.CONFIGURATION_ID, webhookParams.configurationId);

  trace
    .getActiveSpan()
    ?.setAttribute(ObservabilityAttributes.SALEOR_API_URL, webhookParams.saleorApiUrl);

  logger.info("Received webhook from Ziina");

  const authData = await saleorApp.apl.get(webhookParams.saleorApiUrl);

  if (!authData) {
    captureException(new BaseError("AuthData from APL is empty, installation may be broken"), (s) =>
      s.setLevel("warning"),
    );

    return new ZiinaWebhookFailureResponse().getResponse();
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("X-Hmac-Signature");

  try {
    const result = await useCase.execute({
      rawBody,
      signatureHeader,
      webhookParams,
      authData,
    });

    return result.match(
      (success) => {
        logger.info("Success processing Ziina webhook", {
          httpsStatusCode: success.statusCode,
        });

        return success.getResponse();
      },
      (error) => {
        logger.warn("Failed to process Ziina webhook", {
          error: error,
          httpsStatusCode: error.statusCode,
        });

        return error.getResponse();
      },
    );
  } catch (e) {
    logger.error("Unhandled error", { error: e });

    const panicError = new BaseError("Unhandled Error processing Ziina webhook UseCase", {
      cause: e,
    });

    captureException(panicError);

    return new ZiinaWebhookFailureResponse().getResponse();
  }
};

export const POST = compose(
  withLoggerContext,
  appContextContainer.wrapRequest,
  withSpanAttributesAppRouter,
)(ZiinaWebhookHandler);
