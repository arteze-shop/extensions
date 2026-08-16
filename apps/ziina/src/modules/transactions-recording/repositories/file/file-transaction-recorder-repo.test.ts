import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  mockedConfigurationId,
  mockedSaleorAppId,
  mockedSaleorChannelId,
} from "@/__tests__/mocks/constants";
import { mockEncryptor } from "@/__tests__/mocks/mock-encryptor";
import { mockedZiinaConfig } from "@/__tests__/mocks/mock-ziina-config";
import { getMockedRecordedTransaction } from "@/__tests__/mocks/mocked-recorded-transaction";
import { mockedZiinaPaymentIntentId } from "@/__tests__/mocks/mocked-ziina-payment-intent-id";
import { mockedSaleorApiUrl } from "@/__tests__/mocks/saleor-api-url";
import { FileAppConfigRepo } from "@/modules/app-config/repositories/file/file-app-config-repo";
import { JsonFileStore } from "@/modules/file-storage/json-file-store";
import { createSaleorTransactionId } from "@/modules/saleor/saleor-transaction-id";
import { RecordedTransaction } from "@/modules/transactions-recording/domain/recorded-transaction";
import { FileTransactionRecorderRepo } from "@/modules/transactions-recording/repositories/file/file-transaction-recorder-repo";
import { TransactionRecorderError } from "@/modules/transactions-recording/repositories/transaction-recorder-repo";

const createAccessPattern = () => ({
  saleorApiUrl: mockedSaleorApiUrl,
  appId: mockedSaleorAppId,
});

describe("FileTransactionRecorderRepo", () => {
  let tempDir: string;
  let store: JsonFileStore;
  let repo: FileTransactionRecorderRepo;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ziina-tx-"));

    store = new JsonFileStore(path.join(tempDir, "config.json"));
    repo = new FileTransactionRecorderRepo({ store });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("recordTransaction", () => {
    it("Stores transaction in the file under the transactions key", async () => {
      const transaction = getMockedRecordedTransaction();

      const result = await repo.recordTransaction(createAccessPattern(), transaction);

      expect(result._unsafeUnwrap()).toBeNull();

      const raw = await fs.readFile(path.join(tempDir, "config.json"), "utf8");
      const stored = JSON.parse(raw) as {
        transactions: Record<string, unknown>;
      };

      expect(Object.keys(stored)).toStrictEqual(["transactions"]);
      expect(stored.transactions[mockedZiinaPaymentIntentId]).toStrictEqual({
        saleorTransactionId: transaction.saleorTransactionId,
        saleorTransactionFlow: transaction.saleorTransactionFlow,
        resolvedTransactionFlow: transaction.resolvedTransactionFlow,
        ziinaPaymentIntentId: transaction.ziinaPaymentIntentId,
        saleorSchemaVersion: [3, 22],
      });
    });

    it("Treats already existing transaction as success (idempotency)", async () => {
      const transaction = getMockedRecordedTransaction();

      await repo.recordTransaction(createAccessPattern(), transaction);

      const secondAttempt = getMockedRecordedTransaction({
        saleorTransactionId: createSaleorTransactionId("other-transaction-id"),
      });

      const result = await repo.recordTransaction(createAccessPattern(), secondAttempt);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeNull();

      const fetched = (
        await repo.getTransactionByZiinaPaymentIntentId(
          createAccessPattern(),
          mockedZiinaPaymentIntentId,
        )
      )._unsafeUnwrap();

      expect(fetched.saleorTransactionId).toBe(transaction.saleorTransactionId);
      expect(fetched.saleorTransactionId).not.toBe(secondAttempt.saleorTransactionId);
    });

    it("Returns FailedWritingTransactionError if file write fails", async () => {
      await fs.writeFile(path.join(tempDir, "config.json"), "not-valid-json", "utf8");

      const result = await repo.recordTransaction(
        createAccessPattern(),
        getMockedRecordedTransaction(),
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        TransactionRecorderError.FailedWritingTransactionError,
      );
    });
  });

  describe("getTransactionByZiinaPaymentIntentId", () => {
    it("Returns RecordedTransaction if found", async () => {
      await repo.recordTransaction(createAccessPattern(), getMockedRecordedTransaction());

      const result = await repo.getTransactionByZiinaPaymentIntentId(
        createAccessPattern(),
        mockedZiinaPaymentIntentId,
      );

      expect(result._unsafeUnwrap()).toBeInstanceOf(RecordedTransaction);
      expect(result._unsafeUnwrap()).toMatchObject({
        saleorTransactionId: "mocked-transaction-id",
        ziinaPaymentIntentId: mockedZiinaPaymentIntentId,
        saleorTransactionFlow: "CHARGE",
        resolvedTransactionFlow: "CHARGE",
        saleorSchemaVersion: [3, 22],
      });
    });

    it("Returns TransactionMissingError if not found", async () => {
      const result = await repo.getTransactionByZiinaPaymentIntentId(
        createAccessPattern(),
        mockedZiinaPaymentIntentId,
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        TransactionRecorderError.TransactionMissingError,
      );
    });

    it("Returns FailedFetchingTransactionError if file is corrupt", async () => {
      await fs.writeFile(path.join(tempDir, "config.json"), "not-valid-json", "utf8");

      const result = await repo.getTransactionByZiinaPaymentIntentId(
        createAccessPattern(),
        mockedZiinaPaymentIntentId,
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        TransactionRecorderError.FailedFetchingTransactionError,
      );
    });
  });

  describe("config and transaction repos sharing the same store", () => {
    it("Does not clobber each other's top-level keys", async () => {
      const configRepo = new FileAppConfigRepo({ store, encryptor: mockEncryptor });

      await configRepo.saveZiinaConfig({
        config: mockedZiinaConfig,
        saleorApiUrl: mockedSaleorApiUrl,
        appId: mockedSaleorAppId,
      });

      await configRepo.updateMapping(
        { saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId },
        { configId: mockedConfigurationId, channelId: mockedSaleorChannelId },
      );

      await repo.recordTransaction(createAccessPattern(), getMockedRecordedTransaction());

      const rootConfig = (
        await configRepo.getRootConfig({
          saleorApiUrl: mockedSaleorApiUrl,
          appId: mockedSaleorAppId,
        })
      )._unsafeUnwrap();

      expect(rootConfig.chanelConfigMapping).toStrictEqual({
        [mockedSaleorChannelId]: mockedConfigurationId,
      });
      expect(rootConfig.ziinaConfigsById[mockedConfigurationId].id).toBe(mockedConfigurationId);

      const transaction = (
        await repo.getTransactionByZiinaPaymentIntentId(
          createAccessPattern(),
          mockedZiinaPaymentIntentId,
        )
      )._unsafeUnwrap();

      expect(transaction.ziinaPaymentIntentId).toBe(mockedZiinaPaymentIntentId);

      const raw = await fs.readFile(path.join(tempDir, "config.json"), "utf8");
      const stored = JSON.parse(raw) as Record<string, unknown>;

      expect(Object.keys(stored)).toStrictEqual(["config", "transactions"]);
    });
  });
});
