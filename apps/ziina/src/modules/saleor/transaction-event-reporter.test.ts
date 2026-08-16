import { describe, expect, it, vi } from "vitest";

import { mockedSaleorTransactionId } from "@/__tests__/mocks/constants";
import { mockedGraphqlClient } from "@/__tests__/mocks/graphql-client";
import { mockedZiinaPaymentIntentId } from "@/__tests__/mocks/mocked-ziina-payment-intent-id";
import { SaleorMoney } from "@/modules/saleor/saleor-money";
import { TransactionEventReporter } from "@/modules/saleor/transaction-event-reporter";

describe("TransactionEventReporter", () => {
  const instance = new TransactionEventReporter({
    graphqlClient: mockedGraphqlClient,
  });

  it("Returns AlreadyReportedError if graphql error points ALREADY_EXISTS", async () => {
    // @ts-expect-error - patching only subset
    vi.spyOn(mockedGraphqlClient, "mutation").mockImplementationOnce(async () => ({
      data: {
        transactionEventReport: {
          errors: [
            {
              code: "ALREADY_EXISTS",
              message: "Transaction with this pspReference already exists",
            },
          ],
        },
      },
    }));

    const result = await instance.reportTransactionEvent({
      time: new Date().toISOString(),
      message: "Test message",
      type: "AUTHORIZATION_ADJUSTMENT",
      amount: SaleorMoney.createFromZiina({
        amount: 10_12,
        currency: "USD",
      })._unsafeUnwrap(),
      pspReference: mockedZiinaPaymentIntentId,
      transactionId: mockedSaleorTransactionId,
      actions: [],
      externalUrl: "https://dashboard.ziina.com/payment-intents/pi_TEST_TEST_TEST",
      saleorPaymentMethodDetailsInput: null,
    });

    expect(result._unsafeUnwrapErr()).toMatchInlineSnapshot(
      `
      [TransactionEventReporter.AlreadyReportedError: Transaction with this pspReference already exists
      Event already reported]
    `,
    );
  });

  it("Returns AlreadyReportedError if data contains alreadyProcessed: true", async () => {
    // @ts-expect-error - patching only subset
    vi.spyOn(mockedGraphqlClient, "mutation").mockImplementationOnce(async () => ({
      data: {
        transactionEventReport: {
          alreadyProcessed: true,
          transactionEvent: {
            id: "asd",
          },
        },
      },
    }));

    const result = await instance.reportTransactionEvent({
      time: new Date().toISOString(),
      message: "Test message",
      type: "AUTHORIZATION_ADJUSTMENT",
      amount: SaleorMoney.createFromZiina({
        amount: 10_12,
        currency: "USD",
      })._unsafeUnwrap(),
      pspReference: mockedZiinaPaymentIntentId,
      transactionId: mockedSaleorTransactionId,
      actions: [],
      externalUrl: "https://dashboard.ziina.com/payment-intents/pi_TEST_TEST_TEST",
      saleorPaymentMethodDetailsInput: null,
    });

    expect(result._unsafeUnwrapErr()).toMatchInlineSnapshot(
      `[TransactionEventReporter.AlreadyReportedError: Event already reported: asd]`,
    );
  });

  it("returns event id in case of success", async () => {
    // @ts-expect-error - patching only subset
    vi.spyOn(mockedGraphqlClient, "mutation").mockImplementationOnce(async () => ({
      data: {
        transactionEventReport: {
          alreadyProcessed: false,
          transactionEvent: {
            id: "asd",
          },
        },
      },
    }));

    const result = await instance.reportTransactionEvent({
      time: new Date().toISOString(),
      message: "Test message",
      type: "AUTHORIZATION_ADJUSTMENT",
      amount: SaleorMoney.createFromZiina({
        amount: 10_12,
        currency: "USD",
      })._unsafeUnwrap(),
      pspReference: mockedZiinaPaymentIntentId,
      transactionId: mockedSaleorTransactionId,
      actions: [],
      externalUrl: "https://dashboard.ziina.com/payment-intents/pi_TEST_TEST_TEST",
      saleorPaymentMethodDetailsInput: null,
    });

    expect(result._unsafeUnwrap()).toMatchInlineSnapshot(`
      {
        "createdEventId": "asd",
      }
    `);
  });
});
