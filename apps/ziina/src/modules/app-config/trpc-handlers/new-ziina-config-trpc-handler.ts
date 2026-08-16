import { captureException } from "@sentry/nextjs";
import { TRPCError } from "@trpc/server";

import { BaseError } from "@/lib/errors";
import { RandomId } from "@/lib/random-id";
import { ZiinaConfig } from "@/modules/app-config/domain/ziina-config";
import { newZiinaConfigInputSchema } from "@/modules/app-config/trpc-handlers/new-ziina-config-input-schema";
import { createSaleorApiUrl } from "@/modules/saleor/saleor-api-url";
import { protectedClientProcedure } from "@/modules/trpc/protected-client-procedure";
import { ZiinaAuthValidator } from "@/modules/ziina/ziina-auth-validator";
import { ZiinaClient } from "@/modules/ziina/ziina-client";
import {
  createZiinaRestrictedKey,
  type ZiinaRestrictedKey,
} from "@/modules/ziina/ziina-restricted-key";
import { ZiinaWebhookManager } from "@/modules/ziina/ziina-webhook-manager";
import { createZiinaWebhookSecret } from "@/modules/ziina/ziina-webhook-secret";

export class NewZiinaConfigTrpcHandler {
  baseProcedure = protectedClientProcedure;
  private readonly webhookManager = new ZiinaWebhookManager();

  constructor(deps: { webhookManager: ZiinaWebhookManager }) {
    this.webhookManager = deps.webhookManager;
  }

  private createRestrictedKey(raw: string): ZiinaRestrictedKey {
    const result = createZiinaRestrictedKey(raw);

    if (result.isErr()) {
      captureException(
        new BaseError(
          "Handler validation triggered outside of input validation. This means input validation is leaky.",
          { cause: result.error },
        ),
      );

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Failed to create Ziina configuration: ${result.error.message}`,
      });
    }

    return result.value;
  }

  getTrpcProcedure() {
    return this.baseProcedure.input(newZiinaConfigInputSchema).mutation(async ({ input, ctx }) => {
      const saleorApiUrl = createSaleorApiUrl(ctx.saleorApiUrl);

      if (saleorApiUrl.isErr()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Malformed request",
        });
      }

      if (!ctx.appUrl) {
        captureException(new BaseError("Missing appUrl in TRPC request"));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Something went wrong, please contact support.",
        });
      }

      const configId = new RandomId().generate();
      const accessToken = this.createRestrictedKey(input.accessToken);

      const authValidationResult = await ZiinaAuthValidator.createFromClient(
        ZiinaClient.createFromRestrictedKey(accessToken),
      ).validateZiinaAuth();

      if (authValidationResult.isErr()) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Failed to create Ziina configuration. Access token is invalid",
        });
      }

      const webhookCreationResult = await this.webhookManager.createWebhook(
        {
          name: input.name,
          accessToken,
          configurationId: configId,
          ziinaEnv: input.ziinaEnv,
        },
        {
          saleorApiUrl: saleorApiUrl.value,
          appUrl: ctx.appUrl,
          appId: ctx.appId,
        },
      );

      if (webhookCreationResult.isErr()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Failed to create Ziina webhook. Please validate your credentials or contact support. " +
            webhookCreationResult.error.message,
        });
      }

      const webhookSecretVo = createZiinaWebhookSecret(webhookCreationResult.value.secret);

      if (webhookSecretVo.isErr()) {
        captureException(
          new BaseError("Secret from Ziina doesnt match expected format", {
            cause: webhookSecretVo.error,
          }),
        );

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create Ziina webhook. Secret is invalid. Please contact support.",
        });
      }

      const configToSave = ZiinaConfig.create({
        name: input.name,
        id: configId,
        accessToken,
        webhookSecret: webhookSecretVo.value,
        webhookId: webhookCreationResult.value.id,
        ziinaEnv: input.ziinaEnv,
      });

      if (configToSave.isErr()) {
        captureException(
          new BaseError("Failed to create Ziina configuration. This should not happen", {
            cause: configToSave.error,
          }),
        );

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create Ziina configuration. Please contact support.",
        });
      }

      const saveResult = await ctx.configRepo.saveZiinaConfig({
        config: configToSave.value,
        saleorApiUrl: saleorApiUrl.value,
        appId: ctx.appId,
      });

      if (saveResult.isErr()) {
        captureException(saveResult.error);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create Ziina configuration. Data can't be saved.",
        });
      }
    });
  }
}
