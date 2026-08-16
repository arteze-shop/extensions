import { describe, expect, it } from "vitest";

import { getMockedSaleorMoney } from "@/__tests__/mocks/constants";
import { mockedZiinaPaymentIntentId } from "@/__tests__/mocks/mocked-ziina-payment-intent-id";
import {
  CancelFailureResult,
  CancelSuccessResult,
} from "@/modules/transaction-result/cancel-result";

import { TransactionCancelationRequestedUseCaseResponses } from "./use-case-response";

describe("TransactionCancelationRequestedUseCaseResponses", () => {
  describe("Success", () => {
    it("getResponse() returns valid Response with status 200 and cancel success payload", async () => {
      const response = new TransactionCancelationRequestedUseCaseResponses.Success({
        transactionResult: new CancelSuccessResult(),
        saleorMoney: getMockedSaleorMoney(10000, "AED"),
        ziinaPaymentIntentId: mockedZiinaPaymentIntentId,
        appContext: {
          ziinaEnv: "LIVE",
        },
      });
      const fetchResponse = response.getResponse();

      expect(fetchResponse.status).toBe(200);
      expect(await fetchResponse.json()).toMatchInlineSnapshot(`
        {
          "actions": [],
          "amount": 100,
          "message": "Payment intent was cancelled",
          "pspReference": "pi_TEST_TEST_TEST",
          "result": "CANCEL_SUCCESS",
        }
      `);
    });
  });

  describe("Failure with error being null", () => {
    it("getResponse() returns valid Response with status 200 and cancel failure payload", async () => {
      const response = new TransactionCancelationRequestedUseCaseResponses.Failure({
        transactionResult: new CancelFailureResult(),
        error: null,
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
            "CANCEL",
          ],
          "message": "Payment intent cannot be cancelled",
          "pspReference": "pi_TEST_TEST_TEST",
          "result": "CANCEL_FAILURE",
        }
      `);
    });
  });
});
