import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import { mockedAppConfigRepo } from "@/__tests__/mocks/app-config-repo";
import { mockedSaleorAppId } from "@/__tests__/mocks/constants";
import { mockZiinaProblemReporter } from "@/__tests__/mocks/mock-ziina-problem-reporter";
import { mockedZiinaClient } from "@/__tests__/mocks/mocked-ziina-client";
import { mockedZiinaPaymentIntent } from "@/__tests__/mocks/mocked-ziina-payment-intent";
import { mockedSaleorApiUrl } from "@/__tests__/mocks/saleor-api-url";
import { getMockedTransactionCancelationRequestedEvent } from "@/__tests__/mocks/saleor-events/transaction-cancelation-request-event";
import {
  AppIsNotConfiguredResponse,
  BrokenAppResponse,
} from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import {
  CancelFailureResult,
  CancelSuccessResult,
} from "@/modules/transaction-result/cancel-result";
import { ZiinaApiInvalidRequestError } from "@/modules/ziina/ziina-api-error";

import { TransactionCancelationRequestedUseCase } from "./use-case";
import { TransactionCancelationRequestedUseCaseResponses } from "./use-case-response";

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

describe("TransactionCancelationRequestedUseCase", () => {
  const ziinaClientFactory = {
    create: () => mockedZiinaClient,
  };

  it("Calls Ziina client to get payment intent with payment intent id from transaction pspReference", async () => {
    const saleorEvent = getMockedTransactionCancelationRequestedEvent();

    const spy = vi
      .spyOn(mockedZiinaClient, "getPaymentIntent")
      .mockImplementationOnce(async () => ok(mockedZiinaPaymentIntent));

    const uc = new TransactionCancelationRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: saleorEvent,
      problemReporter: mockZiinaProblemReporter,
    });

    expect(spy).toHaveBeenCalledWith({ id: saleorEvent.transaction?.pspReference });
  });

  it("Returns Success response with CancelSuccessResult result when payment intent is not completed", async () => {
    vi.spyOn(mockedZiinaClient, "getPaymentIntent").mockImplementationOnce(async () =>
      ok(mockedZiinaPaymentIntent),
    );

    const uc = new TransactionCancelationRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionCancelationRequestedEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    const success = result._unsafeUnwrap();

    expect(success).toBeInstanceOf(TransactionCancelationRequestedUseCaseResponses.Success);
    expect(success.transactionResult).toBeInstanceOf(CancelSuccessResult);
  });

  it("Returns Failure response with CancelFailureResult result when payment intent is already completed", async () => {
    vi.spyOn(mockedZiinaClient, "getPaymentIntent").mockImplementationOnce(async () =>
      ok({
        ...mockedZiinaPaymentIntent,
        status: "completed",
      }),
    );

    const uc = new TransactionCancelationRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionCancelationRequestedEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    const failure = result._unsafeUnwrap();

    if (!(failure instanceof TransactionCancelationRequestedUseCaseResponses.Failure)) {
      throw new Error("Expected Failure response");
    }

    expect(failure.transactionResult).toBeInstanceOf(CancelFailureResult);
    expect(failure.error).toBeNull();
  });

  it("Returns Failure response with CancelFailureResult result when Ziina client throws error", async () => {
    vi.spyOn(mockedZiinaClient, "getPaymentIntent").mockImplementationOnce(async () =>
      err(new ZiinaApiInvalidRequestError("Error from Ziina API")),
    );

    const uc = new TransactionCancelationRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionCancelationRequestedEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    const failure = result._unsafeUnwrap();

    expect(failure).toBeInstanceOf(TransactionCancelationRequestedUseCaseResponses.Failure);
    expect(failure.transactionResult).toBeInstanceOf(CancelFailureResult);
  });

  it("Returns AppIsNotConfiguredResponse if config not found for specified channel", async () => {
    vi.spyOn(mockedAppConfigRepo, "getZiinaConfig").mockImplementationOnce(async () => ok(null));

    const uc = new TransactionCancelationRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionCancelationRequestedEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AppIsNotConfiguredResponse);
  });

  it("Returns BrokenAppResponse when payment intent cannot be mapped to Saleor money", async () => {
    vi.spyOn(mockedZiinaClient, "getPaymentIntent").mockImplementationOnce(async () =>
      ok({
        ...mockedZiinaPaymentIntent,
        currency_code: "abc",
      }),
    );

    const uc = new TransactionCancelationRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionCancelationRequestedEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(BrokenAppResponse);
  });
});
