import { describe, expect, it, type Mock, vi } from "vitest";

import { mockedZiinaAccount } from "@/__tests__/mocks/mocked-ziina-account";
import { mockedZiinaPaymentIntent } from "@/__tests__/mocks/mocked-ziina-payment-intent";
import { mockedZiinaRefund } from "@/__tests__/mocks/mocked-ziina-refund";
import { mockedZiinaRestrictedKey } from "@/__tests__/mocks/mocked-ziina-restricted-key";
import {
  ZiinaApiConnectionError,
  ZiinaApiInvalidRequestError,
} from "@/modules/ziina/ziina-api-error";
import { createZiinaClient, ZiinaClient } from "@/modules/ziina/ziina-client";

const createFetchMock = (
  impl: (
    url: string,
    init?: RequestInit,
  ) => Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
  }>,
): Mock<typeof fetch> => vi.fn(impl);

const createClient = (fetchMock: typeof fetch) =>
  new ZiinaClient({ restrictedKey: mockedZiinaRestrictedKey, fetchFn: fetchMock });

describe("ZiinaClient", () => {
  describe("createPaymentIntent", () => {
    it("creates a payment intent and sends the request with bearer auth", async () => {
      const fetchMock = createFetchMock(async () => ({
        ok: true,
        status: 200,
        json: async () => mockedZiinaPaymentIntent,
      }));

      const client = createClient(fetchMock);

      const result = await client.createPaymentIntent({ amount: 200, currencyCode: "AED" });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toStrictEqual(mockedZiinaPaymentIntent);

      const [url, init] = fetchMock.mock.calls[0];

      expect(url).toBe("https://api-v2.ziina.com/api/payment_intent");
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        `Bearer ${mockedZiinaRestrictedKey}`,
      );
      expect(JSON.parse(init?.body as string)).toStrictEqual({
        amount: 200,
        currency_code: "AED",
      });
    });

    it("returns ZiinaApiConnectionError when the network request fails", async () => {
      const fetchMock = createFetchMock(async () => {
        throw new TypeError("Failed to fetch");
      });

      const client = createClient(fetchMock);

      const result = await client.createPaymentIntent({ amount: 200, currencyCode: "AED" });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ZiinaApiConnectionError);
    });

    it("returns ZiinaApiInvalidRequestError with message from the error body", async () => {
      const fetchMock = createFetchMock(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ message: "Invalid amount", code: "invalid_amount" }),
      }));

      const client = createClient(fetchMock);

      const result = await client.createPaymentIntent({ amount: 200, currencyCode: "AED" });

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();

      expect(error).toBeInstanceOf(ZiinaApiInvalidRequestError);
      expect(error.publicMessage).toBe("Invalid amount");
    });
  });

  describe("getPaymentIntent", () => {
    it("fetches a payment intent by id", async () => {
      const fetchMock = createFetchMock(async () => ({
        ok: true,
        status: 200,
        json: async () => mockedZiinaPaymentIntent,
      }));

      const client = createClient(fetchMock);

      const result = await client.getPaymentIntent({ id: "payment-intent-1" });

      expect(result._unsafeUnwrap()).toStrictEqual(mockedZiinaPaymentIntent);

      const [url, init] = fetchMock.mock.calls[0];

      expect(url).toBe("https://api-v2.ziina.com/api/payment_intent/payment-intent-1");
      expect(init?.method).toBe("GET");
    });
  });

  describe("createRefund", () => {
    it("creates a refund", async () => {
      const fetchMock = createFetchMock(async () => ({
        ok: true,
        status: 200,
        json: async () => mockedZiinaRefund,
      }));

      const client = createClient(fetchMock);

      const result = await client.createRefund({
        id: "refund-1",
        paymentIntentId: "payment-intent-1",
        amount: 200,
        currencyCode: "AED",
        test: true,
      });

      expect(result._unsafeUnwrap()).toStrictEqual(mockedZiinaRefund);

      const [url, init] = fetchMock.mock.calls[0];

      expect(url).toBe("https://api-v2.ziina.com/api/refund");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toStrictEqual({
        id: "refund-1",
        payment_intent_id: "payment-intent-1",
        amount: 200,
        currency_code: "AED",
        test: true,
      });
    });
  });

  describe("getRefund", () => {
    it("fetches a refund by id", async () => {
      const fetchMock = createFetchMock(async () => ({
        ok: true,
        status: 200,
        json: async () => mockedZiinaRefund,
      }));

      const client = createClient(fetchMock);

      const result = await client.getRefund({ id: "refund-1" });

      expect(result._unsafeUnwrap()).toStrictEqual(mockedZiinaRefund);

      const [url, init] = fetchMock.mock.calls[0];

      expect(url).toBe("https://api-v2.ziina.com/api/refund/refund-1");
      expect(init?.method).toBe("GET");
    });
  });

  describe("getAccount", () => {
    it("fetches the account", async () => {
      const fetchMock = createFetchMock(async () => ({
        ok: true,
        status: 200,
        json: async () => mockedZiinaAccount,
      }));

      const client = createClient(fetchMock);

      const result = await client.getAccount();

      expect(result._unsafeUnwrap()).toStrictEqual(mockedZiinaAccount);

      const [url, init] = fetchMock.mock.calls[0];

      expect(url).toBe("https://api-v2.ziina.com/api/account");
      expect(init?.method).toBe("GET");
    });
  });

  describe("createWebhook", () => {
    it("creates a webhook with url and secret", async () => {
      const fetchMock = createFetchMock(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      }));

      const client = createClient(fetchMock);

      const result = await client.createWebhook({
        url: "https://example.com/webhook",
        secret: "secret",
      });

      expect(result._unsafeUnwrap()).toStrictEqual({ success: true });

      const [url, init] = fetchMock.mock.calls[0];

      expect(url).toBe("https://api-v2.ziina.com/api/webhook");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toStrictEqual({
        url: "https://example.com/webhook",
        secret: "secret",
      });
    });
  });

  describe("deleteWebhook", () => {
    it("deletes the webhook", async () => {
      const fetchMock = createFetchMock(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      }));

      const client = createClient(fetchMock);

      const result = await client.deleteWebhook();

      expect(result._unsafeUnwrap()).toStrictEqual({ success: true });

      const [url, init] = fetchMock.mock.calls[0];

      expect(url).toBe("https://api-v2.ziina.com/api/webhook");
      expect(init?.method).toBe("DELETE");
    });
  });

  describe("createZiinaClient", () => {
    it("returns a ZiinaClient instance", () => {
      const client = createZiinaClient({ restrictedKey: mockedZiinaRestrictedKey });

      expect(client).toBeInstanceOf(ZiinaClient);
    });
  });

  it("uses global fetch when fetchFn is not provided", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    const client = new ZiinaClient({ restrictedKey: mockedZiinaRestrictedKey });

    await client.getAccount();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api-v2.ziina.com/api/account",
      expect.objectContaining({ method: "GET" }),
    );

    vi.unstubAllGlobals();
  });
});
