import { randomBytes, randomUUID } from "node:crypto";

import { err, ok, type Result } from "neverthrow";

import { BaseError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";

import { createZiinaClient, type ZiinaClient } from "./ziina-client";
import { type ZiinaEnv } from "./ziina-env";
import { type ZiinaRestrictedKey } from "./ziina-restricted-key";
import { createZiinaWebhookSecret } from "./ziina-webhook-secret";
import { createZiinaWebhookUrl } from "./ziina-webhook-url-builder";

export const ZiinaWebhookManagerError = BaseError.subclass("ZiinaWebhookManagerError", {
  props: {
    _internalName: "ZiinaWebhookManagerError" as const,
    publicMessage: "There was a problem with the Ziina webhook configuration",
  },
});

export class ZiinaWebhookManager {
  private logger = createLogger("ZiinaWebhookManager");
  private readonly clientFactory: (key: ZiinaRestrictedKey) => ZiinaClient;

  constructor(deps?: { clientFactory?: (key: ZiinaRestrictedKey) => ZiinaClient }) {
    this.clientFactory =
      deps?.clientFactory ??
      ((key: ZiinaRestrictedKey) => createZiinaClient({ restrictedKey: key }));
  }

  async createWebhook(
    config: {
      name: string;
      accessToken: ZiinaRestrictedKey;
      configurationId: string;
      ziinaEnv: ZiinaEnv;
    },
    opts: { saleorApiUrl: SaleorApiUrl; appUrl: string; appId: string },
  ): Promise<
    Result<{ secret: string; id: string }, InstanceType<typeof ZiinaWebhookManagerError>>
  > {
    this.logger.debug("Will create Ziina webhook");

    const secretResult = createZiinaWebhookSecret(randomBytes(32).toString("hex"));

    if (secretResult.isErr()) {
      return err(
        new ZiinaWebhookManagerError("Failed to generate Ziina webhook secret", {
          cause: secretResult.error,
        }),
      );
    }

    const webhookUrl = createZiinaWebhookUrl({
      appUrl: opts.appUrl,
      saleorApiUrl: opts.saleorApiUrl,
      configurationId: config.configurationId,
      appId: opts.appId,
    });

    const client = this.clientFactory(config.accessToken);

    const result = await client.createWebhook({ url: webhookUrl, secret: secretResult.value });

    if (result.isErr()) {
      this.logger.warn("Error creating webhook", { error: result.error });

      return err(
        new ZiinaWebhookManagerError("Error creating Ziina webhook", { cause: result.error }),
      );
    }

    this.logger.info("Successfully created Ziina webhook");

    return ok({
      secret: secretResult.value,
      id: randomUUID(),
    });
  }

  async getWebhook(config: {
    accessToken: ZiinaRestrictedKey;
    webhookId: string | null;
  }): Promise<
    Result<
      { status: "missing" | "disabled" | "active" },
      InstanceType<typeof ZiinaWebhookManagerError>
    >
  > {
    const { accessToken: _, webhookId } = config;

    if (webhookId === null) {
      return ok({ status: "missing" });
    }

    /**
     * Ziina does not expose the registered webhook, so the state is best-effort.
     * If a webhook id was stored, we assume it is still active.
     */
    return ok({ status: "active" });
  }

  async removeWebhook(config: {
    accessToken: ZiinaRestrictedKey;
  }): Promise<Result<null, InstanceType<typeof ZiinaWebhookManagerError>>> {
    const client = this.clientFactory(config.accessToken);

    const result = await client.deleteWebhook();

    if (result.isErr()) {
      this.logger.warn("Error removing webhook", { error: result.error });

      return err(
        new ZiinaWebhookManagerError("Error removing Ziina webhook", { cause: result.error }),
      );
    }

    this.logger.info("Successfully removed Ziina webhook");

    return ok(null);
  }
}
