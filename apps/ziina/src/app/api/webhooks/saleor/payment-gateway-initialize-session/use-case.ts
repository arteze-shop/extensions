import { err, ok, type Result } from "neverthrow";

import {
  AppIsNotConfiguredResponse,
  BrokenAppResponse,
} from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import { appContextContainer } from "@/lib/app-context";
import { BaseError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { type AppConfigRepo } from "@/modules/app-config/repositories/app-config-repo";
import { type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";

import {
  PaymentGatewayInitializeSessionUseCaseResponses,
  type PaymentGatewayInitializeSessionUseCaseResponsesType,
} from "./use-case-response";

export class PaymentGatewayInitializeSessionUseCase {
  private appConfigRepo: AppConfigRepo;
  private logger = createLogger("PaymentGatewayInitializeSessionUseCase");

  static UseCaseError = BaseError.subclass("PaymentGatewayInitializeSessionUseCaseError", {
    props: {
      _internalName: "PaymentGatewayInitializeSessionUseCaseError" as const,
    },
  });

  constructor(deps: { appConfigRepo: AppConfigRepo }) {
    this.appConfigRepo = deps.appConfigRepo;
  }

  async execute(params: {
    channelId: string;
    appId: string;
    saleorApiUrl: SaleorApiUrl;
  }): Promise<
    Result<
      PaymentGatewayInitializeSessionUseCaseResponsesType,
      AppIsNotConfiguredResponse | BrokenAppResponse
    >
  > {
    const { channelId, appId, saleorApiUrl } = params;

    const ziinaConfigForThisChannel = await this.appConfigRepo.getZiinaConfig({
      channelId,
      appId,
      saleorApiUrl,
    });

    if (ziinaConfigForThisChannel.isOk()) {
      if (!ziinaConfigForThisChannel.value) {
        this.logger.warn("Config for channel not found", {
          channelId,
        });

        return err(
          new AppIsNotConfiguredResponse(
            appContextContainer.getContextValue(),
            new BaseError("Config for channel not found"),
          ),
        );
      }

      appContextContainer.set({
        ziinaEnv: ziinaConfigForThisChannel.value.getZiinaEnvValue(),
      });

      return ok(
        new PaymentGatewayInitializeSessionUseCaseResponses.Success({
          appContext: appContextContainer.getContextValue(),
        }),
      );
    }

    if (ziinaConfigForThisChannel.isErr()) {
      this.logger.error("Failed to get configuration", {
        error: ziinaConfigForThisChannel.error,
      });

      return err(
        new BrokenAppResponse(
          appContextContainer.getContextValue(),
          ziinaConfigForThisChannel.error,
        ),
      );
    }

    throw new PaymentGatewayInitializeSessionUseCase.UseCaseError("Leaky logic, should not happen");
  }
}
