import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import { mockedAppConfigRepo } from "@/__tests__/mocks/app-config-repo";
import {
  mockedSaleorAppId,
  mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
} from "@/__tests__/mocks/constants";
import { mockZiinaProblemReporter } from "@/__tests__/mocks/mock-ziina-problem-reporter";
import { MockedTransactionRecorder } from "@/__tests__/mocks/mocked-transaction-recorder";
import { mockedZiinaClient } from "@/__tests__/mocks/mocked-ziina-client";
import { mockedZiinaPaymentIntent } from "@/__tests__/mocks/mocked-ziina-payment-intent";
import { mockedSaleorApiUrl } from "@/__tests__/mocks/saleor-api-url";
import { getMockedTransactionInitializeSessionEvent } from "@/__tests__/mocks/saleor-events/transaction-initialize-session-event";
import {
  AppIsNotConfiguredResponse,
  BrokenAppResponse,
  MalformedRequestResponse,
} from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import { ChargeActionRequiredResult } from "@/modules/transaction-result/action-required-result";
import { ChargeFailureResult } from "@/modules/transaction-result/failure-result";
import { TransactionRecorderError } from "@/modules/transactions-recording/repositories/transaction-recorder-repo";
import { ZiinaApiInvalidRequestError } from "@/modules/ziina/ziina-api-error";

import { TransactionInitializeSessionUseCase } from "./use-case";
import { TransactionInitializeSessionUseCaseResponses } from "./use-case-response";

