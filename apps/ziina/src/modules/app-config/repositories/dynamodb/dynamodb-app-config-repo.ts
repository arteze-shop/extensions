import { type IEncryptor } from "@saleor/apps-shared/encryptor";
import { RotatingEncryptor } from "@saleor/apps-shared/key-rotation/rotating-encryptor";
import {
  resolveDecryptFallbacks,
  resolveEncryptKey,
} from "@saleor/apps-shared/secret-key-resolution";
import { DeleteItemCommand, GetItemCommand, Parser, PutItemCommand } from "dynamodb-toolbox";
import { QueryCommand } from "dynamodb-toolbox/table/actions/query";
import { err, ok, type Result } from "neverthrow";

import { env } from "@/lib/env";
import { getDynamoEnv } from "@/lib/env-dynamodb";
import { BaseError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { AppRootConfig } from "@/modules/app-config/domain/app-root-config";
import { ZiinaConfig } from "@/modules/app-config/domain/ziina-config";
import {
  type AppConfigRepo,
  AppConfigRepoError,
  type BaseAccessPattern,
  type GetZiinaConfigAccessPattern,
  type ZiinaConfigByChannelIdAccessPattern,
  type ZiinaConfigByConfigIdAccessPattern,
} from "@/modules/app-config/repositories/app-config-repo";
import {
  createChannelConfigMappingEntity,
  DynamoDbChannelConfigMapping,
  type DynamoDbChannelConfigMappingEntity,
} from "@/modules/app-config/repositories/dynamodb/channel-config-mapping-db-model";
import {
  createZiinaConfigEntity,
  DynamoDbZiinaConfig,
  type DynamoDbZiinaConfigEntity,
} from "@/modules/app-config/repositories/dynamodb/ziina-config-db-model";
import { createDynamoMainTable } from "@/modules/dynamodb/dynamo-main-table";
import { type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";
import { type ZiinaEnv } from "@/modules/ziina/ziina-env";
import { createZiinaRestrictedKey } from "@/modules/ziina/ziina-restricted-key";
import { createZiinaWebhookSecret } from "@/modules/ziina/ziina-webhook-secret";

type ConstructorParams = {
  entities: {
    ziinaConfig: DynamoDbZiinaConfigEntity;
    channelConfigMapping: DynamoDbChannelConfigMappingEntity;
  };
  encryptor: IEncryptor;
};

export class DynamodbAppConfigRepo implements AppConfigRepo {
  private logger = createLogger("DynamodbAppConfigRepo");

  ziinaConfigEntity: DynamoDbZiinaConfigEntity;
  channelConfigMappingEntity: DynamoDbChannelConfigMappingEntity;
  encryptor: IEncryptor;

  constructor(config?: ConstructorParams) {
    if (!config) {
      const table = createDynamoMainTable(getDynamoEnv());

      config = {
        entities: {
          ziinaConfig: createZiinaConfigEntity(table),
          channelConfigMapping: createChannelConfigMappingEntity(table),
        },
        encryptor: new RotatingEncryptor({
          primarySecret: resolveEncryptKey(env),
          fallbackSecrets: resolveDecryptFallbacks(env),
          logger: createLogger("RotatingEncryptor"),
        }),
      };
    }

    this.channelConfigMappingEntity = config.entities.channelConfigMapping;
    this.ziinaConfigEntity = config.entities.ziinaConfig;
    this.encryptor = config.encryptor;
  }

  /**
   * Fetches twice - configs entity and mapping. These are queries. Looks like Toolbox (Dynamo?)
   * can't batch queries
   */
  async getRootConfig(
    access: BaseAccessPattern,
  ): Promise<Result<AppRootConfig, InstanceType<typeof BaseError>>> {
    const allConfigsQuery = this.ziinaConfigEntity.table
      .build(QueryCommand)
      .entities(this.ziinaConfigEntity)
      .query({
        range: {
          beginsWith: DynamoDbZiinaConfig.accessPattern.getSKforAllItems(),
        },
        partition: DynamoDbZiinaConfig.accessPattern.getPK({
          appId: access.appId,
          saleorApiUrl: access.saleorApiUrl,
        }),
      })
      .options({ maxPages: Infinity });

    const allMappingsQuery = this.channelConfigMappingEntity.table
      .build(QueryCommand)
      .entities(this.channelConfigMappingEntity)
      .query({
        range: {
          beginsWith: DynamoDbChannelConfigMapping.accessPattern.getSKforAllChannels(),
        },
        partition: DynamoDbChannelConfigMapping.accessPattern.getPK({
          appId: access.appId,
          saleorApiUrl: access.saleorApiUrl,
        }),
      })
      .options({ maxPages: Infinity });

    try {
      const results = await Promise.all([allConfigsQuery, allMappingsQuery].map((q) => q.send()));

      const [configs, mappings] = results;

      /**
       * For some reason types from Dynamo are unions of both entities, instead of valid types, so parsing them to get actual shapes
       */
      const parsedConfigs =
        configs.Items?.map((item) => {
          return DynamoDbZiinaConfig.entitySchema.build(Parser).parse(item);
        }) ?? [];

      const parsedMappings =
        mappings.Items?.map((item) => {
          return DynamoDbChannelConfigMapping.entitySchema.build(Parser).parse(item);
        }) ?? [];

      const rootConfig = new AppRootConfig(
        parsedMappings.reduce(
          (record, dynamoItem) => {
            if (dynamoItem.configId) {
              record[dynamoItem.channelId] = dynamoItem.configId;
            }

            return record;
          },
          {} as Record<string, string>,
        ),
        parsedConfigs.reduce(
          (record, dynamoItem) => {
            record[dynamoItem.configId] = this.mapRawDynamoConfigItemToConfigOrThrow(dynamoItem);

            return record;
          },
          {} as Record<string, ZiinaConfig>,
        ),
      );

      return ok(rootConfig);
    } catch (e) {
      this.logger.error("Failed to fetch RootConfig from DynamoDB", { cause: e });

      return err(
        new AppConfigRepoError.FailureFetchingConfig("Error fetching RootConfig from DynamoDB", {
          cause: e,
        }),
      );
    }
  }

  private fetchZiinaConfigByItsId(access: ZiinaConfigByConfigIdAccessPattern) {
    const query = this.ziinaConfigEntity.build(GetItemCommand).key({
      PK: DynamoDbZiinaConfig.accessPattern.getPK(access),
      SK: DynamoDbZiinaConfig.accessPattern.getSKforSpecificItem({
        configId: access.configId,
      }),
    });

    return query.send();
  }

  private fetchConfigIdFromChannelId(access: ZiinaConfigByChannelIdAccessPattern) {
    const query = this.channelConfigMappingEntity.build(GetItemCommand).key({
      PK: DynamoDbChannelConfigMapping.accessPattern.getPK(access),
      SK: DynamoDbChannelConfigMapping.accessPattern.getSKforSpecificChannel({
        channelId: access.channelId,
      }),
    });

    return query.send();
  }

  private mapRawDynamoConfigItemToConfigOrThrow(item: unknown) {
    const parsed = DynamoDbZiinaConfig.entitySchema.build(Parser).parse(item);

    const configResult = ZiinaConfig.create({
      name: parsed.configName,
      accessToken: createZiinaRestrictedKey(
        this.encryptor.decrypt(parsed.ziinaAccessToken),
      )._unsafeUnwrap(), // make it throwable
      webhookId: parsed.ziinaWebhookId,
      id: parsed.configId,
      webhookSecret: createZiinaWebhookSecret(
        this.encryptor.decrypt(parsed.ziinaWebhookSecret),
      )._unsafeUnwrap(), // make it throwable
      ziinaEnv: parsed.ziinaEnv as ZiinaEnv,
    });

    if (configResult.isErr()) {
      // Throw and catch it below, so neverthrow can continue, to avoid too much boilerplate
      throw new BaseError("Failed to parse config from DynamoDB", {
        cause: configResult.error,
      });
    }

    return configResult.value;
  }

  async getZiinaConfig(
    access: GetZiinaConfigAccessPattern,
  ): Promise<Result<ZiinaConfig | null, InstanceType<typeof BaseError>>> {
    const channelId = "channelId" in access ? access.channelId : undefined;
    /**
     * We eventually need config id, so it's mutable. It's either provided or will be resolved later and written here
     */
    let configId = "configId" in access ? access.configId : undefined;

    if (!configId && channelId) {
      try {
        const configIdResult = await this.fetchConfigIdFromChannelId({
          appId: access.appId,
          saleorApiUrl: access.saleorApiUrl,
          channelId: channelId,
        });

        if (!configIdResult.Item) {
          return ok(null);
        }

        const parsed = DynamoDbChannelConfigMapping.entitySchema
          .build(Parser)
          .parse(configIdResult.Item);

        configId = parsed.configId;
      } catch (e) {
        return err(
          new AppConfigRepoError.FailureFetchingConfig(
            "Error fetching specific config from DynamoDB",
            {
              cause: e,
            },
          ),
        );
      }
    }

    if (!configId) {
      return ok(null);
    }

    try {
      const result = await this.fetchZiinaConfigByItsId({
        configId,
        appId: access.appId,
        saleorApiUrl: access.saleorApiUrl,
      });

      if (!result.Item) {
        return ok(null);
      }

      const parsedConfig = this.mapRawDynamoConfigItemToConfigOrThrow(result.Item);

      return ok(parsedConfig);
    } catch (e) {
      this.logger.error("Failed to fetch config from DynamoDB", { cause: e });

      return err(
        new AppConfigRepoError.FailureFetchingConfig(
          "Error fetching specific config from DynamoDB",
          {
            cause: e,
          },
        ),
      );
    }
  }

  async saveZiinaConfig({
    config,
    appId,
    saleorApiUrl,
  }: {
    config: ZiinaConfig;
    saleorApiUrl: SaleorApiUrl;
    appId: string;
  }): Promise<Result<void | null, InstanceType<typeof AppConfigRepoError.FailureSavingConfig>>> {
    try {
      const command = this.ziinaConfigEntity.build(PutItemCommand).item({
        configId: config.id,
        ziinaAccessToken: this.encryptor.encrypt(config.accessToken),
        ziinaWebhookId: config.webhookId,
        ziinaWebhookSecret: this.encryptor.encrypt(config.webhookSecret),
        ziinaEnv: config.ziinaEnv,
        PK: DynamoDbZiinaConfig.accessPattern.getPK({ saleorApiUrl, appId }),
        SK: DynamoDbZiinaConfig.accessPattern.getSKforSpecificItem({ configId: config.id }),
        configName: config.name,
      });

      const response = await command.send();

      this.logger.info("Saved config to DynamoDB", {
        dynamoHttpResponseStatusCode: response.$metadata.httpStatusCode,
        configId: config.id,
      });

      return ok(null);
    } catch (e) {
      this.logger.error("Failed to save config to DynamoDB", { cause: e });

      return err(
        new AppConfigRepoError.FailureSavingConfig("Failed to save config to DynamoDB", {
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
  ): Promise<Result<void | null, InstanceType<typeof BaseError>>> {
    const command = this.channelConfigMappingEntity.build(PutItemCommand).item({
      configId: data.configId ?? undefined,
      channelId: data.channelId,
      PK: DynamoDbChannelConfigMapping.accessPattern.getPK(access),
      SK: DynamoDbChannelConfigMapping.accessPattern.getSKforSpecificChannel({
        channelId: data.channelId,
      }),
    });

    try {
      const result = await command.send();

      this.logger.info("Updated mapping in DynamoDB", {
        dynamoHttpResponseStatusCode: result.$metadata.httpStatusCode,
        configId: data.configId,
        channelId: data.channelId,
      });

      return ok(null);
    } catch (e) {
      this.logger.error("Failed to update mapping in DynamoDB", {
        error: e,
      });

      return err(
        new AppConfigRepoError.FailureSavingConfig("Failed to update mapping in DynamoDB", {
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
      const operation = this.ziinaConfigEntity.build(DeleteItemCommand).key({
        PK: DynamoDbZiinaConfig.accessPattern.getPK(access),
        SK: DynamoDbZiinaConfig.accessPattern.getSKforSpecificItem({
          configId: data.configId,
        }),
      });

      const result = await operation.send();

      if (result.$metadata.httpStatusCode !== 200) {
        return err(
          new AppConfigRepoError.FailureRemovingConfig("Failed to remove config from DynamoDB", {
            props: {
              dynamoHttpResponseStatusCode: result.$metadata.httpStatusCode,
            },
          }),
        );
      }

      return ok(null);
    } catch (e) {
      return err(
        new AppConfigRepoError.FailureRemovingConfig("Failed to remove config from DynamoDB", {
          cause: e,
        }),
      );
    }
  }
}
