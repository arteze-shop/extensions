import crypto from "node:crypto";

import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockedAppConfigRepo } from "@/__tests__/mocks/app-config-repo";
import { mockedSaleorAppId, mockedSaleorTransactionId } from "@/__tests__/mocks/constants";
import { mockAuthData } from "@/__tests__/mocks/mock-auth-data";
import { mockedZiinaConfig } from "@/__tests__/mocks/mock-ziina-config";
import { getMockedRecordedTransaction } from "@/__tests__/mocks/mocked-recorded-transaction";
import { MockedTransactionRecorder } from "@/__tests__/mocks/mocked-transaction-recorder";
import { mockedZiinaPaymentIntent } from "@/__tests__/mocks/mocked-ziina-payment-intent";
import { mockedZiinaPaymentIntentId } from "@/__tests__/mocks/mocked-ziina-payment-intent-id";
import { mockedZiinaRefund } from "@/__tests__/mocks/mocked-ziina-refund";
import { mockedZiinaWebhookSecret } from "@/__tests__/mocks/mocked-ziina-webhook-secret";
import { mockedSaleorApiUrl } from "@/__tests__/mocks/saleor-api-url";
import { BaseError } from "@/lib/errors";
import { ZiinaProblemReporter } from "@/modules/app-problems";
import {
  type ITransactionEventReporter,
  type TransactionEventReportResultResult,
} from "@/modules/saleor/transaction-event-reporter";
import { type ZiinaWebhookEvent } from "@/modules/ziina/types";
import { createZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";
import { createZiinaPaymentIntentStatus } from "@/modules/ziina/ziina-payment-intent-status";
import { createZiinaRefundId } from "@/modules/ziina/ziina-refund-id";
import { createZiinaRefundStatus } from "@/modules/ziina/ziina-refund-status";

import { ZiinaWebhookUseCase } from "./use-case";
import { ZiinaWebhookParams } from "./webhook-params";

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

const getWebhookParams = () => {
  const webhookUrl = new URL("https://test-deployment.com/api/webhooks/ziina");

  webhookUrl.searchParams.set("saleorApiUrl", mockedSaleorApiUrl);
  webhookUrl.searchParams.set("configurationId", mockedZiinaConfig.id);
  webhookUrl.searchParams.set("appId", mockedSaleorAppId);

  return ZiinaWebhookParams.createFromWebhookUrl(webhookUrl.toString())._unsafeUnwrap();
};

const getSignedBody = (rawBody: string) =>
  crypto.createHmac("sha256", mockedZiinaWebhookSecret).update(rawBody).digest("hex");

const mockEventReporter = {
  reportTransactionEvent: vi.fn(),
} satisfies ITransactionEventReporter;

const mockTransactionRecorder = new MockedTransactionRecorder();

let instance: ZiinaWebhookUseCase;

describe("ZiinaWebhookUseCase", () => {
  beforeEach(() => {
    vi.spyOn(mockedAppConfigRepo, "getZiinaConfig").mockImplementation(async () =>
      ok(mockedZiinaConfig),
    );

    mockTransactionRecorder.reset();

    instance = new ZiinaWebhookUseCase({
      appConfigRepo: mockedAppConfigRepo,
      transactionRecorder: mockTransactionRecorder,
      transactionEventReporterFactory() {
        return mockEventReporter;
      },
      problemReporterFactory: () => new ZiinaProblemReporter({} as never),
    });
  });

  describe("handling payment_intent.status.updated event", () => {
    const getPaymentIntentEvent = (): ZiinaWebhookEvent => ({
      event: "payment_intent.status.updated",
      data: {
        ...mockedZiinaPaymentIntent,
        id: createZiinaPaymentIntentId("pi_TEST_TEST_TEST"),
        status: createZiinaPaymentIntentStatus("completed"),
      },
    });

    it("Reports CHARGE_SUCCESS transaction event to Saleor", async () => {
      const rawBody = JSON.stringify(getPaymentIntentEvent());
      const signatureHeader = getSignedBody(rawBody);

      mockTransactionRecorder.transactions = {
        [mockedZiinaPaymentIntentId]: getMockedRecordedTransaction(),
      };

      mockEventReporter.reportTransactionEvent.mockImplementationOnce(async () => {
        const data: TransactionEventReportResultResult = {
          createdEventId: "TEST_EVENT_ID",
        };

        return ok(data);
      });

      const result = await instance.execute({
        rawBody,
        signatureHeader,
        webhookParams: getWebhookParams(),
        authData: mockAuthData,
      });

      expect(result._unsafeUnwrap().statusCode).toBe(200);

      expect(mockEventReporter.reportTransactionEvent).toHaveBeenCalledOnce();

      const input = vi.mocked(mockEventReporter.reportTransactionEvent).mock.calls[0][0];

      expect(input.type).toBe("CHARGE_SUCCESS");
      expect(input.message).toBe("Payment intent has been successful");
      expect(input.pspReference).toBe("pi_TEST_TEST_TEST");
      expect(input.transactionId).toBe(mockedSaleorTransactionId);
      expect(input.amount.amount).toBe(2);
      expect(input.amount.currency).toBe("AED");
      expect(input.actions).toStrictEqual(["REFUND"]);
      expect(input.externalUrl).toBe(mockedZiinaPaymentIntent.redirect_url);
      expect(input.saleorPaymentMethodDetailsInput).toBeNull();
    });

    it("Returns Success when transaction was not recorded - does not report to Saleor", async () => {
      const rawBody = JSON.stringify(getPaymentIntentEvent());
      const signatureHeader = getSignedBody(rawBody);

      const result = await instance.execute({
        rawBody,
        signatureHeader,
        webhookParams: getWebhookParams(),
        authData: mockAuthData,
      });

      expect(result._unsafeUnwrap().statusCode).toBe(200);
      expect(mockEventReporter.reportTransactionEvent).not.toHaveBeenCalled();
    });

    it("Returns Failure when the recorded transaction lookup fails", async () => {
      const rawBody = JSON.stringify(getPaymentIntentEvent());
      const signatureHeader = getSignedBody(rawBody);

      vi.spyOn(
        mockTransactionRecorder,
        "getTransactionByZiinaPaymentIntentId",
      ).mockImplementationOnce(async () =>
        err(new BaseError("Test error - failed fetching transaction")),
      );

      const result = await instance.execute({
        rawBody,
        signatureHeader,
        webhookParams: getWebhookParams(),
        authData: mockAuthData,
      });

      expect(result._unsafeUnwrapErr().statusCode).toBe(500);
      expect(mockEventReporter.reportTransactionEvent).not.toHaveBeenCalled();
    });
  });

  describe("handling refund.status.updated event", () => {
    const getRefundEvent = (): ZiinaWebhookEvent => ({
      event: "refund.status.updated",
      data: {
        ...mockedZiinaRefund,
        id: createZiinaRefundId("re_TEST_TEST_TEST"),
        payment_intent_id: createZiinaPaymentIntentId("pi_TEST_TEST_TEST"),
        status: createZiinaRefundStatus("completed"),
      },
    });

    it("Reports REFUND_SUCCESS transaction event to Saleor", async () => {
      const rawBody = JSON.stringify(getRefundEvent());
      const signatureHeader = getSignedBody(rawBody);

      mockTransactionRecorder.transactions = {
        [mockedZiinaPaymentIntentId]: getMockedRecordedTransaction(),
      };

      mockEventReporter.reportTransactionEvent.mockImplementationOnce(async () => {
        const data: TransactionEventReportResultResult = {
          createdEventId: "TEST_EVENT_ID",
        };

        return ok(data);
      });

      const result = await instance.execute({
        rawBody,
        signatureHeader,
        webhookParams: getWebhookParams(),
        authData: mockAuthData,
      });

      expect(result._unsafeUnwrap().statusCode).toBe(200);

      expect(mockEventReporter.reportTransactionEvent).toHaveBeenCalledOnce();

      const input = vi.mocked(mockEventReporter.reportTransactionEvent).mock.calls[0][0];

      expect(input.type).toBe("REFUND_SUCCESS");
      expect(input.message).toBe("Refund was successful");
      expect(input.pspReference).toBe("re_TEST_TEST_TEST");
      expect(input.transactionId).toBe(mockedSaleorTransactionId);
      expect(input.amount.amount).toBe(2);
      expect(input.amount.currency).toBe("AED");
      expect(input.actions).toStrictEqual(["REFUND"]);
      expect(input.externalUrl).toBe("");
      expect(input.saleorPaymentMethodDetailsInput).toBeNull();
    });
  });

  describe("error handling", () => {
    it("Returns 400 and reports webhook secret mismatch when signature is invalid", async () => {
      const reportWebhookSecretMismatchSpy = vi
        .spyOn(ZiinaProblemReporter.prototype, "reportWebhookSecretMismatch")
        .mockImplementation(async () => {});

      const result = await instance.execute({
        rawBody: JSON.stringify({ event: "payment_intent.status.updated", data: {} }),
        signatureHeader: "invalid-signature",
        webhookParams: getWebhookParams(),
        authData: mockAuthData,
      });

      expect(result._unsafeUnwrapErr().statusCode).toBe(400);
      expect(mockEventReporter.reportTransactionEvent).not.toHaveBeenCalled();
      expect(reportWebhookSecretMismatchSpy).toHaveBeenCalledWith(
        mockedZiinaConfig.id,
        mockedZiinaConfig.name,
      );
    });

    it("Returns 500 when config cannot be fetched", async () => {
      vi.spyOn(mockedAppConfigRepo, "getZiinaConfig").mockImplementationOnce(async () =>
        err(new BaseError("Test error - cant fetch config")),
      );

      const result = await instance.execute({
        rawBody: JSON.stringify({}),
        signatureHeader: "signature",
        webhookParams: getWebhookParams(),
        authData: mockAuthData,
      });

      expect(result._unsafeUnwrapErr().statusCode).toBe(500);
      expect(mockEventReporter.reportTransactionEvent).not.toHaveBeenCalled();
    });

    it("Returns 500 and reports config missing when config for given webhook is empty", async () => {
      const reportConfigMissingSpy = vi
        .spyOn(ZiinaProblemReporter.prototype, "reportConfigMissing")
        .mockImplementation(async () => {});

      vi.spyOn(mockedAppConfigRepo, "getZiinaConfig").mockImplementationOnce(async () => ok(null));

      const result = await instance.execute({
        rawBody: JSON.stringify({}),
        signatureHeader: "signature",
        webhookParams: getWebhookParams(),
        authData: mockAuthData,
      });

      expect(result._unsafeUnwrapErr().statusCode).toBe(500);
      expect(reportConfigMissingSpy).toHaveBeenCalledWith(mockedZiinaConfig.id);
      expect(mockEventReporter.reportTransactionEvent).not.toHaveBeenCalled();
    });

    it("Returns 500 when the webhook body is not a valid JSON", async () => {
      const rawBody = "not-a-json";
      const signatureHeader = getSignedBody(rawBody);

      const result = await instance.execute({
        rawBody,
        signatureHeader,
        webhookParams: getWebhookParams(),
        authData: mockAuthData,
      });

      expect(result._unsafeUnwrapErr().statusCode).toBe(500);
      expect(mockEventReporter.reportTransactionEvent).not.toHaveBeenCalled();
    });

    it("Returns 500 when the webhook body does not match the ZiinaWebhookEvent schema", async () => {
      const rawBody = JSON.stringify({ event: "unknown.event", data: {} });
      const signatureHeader = getSignedBody(rawBody);

      const result = await instance.execute({
        rawBody,
        signatureHeader,
        webhookParams: getWebhookParams(),
        authData: mockAuthData,
      });

      expect(result._unsafeUnwrapErr().statusCode).toBe(500);
      expect(mockEventReporter.reportTransactionEvent).not.toHaveBeenCalled();
    });
  });
});
