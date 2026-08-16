import { SaleorSyncWebhook } from "@saleor/app-sdk/handlers/next-app-router";

import { verifyWebhookSignature } from "@/app/api/webhooks/saleor/verify-signature";
import {
  TransactionChargeRequestedDocument,
  type TransactionChargeRequestedEventFragment,
} from "@/generated/graphql";
import { saleorApp } from "@/lib/saleor-app";

export const transactionChargeRequestedWebhookDefinition =
  new SaleorSyncWebhook<TransactionChargeRequestedEventFragment>({
    apl: saleorApp.apl,
    event: "TRANSACTION_CHARGE_REQUESTED",
    name: "Ziina Transaction Charge Requested",
    isActive: true,
    query: TransactionChargeRequestedDocument,
    webhookPath: "api/webhooks/saleor/transaction-charge-requested",
    verifySignatureFn: (jwks, signature, rawBody) => {
      return verifyWebhookSignature(jwks, signature, rawBody);
    },
  });
