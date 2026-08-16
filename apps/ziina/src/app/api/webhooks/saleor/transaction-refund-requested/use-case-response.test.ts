import { describe, expect, it } from "vitest";

import { mockedZiinaPaymentIntentId } from "@/__tests__/mocks/mocked-ziina-payment-intent-id";
import { mockedZiinaRefundId } from "@/__tests__/mocks/mocked-ziina-refund-id";
import { RefundFailureResult } from "@/modules/transaction-result/refund-result";
import { ZiinaApiInvalidRequestError } from "@/modules/ziina/ziina-api-error";

import { TransactionRefundRequestedUseCaseResponses } from "./use-case-response";

describe("TransactionRefundRequestedUseCaseResponses", () => {
  describe("Success", () => {
    it("getResponse() returns valid Response with status 200 and async payload with refund id", async () => {
      const response = new TransactionRefundRequestedUseCaseResponses.Success({
        ziinaRefundId: mockedZiinaRefundId,
        appContext: {
          ziinaEnv: "LIVE",
        },
      });
      const fetchResponse = response.getResponse();

      expect(fetchResponse.status).toBe(200);
      expect(await fetchResponse.json()).toMatchInlineSnapshot(`
        {
          "actions": [],
          "pspReference": "ziina_refund_test",
        }
      `);
    });
  });

  describe("Failure", () => {
    it("getResponse() returns valid Response with status 200 and message with failure reason", async () => {
      const response = new TransactionRefundRequestedUseCaseResponses.Failure({
        transactionResult: new RefundFailureResult(),
        error: new ZiinaApiInvalidRequestError("Error from Ziina API"),
        ziinaPaymentIntentId: mockedZiinaPaymentIntentId,
        appContext: {
          ziinaEnv: "LIVE",
        },
      });
      const fetchResponse = response.getResponse();

      expect(fetchResponse.status).toBe(200);
      expect(await fetchResponse.json()).toMatchInlineSnapshot(`
        {
          "actions": [
            "REFUND",
          ],
          "message": "There is a problem with the request to Ziina API",
          "pspReference": "pi_TEST_TEST_TEST",
          "result": "REFUND_FAILURE",
        }
      `);
    });
  });
});
