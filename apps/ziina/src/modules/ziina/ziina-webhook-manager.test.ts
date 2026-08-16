import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import { mockedZiinaRestrictedKey } from "@/__tests__/mocks/mocked-ziina-restricted-key";
import { type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";
import { mapZiinaErrorToApiError } from "@/modules/ziina/ziina-api-error";
import { type ZiinaClient } from "@/modules/ziina/ziina-client";
import {
  ZiinaWebhookManager,
  ZiinaWebhookManagerError,
} from "@/modules/ziina/ziina-webhook-manager";

const mockedSaleorApiUrl = "https://foo.bar.saleor.cloud/graphql/" as unknown as SaleorApiUrl;
const mockedConfigurationId = "81f323bd-91e2-4838-ab6e-5affd81ffc3b";
const mockedSaleorAppId = "saleor-app-id";

describe("ZiinaWebhookManager", () => {
  const createWebhookMock = vi.fn();
  const deleteWebhookMock = vi.fn();
  const mockedClient = {
    createWebhook: createWebhookMock,
    deleteWebhook: deleteWebhookMock,
  } as unknown as ZiinaClient;

  const instance = new ZiinaWebhookManager({
    clientFactory: () => mockedClient,
  });

  describe("createWebhook", () => {
    it("Calls ziina client to create webhook and returns generated secret and id", async () => {
      createWebhookMock.mockResolvedValue(ok({ success: true }));

      const result = await instance.createWebhook(
        {
          name: "config name",
          accessToken: mockedZiinaRestrictedKey,
          configurationId: mockedConfigurationId,
          ziinaEnv: "LIVE",
        },
        {
          appUrl: "http://localhost:3000",
          saleorApiUrl: mockedSaleorApiUrl,
          appId: mockedSaleorAppId,
        },
      );

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toMatchObject({
        id: expect.any(String),
        secret: expect.any(String),
      });

      /**
       * Ensure we send proper webhook params to Ziina
       */
      expect(createWebhookMock).toHaveBeenCalledWith({
        url: "http://localhost:3000/api/webhooks/ziina?saleorApiUrl=https%3A%2F%2Ffoo.bar.saleor.cloud%2Fgraphql%2F&configurationId=81f323bd-91e2-4838-ab6e-5affd81ffc3b&appId=saleor-app-id",
        secret: expect.any(String),
      });
    });

    it("Returns ZiinaWebhookManagerError if ziina client returns an error", async () => {
      createWebhookMock.mockResolvedValue(
        err(mapZiinaErrorToApiError({ error: new Error("Test error") })),
      );

      const result = await instance.createWebhook(
        {
          name: "config name",
          accessToken: mockedZiinaRestrictedKey,
          configurationId: mockedConfigurationId,
          ziinaEnv: "LIVE",
        },
        {
          appUrl: "http://localhost:3000",
          saleorApiUrl: mockedSaleorApiUrl,
          appId: mockedSaleorAppId,
        },
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ZiinaWebhookManagerError);
    });
  });

  describe("getWebhook", () => {
    it("Returns missing status when webhookId is null", async () => {
      const result = await instance.getWebhook({
        accessToken: mockedZiinaRestrictedKey,
        webhookId: null,
      });

      expect(result._unsafeUnwrap()).toStrictEqual({ status: "missing" });
    });

    it("Returns active status when webhookId is present", async () => {
      const result = await instance.getWebhook({
        accessToken: mockedZiinaRestrictedKey,
        webhookId: "wh_123",
      });

      expect(result._unsafeUnwrap()).toStrictEqual({ status: "active" });
    });
  });

  describe("removeWebhook", () => {
    it("Calls ziina client to remove the webhook", async () => {
      deleteWebhookMock.mockResolvedValue(ok({ success: true }));

      const result = await instance.removeWebhook({ accessToken: mockedZiinaRestrictedKey });

      expect(result.isOk()).toBe(true);
      expect(deleteWebhookMock).toHaveBeenCalledTimes(1);
    });

    it("Returns ZiinaWebhookManagerError if ziina client returns an error", async () => {
      deleteWebhookMock.mockResolvedValue(
        err(mapZiinaErrorToApiError({ error: new Error("Test error") })),
      );

      const result = await instance.removeWebhook({ accessToken: mockedZiinaRestrictedKey });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ZiinaWebhookManagerError);
    });
  });
});
