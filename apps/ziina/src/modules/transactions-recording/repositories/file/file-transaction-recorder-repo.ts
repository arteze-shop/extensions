import { err, ok, type Result } from "neverthrow";

import { createLogger } from "@/lib/logger";
import { JsonFileStore } from "@/modules/file-storage/json-file-store";
import { createResolvedTransactionFlow } from "@/modules/resolved-transaction-flow";
import { createSaleorTransactionFlow } from "@/modules/saleor/saleor-transaction-flow";
import { createSaleorTransactionId } from "@/modules/saleor/saleor-transaction-id";
import { RecordedTransaction } from "@/modules/transactions-recording/domain/recorded-transaction";
import {
  TransactionRecorderError,
  type TransactionRecorderRepo,
  type TransactionRecorderRepoAccess,
} from "@/modules/transactions-recording/repositories/transaction-recorder-repo";
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

/**
 * File-based implementation of TransactionRecorderRepo. Stores recorded transactions in a
 * single JSON companion file under the top-level "transactions" key, so it never collides
 * with the "config" key owned by the app config repo.
 */
export class FileTransactionRecorderRepo implements TransactionRecorderRepo {
  private logger = createLogger("FileTransactionRecorderRepo");

  private store: JsonFileStore;

  constructor(
    params: {
      store?: JsonFileStore;
    } = {
      store: new JsonFileStore(),
    },
  ) {
    this.store = params.store ?? new JsonFileStore();
  }

  private toPersistedRecordedTransaction(
    transaction: RecordedTransaction,
  ): PersistedRecordedTransaction {
    return {
      saleorTransactionId: transaction.saleorTransactionId,
      saleorTransactionFlow: transaction.saleorTransactionFlow,
      resolvedTransactionFlow: transaction.resolvedTransactionFlow,
      ziinaPaymentIntentId: transaction.ziinaPaymentIntentId,
      saleorSchemaVersion: [transaction.saleorSchemaVersion[0], transaction.saleorSchemaVersion[1]],
    } satisfies PersistedRecordedTransaction;
  }

  async recordTransaction(
    _accessPattern: TransactionRecorderRepoAccess,
    transaction: RecordedTransaction,
  ): Promise<Result<null, TransactionRecorderError>> {
    try {
      let alreadyRecorded = false;

      await this.store.update<Record<string, PersistedRecordedTransaction>>(
        "transactions",
        (prev) => {
          const transactions = prev ?? {};

          if (transactions[transaction.ziinaPaymentIntentId]) {
            alreadyRecorded = true;

            return transactions;
          }

          transactions[transaction.ziinaPaymentIntentId] =
            this.toPersistedRecordedTransaction(transaction);

          return transactions;
        },
      );

      if (alreadyRecorded) {
        /*
         * Handle race condition: if another request already wrote this transaction,
         * treat it as success, Ziina respects idempotency-key and won't charge many times
         */
        this.logger.info("Transaction already recorded, skipping write (idempotent)", {
          paymentIntentId: transaction.ziinaPaymentIntentId,
        });
      } else {
        this.logger.debug("Successfully wrote transaction to file", { transaction });
      }

      return ok(null);
    } catch (e) {
      this.logger.debug("Failed to write transaction to file", { error: e });

      return err(
        new TransactionRecorderError.FailedWritingTransactionError(
          "Failed to write transaction to file",
          {
            cause: e,
          },
        ),
      );
    }
  }

  async getTransactionByZiinaPaymentIntentId(
    _accessPattern: TransactionRecorderRepoAccess,
    id: ZiinaPaymentIntentId,
  ): Promise<Result<RecordedTransaction, TransactionRecorderError>> {
    try {
      const transactions =
        await this.store.get<Record<string, PersistedRecordedTransaction>>("transactions");

      const raw = transactions?.[id];

      if (raw === undefined) {
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

      return ok(
        new RecordedTransaction({
          resolvedTransactionFlow: createResolvedTransactionFlow(raw.resolvedTransactionFlow),
          saleorTransactionFlow: createSaleorTransactionFlow(raw.saleorTransactionFlow),
          saleorTransactionId: createSaleorTransactionId(raw.saleorTransactionId),
          ziinaPaymentIntentId: createZiinaPaymentIntentId(raw.ziinaPaymentIntentId),
          saleorSchemaVersion: [raw.saleorSchemaVersion[0], raw.saleorSchemaVersion[1]],
        }),
      );
    } catch (e) {
      return err(
        new TransactionRecorderError.FailedFetchingTransactionError(
          "Failed to fetch transaction from file",
          {
            cause: e,
          },
        ),
      );
    }
  }
}
