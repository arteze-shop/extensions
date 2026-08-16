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
import { type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";
import { UpstashClient, type UpstashClientLike } from "@/modules/upstash/upstash-client";
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
  client: UpstashClientLike;
  encryptor: IEncryptor;
};

export class UpstashAppConfigRepo implements AppConfigRepo {
  private logger = createLogger("UpstashAppConfigRepo");

  private client: UpstashClientLike;
  private encryptor: IEncryptor;

  constructor(
    params: ConstructorParams = {
      client: new UpstashClient(),
      encryptor: new RotatingEncryptor({
        primarySecret: resolveEncryptKey(env),
        fallbackSecrets: resolveDecryptFallbacks(env),
        logger: createLogger("RotatingEncryptor"),
      }),
    },
  ) {
    this.client = params.client;
    this.encryptor = params.encryptor;
  }

  private getConfigKey(access: BaseAccessPattern) {
    return `ziina:config:${access.saleorApiUrl}#${access.appId}`;
  }

  private async readRootConfig(access: BaseAccessPattern): Promise<PersistedRootConfig | null> {
    const raw = await this.client.get(this.getConfigKey(access));

    if (raw === null) {
      return null;
    }

    return JSON.parse(raw) as PersistedRootConfig;
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
      throw new BaseError("Failed to parse config from Upstash", {
        cause: configResult.error,
      });
    }

    return configResult.value;
  }

  async getRootConfig(
    access: BaseAccessPattern,
  ): Promise<Result<AppRootConfig, InstanceType<typeof AppConfigRepoError.FailureFetchingConfig>>> {
    try {
      const rawConfig = await this.readRootConfig(access);

      if (rawConfig === null) {
        return ok(new AppRootConfig({}, {}));
      }

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
      this.logger.error("Failed to fetch RootConfig from Upstash", { cause: e });

      return err(
        new AppConfigRepoError.FailureFetchingConfig("Error fetching RootConfig from Upstash", {
          cause: e,
        }),
      );
    }
  }

  async getZiinaConfig(
    access: GetZiinaConfigAccessPattern,
  ): Promise<
    Result<ZiinaConfig | null, InstanceType<typeof AppConfigRepoError.FailureFetchingConfig>>
  > {
    try {
      const rawConfig = await this.readRootConfig(access);

      const configId =
        "configId" in access ? access.configId : rawConfig?.chanelConfigMapping[access.channelId];

      if (!configId) {
        return ok(null);
      }

      const persistedConfig = rawConfig?.ziinaConfigsById[configId];

      if (!persistedConfig) {
        return ok(null);
      }

      return ok(this.mapRawConfigItemToConfigOrThrow(persistedConfig));
    } catch (e) {
      this.logger.error("Failed to fetch config from Upstash", { cause: e });

      return err(
        new AppConfigRepoError.FailureFetchingConfig(
          "Error fetching specific config from Upstash",
          {
            cause: e,
          },
        ),
      );
    }
  }

  async saveZiinaConfig({
    config,
    saleorApiUrl,
    appId,
  }: {
    config: ZiinaConfig;
    saleorApiUrl: SaleorApiUrl;
    appId: string;
  }): Promise<Result<void | null, InstanceType<typeof AppConfigRepoError.FailureSavingConfig>>> {
    try {
      const access = { saleorApiUrl, appId };
      const rootConfig = (await this.readRootConfig(access)) ?? {
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

      await this.client.set(this.getConfigKey(access), JSON.stringify(rootConfig));

      this.logger.info("Saved config to Upstash", { configId: config.id });

      return ok(null);
    } catch (e) {
      this.logger.error("Failed to save config to Upstash", { cause: e });

      return err(
        new AppConfigRepoError.FailureSavingConfig("Failed to save config to Upstash", {
          cause: e,
        }),
      );
    }
  }

  async updateMapping(
    access: BaseAccessPattern,
    data: {
      configId: string | null;
      channelId: string;
    },
  ): Promise<Result<void | null, InstanceType<typeof AppConfigRepoError.FailureSavingConfig>>> {
    try {
      const rootConfig = (await this.readRootConfig(access)) ?? {
        chanelConfigMapping: {},
        ziinaConfigsById: {},
      };

      if (data.configId === null) {
        delete rootConfig.chanelConfigMapping[data.channelId];
      } else {
        rootConfig.chanelConfigMapping[data.channelId] = data.configId;
      }

      await this.client.set(this.getConfigKey(access), JSON.stringify(rootConfig));

      this.logger.info("Updated mapping in Upstash", {
        configId: data.configId,
        channelId: data.channelId,
      });

      return ok(null);
    } catch (e) {
      this.logger.error("Failed to update mapping in Upstash", { error: e });

      return err(
        new AppConfigRepoError.FailureSavingConfig("Failed to update mapping in Upstash", {
          cause: e,
        }),
      );
    }
  }

  async removeConfig(
    access: BaseAccessPattern,
    data: {
      configId: string;
    },
  ): Promise<Result<null, InstanceType<typeof AppConfigRepoError.FailureRemovingConfig>>> {
    try {
      const rootConfig = await this.readRootConfig(access);

      if (rootConfig) {
        delete rootConfig.ziinaConfigsById[data.configId];

        for (const [channelId, configId] of Object.entries(rootConfig.chanelConfigMapping)) {
          if (configId === data.configId) {
            delete rootConfig.chanelConfigMapping[channelId];
          }
        }

        await this.client.set(this.getConfigKey(access), JSON.stringify(rootConfig));
      }

      this.logger.info("Removed config from Upstash", { configId: data.configId });

      return ok(null);
    } catch (e) {
      return err(
        new AppConfigRepoError.FailureRemovingConfig("Failed to remove config from Upstash", {
          cause: e,
        }),
      );
    }
  }
}
