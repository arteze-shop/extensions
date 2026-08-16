import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import { mockedAppConfigRepo } from "@/__tests__/mocks/app-config-repo";
import { mockedSaleorAppId } from "@/__tests__/mocks/constants";
import { mockZiinaProblemReporter } from "@/__tests__/mocks/mock-ziina-problem-reporter";
import { mockedZiinaClient } from "@/__tests__/mocks/mocked-ziina-client";
import { mockedZiinaRefund } from "@/__tests__/mocks/mocked-ziina-refund";
import { mockedSaleorApiUrl } from "@/__tests__/mocks/saleor-api-url";
import { getMockedTransactionRefundRequestedEvent } from "@/__tests__/mocks/saleor-events/transaction-refund-request-event";
import {
  AppIsNotConfiguredResponse,
  MalformedRequestResponse,
} from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import { RefundFailureResult } from "@/modules/transaction-result/refund-result";
import { ZiinaApiInvalidRequestError } from "@/modules/ziina/ziina-api-error";

import { TransactionRefundRequestedUseCase } from "./use-case";
import { TransactionRefundRequestedUseCaseResponses } from "./use-case-response";

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

describe("TransactionRefundRequestedUseCase", () => {
  const ziinaClientFactory = {
    create: () => mockedZiinaClient,
  };

  it("Calls Ziina client to create refund with payment intent id from transaction pspReference", async () => {
    const saleorEvent = getMockedTransactionRefundRequestedEvent();

    const spy = vi
      .spyOn(mockedZiinaClient, "createRefund")
      .mockImplementationOnce(async () => ok(mockedZiinaRefund));

    const uc = new TransactionRefundRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: saleorEvent,
      problemReporter: mockZiinaProblemReporter,
    });

    const args = spy.mock.calls[0][0];

    expect(args.paymentIntentId).toBe(saleorEvent.transaction?.pspReference);
    expect(args.amount).toBe(10000);
    expect(args.currencyCode).toBe("AED");
    expect(args.test).toBe(false);
  });

  it("Returns Success response when refund is created", async () => {
    vi.spyOn(mockedZiinaClient, "createRefund").mockImplementationOnce(async () =>
      ok(mockedZiinaRefund),
    );

    const uc = new TransactionRefundRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionRefundRequestedEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    const success = result._unsafeUnwrap();

    if (!(success instanceof TransactionRefundRequestedUseCaseResponses.Success)) {
      throw new Error("Expected Success response");
    }

    expect(success.ziinaRefundId).toBe("ziina_refund_test");
  });

  it("Returns Failure response with RefundFailureResult result when Ziina client throws error", async () => {
    vi.spyOn(mockedZiinaClient, "createRefund").mockImplementationOnce(async () =>
      err(new ZiinaApiInvalidRequestError("Error from Ziina API")),
    );

    const uc = new TransactionRefundRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionRefundRequestedEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    const failure = result._unsafeUnwrap();

    if (!(failure instanceof TransactionRefundRequestedUseCaseResponses.Failure)) {
      throw new Error("Expected Failure response");
    }

    expect(failure.transactionResult).toBeInstanceOf(RefundFailureResult);
  });

  it("Returns AppIsNotConfiguredResponse if config not found for specified channel", async () => {
    vi.spyOn(mockedAppConfigRepo, "getZiinaConfig").mockImplementationOnce(async () => ok(null));

    const uc = new TransactionRefundRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: getMockedTransactionRefundRequestedEvent(),
      problemReporter: mockZiinaProblemReporter,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AppIsNotConfiguredResponse);
  });

  it("Returns MalformedRequestResponse when refund amount cannot be parsed to Ziina money", async () => {
    const saleorEvent = {
      ...getMockedTransactionRefundRequestedEvent(),
      action: {
        amount: -100,
        currency: "AED",
      },
    };

    const uc = new TransactionRefundRequestedUseCase({
      appConfigRepo: mockedAppConfigRepo,
      ziinaClientFactory,
    });

    const result = await uc.execute({
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
      event: saleorEvent,
      problemReporter: mockZiinaProblemReporter,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(MalformedRequestResponse);
  });
});