vi.mock("@saleor/app-problems", () => ({
  AppProblemsReporter: class {
    reportProblem() {
      return Promise.resolve({ isErr: () => false });
    }
    clearProblems() {
      return Promise.resolve({ isErr: () => false });
    }
  },
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("TransactionInitializeSessionUseCase", () => {
  const ziinaClientFactory = {
    create: () => mockedZiinaClient,
  };

  it("Calls Ziina client to create payment intent with expected params", async () => {
    const saleorEvent = getMockedTransactionInitializeSessionEvent();

    const spy = vi
      .spyOn(mockedZiinaClient, "createPaymentIntent")
      .mockImplementationOnce(async () => ok(mockedZiinaPaymentIntent));

    const uc = new TransactionInitializeSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder: new MockedTransactionRecorder(),
    });

    await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: saleorEvent,
      saleorSchemaVersion: mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
      problemReporter: mockZiinaProblemReporter,
      appUrl: "https://my-app.saleor.app",
    });

    expect(spy).toHaveBeenCalledWith({
      amount: 10000,
      currencyCode: "AED",
      message: "Payment for your order",
      test: false,
      operationId: saleorEvent.idempotencyKey,
      allowTips: false,
      successUrl: undefined,
      cancelUrl: undefined,
      failureUrl: undefined,
    });
  });

  it("Sends storefront return URL to Ziina as success/cancel/failure URLs", async () => {
    const saleorEvent = getMockedTransactionInitializeSessionEvent({
      data: { returnUrl: "https://storefront.example/checkout?checkout=abc&step=payment" },
    });

    const spy = vi
      .spyOn(mockedZiinaClient, "createPaymentIntent")
      .mockImplementationOnce(async () => ok(mockedZiinaPaymentIntent));

    const uc = new TransactionInitializeSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder: new MockedTransactionRecorder(),
    });

    await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: saleorEvent,
      saleorSchemaVersion: mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
      problemReporter: mockZiinaProblemReporter,
      appUrl: "https://my-app.saleor.app",
    });

    expect(spy).toHaveBeenCalledWith({
      amount: 10000,
      currencyCode: "AED",
      message: "Payment for your order",
      test: false,
      operationId: saleorEvent.idempotencyKey,
      allowTips: false,
      successUrl: "https://storefront.example/checkout?checkout=abc&step=payment",
      cancelUrl:
        "https://storefront.example/checkout?checkout=abc&step=payment&ziina_status=cancelled",
      failureUrl:
        "https://storefront.example/checkout?checkout=abc&step=payment&ziina_status=failed",
    });
  });

  it("Does not send redirect URLs to Ziina when no storefront return URL is provided", async () => {
    const saleorEvent = getMockedTransactionInitializeSessionEvent();

    const spy = vi
      .spyOn(mockedZiinaClient, "createPaymentIntent")
      .mockImplementationOnce(async () => ok(mockedZiinaPaymentIntent));

    const uc = new TransactionInitializeSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder: new MockedTransactionRecorder(),
    });

    await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: saleorEvent,
      saleorSchemaVersion: mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
      problemReporter: mockZiinaProblemReporter,
      appUrl: "https://my-app.saleor.app",
    });

    expect(spy).toHaveBeenCalledWith({
      amount: 10000,
      currencyCode: "AED",
      message: "Payment for your order",
      test: false,
      operationId: saleorEvent.idempotencyKey,
      allowTips: false,
      successUrl: undefined,
      cancelUrl: undefined,
      failureUrl: undefined,
    });
  });

  it("Returns Success response with ChargeActionRequiredResult result if Ziina client successfully responds", async () => {
    const saleorEvent = getMockedTransactionInitializeSessionEvent();

    vi.spyOn(mockedZiinaClient, "createPaymentIntent").mockImplementationOnce(async () =>
      ok(mockedZiinaPaymentIntent),
    );

    const uc = new TransactionInitializeSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder: new MockedTransactionRecorder(),
    });

    const responsePayload = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: saleorEvent,
      saleorSchemaVersion: mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
      problemReporter: mockZiinaProblemReporter,
      appUrl: "https://my-app.saleor.app",
    });

    const result = responsePayload._unsafeUnwrap();

    expect(result).toBeInstanceOf(TransactionInitializeSessionUseCaseResponses.Success);
    expect(result.transactionResult).toBeInstanceOf(ChargeActionRequiredResult);
    expect(result.transactionResult.message).toBe("Payment intent requires payment instrument");
  });

  it("Returns AppIsNotConfiguredResponse if config not found for specified channel", async () => {
    const spy = vi
      .spyOn(mockedAppConfigRepo, "getZiinaConfig")
      .mockImplementationOnce(async () => ok(null));

    const uc = new TransactionInitializeSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder: new MockedTransactionRecorder(),
    });

    const responsePayload = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionInitializeSessionEvent(),
      saleorSchemaVersion: mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
      problemReporter: mockZiinaProblemReporter,
      appUrl: "https://my-app.saleor.app",
    });

    expect(spy).toHaveBeenCalledOnce();
    expect(responsePayload._unsafeUnwrapErr()).toBeInstanceOf(AppIsNotConfiguredResponse);
  });

  it("Returns Failure response with ChargeFailureResult result if Ziina client throws error", async () => {
    vi.spyOn(mockedZiinaClient, "createPaymentIntent").mockImplementationOnce(async () =>
      err(new ZiinaApiInvalidRequestError("Error from Ziina API")),
    );

    const uc = new TransactionInitializeSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder: new MockedTransactionRecorder(),
    });

    const responsePayload = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionInitializeSessionEvent(),
      saleorSchemaVersion: mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
      problemReporter: mockZiinaProblemReporter,
      appUrl: "https://my-app.saleor.app",
    });

    const result = responsePayload._unsafeUnwrap();

    expect(result).toBeInstanceOf(TransactionInitializeSessionUseCaseResponses.Failure);
    expect(result.transactionResult).toBeInstanceOf(ChargeFailureResult);
  });

  it("Returns MalformedRequestResponse when currency coming from Saleor cannot be parsed to Ziina money", async () => {
    const saleorEvent = {
      ...getMockedTransactionInitializeSessionEvent(),
      action: {
        amount: -100,
        currency: "AED",
        actionType: "CHARGE" as const,
      },
    };

    const uc = new TransactionInitializeSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder: new MockedTransactionRecorder(),
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: saleorEvent,
      saleorSchemaVersion: mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
      problemReporter: mockZiinaProblemReporter,
      appUrl: "https://my-app.saleor.app",
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(MalformedRequestResponse);
  });

  it("Returns Failure response when currency is not supported by Ziina", async () => {
    const saleorEvent = {
      ...getMockedTransactionInitializeSessionEvent(),
      action: {
        amount: 100,
        currency: "PLN",
        actionType: "CHARGE" as const,
      },
    };

    const uc = new TransactionInitializeSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder: new MockedTransactionRecorder(),
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: saleorEvent,
      saleorSchemaVersion: mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
      problemReporter: mockZiinaProblemReporter,
      appUrl: "https://my-app.saleor.app",
    });

    const failure = result._unsafeUnwrap() as InstanceType<
      typeof TransactionInitializeSessionUseCaseResponses.Failure
    >;

    expect(failure).toBeInstanceOf(TransactionInitializeSessionUseCaseResponses.Failure);
    expect(failure.transactionResult).toBeInstanceOf(ChargeFailureResult);
    expect(failure.error.publicMessage).toBe(
      "The currency of the transaction is not supported by Ziina",
    );
  });

  it("Returns Success response even when TransactionRecorderRepo returns error", async () => {
    const saleorEvent = getMockedTransactionInitializeSessionEvent();
    const transactionRecorder = new MockedTransactionRecorder();

    vi.spyOn(transactionRecorder, "recordTransaction").mockImplementationOnce(async () =>
      err(new TransactionRecorderError.TransactionMissingError("Transaction recorder error")),
    );

    vi.spyOn(mockedZiinaClient, "createPaymentIntent").mockImplementationOnce(async () =>
      ok(mockedZiinaPaymentIntent),
    );

    const uc = new TransactionInitializeSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: saleorEvent,
      saleorSchemaVersion: mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
      problemReporter: mockZiinaProblemReporter,
      appUrl: "https://my-app.saleor.app",
    });

    expect(result.isOk()).toBe(true);
  });

  it("Calls TransactionRecorderRepo with resolved data", async () => {
    const saleorEvent = getMockedTransactionInitializeSessionEvent();
    const transactionRecorder = new MockedTransactionRecorder();

    vi.spyOn(transactionRecorder, "recordTransaction");

    vi.spyOn(mockedZiinaClient, "createPaymentIntent").mockImplementationOnce(async () =>
      ok(mockedZiinaPaymentIntent),
    );

    const uc = new TransactionInitializeSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder,
    });

    await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: saleorEvent,
      saleorSchemaVersion: mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
      problemReporter: mockZiinaProblemReporter,
      appUrl: "https://my-app.saleor.app",
    });

    expect(transactionRecorder.recordTransaction).toHaveBeenCalledWith(
      {
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
      },
      {
        resolvedTransactionFlow: "CHARGE",
        saleorTransactionFlow: "CHARGE",
        saleorTransactionId: "mocked-transaction-id",
        ziinaPaymentIntentId: "ziina_payment_intent_test",
        saleorSchemaVersion: [3, 22],
      },
    );
  });

  it("Returns BrokenAppResponse when Ziina payment intent cannot be mapped to Saleor money", async () => {
    vi.spyOn(mockedZiinaClient, "createPaymentIntent").mockImplementationOnce(async () =>
      ok({
        ...mockedZiinaPaymentIntent,
        currency_code: "abc",
      }),
    );

    const uc = new TransactionInitializeSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder: new MockedTransactionRecorder(),
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionInitializeSessionEvent(),
      saleorSchemaVersion: mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
      problemReporter: mockZiinaProblemReporter,
      appUrl: "https://my-app.saleor.app",
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(BrokenAppResponse);
  });
});
