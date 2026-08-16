import { describe, expect, it } from "vitest";

import { getMockedSaleorMoney, mockedSaleorTransactionId } from "@/__tests__/mocks/constants";
import { mockedZiinaPaymentIntentId } from "@/__tests__/mocks/mocked-ziina-payment-intent-id";
import { mockedZiinaRefundId } from "@/__tests__/mocks/mocked-ziina-refund-id";
import { ChargeActionRequiredResult } from "@/modules/transaction-result/action-required-result";
import { ChargeFailureResult } from "@/modules/transaction-result/failure-result";
import {
  RefundFailureResult,
  RefundRequestResult,
  RefundSuccessResult,
} from "@/modules/transaction-result/refund-result";
import { ChargeRequestResult } from "@/modules/transaction-result/request-result";
import { ChargeSuccessResult } from "@/modules/transaction-result/success-result";
import { createZiinaPaymentIntentStatus } from "@/modules/ziina/ziina-payment-intent-status";

import { TransactionEventReportVariablesResolver } from "./transaction-event-report-variables-resolver";

describe("TransactionEventReportVariablesResolver", () => {
  const timestamp = new Date("2023-10-01T00:00:00Z");

  it("Resolves valid transaction report variables for transactionResult: ChargeSuccess", () => {
    const resolver = new TransactionEventReportVariablesResolver({
      saleorTransactionId: mockedSaleorTransactionId,
      timestamp,
      transactionResult: new ChargeSuccessResult(),
      saleorMoney: getMockedSaleorMoney(),
      pspReference: mockedZiinaPaymentIntentId,
      externalUrl: "https://pay.ziina.com/embedded/test",
    });

    expect(resolver.resolveEventReportVariables()).toMatchInlineSnapshot(`
      {
        "actions": [
          "REFUND",
        ],
        "amount": SaleorMoney {
          "amount": 10,
          "currency": "USD",
        },
        "externalUrl": "https://pay.ziina.com/embedded/test",
        "message": "Payment intent has been successful",
        "pspReference": "pi_TEST_TEST_TEST",
        "saleorPaymentMethodDetailsInput": null,
        "time": "2023-10-01T00:00:00.000Z",
        "transactionId": "mocked-transaction-id",
        "type": "CHARGE_SUCCESS",
      }
    `);
  });

  it("Resolves valid transaction report variables for transactionResult: ChargeActionRequired", () => {
    const resolver = new TransactionEventReportVariablesResolver({
      saleorTransactionId: mockedSaleorTransactionId,
      timestamp,
      transactionResult: new ChargeActionRequiredResult(createZiinaPaymentIntentStatus("canceled")),
      saleorMoney: getMockedSaleorMoney(),
      pspReference: mockedZiinaPaymentIntentId,
      externalUrl: "",
    });

    expect(resolver.resolveEventReportVariables()).toMatchInlineSnapshot(`
      {
        "actions": [
          "CANCEL",
        ],
        "amount": SaleorMoney {
          "amount": 10,
          "currency": "USD",
        },
        "externalUrl": "",
        "message": "Payment intent was canceled",
        "pspReference": "pi_TEST_TEST_TEST",
        "saleorPaymentMethodDetailsInput": null,
        "time": "2023-10-01T00:00:00.000Z",
        "transactionId": "mocked-transaction-id",
        "type": "CHARGE_ACTION_REQUIRED",
      }
    `);
  });

  it("Resolves valid transaction report variables for transactionResult: ChargeRequest", () => {
    const resolver = new TransactionEventReportVariablesResolver({
      saleorTransactionId: mockedSaleorTransactionId,
      timestamp,
      transactionResult: new ChargeRequestResult(),
      saleorMoney: getMockedSaleorMoney(),
      pspReference: mockedZiinaPaymentIntentId,
      externalUrl: "",
    });

    expect(resolver.resolveEventReportVariables()).toMatchInlineSnapshot(`
      {
        "actions": [],
        "amount": SaleorMoney {
          "amount": 10,
          "currency": "USD",
        },
        "externalUrl": "",
        "message": "Payment intent is processing",
        "pspReference": "pi_TEST_TEST_TEST",
        "saleorPaymentMethodDetailsInput": null,
        "time": "2023-10-01T00:00:00.000Z",
        "transactionId": "mocked-transaction-id",
        "type": "CHARGE_REQUEST",
      }
    `);
  });

  it("Resolves valid transaction report variables for transactionResult: ChargeFailure", () => {
    const resolver = new TransactionEventReportVariablesResolver({
      saleorTransactionId: mockedSaleorTransactionId,
      timestamp,
      transactionResult: new ChargeFailureResult(),
      saleorMoney: getMockedSaleorMoney(),
      pspReference: mockedZiinaPaymentIntentId,
      externalUrl: "",
    });

    expect(resolver.resolveEventReportVariables()).toMatchInlineSnapshot(`
      {
        "actions": [
          "CHARGE",
        ],
        "amount": SaleorMoney {
          "amount": 10,
          "currency": "USD",
        },
        "externalUrl": "",
        "message": "Payment intent failed",
        "pspReference": "pi_TEST_TEST_TEST",
        "saleorPaymentMethodDetailsInput": null,
        "time": "2023-10-01T00:00:00.000Z",
        "transactionId": "mocked-transaction-id",
        "type": "CHARGE_FAILURE",
      }
    `);
  });

  it("Resolves valid transaction report variables for transactionResult: RefundSuccess", () => {
    const resolver = new TransactionEventReportVariablesResolver({
      saleorTransactionId: mockedSaleorTransactionId,
      timestamp,
      transactionResult: new RefundSuccessResult(),
      saleorMoney: getMockedSaleorMoney(),
      pspReference: mockedZiinaRefundId,
      externalUrl: "",
    });

    expect(resolver.resolveEventReportVariables()).toMatchInlineSnapshot(`
      {
        "actions": [
          "REFUND",
        ],
        "amount": SaleorMoney {
          "amount": 10,
          "currency": "USD",
        },
        "externalUrl": "",
        "message": "Refund was successful",
        "pspReference": "ziina_refund_test",
        "saleorPaymentMethodDetailsInput": null,
        "time": "2023-10-01T00:00:00.000Z",
        "transactionId": "mocked-transaction-id",
        "type": "REFUND_SUCCESS",
      }
    `);
  });

  it("Resolves valid transaction report variables for transactionResult: RefundFailure", () => {
    const resolver = new TransactionEventReportVariablesResolver({
      saleorTransactionId: mockedSaleorTransactionId,
      timestamp,
      transactionResult: new RefundFailureResult(),
      saleorMoney: getMockedSaleorMoney(),
      pspReference: mockedZiinaRefundId,
      externalUrl: "",
    });

    expect(resolver.resolveEventReportVariables()).toMatchInlineSnapshot(`
      {
        "actions": [
          "REFUND",
        ],
        "amount": SaleorMoney {
          "amount": 10,
          "currency": "USD",
        },
        "externalUrl": "",
        "message": "Refund failed",
        "pspReference": "ziina_refund_test",
        "saleorPaymentMethodDetailsInput": null,
        "time": "2023-10-01T00:00:00.000Z",
        "transactionId": "mocked-transaction-id",
        "type": "REFUND_FAILURE",
      }
    `);
  });

  it("Resolves valid transaction report variables for transactionResult: RefundRequest", () => {
    const resolver = new TransactionEventReportVariablesResolver({
      saleorTransactionId: mockedSaleorTransactionId,
      timestamp,
      transactionResult: new RefundRequestResult(),
      saleorMoney: getMockedSaleorMoney(),
      pspReference: mockedZiinaRefundId,
      externalUrl: "",
    });

    expect(resolver.resolveEventReportVariables()).toMatchInlineSnapshot(`
      {
        "actions": [],
        "amount": SaleorMoney {
          "amount": 10,
          "currency": "USD",
        },
        "externalUrl": "",
        "message": "Refund is processing",
        "pspReference": "ziina_refund_test",
        "saleorPaymentMethodDetailsInput": null,
        "time": "2023-10-01T00:00:00.000Z",
        "transactionId": "mocked-transaction-id",
        "type": "REFUND_REQUEST",
      }
    `);
  });
});
