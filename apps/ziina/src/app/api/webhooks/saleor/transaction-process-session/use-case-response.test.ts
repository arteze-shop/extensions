import { describe, expect, it } from "vitest";

import { getMockedSaleorMoney } from "@/__tests__/mocks/constants";
import { mockedZiinaPaymentIntentId } from "@/__tests__/mocks/mocked-ziina-payment-intent-id";
import { ChargeActionRequiredResult } from "@/modules/transaction-result/action-required-result";
import { ChargeFailureResult } from "@/modules/transaction-result/failure-result";
import { ChargeSuccessResult } from "@/modules/transaction-result/success-result";
import { ZiinaApiInvalidRequestError } from "@/modules/ziina/ziina-api-error";
import { createZiinaPaymentIntentStatus } from "@/modules/ziina/ziina-payment-intent-status";

import { TransactionProcessSessionUseCaseResponses } from "./use-case-response";

describe("TransactionProcessSessionUseCaseResponses", () => {
  describe("Success with ChargeActionRequired as result", () => {
    it("getResponse() returns valid Response with status 200 and charge action required payload", async () => {
      const response = new TransactionProcessSessionUseCaseResponses.Success({
        transactionResult: new ChargeActionRequiredResult(
          createZiinaPaymentIntentStatus("requires_user_action"),
        ),
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
          "actions": [
            "CANCEL",
          ],
          "amount": 100,
          "message": "Payment intent requires action",
          "pspReference": "pi_TEST_TEST_TEST",
          "result": "CHARGE_ACTION_REQUIRED",
        }
      `);
    });
  });

  describe("Success with ChargeSuccess as result", () => {
    it("getResponse() returns valid Response with status 200 and charge success payload", async () => {
      const response = new TransactionProcessSessionUseCaseResponses.Success({
        transactionResult: new ChargeSuccessResult(),
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
          "actions": [
            "REFUND",
          ],
          "amount": 100,
          "message": "Payment intent has been successful",
          "pspReference": "pi_TEST_TEST_TEST",
          "result": "CHARGE_SUCCESS",
        }
      `);
    });
  });

  describe("Failure", () => {
    it("getResponse() returns valid Response with status 200 and message with failure reason and additional information inside data object", async () => {
      const response = new TransactionProcessSessionUseCaseResponses.Failure({
        transactionResult: new ChargeFailureResult(),
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
            "CHARGE",
          ],
          "data": {
            "paymentIntent": {
              "errors": [
                {
                  "code": "ZiinaApiError",
                  "message": "There is a problem with the request to Ziina API",
                },
              ],
            },
          },
          "message": "There is a problem with the request to Ziina API",
          "pspReference": "pi_TEST_TEST_TEST",
          "result": "CHARGE_FAILURE",
        }
      `);
    });
  });
});
