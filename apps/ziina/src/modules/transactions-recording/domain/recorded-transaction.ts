import { type SaleorSchemaVersion } from "@saleor/app-sdk/types";

import { type SaleorTransationId } from "@/modules/saleor/saleor-transaction-id";
import { type ZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";

import { type ResolvedTransactionFlow } from "../../resolved-transaction-flow";
import { type SaleorTransationFlow } from "../../saleor/saleor-transaction-flow";

/**
 * Holds transaction that app records during it's lifetime.
 * Usually it's mainly used for persisting pair of Saleor reference (Transaction ID) and Ziina reference (PaymentIntent ID).
 *
 * TODO: Persistence should not allow overwrites - it's invariant if we try to save the same data twice
 */
export class RecordedTransaction {
  readonly saleorTransactionId: SaleorTransationId;
  readonly ziinaPaymentIntentId: ZiinaPaymentIntentId;
  readonly saleorTransactionFlow: SaleorTransationFlow;
  readonly resolvedTransactionFlow: ResolvedTransactionFlow;
  readonly saleorSchemaVersion: SaleorSchemaVersion;

  constructor(args: {
    saleorTransactionId: SaleorTransationId;
    ziinaPaymentIntentId: ZiinaPaymentIntentId;
    saleorTransactionFlow: SaleorTransationFlow;
    resolvedTransactionFlow: ResolvedTransactionFlow;
    saleorSchemaVersion: SaleorSchemaVersion;
  }) {
    this.saleorTransactionId = args.saleorTransactionId;
    this.ziinaPaymentIntentId = args.ziinaPaymentIntentId;
    this.saleorTransactionFlow = args.saleorTransactionFlow;
    this.resolvedTransactionFlow = args.resolvedTransactionFlow;
    this.saleorSchemaVersion = args.saleorSchemaVersion;
  }
}
