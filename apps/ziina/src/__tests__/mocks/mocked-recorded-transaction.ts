import { type SaleorSchemaVersion } from "@saleor/app-sdk/types";

import {
  mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
  mockedSaleorTransactionId,
} from "@/__tests__/mocks/constants";
import { mockedZiinaPaymentIntentId } from "@/__tests__/mocks/mocked-ziina-payment-intent-id";
import {
  createResolvedTransactionFlow,
  type ResolvedTransactionFlow,
} from "@/modules/resolved-transaction-flow";
import {
  createSaleorTransactionFlow,
  type SaleorTransationFlow,
} from "@/modules/saleor/saleor-transaction-flow";
import { type SaleorTransationId } from "@/modules/saleor/saleor-transaction-id";
import { RecordedTransaction } from "@/modules/transactions-recording/domain/recorded-transaction";
import { type ZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";

type Params = {
  saleorTransactionId?: SaleorTransationId;
  ziinaPaymentIntentId?: ZiinaPaymentIntentId;
  resolvedTransactionFlow?: ResolvedTransactionFlow;
  saleorTransactionFlow?: SaleorTransationFlow;
  saleorSchemaVersion?: SaleorSchemaVersion;
};

export const getMockedRecordedTransaction = (params?: Params): RecordedTransaction => {
  const finalParams = {
    saleorTransactionId: mockedSaleorTransactionId,
    ziinaPaymentIntentId: mockedZiinaPaymentIntentId,
    saleorTransactionFlow: createSaleorTransactionFlow("CHARGE"),
    resolvedTransactionFlow: createResolvedTransactionFlow("CHARGE"),
    saleorSchemaVersion: mockedSaleorSchemaVersionSupportingPaymentMethodDetails,
    ...(params ?? {}),
  } satisfies Params;

  return new RecordedTransaction({
    saleorTransactionId: finalParams.saleorTransactionId,
    ziinaPaymentIntentId: finalParams.ziinaPaymentIntentId,
    saleorTransactionFlow: finalParams.saleorTransactionFlow,
    resolvedTransactionFlow: finalParams.resolvedTransactionFlow,
    saleorSchemaVersion: finalParams.saleorSchemaVersion,
  });
};
