import { Entity, string } from "dynamodb-toolbox";
import { item } from "dynamodb-toolbox/schema/item";

import { getDynamoEnv } from "@/lib/env-dynamodb";
import { createDynamoMainTable, DynamoMainTable } from "@/modules/dynamodb/dynamo-main-table";
import { type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";

class ZiinaConfigAccessPattern {
  static getPK({ saleorApiUrl, appId }: { saleorApiUrl: SaleorApiUrl; appId: string }) {
    return DynamoMainTable.getPrimaryKeyScopedToInstallation({ saleorApiUrl, appId });
  }

  static getSKforSpecificItem({ configId }: { configId: string }) {
    return `CONFIG_ID#${configId}` as const;
  }

  static getSKforAllItems() {
    return `CONFIG_ID#` as const;
  }
}

const DynamoDbZiinaConfigSchema = item({
  PK: string().key(),
  SK: string().key(),
  configName: string(),
  configId: string(),
  ziinaAccessToken: string(),
  ziinaWebhookSecret: string(),
  ziinaWebhookId: string(),
  ziinaEnv: string(),
});

export function createZiinaConfigEntity(table: DynamoMainTable) {
  return new Entity({
    table,
    name: "ZiinaConfig",
    schema: DynamoDbZiinaConfigSchema,
    timestamps: {
      created: {
        name: "createdAt",
        savedAs: "createdAt",
      },
      modified: {
        name: "modifiedAt",
        savedAs: "modifiedAt",
      },
    },
  });
}

export type DynamoDbZiinaConfigEntity = ReturnType<typeof createZiinaConfigEntity>;

export const DynamoDbZiinaConfig = {
  accessPattern: {
    getPK: ZiinaConfigAccessPattern.getPK,
    getSKforSpecificItem: ZiinaConfigAccessPattern.getSKforSpecificItem,
    getSKforAllItems: ZiinaConfigAccessPattern.getSKforAllItems,
  },
  entitySchema: DynamoDbZiinaConfigSchema,
  createEntity: createZiinaConfigEntity,
  get entity(): DynamoDbZiinaConfigEntity {
    return createZiinaConfigEntity(createDynamoMainTable(getDynamoEnv()));
  },
};
