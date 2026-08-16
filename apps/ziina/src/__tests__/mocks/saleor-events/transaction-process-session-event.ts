import { type TransactionProcessSessionEventFragment } from "@/generated/graphql";

import { mockedSaleorChannelId } from "../constants";
import { mockedZiinaPaymentIntentId } from "../mocked-ziina-payment-intent-id";

export const getMockedTransactionProcessSessionEvent = (args?: {
  actionType: "CHARGE" | "AUTHORIZATION";
}): TransactionProcessSessionEventFragment => ({
  action: {
    amount: 100,
    actionType: args?.actionType ?? "CHARGE",
  },
  transaction: {
    pspReference: mockedZiinaPaymentIntentId,
  },
  sourceObject: {
    __typename: "Checkout",
    id: "mock-channel-1",
    channel: {
      id: mockedSaleorChannelId,
      slug: "channel-slug",
    },
  },
});
