import { describe, expect, it } from "vitest";

import { ZiinaApiInvalidRequestError } from "@/modules/ziina/ziina-api-error";

import { PaymentGatewayInitializeSessionUseCaseResponses } from "./use-case-response";

describe("PaymentGatewayInitializeSessionUseCaseResponses", () => {
  describe("Success", () => {
    it("getResponse() returns valid Response with status 200 and empty data object", async () => {
      const successResponse = new PaymentGatewayInitializeSessionUseCaseResponses.Success({
        appContext: {
          ziinaEnv: "LIVE",
        },
      });
      const fetchReponse = successResponse.getResponse();

      expect(fetchReponse.status).toBe(200);
      expect(await fetchReponse.json()).toMatchInlineSnapshot(`
        {
          "data": {},
        }
      `);
    });
  });

  describe("Failure", () => {
    it("getResponse() returns valid Response with status 200 and errors inside data object", async () => {
      const failureResponse = new PaymentGatewayInitializeSessionUseCaseResponses.Failure({
        error: new ZiinaApiInvalidRequestError("Error from Ziina API"),
        appContext: {
          ziinaEnv: "LIVE",
        },
      });
      const fetchReponse = failureResponse.getResponse();

      expect(fetchReponse.status).toBe(200);
      expect(await fetchReponse.json()).toMatchInlineSnapshot(`
        {
          "data": {
            "errors": [
              {
                "code": "ZiinaApiError",
                "message": "There is a problem with the request to Ziina API",
              },
            ],
          },
        }
      `);
    });
  });
});
