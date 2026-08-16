import { describe, expect, it, vi } from "vitest";

import { mockedZiinaPaymentIntent } from "@/__tests__/mocks/mocked-ziina-payment-intent";
import { mockedZiinaRestrictedKey } from "@/__tests__/mocks/mocked-ziina-restricted-key";
import { ZiinaApiAuthenticationError } from "@/modules/ziina/ziina-api-error";
import { ZiinaAuthValidator } from "@/modules/ziina/ziina-auth-validator";
import { ZiinaClient } from "@/modules/ziina/ziina-client";

const createFetchMock = (
  impl: (
    url: string,
    init?: RequestInit,
  ) => Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
  }>,
) => vi.fn(impl) as unknown as typeof fetch;

describe("ZiinaAuthValidator", () => {
  describe("validateZiinaAuth", () => {
    it("Return ok if creating a TEST payment intent succeeds", async () => {
      let capturedBody: string | undefined;

      const client = new ZiinaClient({
        restrictedKey: mockedZiinaRestrictedKey,
        fetchFn: createFetchMock(async (_url, init) => {
          capturedBody = init?.body as string;

          return {
            ok: true,
            status: 200,
            json: async () => mockedZiinaPaymentIntent,
          };
        }),
      });

      const instance = ZiinaAuthValidator.createFromClient(client);

      const result = await instance.validateZiinaAuth();

      expect(result.isOk()).toBe(true);

      /**
       * Auth is validated by creating a TEST payment intent in AED
       */
      expect(JSON.parse(capturedBody ?? "{}")).toMatchObject({
        amount: 200,
        currency_code: "AED",
        test: true,
        message: "Ziina connection validation",
      });
    });

    it("Return err if creating a TEST payment intent fails", async () => {
      const client = new ZiinaClient({
        restrictedKey: mockedZiinaRestrictedKey,
        fetchFn: createFetchMock(async () => ({
          ok: false,
          status: 401,
          json: async () => ({ message: "Invalid token", code: "unauthorized" }),
        })),
      });

      const instance = ZiinaAuthValidator.createFromClient(client);

      const result = await instance.validateZiinaAuth();

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ZiinaApiAuthenticationError);
    });
  });
});
