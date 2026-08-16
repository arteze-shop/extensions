import { err, ok, type Result } from "neverthrow";

import {
  type IZiinaClient,
  type ZiinaAccount,
  type ZiinaPaymentIntent,
  type ZiinaPaymentIntentApiCreateArgs,
  type ZiinaRefund,
  type ZiinaRefundApiCreateArgs,
} from "./types";
import {
  mapZiinaErrorToApiError,
  type ZiinaApiError,
  type ZiinaErrorBody,
} from "./ziina-api-error";
import { type ZiinaRestrictedKey } from "./ziina-restricted-key";

const ZIINA_API_URL = "https://api-v2.ziina.com/api";

export class ZiinaClient implements IZiinaClient {
  private readonly fetchFn: typeof fetch;
  private readonly restrictedKey: ZiinaRestrictedKey;

  constructor(args: { fetchFn?: typeof fetch; restrictedKey: ZiinaRestrictedKey }) {
    this.fetchFn = args.fetchFn ?? fetch;
    this.restrictedKey = args.restrictedKey;
  }

  static createFromRestrictedKey(key: ZiinaRestrictedKey) {
    return new ZiinaClient({ restrictedKey: key });
  }

  async createPaymentIntent(
    args: ZiinaPaymentIntentApiCreateArgs,
  ): Promise<Result<ZiinaPaymentIntent, ZiinaApiError>> {
    return this.post<ZiinaPaymentIntent>("/payment_intent", {
      amount: args.amount,
      currency_code: args.currencyCode,
      message: args.message,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      failure_url: args.failureUrl,
      test: args.test,
      expiry: args.expiry,
      allow_tips: args.allowTips,
      operation_id: args.operationId,
    });
  }

  async getPaymentIntent(args: { id: string }): Promise<Result<ZiinaPaymentIntent, ZiinaApiError>> {
    return this.get<ZiinaPaymentIntent>(`/payment_intent/${args.id}`);
  }

  async createRefund(args: ZiinaRefundApiCreateArgs): Promise<Result<ZiinaRefund, ZiinaApiError>> {
    return this.post<ZiinaRefund>("/refund", {
      id: args.id,
      payment_intent_id: args.paymentIntentId,
      amount: args.amount,
      currency_code: args.currencyCode,
      test: args.test,
    });
  }

  async getRefund(args: { id: string }): Promise<Result<ZiinaRefund, ZiinaApiError>> {
    return this.get<ZiinaRefund>(`/refund/${args.id}`);
  }

  async getAccount(): Promise<Result<ZiinaAccount, ZiinaApiError>> {
    return this.get<ZiinaAccount>("/account");
  }

  async createWebhook(args: {
    url: string;
    secret?: string;
  }): Promise<Result<{ success: boolean; error?: string }, ZiinaApiError>> {
    return this.post<{ success: boolean; error?: string }>("/webhook", {
      url: args.url,
      secret: args.secret,
    });
  }

  async deleteWebhook(): Promise<Result<{ success: boolean; error?: string }, ZiinaApiError>> {
    return this.delete<{ success: boolean; error?: string }>("/webhook");
  }

  private async get<T>(path: string): Promise<Result<T, ZiinaApiError>> {
    return this.request<T>(path, { method: "GET" });
  }

  private async post<T>(path: string, body: unknown): Promise<Result<T, ZiinaApiError>> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }

  private async delete<T>(path: string): Promise<Result<T, ZiinaApiError>> {
    return this.request<T>(path, { method: "DELETE" });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<Result<T, ZiinaApiError>> {
    const { headers: _ignored, ...restInit } = init ?? {};

    try {
      const response = await this.fetchFn(`${ZIINA_API_URL}${path}`, {
        ...restInit,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.restrictedKey}`,
        },
      });

      const body = await response.json().catch(() => undefined);

      if (!response.ok) {
        return err(
          mapZiinaErrorToApiError({
            error: new Error(`Request to Ziina API failed with status ${response.status}`),
            httpStatusCode: response.status,
            errorBody: body as ZiinaErrorBody,
          }),
        );
      }

      return ok(body as T);
    } catch (e) {
      return err(mapZiinaErrorToApiError({ error: e }));
    }
  }
}

export const createZiinaClient = (args: { restrictedKey: ZiinaRestrictedKey }): ZiinaClient =>
  new ZiinaClient(args);
