import { default as currencyJs } from "currency.js";
import { default as currencyCodesData } from "currency-codes";
import { err, ok, type Result } from "neverthrow";

import { BaseError } from "@/lib/errors";

/**
 * Ziina requires amounts for three-decimal currencies to be rounded
 * to the nearest ten in base units, e.g. 1.234 OMR -> 1.230 OMR.
 */
const THREE_DECIMAL_CURRENCIES = ["BHD", "KWD", "OMR"];

export class ZiinaMoney {
  public readonly amount: number;
  public readonly currency: string;

  static ValidationError = BaseError.subclass("ValidationError", {
    props: {
      _internalName: "ZiinaMoney.ValidationError" as const,
    },
  });

  private constructor(args: { amount: number; currency: string }) {
    this.amount = args.amount;
    this.currency = args.currency;
  }

  static createFromSaleorAmount(args: {
    amount: number;
    currency: string;
  }): Result<ZiinaMoney, InstanceType<typeof ZiinaMoney.ValidationError>> {
    if (args.amount < 0) {
      return err(new ZiinaMoney.ValidationError("Amount must be greater than 0"));
    }

    if (args.currency.length !== 3) {
      return err(new ZiinaMoney.ValidationError("Currency code must be 3 characters long"));
    }

    const currencyCodeData = currencyCodesData.code(args.currency);

    if (currencyCodeData === undefined) {
      return err(new ZiinaMoney.ValidationError("Currency code is not supported"));
    }

    const convertedAmount = currencyJs(args.amount, {
      precision: currencyCodeData.digits,
    });

    let amount = convertedAmount.intValue;

    if (THREE_DECIMAL_CURRENCIES.includes(args.currency)) {
      amount = Math.round(amount / 10) * 10;
    }

    return ok(
      new ZiinaMoney({
        amount,
        currency: args.currency,
      }),
    );
  }
}
