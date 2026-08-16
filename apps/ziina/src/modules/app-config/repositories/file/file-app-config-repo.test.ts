import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
import { FileAppConfigRepo } from "@/modules/app-config/repositories/file/file-app-config-repo";
import { JsonFileStore } from "@/modules/file-storage/json-file-store";

const createAccessPattern = () => ({
  saleorApiUrl: mockedSaleorApiUrl,
  appId: mockedSaleorAppId,
});

describe("FileAppConfigRepo", () => {
  let tempDir: string;
  let store: JsonFileStore;
  let repo: FileAppConfigRepo;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ziina-config-"));

    store = new JsonFileStore(path.join(tempDir, "config.json"));
    repo = new FileAppConfigRepo({ store, encryptor: mockEncryptor });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("getRootConfig", () => {
    it("Returns empty AppRootConfig when file does not exist", async () => {
      const result = await repo.getRootConfig(createAccessPattern());

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

      await repo.updateMapping(createAccessPattern(), {
        configId: mockedConfigurationId,
        channelId: mockedSaleorChannelId,
      });

      const result = await repo.getRootConfig(createAccessPattern());

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

    it("Returns FailureFetchingConfig if file is corrupt", async () => {
      await fs.writeFile(path.join(tempDir, "config.json"), "not-valid-json", "utf8");

      const result = await repo.getRootConfig(createAccessPattern());

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(AppConfigRepoError.FailureFetchingConfig);
    });
  });

  describe("getZiinaConfig", () => {
    it("Returns null when file does not exist", async () => {
      const result = await repo.getZiinaConfig({
        ...createAccessPattern(),
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
        ...createAccessPattern(),
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

      await repo.updateMapping(createAccessPattern(), {
        configId: mockedConfigurationId,
        channelId: mockedSaleorChannelId,
      });

      const result = await repo.getZiinaConfig({
        ...createAccessPattern(),
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
        ...createAccessPattern(),
        channelId: "channel-without-mapping",
      });

      expect(result._unsafeUnwrap()).toBeNull();
    });

    it("Returns FailureFetchingConfig if file is corrupt", async () => {
      await fs.writeFile(path.join(tempDir, "config.json"), "not-valid-json", "utf8");

      const result = await repo.getZiinaConfig({
        ...createAccessPattern(),
        configId: mockedConfigurationId,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(AppConfigRepoError.FailureFetchingConfig);
    });
  });

  describe("saveZiinaConfig", () => {
    it("Encrypts secret fields and persists config in the file", async () => {
      const result = await repo.saveZiinaConfig({
        config: mockedZiinaConfig,
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
      });

      expect(result.isOk()).toBe(true);

      const raw = await fs.readFile(path.join(tempDir, "config.json"), "utf8");
      const stored = JSON.parse(raw) as {
        config: {
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
      };

      expect(stored.config).toStrictEqual({
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

      const storedConfig = stored.config.ziinaConfigsById[mockedConfigurationId];

      expect(storedConfig.accessToken).not.toBe(mockedZiinaConfig.accessToken);
      expect(storedConfig.webhookSecret).not.toBe(mockedZiinaConfig.webhookSecret);
      expect(mockEncryptor.decrypt(storedConfig.accessToken)).toBe(mockedZiinaConfig.accessToken);
      expect(mockEncryptor.decrypt(storedConfig.webhookSecret)).toBe(
        mockedZiinaConfig.webhookSecret,
      );
    });
  });

  describe("updateMapping", () => {
    it("Sets channel mapping and resets it with null configId", async () => {
      const access = createAccessPattern();

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
  });

  describe("removeConfig", () => {
    it("Removes config and mappings pointing to it", async () => {
      await repo.saveZiinaConfig({
        config: mockedZiinaConfig,
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
      });

      await repo.updateMapping(createAccessPattern(), {
        configId: mockedConfigurationId,
        channelId: mockedSaleorChannelId,
      });

      const result = await repo.removeConfig(createAccessPattern(), {
        configId: mockedConfigurationId,
      });

      expect(result.isOk()).toBe(true);

      const rootConfig = (await repo.getRootConfig(createAccessPattern()))._unsafeUnwrap();

      expect(rootConfig.ziinaConfigsById[mockedConfigurationId]).toBeUndefined();
      expect(rootConfig.chanelConfigMapping[mockedSaleorChannelId]).toBeUndefined();
    });
  });
});
