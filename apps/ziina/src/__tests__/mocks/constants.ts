import { type SaleorSchemaVersion } from "@saleor/app-sdk/types";

import { SaleorMoney } from "@/modules/saleor/saleor-money";
import { createSaleorTransactionId } from "@/modules/saleor/saleor-transaction-id";

export const mockedSaleorChannelId = "Q2hhbm5lbDox";
export const mockedConfigurationId = "81f323bd-91e2-4838-ab6e-5affd81ffc3b";
export const mockedSaleorAppId = "saleor-app-id";
export const mockedSaleorSchemaVersionSupportingPaymentMethodDetails: SaleorSchemaVersion = [3, 22];
export const mockedSaleorSchemaVersionNotSupportingPaymentMethodDetails: SaleorSchemaVersion = [
  3, 21,
];
export const mockedAppToken = "XXXYYYZZZ";
export const mockAppUrlBase = "https://my-app.saleor.app";
export const mockedSaleorTransactionId = createSaleorTransactionId("mocked-transaction-id");

export const getMockedSaleorMoney = (amount: number = 10_00, currency: string = "usd") =>
  SaleorMoney.createFromZiina({
    amount,
    currency,
  })._unsafeUnwrap();
