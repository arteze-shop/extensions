import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { GetItemCommand, PutItemCommand } from "dynamodb-toolbox";
import { err, ok, type Result } from "neverthrow";

import { getDynamoEnv } from "@/lib/env-dynamodb";
import { BaseError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { createDynamoMainTable } from "@/modules/dynamodb/dynamo-main-table";
import { createResolvedTransactionFlow } from "@/modules/resolved-transaction-flow";
import { createSaleorTransactionFlow } from "@/modules/saleor/saleor-transaction-flow";
import { createSaleorTransactionId } from "@/modules/saleor/saleor-transaction-id";
import { RecordedTransaction } from "@/modules/transactions-recording/domain/recorded-transaction";
import {
  createRecordedTransactionEntity,
  DynamoDbRecordedTransaction,
  type DynamoDbRecordedTransactionEntity,
} from "@/modules/transactions-recording/repositories/dynamodb/recorded-transaction-db-model";
import {
  TransactionRecorderError,
  type TransactionRecorderRepo,
  type TransactionRecorderRepoAccess,
} from "@/modules/transactions-recording/repositories/transaction-recorder-repo";
import {
  createZiinaPaymentIntentId,
  type ZiinaPaymentIntentId,
} from "@/modules/ziina/ziina-payment-intent-id";

export class DynamoDBTransactionRecorderRepo implements TransactionRecorderRepo {
  private entity: DynamoDbRecordedTransactionEntity;

  private logger = createLogger("DynamoDBTransactionRecorderRepo");

  constructor(params?: { entity: DynamoDbRecordedTransactionEntity }) {
    this.entity =
      params?.entity ?? createRecordedTransactionEntity(createDynamoMainTable(getDynamoEnv()));
  }

  async recordTransaction(
    accessPattern: TransactionRecorderRepoAccess,
    transaction: RecordedTransaction,
  ): Promise<Result<null, TransactionRecorderError>> {
    try {
      this.logger.debug("Trying to write Transaction to DynamoDB", { transaction });

      const [major, minor] = transaction.saleorSchemaVersion;

      const operation = this.entity
        .build(PutItemCommand)
        .item({
          PK: DynamoDbRecordedTransaction.accessPattern.getPK({
            appId: accessPattern.appId,
            saleorApiUrl: accessPattern.saleorApiUrl,
          }),
          SK: DynamoDbRecordedTransaction.accessPattern.getSKforSpecificItem({
            ziinaPaymentIntentId: transaction.ziinaPaymentIntentId,
          }),
          ziinaPaymentIntentId: transaction.ziinaPaymentIntentId,
          saleorTransactionId: transaction.saleorTransactionId,
          saleorTransactionFlow: transaction.saleorTransactionFlow,
          resolvedTransactionFlow: transaction.resolvedTransactionFlow,
          saleorSchemaVersion: {
            major,
            minor,
          },
        })
        .options({
          condition: {
            attr: "ziinaPaymentIntentId",
            exists: false,
          },
        });

      const result = await operation.send();

      if (result.$metadata.httpStatusCode === 200) {
        this.logger.debug("Successfully wrote transaction to DynamoDB", {
          transaction,
        });

        return ok(null);
      }

      throw new BaseError("Unexpected response from DynamoDB: " + result.$metadata.httpStatusCode, {
        cause: result,
      });
    } catch (e) {
      /*
       * Handle race condition: if another request already wrote this transaction,
       * treat it as success, Ziina respects idempotency-key and won't charge many times
       */
      if (e instanceof ConditionalCheckFailedException) {
        this.logger.info("Transaction already recorded, skipping write (idempotent)", {
          paymentIntentId: transaction.ziinaPaymentIntentId,
        });

        return ok(null);
      }

      this.logger.debug("Failed to write transaction to DynamoDB", {
        error: e,
      });

      return err(
        new TransactionRecorderError.FailedWritingTransactionError(
          "Failed to write transaction to DynamoDB",
          {
            cause: e,
          },
        ),
      );
    }
  }

  async getTransactionByZiinaPaymentIntentId(
    accessPattern: TransactionRecorderRepoAccess,
    id: ZiinaPaymentIntentId,
  ): Promise<Result<RecordedTransaction, TransactionRecorderError>> {
    try {
      const operation = this.entity.build(GetItemCommand).key({
        PK: DynamoDbRecordedTransaction.accessPattern.getPK(accessPattern),
        SK: DynamoDbRecordedTransaction.accessPattern.getSKforSpecificItem({
          ziinaPaymentIntentId: id,
        }),
      });

      const result = await operation.send();

      if (result.$metadata.httpStatusCode !== 200) {
        return err(
          new TransactionRecorderError.FailedFetchingTransactionError(
            "Failed to read data from DynamoDB. HTTP status code: " +
              result.$metadata.httpStatusCode,
            {
              cause: result,
            },
          ),
        );
      }

      if (result.Item) {
        const {
          saleorTransactionId,
          saleorTransactionFlow,
          ziinaPaymentIntentId,
          resolvedTransactionFlow,
        } = result.Item;

        return ok(
          new RecordedTransaction({
            resolvedTransactionFlow: createResolvedTransactionFlow(resolvedTransactionFlow),
            saleorTransactionFlow: createSaleorTransactionFlow(saleorTransactionFlow),
            saleorTransactionId: createSaleorTransactionId(saleorTransactionId),
            ziinaPaymentIntentId: createZiinaPaymentIntentId(ziinaPaymentIntentId),
            saleorSchemaVersion: [
              result.Item.saleorSchemaVersion.major,
              result.Item.saleorSchemaVersion.minor,
            ],
          }),
        );
      } else {
        return err(
          new TransactionRecorderError.TransactionMissingError(
            "Transaction not found in Database",
            {
              props: {
                paymentIntentId: id,
              },
            },
          ),
        );
      }
    } catch (e) {
      return err(
        new TransactionRecorderError.FailedFetchingTransactionError(
          "Failed to fetch transaction from DynamoDB",
          {
            cause: e,
          },
        ),
      );
    }
  }
}
