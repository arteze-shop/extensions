import { type IEncryptor } from "@saleor/apps-shared/encryptor";
import { RotatingEncryptor } from "@saleor/apps-shared/key-rotation/rotating-encryptor";
import {
  resolveDecryptFallbacks,
  resolveEncryptKey,
} from "@saleor/apps-shared/secret-key-resolution";
import { err, ok, type Result } from "neverthrow";

import { env } from "@/lib/env";
import { BaseError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { AppRootConfig } from "@/modules/app-config/domain/app-root-config";
import { ZiinaConfig } from "@/modules/app-config/domain/ziina-config";
import {
  type AppConfigRepo,
  AppConfigRepoError,
  type BaseAccessPattern,
  type GetZiinaConfigAccessPattern,
} from "@/modules/app-config/repositories/app-config-repo";
import { JsonFileStore } from "@/modules/file-storage/json-file-store";
import { type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";
import { type ZiinaEnv } from "@/modules/ziina/ziina-env";
import { createZiinaRestrictedKey } from "@/modules/ziina/ziina-restricted-key";
import { createZiinaWebhookSecret } from "@/modules/ziina/ziina-webhook-secret";

type PersistedZiinaConfig = {
  name: string;
  id: string;
  accessToken: string;
  webhookId: string;
  webhookSecret: string;
  ziinaEnv: ZiinaEnv;
};

type PersistedRootConfig = {
  chanelConfigMapping: Record<string, string>;
  ziinaConfigsById: Record<string, PersistedZiinaConfig>;
};

type ConstructorParams = {
  store?: JsonFileStore;
  encryptor?: IEncryptor;
};

/**
 * File-based implementation of AppConfigRepo. Stores all configs in a single JSON
 * companion file under the top-level "config" key, so it never collides with the
 * "transactions" key owned by the transaction recorder repo.
 */
export class FileAppConfigRepo implements AppConfigRepo {
  private logger = createLogger("FileAppConfigRepo");

  private store: JsonFileStore;
  private encryptor: IEncryptor;

  constructor(
    params: ConstructorParams = {
      store: new JsonFileStore(),
      encryptor: new RotatingEncryptor({
        primarySecret: resolveEncryptKey(env),
        fallbackSecrets: resolveDecryptFallbacks(env),
        logger: createLogger("RotatingEncryptor"),
      }),
    },
  ) {
    this.store = params.store ?? new JsonFileStore();
    this.encryptor =
      params.encryptor ??
      new RotatingEncryptor({
        primarySecret: resolveEncryptKey(env),
        fallbackSecrets: resolveDecryptFallbacks(env),
        logger: createLogger("RotatingEncryptor"),
      });
  }

  private async readRootConfig(): Promise<PersistedRootConfig> {
    const rootConfig = await this.store.get<PersistedRootConfig>("config");

    if (rootConfig === undefined) {
      return {
        chanelConfigMapping: {},
        ziinaConfigsById: {},
      };
    }

    return rootConfig;
  }

  private mapRawConfigItemToConfigOrThrow(item: PersistedZiinaConfig): ZiinaConfig {
    const configResult = ZiinaConfig.create({
      name: item.name,
      accessToken: createZiinaRestrictedKey(
        this.encryptor.decrypt(item.accessToken),
      )._unsafeUnwrap(), // make it throwable
      webhookId: item.webhookId,
      id: item.id,
      webhookSecret: createZiinaWebhookSecret(
        this.encryptor.decrypt(item.webhookSecret),
      )._unsafeUnwrap(), // make it throwable
      ziinaEnv: item.ziinaEnv,
    });

    if (configResult.isErr()) {
      // Throw and catch it below, so neverthrow can continue, to avoid too much boilerplate
      throw new BaseError("Failed to parse config from file", {
        cause: configResult.error,
      });
    }

    return configResult.value;
  }

  async getRootConfig(
    _access: BaseAccessPattern,
  ): Promise<Result<AppRootConfig, InstanceType<typeof AppConfigRepoError.FailureFetchingConfig>>> {
    try {
      const rawConfig = await this.readRootConfig();

      const rootConfig = new AppRootConfig(
        rawConfig.chanelConfigMapping ?? {},
        Object.fromEntries(
          Object.entries(rawConfig.ziinaConfigsById ?? {}).map(([configId, item]) => [
            configId,
            this.mapRawConfigItemToConfigOrThrow(item),
          ]),
        ),
      );

      return ok(rootConfig);
    } catch (e) {
      this.logger.error("Failed to fetch RootConfig from file", { cause: e });

      return err(
        new AppConfigRepoError.FailureFetchingConfig("Error fetching RootConfig from file", {
          cause: e,
        }),
      );
    }
  }

  async getZiinaConfig(
    _access: GetZiinaConfigAccessPattern,
  ): Promise<
    Result<ZiinaConfig | null, InstanceType<typeof AppConfigRepoError.FailureFetchingConfig>>
  > {
    try {
      const rawConfig = await this.readRootConfig();

      const configId =
        "configId" in _access ? _access.configId : rawConfig.chanelConfigMapping[_access.channelId];

      if (!configId) {
        return ok(null);
      }

      const persistedConfig = rawConfig.ziinaConfigsById[configId];

      if (!persistedConfig) {
        return ok(null);
      }

      return ok(this.mapRawConfigItemToConfigOrThrow(persistedConfig));
    } catch (e) {
      this.logger.error("Failed to fetch config from file", { cause: e });

      return err(
        new AppConfigRepoError.FailureFetchingConfig("Error fetching specific config from file", {
          cause: e,
        }),
      );
    }
  }

  async saveZiinaConfig({
    config,
    saleorApiUrl: _saleorApiUrl,
    appId: _appId,
  }: {
    config: ZiinaConfig;
    saleorApiUrl: SaleorApiUrl;
    appId: string;
  }): Promise<Result<void | null, InstanceType<typeof AppConfigRepoError.FailureSavingConfig>>> {
    try {
      await this.store.update<PersistedRootConfig>("config", (prev) => {
        const rootConfig = prev ?? {
          chanelConfigMapping: {},
          ziinaConfigsById: {},
        };

        rootConfig.ziinaConfigsById[config.id] = {
          id: config.id,
          name: config.name,
          accessToken: this.encryptor.encrypt(config.accessToken),
          webhookId: config.webhookId,
          webhookSecret: this.encryptor.encrypt(config.webhookSecret),
          ziinaEnv: config.ziinaEnv,
        };

        return rootConfig;
      });

      this.logger.info("Saved config to file", { configId: config.id });

      return ok(null);
    } catch (e) {
      this.logger.error("Failed to save config to file", { cause: e });

      return err(
        new AppConfigRepoError.FailureSavingConfig("Failed to save config to file", {
          cause: e,
        }),
      );
    }
  }

  async updateMapping(
    _access: BaseAccessPattern,
    data: {
      configId: string | null;
      channelId: string;
    },
  ): Promise<Result<void | null, InstanceType<typeof AppConfigRepoError.FailureSavingConfig>>> {
    try {
      await this.store.update<PersistedRootConfig>("config", (prev) => {
        const rootConfig = prev ?? {
          chanelConfigMapping: {},
          ziinaConfigsById: {},
        };

        if (data.configId === null) {
          delete rootConfig.chanelConfigMapping[data.channelId];
        } else {
          rootConfig.chanelConfigMapping[data.channelId] = data.configId;
        }

        return rootConfig;
      });

      this.logger.info("Updated mapping in file", {
        configId: data.configId,
        channelId: data.channelId,
      });

      return ok(null);
    } catch (e) {
      this.logger.error("Failed to update mapping in file", { error: e });

      return err(
        new AppConfigRepoError.FailureSavingConfig("Failed to update mapping in file", {
          cause: e,
        }),
      );
    }
  }

  async removeConfig(
    _access: BaseAccessPattern,
    data: {
      configId: string;
    },
  ): Promise<Result<null, InstanceType<typeof AppConfigRepoError.FailureRemovingConfig>>> {
    try {
      await this.store.update<PersistedRootConfig>("config", (prev) => {
        const rootConfig = prev ?? {
          chanelConfigMapping: {},
          ziinaConfigsById: {},
        };

        delete rootConfig.ziinaConfigsById[data.configId];

        for (const [channelId, configId] of Object.entries(rootConfig.chanelConfigMapping)) {
          if (configId === data.configId) {
            delete rootConfig.chanelConfigMapping[channelId];
          }
        }

        return rootConfig;
      });

      this.logger.info("Removed config from file", { configId: data.configId });

      return ok(null);
    } catch (e) {
      return err(
        new AppConfigRepoError.FailureRemovingConfig("Failed to remove config from file", {
          cause: e,
        }),
      );
    }
  }
}
