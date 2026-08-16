import { describe, expect, it } from "vitest";

import { ZiinaMoney } from "./ziina-money";

describe("ZiinaMoney", () => {
  describe("createFromSaleorAmount", () => {
    it("creates a valid ZiinaMoney instance", () => {
      const money = ZiinaMoney.createFromSaleorAmount({
        amount: 10.0,
        currency: "USD",
      })._unsafeUnwrap();

      expect(money.amount).toBe(1000);
      expect(money.currency).toBe("USD");
    });

    it("handles different currency precisions correctly", () => {
      const money = ZiinaMoney.createFromSaleorAmount({
        amount: 10.0,
        currency: "JPY",
      })._unsafeUnwrap();

      expect(money.amount).toBe(10);
      expect(money.currency).toBe("JPY");
    });

    it("returns error for negative amount", () => {
      const money = ZiinaMoney.createFromSaleorAmount({
        amount: -10.0,
        currency: "USD",
      });

      expect(money._unsafeUnwrapErr()).toBeInstanceOf(ZiinaMoney.ValidationError);
    });

    it("returns error for invalid currency code length", () => {
      const money = ZiinaMoney.createFromSaleorAmount({
        amount: 100.0,
        currency: "USDD",
      });

      expect(money._unsafeUnwrapErr()).toBeInstanceOf(ZiinaMoney.ValidationError);
    });

    it("returns error for unsupported currency", () => {
      const money = ZiinaMoney.createFromSaleorAmount({
        amount: 100.0,
        currency: "ABC",
      });

      expect(money._unsafeUnwrapErr()).toBeInstanceOf(ZiinaMoney.ValidationError);
    });
  });

  describe("getAmount", () => {
    it("handles 0-digit currencies", () => {
      const money = ZiinaMoney.createFromSaleorAmount({
        amount: 2137,
        currency: "JPY",
      })._unsafeUnwrap();

      expect(money.amount).toBe(2137);
    });

    it("handles 2-digit currencies", () => {
      const money = ZiinaMoney.createFromSaleorAmount({
        amount: 10.99,
        currency: "USD",
      })._unsafeUnwrap();

      expect(money.amount).toBe(1099);
    });

    it("handles 3-digit currencies", () => {
      const money = ZiinaMoney.createFromSaleorAmount({
        amount: 10.123,
        currency: "IQD",
      })._unsafeUnwrap();

      expect(money.amount).toBe(10123);
    });

    it("handles 4-digit currencies", () => {
      const money = ZiinaMoney.createFromSaleorAmount({
        amount: 10.1234,
        currency: "UYW",
      })._unsafeUnwrap();

      expect(money.amount).toBe(101234);
    });

    it("rounds BHD to the nearest ten in base units", () => {
      const money = ZiinaMoney.createFromSaleorAmount({
        amount: 1.234,
        currency: "BHD",
      })._unsafeUnwrap();

      expect(money.amount).toBe(1230);
    });

    it("rounds KWD to the nearest ten in base units", () => {
      const money = ZiinaMoney.createFromSaleorAmount({
        amount: 1.236,
        currency: "KWD",
      })._unsafeUnwrap();

      expect(money.amount).toBe(1240);
    });

    it("rounds OMR to the nearest ten in base units", () => {
      const money = ZiinaMoney.createFromSaleorAmount({
        amount: 1.237,
        currency: "OMR",
      })._unsafeUnwrap();

      expect(money.amount).toBe(1240);
    });

    it("does not round amounts that are already multiples of ten", () => {
      const money = ZiinaMoney.createFromSaleorAmount({
        amount: 1.23,
        currency: "BHD",
      })._unsafeUnwrap();

      expect(money.amount).toBe(1230);
    });
  });

  describe("getCurrency", () => {
    it("returns the currency code", () => {
      const money = ZiinaMoney.createFromSaleorAmount({
        amount: 1000,
        currency: "EUR",
      })._unsafeUnwrap();

      expect(money.currency).toBe("EUR");
    });
  });
});
