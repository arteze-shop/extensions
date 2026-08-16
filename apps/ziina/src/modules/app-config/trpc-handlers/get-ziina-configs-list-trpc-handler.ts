import { captureException } from "@sentry/nextjs";
import { TRPCError } from "@trpc/server";

import { type ZiinaConfig, ZiinaFrontendConfig } from "@/modules/app-config/domain/ziina-config";
import { createSaleorApiUrl } from "@/modules/saleor/saleor-api-url";
import { protectedClientProcedure } from "@/modules/trpc/protected-client-procedure";
import { ZiinaWebhookManager } from "@/modules/ziina/ziina-webhook-manager";

// todo test
export class GetZiinaConfigsListTrpcHandler {
  baseProcedure = protectedClientProcedure;

  webhookManager: ZiinaWebhookManager;

  constructor(
    deps: { webhookManager: ZiinaWebhookManager } = {
      webhookManager: new ZiinaWebhookManager(),
    },
  ) {
    this.webhookManager = deps.webhookManager;
  }

  private getFrontendConfigWithWebhookStatus = async (
    config: ZiinaConfig,
  ): Promise<ZiinaFrontendConfig> => {
    const webhookResult = await this.webhookManager.getWebhook({
      webhookId: config.webhookId,
      accessToken: config.accessToken,
    });

    const frontendConfig = ZiinaFrontendConfig.createFromZiinaConfig(config);

    if (webhookResult.isErr()) {
      frontendConfig.webhookStatus = "missing";
    }

    if (webhookResult.isOk()) {
      frontendConfig.webhookStatus = webhookResult.value.status;
    }

    return frontendConfig;
  };

  getTrpcProcedure() {
    return this.baseProcedure.query(async ({ ctx }) => {
      const saleorApiUrl = createSaleorApiUrl(ctx.saleorApiUrl);

      /**
       * TODO: Extract such logic to be shared between handlers
       * TODO CTX should have already created SaleorApiUrl instance, not Result
       */
      if (saleorApiUrl.isErr()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Malformed request",
        });
      }

      const config = await ctx.configRepo.getRootConfig({
        saleorApiUrl: saleorApiUrl.value,
        appId: ctx.appId,
      });

      if (config.isErr()) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "App failed to fetch config, please contact Saleor",
        });
      }

      const configsList = config.value.getAllConfigsAsList();
      const mappedPromises = configsList.map(this.getFrontendConfigWithWebhookStatus);
      const results = await Promise.all(mappedPromises).catch((e) => {
        captureException(e);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch configurations, try again",
        });
      });

      return results;
    });
  }
}
