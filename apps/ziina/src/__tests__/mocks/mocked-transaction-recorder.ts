import { err, ok, type Result } from "neverthrow";

import { type RecordedTransaction } from "@/modules/transactions-recording/domain/recorded-transaction";
import {
  TransactionRecorderError,
  type TransactionRecorderRepo,
  type TransactionRecorderRepoAccess,
} from "@/modules/transactions-recording/repositories/transaction-recorder-repo";
import { type ZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";

export class MockedTransactionRecorder implements TransactionRecorderRepo {
  public transactions: Record<string, RecordedTransaction> = {};

  async recordTransaction(
    _accessPattern: TransactionRecorderRepoAccess,
    transaction: RecordedTransaction,
  ): Promise<Result<null, TransactionRecorderError>> {
    this.transactions[transaction.ziinaPaymentIntentId] = transaction;

    return ok(null);
  }

  async getTransactionByZiinaPaymentIntentId(
    _accessPattern: TransactionRecorderRepoAccess,
    id: ZiinaPaymentIntentId,
  ): Promise<Result<RecordedTransaction, TransactionRecorderError>> {
    const transaction = this.transactions[id];

    if (transaction) {
      return ok(transaction);
    } else {
      return err(new TransactionRecorderError.TransactionMissingError("Transaction not found"));
    }
  }

  reset() {
    this.transactions = {};
  }
}
