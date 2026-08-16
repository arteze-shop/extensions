import { randomUUID } from "node:crypto";

import { err, ok, type Result } from "neverthrow";

import { type ZiinaApiError } from "./ziina-api-error";
import { type ZiinaClient } from "./ziina-client";

export class ZiinaAuthValidator {
  private readonly client: ZiinaClient;

  private constructor(client: ZiinaClient) {
    this.client = client;
  }

  static createFromClient(client: ZiinaClient) {
    return new ZiinaAuthValidator(client);
  }

  /**
   * Checks if the access token is valid.
   * Ziina's GET /account endpoint only works with OAuth 2.0 tokens,
   * so the auth is validated by creating a TEST payment intent.
   */
  async validateZiinaAuth(): Promise<Result<null, ZiinaApiError>> {
    const result = await this.client.createPaymentIntent({
      amount: 200,
      currencyCode: "AED",
      test: true,
      message: "Ziina connection validation",
      operationId: randomUUID(),
    });

    if (result.isErr()) {
      return err(result.error);
    }

    return ok(null);
  }
}
