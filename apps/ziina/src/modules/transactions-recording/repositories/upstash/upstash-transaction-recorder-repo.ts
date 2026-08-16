import { err, ok, type Result } from "neverthrow";

import { createLogger } from "@/lib/logger";
import { createResolvedTransactionFlow } from "@/modules/resolved-transaction-flow";
import { createSaleorTransactionFlow } from "@/modules/saleor/saleor-transaction-flow";
import { createSaleorTransactionId } from "@/modules/saleor/saleor-transaction-id";
import { RecordedTransaction } from "@/modules/transactions-recording/domain/recorded-transaction";
import {
  TransactionRecorderError,
  type TransactionRecorderRepo,
  type TransactionRecorderRepoAccess,
} from "@/modules/transactions-recording/repositories/transaction-recorder-repo";
import { UpstashClient, type UpstashClientLike } from "@/modules/upstash/upstash-client";
import {
  createZiinaPaymentIntentId,
  type ZiinaPaymentIntentId,
} from "@/modules/ziina/ziina-payment-intent-id";

type PersistedRecordedTransaction = {
  saleorTransactionId: string;
  saleorTransactionFlow: string;
  resolvedTransactionFlow: string;
  ziinaPaymentIntentId: string;
  saleorSchemaVersion: [number, number];
};

export class UpstashTransactionRecorderRepo implements TransactionRecorderRepo {
  private logger = createLogger("UpstashTransactionRecorderRepo");

  private client: UpstashClientLike;

  constructor(
    params: {
      client: UpstashClientLike;
    } = {
      client: new UpstashClient(),
    },
  ) {
    this.client = params.client;
  }

  private getTransactionKey(
    accessPattern: TransactionRecorderRepoAccess,
    ziinaPaymentIntentId: ZiinaPaymentIntentId,
  ) {
    return `ziina:tx:${accessPattern.saleorApiUrl}#${accessPattern.appId}:${ziinaPaymentIntentId}`;
  }

  async recordTransaction(
    accessPattern: TransactionRecorderRepoAccess,
    transaction: RecordedTransaction,
  ): Promise<Result<null, TransactionRecorderError>> {
    try {
      const key = this.getTransactionKey(accessPattern, transaction.ziinaPaymentIntentId);

      const value = JSON.stringify({
        saleorTransactionId: transaction.saleorTransactionId,
        saleorTransactionFlow: transaction.saleorTransactionFlow,
        resolvedTransactionFlow: transaction.resolvedTransactionFlow,
        ziinaPaymentIntentId: transaction.ziinaPaymentIntentId,
        saleorSchemaVersion: transaction.saleorSchemaVersion,
      } satisfies PersistedRecordedTransaction);

      const wasWritten = await this.client.setIfNotExists(key, value);

      if (wasWritten) {
        this.logger.debug("Successfully wrote transaction to Upstash", { transaction });
      } else {
        /*
         * Handle race condition: if another request already wrote this transaction,
         * treat it as success, Ziina respects idempotency-key and won't charge many times
         */
        this.logger.info("Transaction already recorded, skipping write (idempotent)", {
          paymentIntentId: transaction.ziinaPaymentIntentId,
        });
      }

      return ok(null);
    } catch (e) {
      this.logger.debug("Failed to write transaction to Upstash", { error: e });

      return err(
        new TransactionRecorderError.FailedWritingTransactionError(
          "Failed to write transaction to Upstash",
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
      const raw = await this.client.get(this.getTransactionKey(accessPattern, id));

      if (raw === null) {
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

      const parsed = JSON.parse(raw) as PersistedRecordedTransaction;

      return ok(
        new RecordedTransaction({
          resolvedTransactionFlow: createResolvedTransactionFlow(parsed.resolvedTransactionFlow),
          saleorTransactionFlow: createSaleorTransactionFlow(parsed.saleorTransactionFlow),
          saleorTransactionId: createSaleorTransactionId(parsed.saleorTransactionId),
          ziinaPaymentIntentId: createZiinaPaymentIntentId(parsed.ziinaPaymentIntentId),
          saleorSchemaVersion: [parsed.saleorSchemaVersion[0], parsed.saleorSchemaVersion[1]],
        }),
      );
    } catch (e) {
      return err(
        new TransactionRecorderError.FailedFetchingTransactionError(
          "Failed to fetch transaction from Upstash",
          {
            cause: e,
          },
        ),
      );
    }
  }
}
