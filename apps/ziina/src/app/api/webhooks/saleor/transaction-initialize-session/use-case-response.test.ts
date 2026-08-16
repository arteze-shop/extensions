import { describe, expect, it } from "vitest";

import { getMockedSaleorMoney } from "@/__tests__/mocks/constants";
import { mockedZiinaPaymentIntentId } from "@/__tests__/mocks/mocked-ziina-payment-intent-id";
import { ChargeActionRequiredResult } from "@/modules/transaction-result/action-required-result";
import { ChargeFailureResult } from "@/modules/transaction-result/failure-result";
import { ZiinaApiInvalidRequestError } from "@/modules/ziina/ziina-api-error";
import { createZiinaPaymentIntentStatus } from "@/modules/ziina/ziina-payment-intent-status";

import { TransactionInitializeSessionUseCaseResponses } from "./use-case-response";

describe("TransactionInitializeSessionUseCaseResponses", () => {
  describe("Success", () => {
    it("getResponse() returns valid Response with status 200 and formatted 'data' object containing redirectUrl", async () => {
      const response = new TransactionInitializeSessionUseCaseResponses.Success({
        transactionResult: new ChargeActionRequiredResult(
          createZiinaPaymentIntentStatus("requires_user_action"),
        ),
        saleorMoney: getMockedSaleorMoney(10000, "AED"),
        ziinaPaymentIntentId: mockedZiinaPaymentIntentId,
        redirectUrl: "https://pay.ziina.com/test",
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
          "data": {
            "paymentIntent": {
              "redirectUrl": "https://pay.ziina.com/test",
            },
          },
          "externalUrl": "https://pay.ziina.com/test",
          "message": "Payment intent requires action",
          "pspReference": "pi_TEST_TEST_TEST",
          "result": "CHARGE_ACTION_REQUIRED",
        }
      `);
    });
  });

  describe("Failure", () => {
    it("getResponse() returns valid Response with status 200 and message with failure reason and additional information inside data object", async () => {
      const response = new TransactionInitializeSessionUseCaseResponses.Failure({
        transactionResult: new ChargeFailureResult(),
        error: new ZiinaApiInvalidRequestError("Error from Ziina API"),
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
          "result": "CHARGE_FAILURE",
        }
      `);
    });
  });
});
