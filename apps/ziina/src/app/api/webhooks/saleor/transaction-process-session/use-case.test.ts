import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import { mockedAppConfigRepo } from "@/__tests__/mocks/app-config-repo";
import {
  mockedSaleorAppId,
  mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
} from "@/__tests__/mocks/constants";
import { mockZiinaProblemReporter } from "@/__tests__/mocks/mock-ziina-problem-reporter";
import { getMockedRecordedTransaction } from "@/__tests__/mocks/mocked-recorded-transaction";
import { MockedTransactionRecorder } from "@/__tests__/mocks/mocked-transaction-recorder";
import { mockedZiinaClient } from "@/__tests__/mocks/mocked-ziina-client";
import { mockedZiinaPaymentIntent } from "@/__tests__/mocks/mocked-ziina-payment-intent";
import { mockedZiinaPaymentIntentId } from "@/__tests__/mocks/mocked-ziina-payment-intent-id";
import { mockedSaleorApiUrl } from "@/__tests__/mocks/saleor-api-url";
import { getMockedTransactionProcessSessionEvent } from "@/__tests__/mocks/saleor-events/transaction-process-session-event";
import {
  AppIsNotConfiguredResponse,
  MalformedRequestResponse,
} from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import { ChargeActionRequiredResult } from "@/modules/transaction-result/action-required-result";
import { ChargeFailureResult } from "@/modules/transaction-result/failure-result";
import { ChargeSuccessResult } from "@/modules/transaction-result/success-result";
import { ZiinaApiInvalidRequestError } from "@/modules/ziina/ziina-api-error";

import { TransactionProcessSessionUseCase } from "./use-case";
import { TransactionProcessSessionUseCaseResponses } from "./use-case-response";

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

describe("TransactionProcessSessionUseCase", () => {
  const ziinaClientFactory = {
    create: () => mockedZiinaClient,
  };

  it("Calls Ziina client to get payment intent with payment intent id from pspReference", async () => {
    const saleorEvent = getMockedTransactionProcessSessionEvent();
    const transactionRecorder = new MockedTransactionRecorder();

    transactionRecorder.transactions[mockedZiinaPaymentIntentId] = getMockedRecordedTransaction();

    const spy = vi
      .spyOn(mockedZiinaClient, "getPaymentIntent")
      .mockImplementationOnce(async () => ok(mockedZiinaPaymentIntent));

    const uc = new TransactionProcessSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder,
    });

    await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: saleorEvent,
      problemReporter: mockZiinaProblemReporter,
    });

    expect(spy).toHaveBeenCalledWith({ id: saleorEvent.transaction.pspReference });
  });

  it("Returns Success response with CHARGE_ACTION_REQUIRED result when payment intent requires action", async () => {
    const transactionRecorder = new MockedTransactionRecorder();

    transactionRecorder.transactions[mockedZiinaPaymentIntentId] = getMockedRecordedTransaction();

    vi.spyOn(mockedZiinaClient, "getPaymentIntent").mockImplementationOnce(async () =>
      ok(mockedZiinaPaymentIntent),
    );

    const uc = new TransactionProcessSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionProcessSessionEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    const success = result._unsafeUnwrap();

    expect(success).toBeInstanceOf(TransactionProcessSessionUseCaseResponses.Success);
    expect(success.transactionResult).toBeInstanceOf(ChargeActionRequiredResult);
  });

  it.each([
    { status: "completed" as const, expectedResult: ChargeSuccessResult },
    { status: "pending" as const, expectedResult: ChargeActionRequiredResult },
    { status: "failed" as const, expectedResult: ChargeFailureResult },
  ])(
    "Returns Success response with $expectedResult.name result when payment intent status is $status",
    async ({ status, expectedResult }) => {
      const transactionRecorder = new MockedTransactionRecorder();

      transactionRecorder.transactions[mockedZiinaPaymentIntentId] = getMockedRecordedTransaction();

      vi.spyOn(mockedZiinaClient, "getPaymentIntent").mockImplementationOnce(async () =>
        ok({
          ...mockedZiinaPaymentIntent,
          status,
        }),
      );

      const uc = new TransactionProcessSessionUseCase({
        appConfigRepo: mockedAppConfigRepo,
        ziinaClientFactory,
        transactionRecorder,
      });

      const result = await uc.execute({
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
        event: getMockedTransactionProcessSessionEvent(),
        problemReporter: mockZiinaProblemReporter,
      });

      const success = result._unsafeUnwrap();

      expect(success.transactionResult).toBeInstanceOf(expectedResult);
    },
  );

  it("Returns Failure response with ChargeFailureResult result when Ziina client throws error", async () => {
    const transactionRecorder = new MockedTransactionRecorder();

    transactionRecorder.transactions[mockedZiinaPaymentIntentId] = getMockedRecordedTransaction();

    vi.spyOn(mockedZiinaClient, "getPaymentIntent").mockImplementationOnce(async () =>
      err(new ZiinaApiInvalidRequestError("Error from Ziina API")),
    );

    const uc = new TransactionProcessSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionProcessSessionEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    const failure = result._unsafeUnwrap();

    expect(failure).toBeInstanceOf(TransactionProcessSessionUseCaseResponses.Failure);
    expect(failure.transactionResult).toBeInstanceOf(ChargeFailureResult);
  });

  it("Returns AppIsNotConfiguredResponse if config not found for specified channel", async () => {
    vi.spyOn(mockedAppConfigRepo, "getZiinaConfig").mockImplementationOnce(async () => ok(null));

    const uc = new TransactionProcessSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder: new MockedTransactionRecorder(),
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionProcessSessionEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AppIsNotConfiguredResponse);
  });

  it("Returns MalformedRequestResponse when recorded transaction is missing", async () => {
    const uc = new TransactionProcessSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder: new MockedTransactionRecorder(),
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionProcessSessionEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(MalformedRequestResponse);
  });

  it("Returns Success response when payment intent completed but schema version not set in recorded transaction", async () => {
    const transactionRecorder = new MockedTransactionRecorder();

    transactionRecorder.transactions[mockedZiinaPaymentIntentId] = getMockedRecordedTransaction({
      saleorSchemaVersion: mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
    });

    vi.spyOn(mockedZiinaClient, "getPaymentIntent").mockImplementationOnce(async () =>
      ok({
        ...mockedZiinaPaymentIntent,
        status: "completed",
      }),
    );

    const uc = new TransactionProcessSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
      transactionRecorder,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionProcessSessionEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    const success = result._unsafeUnwrap();

    expect(success.transactionResult).toBeInstanceOf(ChargeSuccessResult);
  });
});
