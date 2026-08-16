import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import { mockedAppConfigRepo } from "@/__tests__/mocks/app-config-repo";
import { mockedSaleorAppId } from "@/__tests__/mocks/constants";
import { mockZiinaProblemReporter } from "@/__tests__/mocks/mock-ziina-problem-reporter";
import { mockedZiinaClient } from "@/__tests__/mocks/mocked-ziina-client";
import { mockedZiinaPaymentIntent } from "@/__tests__/mocks/mocked-ziina-payment-intent";
import { mockedSaleorApiUrl } from "@/__tests__/mocks/saleor-api-url";
import { getMockedTransactionChargeRequestedEvent } from "@/__tests__/mocks/saleor-events/transaction-charge-requested-event";
import {
  AppIsNotConfiguredResponse,
  BrokenAppResponse,
} from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import { ChargeActionRequiredResult } from "@/modules/transaction-result/action-required-result";
import { ChargeFailureResult } from "@/modules/transaction-result/failure-result";
import { ChargeSuccessResult } from "@/modules/transaction-result/success-result";
import { ZiinaApiInvalidRequestError } from "@/modules/ziina/ziina-api-error";

import { TransactionChargeRequestedUseCase } from "./use-case";
import { TransactionChargeRequestedUseCaseResponses } from "./use-case-response";

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

describe("TransactionChargeRequestedUseCase", () => {
  const ziinaClientFactory = {
    create: () => mockedZiinaClient,
  };

  it("Calls Ziina client to get payment intent with payment intent id from transaction pspReference", async () => {
    const saleorEvent = getMockedTransactionChargeRequestedEvent();

    const spy = vi
      .spyOn(mockedZiinaClient, "getPaymentIntent")
      .mockImplementationOnce(async () => ok(mockedZiinaPaymentIntent));

    const uc = new TransactionChargeRequestedUseCase({
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

  it("Returns Success response with ChargeSuccessResult result when payment intent is completed", async () => {
    vi.spyOn(mockedZiinaClient, "getPaymentIntent").mockImplementationOnce(async () =>
      ok({
        ...mockedZiinaPaymentIntent,
        status: "completed",
      }),
    );

    const uc = new TransactionChargeRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionChargeRequestedEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    const success = result._unsafeUnwrap();

    expect(success).toBeInstanceOf(TransactionChargeRequestedUseCaseResponses.Success);
    expect(success.transactionResult).toBeInstanceOf(ChargeSuccessResult);
  });

  it("Returns Success response with ChargeActionRequiredResult result when payment intent requires action", async () => {
    vi.spyOn(mockedZiinaClient, "getPaymentIntent").mockImplementationOnce(async () =>
      ok(mockedZiinaPaymentIntent),
    );

    const uc = new TransactionChargeRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionChargeRequestedEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    const success = result._unsafeUnwrap();

    expect(success).toBeInstanceOf(TransactionChargeRequestedUseCaseResponses.Success);
    expect(success.transactionResult).toBeInstanceOf(ChargeActionRequiredResult);
  });

  it("Returns Failure response with ChargeFailureResult result when Ziina client throws error", async () => {
    vi.spyOn(mockedZiinaClient, "getPaymentIntent").mockImplementationOnce(async () =>
      err(new ZiinaApiInvalidRequestError("Error from Ziina API")),
    );

    const uc = new TransactionChargeRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionChargeRequestedEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    const failure = result._unsafeUnwrap();

    expect(failure).toBeInstanceOf(TransactionChargeRequestedUseCaseResponses.Failure);
    expect(failure.transactionResult).toBeInstanceOf(ChargeFailureResult);
  });

  it("Returns AppIsNotConfiguredResponse if config not found for specified channel", async () => {
    vi.spyOn(mockedAppConfigRepo, "getZiinaConfig").mockImplementationOnce(async () => ok(null));

    const uc = new TransactionChargeRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionChargeRequestedEvent(),
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

    const uc = new TransactionChargeRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionChargeRequestedEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(BrokenAppResponse);
  });
});
