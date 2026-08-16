import { Entity, map, number, string } from "dynamodb-toolbox";
import { item } from "dynamodb-toolbox/schema/item";

import { getDynamoEnv } from "@/lib/env-dynamodb";
import { createDynamoMainTable, DynamoMainTable } from "@/modules/dynamodb/dynamo-main-table";
import { type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";
import { type ZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";

class AccessPattern {
  static getPK({ saleorApiUrl, appId }: { saleorApiUrl: SaleorApiUrl; appId: string }) {
    return DynamoMainTable.getPrimaryKeyScopedToInstallation({ saleorApiUrl, appId });
  }

  static getSKforSpecificItem({
    ziinaPaymentIntentId,
  }: {
    ziinaPaymentIntentId: ZiinaPaymentIntentId;
  }) {
    return `TRANSACTION#${ziinaPaymentIntentId}` as const;
  }
}

const Schema = item({
  PK: string().key(),
  SK: string().key(),
  ziinaPaymentIntentId: string(),
  saleorTransactionId: string(),
  // TODO: Do we want to use DynamoDB enums?
  saleorTransactionFlow: string(),
  resolvedTransactionFlow: string(),
  saleorSchemaVersion: map({
    major: number(),
    minor: number(),
  }),
});

export function createRecordedTransactionEntity(table: DynamoMainTable) {
  return new Entity({
    table,
    name: "RecordedTransaction",
    schema: Schema,
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

export type DynamoDbRecordedTransactionEntity = ReturnType<typeof createRecordedTransactionEntity>;

export const DynamoDbRecordedTransaction = {
  accessPattern: {
    getPK: AccessPattern.getPK,
    getSKforSpecificItem: AccessPattern.getSKforSpecificItem,
  },
  entitySchema: Schema,
  createEntity: createRecordedTransactionEntity,
  get entity(): DynamoDbRecordedTransactionEntity {
    return createRecordedTransactionEntity(createDynamoMainTable(getDynamoEnv()));
  },
};
