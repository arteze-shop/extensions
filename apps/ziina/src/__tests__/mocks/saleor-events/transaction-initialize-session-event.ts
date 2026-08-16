import { type TransactionInitializeSessionEventFragment } from "@/generated/graphql";

import { mockedSaleorChannelId, mockedSaleorTransactionId } from "../constants";

export const getMockedTransactionInitializeSessionEvent = (args?: {
  actionType?: "CHARGE" | "AUTHORIZATION";
  data?: TransactionInitializeSessionEventFragment["data"];
}): TransactionInitializeSessionEventFragment => ({
  action: {
    amount: 100,
    currency: "AED",
    actionType: args?.actionType ?? "CHARGE",
  },
  transaction: {
    id: mockedSaleorTransactionId,
  },
  data: args?.data ?? null,
  sourceObject: {
    __typename: "Checkout",
    id: "mock-channel-1",
    channel: {
      id: mockedSaleorChannelId,
      slug: "channel-slug",
    },
  },
  idempotencyKey: "idempotency-key",
});
