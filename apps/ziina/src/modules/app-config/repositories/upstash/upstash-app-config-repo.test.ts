import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockedConfigurationId,
  mockedSaleorAppId,
  mockedSaleorChannelId,
} from "@/__tests__/mocks/constants";
import { mockEncryptor } from "@/__tests__/mocks/mock-encryptor";
import { mockedZiinaConfig } from "@/__tests__/mocks/mock-ziina-config";
import { mockedSaleorApiUrl } from "@/__tests__/mocks/saleor-api-url";
import { AppRootConfig } from "@/modules/app-config/domain/app-root-config";
import { ZiinaConfig } from "@/modules/app-config/domain/ziina-config";
import { AppConfigRepoError } from "@/modules/app-config/repositories/app-config-repo";
import { UpstashAppConfigRepo } from "@/modules/app-config/repositories/upstash/upstash-app-config-repo";

const getConfigKey = (saleorApiUrl = mockedSaleorApiUrl, appId = mockedSaleorAppId) =>
  `ziina:config:${saleorApiUrl}#${appId}`;

const createInMemoryClient = () => {
  const store: Record<string, string> = {};

  return {
    store,
    get: vi.fn(async (key: string) => store[key] ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    setIfNotExists: vi.fn(async (key: string, value: string) => {
      if (key in store) {
        return false;
      }

      store[key] = value;

      return true;
    }),
    del: vi.fn(async (key: string) => {
      delete store[key];
    }),
  };
};

describe("UpstashAppConfigRepo", () => {
  let client: ReturnType<typeof createInMemoryClient>;
  let repo: UpstashAppConfigRepo;

  beforeEach(() => {
    client = createInMemoryClient();
    repo = new UpstashAppConfigRepo({ client, encryptor: mockEncryptor });
  });

  describe("getRootConfig", () => {
    it("Returns empty AppRootConfig when document does not exist", async () => {
      const result = await repo.getRootConfig({
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeInstanceOf(AppRootConfig);
      expect(result._unsafeUnwrap()).toStrictEqual(new AppRootConfig({}, {}));
    });

    it("Returns populated AppRootConfig with decrypted configs and mappings", async () => {
      await repo.saveZiinaConfig({
        config: mockedZiinaConfig,
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
      });

      await repo.updateMapping(
        { saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId },
        { configId: mockedConfigurationId, channelId: mockedSaleorChannelId },
      );

      const result = await repo.getRootConfig({
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
      });

      const rootConfig = result._unsafeUnwrap();

      expect(rootConfig).toBeInstanceOf(AppRootConfig);
      expect(rootConfig.chanelConfigMapping).toStrictEqual({
        [mockedSaleorChannelId]: mockedConfigurationId,
      });
      expect(rootConfig.ziinaConfigsById[mockedConfigurationId]).toBeInstanceOf(ZiinaConfig);
      expect(rootConfig.ziinaConfigsById[mockedConfigurationId].id).toBe(mockedConfigurationId);
      expect(rootConfig.ziinaConfigsById[mockedConfigurationId].name).toBe(mockedZiinaConfig.name);
      expect(rootConfig.ziinaConfigsById[mockedConfigurationId].accessToken).toBe(
        mockedZiinaConfig.accessToken,
      );
      expect(rootConfig.ziinaConfigsById[mockedConfigurationId].webhookSecret).toBe(
        mockedZiinaConfig.webhookSecret,
      );
      expect(rootConfig.ziinaConfigsById[mockedConfigurationId].webhookId).toBe(
        mockedZiinaConfig.webhookId,
      );
      expect(rootConfig.ziinaConfigsById[mockedConfigurationId].ziinaEnv).toBe("LIVE");
    });

    it("Returns FailureFetchingConfig if client throws", async () => {
      client.get.mockRejectedValueOnce(new Error("Upstash unavailable"));

      const result = await repo.getRootConfig({
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(AppConfigRepoError.FailureFetchingConfig);
    });
  });

  describe("getZiinaConfig", () => {
    it("Returns null when document does not exist", async () => {
      const result = await repo.getZiinaConfig({
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
        channelId: mockedSaleorChannelId,
      });

      expect(result._unsafeUnwrap()).toBeNull();
    });

    it("Returns config when queried by configId", async () => {
      await repo.saveZiinaConfig({
        config: mockedZiinaConfig,
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
      });

      const result = await repo.getZiinaConfig({
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
        configId: mockedConfigurationId,
      });

      expect(result._unsafeUnwrap()).toBeInstanceOf(ZiinaConfig);
      expect(result._unsafeUnwrap()).toMatchObject({ id: mockedConfigurationId });
    });

    it("Returns config when queried by channelId via mapping", async () => {
      await repo.saveZiinaConfig({
        config: mockedZiinaConfig,
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
      });

      await repo.updateMapping(
        { saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId },
        { configId: mockedConfigurationId, channelId: mockedSaleorChannelId },
      );

      const result = await repo.getZiinaConfig({
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
        channelId: mockedSaleorChannelId,
      });

      expect(result._unsafeUnwrap()).toBeInstanceOf(ZiinaConfig);
      expect(result._unsafeUnwrap()).toMatchObject({ id: mockedConfigurationId });
    });

    it("Returns null when channelId has no mapping", async () => {
      await repo.saveZiinaConfig({
        config: mockedZiinaConfig,
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
      });

      const result = await repo.getZiinaConfig({
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
        channelId: "channel-without-mapping",
      });

      expect(result._unsafeUnwrap()).toBeNull();
    });

    it("Returns FailureFetchingConfig if client throws", async () => {
      client.get.mockRejectedValueOnce(new Error("Upstash unavailable"));

      const result = await repo.getZiinaConfig({
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
        configId: mockedConfigurationId,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(AppConfigRepoError.FailureFetchingConfig);
    });
  });

  describe("saveZiinaConfig", () => {
    it("Encrypts secret fields and persists config in single document", async () => {
      const result = await repo.saveZiinaConfig({
        config: mockedZiinaConfig,
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
      });

      expect(result.isOk()).toBe(true);

      const stored = JSON.parse(client.store[getConfigKey()]) as {
        chanelConfigMapping: Record<string, string>;
        ziinaConfigsById: Record<
          string,
          {
            id: string;
            name: string;
            webhookId: string;
            ziinaEnv: string;
            accessToken: string;
            webhookSecret: string;
          }
        >;
      };

      expect(stored).toStrictEqual({
        chanelConfigMapping: {},
        ziinaConfigsById: {
          [mockedConfigurationId]: {
            id: mockedConfigurationId,
            name: mockedZiinaConfig.name,
            webhookId: mockedZiinaConfig.webhookId,
            ziinaEnv: mockedZiinaConfig.ziinaEnv,
            accessToken: expect.any(String),
            webhookSecret: expect.any(String),
          },
        },
      });

      const storedConfig = stored.ziinaConfigsById[mockedConfigurationId];

      expect(storedConfig.accessToken).not.toBe(mockedZiinaConfig.accessToken);
      expect(storedConfig.webhookSecret).not.toBe(mockedZiinaConfig.webhookSecret);
      expect(mockEncryptor.decrypt(storedConfig.accessToken)).toBe(mockedZiinaConfig.accessToken);
      expect(mockEncryptor.decrypt(storedConfig.webhookSecret)).toBe(
        mockedZiinaConfig.webhookSecret,
      );
    });

    it("Returns FailureSavingConfig if client throws", async () => {
      client.set.mockRejectedValueOnce(new Error("Upstash unavailable"));

      const result = await repo.saveZiinaConfig({
        config: mockedZiinaConfig,
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(AppConfigRepoError.FailureSavingConfig);
    });
  });

  describe("updateMapping", () => {
    it("Sets channel mapping and resets it with null configId", async () => {
      const access = { saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId };

      const setResult = await repo.updateMapping(access, {
        configId: mockedConfigurationId,
        channelId: mockedSaleorChannelId,
      });

      expect(setResult.isOk()).toBe(true);

      const rootAfterSet = await repo.getRootConfig(access);

      expect(rootAfterSet._unsafeUnwrap().chanelConfigMapping[mockedSaleorChannelId]).toBe(
        mockedConfigurationId,
      );

      const resetResult = await repo.updateMapping(access, {
        configId: null,
        channelId: mockedSaleorChannelId,
      });

      expect(resetResult.isOk()).toBe(true);

      const rootAfterReset = await repo.getRootConfig(access);

      expect(
        rootAfterReset._unsafeUnwrap().chanelConfigMapping[mockedSaleorChannelId],
      ).toBeUndefined();
    });

    it("Returns FailureSavingConfig if client throws", async () => {
      client.set.mockRejectedValueOnce(new Error("Upstash unavailable"));

      const result = await repo.updateMapping(
        { saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId },
        { configId: mockedConfigurationId, channelId: mockedSaleorChannelId },
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(AppConfigRepoError.FailureSavingConfig);
    });
  });

  describe("removeConfig", () => {
    it("Removes config and mappings pointing to it", async () => {
      await repo.saveZiinaConfig({
        config: mockedZiinaConfig,
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
      });

      await repo.updateMapping(
        { saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId },
        { configId: mockedConfigurationId, channelId: mockedSaleorChannelId },
      );

      const result = await repo.removeConfig(
        { saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId },
        { configId: mockedConfigurationId },
      );

      expect(result.isOk()).toBe(true);

      const rootConfig = (
        await repo.getRootConfig({ saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId })
      )._unsafeUnwrap();

      expect(rootConfig.ziinaConfigsById[mockedConfigurationId]).toBeUndefined();
      expect(rootConfig.chanelConfigMapping[mockedSaleorChannelId]).toBeUndefined();
    });

    it("Returns FailureRemovingConfig if client throws", async () => {
      await repo.saveZiinaConfig({
        config: mockedZiinaConfig,
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
      });

      client.set.mockRejectedValueOnce(new Error("Upstash unavailable"));

      const result = await repo.removeConfig(
        { saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId },
        { configId: mockedConfigurationId },
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(AppConfigRepoError.FailureRemovingConfig);
    });
  });
});
