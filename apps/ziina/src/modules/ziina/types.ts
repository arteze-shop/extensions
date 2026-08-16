import { type Result } from "neverthrow";

import { type ZiinaApiError } from "./ziina-api-error";
import { type ZiinaPaymentIntentStatus } from "./ziina-payment-intent-status";
import { type ZiinaRefundStatus } from "./ziina-refund-status";

export type ZiinaPaymentIntent = {
  id: string;
  account_id: string;
  amount: number;
  tip_amount: number;
  fee_amount: number;
  currency_code: string;
  created_at: string;
  status: ZiinaPaymentIntentStatus;
  operation_id: string;
  message?: string;
  redirect_url: string;
  embedded_url: string;
  success_url?: string;
  cancel_url?: string;
  latest_error?: {
    message: string;
    code: string;
  };
  allow_tips?: boolean;
};

export type ZiinaRefund = {
  id: string;
  payment_intent_id: string;
  amount: number;
  currency_code: string;
  status: ZiinaRefundStatus;
  created_at: string;
  error?: {
    message: string;
    code: string;
  } | null;
};

export type ZiinaAccount = {
  account_id: string;
  account_type: "personal" | "business";
  status: "onboarding" | "active" | "locked" | "deleted" | "restrictedTransfer";
  ziiname?: string;
  display_name?: string;
  profile_picture_url?: string;
};

export type ZiinaPaymentIntentApiCreateArgs = {
  amount: number;
  currencyCode: string;
  message?: string;
  successUrl?: string;
  cancelUrl?: string;
  failureUrl?: string;
  test?: boolean;
  expiry?: string;
  allowTips?: boolean;
  operationId?: string;
};

export type ZiinaRefundApiCreateArgs = {
  id: string;
  paymentIntentId: string;
  amount: number;
  currencyCode: string;
  test?: boolean;
};

export interface IZiinaClient {
  createPaymentIntent(
    args: ZiinaPaymentIntentApiCreateArgs,
  ): Promise<Result<ZiinaPaymentIntent, ZiinaApiError>>;
  getPaymentIntent(args: { id: string }): Promise<Result<ZiinaPaymentIntent, ZiinaApiError>>;
  createRefund(args: ZiinaRefundApiCreateArgs): Promise<Result<ZiinaRefund, ZiinaApiError>>;
  getRefund(args: { id: string }): Promise<Result<ZiinaRefund, ZiinaApiError>>;
  getAccount(): Promise<Result<ZiinaAccount, ZiinaApiError>>;
  createWebhook(args: {
    url: string;
    secret?: string;
  }): Promise<Result<{ success: boolean; error?: string }, ZiinaApiError>>;
  deleteWebhook(): Promise<Result<{ success: boolean; error?: string }, ZiinaApiError>>;
}

export type ZiinaWebhookEvent =
  | {
      event: "payment_intent.status.updated";
      data: ZiinaPaymentIntent;
    }
  | {
      event: "refund.status.updated";
      data: ZiinaRefund;
    };
