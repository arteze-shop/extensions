import { describe, expect, it } from "vitest";

import { resolveSaleorMoneyFromZiinaPaymentIntent } from "./resolve-saleor-money-from-ziina-payment-intent";

describe("resolveSaleorMoneyFromZiinaPaymentIntent", () => {
  it("when ZiinaPaymentIntent has status: 'canceled' should use the 'amount' field", () => {
    const result = resolveSaleorMoneyFromZiinaPaymentIntent({
      status: "canceled",
      amount: 45689,
      currency_code: "jpy",
    });

    expect(result._unsafeUnwrap()).toMatchInlineSnapshot(`
      SaleorMoney {
        "amount": 45689,
        "currency": "JPY",
      }
    `);
  });

  it("when ZiinaPaymentIntent has status: 'failed' should use the 'amount' field", () => {
    const result = resolveSaleorMoneyFromZiinaPaymentIntent({
      status: "failed",
      amount: 12356,
      currency_code: "pln",
    });

    expect(result._unsafeUnwrap()).toMatchInlineSnapshot(`
      SaleorMoney {
        "amount": 123.56,
        "currency": "PLN",
      }
    `);
  });

  it("when ZiinaPaymentIntent has status: 'requires_payment_instrument' should use the 'amount' field", () => {
    const result = resolveSaleorMoneyFromZiinaPaymentIntent({
      status: "requires_payment_instrument",
      amount: 12356,
      currency_code: "pln",
    });

    expect(result._unsafeUnwrap()).toMatchInlineSnapshot(`
      SaleorMoney {
        "amount": 123.56,
        "currency": "PLN",
      }
    `);
  });

  it("when ZiinaPaymentIntent has status: 'requires_user_action' should use the 'amount' field", () => {
    const result = resolveSaleorMoneyFromZiinaPaymentIntent({
      status: "requires_user_action",
      amount: 99978,
      currency_code: "eur",
    });

    expect(result._unsafeUnwrap()).toMatchInlineSnapshot(`
      SaleorMoney {
        "amount": 999.78,
        "currency": "EUR",
      }
    `);
  });

  it("when ZiinaPaymentIntent has status: 'pending' should use the 'amount' field", () => {
    const result = resolveSaleorMoneyFromZiinaPaymentIntent({
      status: "pending",
      amount: 123456,
      currency_code: "usd",
    });

    expect(result._unsafeUnwrap()).toMatchInlineSnapshot(`
      SaleorMoney {
        "amount": 1234.56,
        "currency": "USD",
      }
    `);
  });

  it("when ZiinaPaymentIntent has status: 'completed' should use the 'amount' field (no partial capture)", () => {
    const result = resolveSaleorMoneyFromZiinaPaymentIntent({
      status: "completed",
      amount: 123456,
      currency_code: "usd",
    });

    expect(result._unsafeUnwrap()).toMatchInlineSnapshot(`
      SaleorMoney {
        "amount": 1234.56,
        "currency": "USD",
      }
    `);
  });
});
