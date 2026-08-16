import { type TransactionRefundRequestedEventFragment } from "@/generated/graphql";

import { mockedSaleorChannelId, mockedSaleorTransactionId } from "../constants";
import { mockedZiinaPaymentIntentId } from "../mocked-ziina-payment-intent-id";

export const getMockedTransactionRefundRequestedEvent =
  (): TransactionRefundRequestedEventFragment => ({
    action: {
      amount: 100,
      currency: "AED",
    },
    transaction: {
      id: mockedSaleorTransactionId,
      pspReference: mockedZiinaPaymentIntentId,
      checkout: {
        id: "mock-channel-1",
        channel: {
          id: mockedSaleorChannelId,
          slug: "channel-slug",
        },
      },
    },
  });
