import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockedSaleorAppId } from "@/__tests__/mocks/constants";
import { getMockedRecordedTransaction } from "@/__tests__/mocks/mocked-recorded-transaction";
import { mockedZiinaPaymentIntentId } from "@/__tests__/mocks/mocked-ziina-payment-intent-id";
import { mockedSaleorApiUrl } from "@/__tests__/mocks/saleor-api-url";
import { RecordedTransaction } from "@/modules/transactions-recording/domain/recorded-transaction";
import { TransactionRecorderError } from "@/modules/transactions-recording/repositories/transaction-recorder-repo";
import { UpstashTransactionRecorderRepo } from "@/modules/transactions-recording/repositories/upstash/upstash-transaction-recorder-repo";

const getTransactionKey = (ziinaPaymentIntentId = mockedZiinaPaymentIntentId) =>
  `ziina:tx:${mockedSaleorApiUrl}#${mockedSaleorAppId}:${ziinaPaymentIntentId}`;

const createInMemoryClient = () => {
  const store: Record<string, string> = {};

  return {
    store,
    get: vi.fn(async (key: string) => store[key] ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    setIfNotExists: vi.fn(async (key: string, value: string) => {
      if (key in store) {
        return false;
      }

      store[key] = value;

      return true;
    }),
    del: vi.fn(async (key: string) => {
      delete store[key];
    }),
  };
};

describe("UpstashTransactionRecorderRepo", () => {
  let client: ReturnType<typeof createInMemoryClient>;
  let repo: UpstashTransactionRecorderRepo;

  beforeEach(() => {
    client = createInMemoryClient();
    repo = new UpstashTransactionRecorderRepo({ client });
  });

  describe("recordTransaction", () => {
    it("Writes transaction to Upstash using setIfNotExists", async () => {
      const transaction = getMockedRecordedTransaction();

      const result = await repo.recordTransaction(
        { saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId },
        transaction,
      );

      expect(result._unsafeUnwrap()).toBeNull();
      expect(client.setIfNotExists).toHaveBeenCalledTimes(1);
      expect(client.setIfNotExists).toHaveBeenCalledWith(
        getTransactionKey(),
        expect.stringContaining(mockedZiinaPaymentIntentId),
      );

      const stored = JSON.parse(client.store[getTransactionKey()]);

      expect(stored).toStrictEqual({
        saleorTransactionId: transaction.saleorTransactionId,
        saleorTransactionFlow: transaction.saleorTransactionFlow,
        resolvedTransactionFlow: transaction.resolvedTransactionFlow,
        ziinaPaymentIntentId: transaction.ziinaPaymentIntentId,
        saleorSchemaVersion: [3, 22],
      });
    });

    it("Treats already existing transaction as success (idempotency)", async () => {
      const transaction = getMockedRecordedTransaction();
      const accessPattern = { saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId };

      await repo.recordTransaction(accessPattern, transaction);

      const result = await repo.recordTransaction(accessPattern, transaction);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeNull();
      expect(client.setIfNotExists).toHaveBeenCalledTimes(2);
    });

    it("Returns FailedWritingTransactionError if client throws", async () => {
      client.setIfNotExists.mockRejectedValueOnce(new Error("Upstash unavailable"));

      const result = await repo.recordTransaction(
        { saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId },
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
      await repo.recordTransaction(
        { saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId },
        getMockedRecordedTransaction(),
      );

      const result = await repo.getTransactionByZiinaPaymentIntentId(
        { saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId },
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
        { saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId },
        mockedZiinaPaymentIntentId,
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        TransactionRecorderError.TransactionMissingError,
      );
    });

    it("Returns FailedFetchingTransactionError if client throws", async () => {
      client.get.mockRejectedValueOnce(new Error("Upstash unavailable"));

      const result = await repo.getTransactionByZiinaPaymentIntentId(
        { saleorApiUrl: mockedSaleorApiUrl, appId: mockedSaleorAppId },
        mockedZiinaPaymentIntentId,
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        TransactionRecorderError.FailedFetchingTransactionError,
      );
    });
  });
});
