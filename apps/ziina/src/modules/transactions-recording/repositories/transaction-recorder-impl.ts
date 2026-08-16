import { env } from "@/lib/env";
import { DynamoDBTransactionRecorderRepo } from "@/modules/transactions-recording/repositories/dynamodb/dynamodb-transaction-recorder-repo";
import { FileTransactionRecorderRepo } from "@/modules/transactions-recording/repositories/file/file-transaction-recorder-repo";
import { type TransactionRecorderRepo } from "@/modules/transactions-recording/repositories/transaction-recorder-repo";
import { UpstashTransactionRecorderRepo } from "@/modules/transactions-recording/repositories/upstash/upstash-transaction-recorder-repo";

/**
 * When forking, you can replace this only file with custom implementation, to replace DynamoDB with another storage
 */
export const transactionRecorder: TransactionRecorderRepo =
  env.CONFIG_STORAGE_MODE === "upstash"
    ? new UpstashTransactionRecorderRepo()
    : env.CONFIG_STORAGE_MODE === "file"
    ? new FileTransactionRecorderRepo()
    : new DynamoDBTransactionRecorderRepo();
