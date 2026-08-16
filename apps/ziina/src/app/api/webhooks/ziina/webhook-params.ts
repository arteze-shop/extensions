import { err, ok, type Result } from "neverthrow";
import { z } from "zod";

import { BaseError } from "@/lib/errors";
import { createSaleorApiUrl, type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";

export const WebhookParamsValidationError = BaseError.subclass("WebhookParamsValidationError", {
  props: {
    _internalName: "ZiinaWebhookParams.ValidationError" as const,
    publicMessage: "Webhook URL parameters are invalid",
  },
});

/**
 * Stores attributes that Ziina webhook returns to us
 */
export class ZiinaWebhookParams {
  static saleorApiUrlSearchParam = "saleorApiUrl";
  static configurationIdSearchParam = "configurationId";
  static appIdSearchParam = "appId";

  readonly saleorApiUrl: SaleorApiUrl;
  readonly configurationId: string;
  /**
   * Require app ID to store a full DynamoDB access path in the webhook URL.
   *
   * If the app is removed, and we still receive the webhook (it's not removed automatically) we will have to somehow disable it.
   * To do that, we need to fetch config from DB. And in DB the path requires saleorApiUrl, appID and configurationId.
   * We must have ALL of them in the webhook to make such a query.
   */
  readonly appId: string;

  private constructor(props: {
    saleorApiUrl: SaleorApiUrl;
    configurationId: string;
    appId: string;
  }) {
    this.saleorApiUrl = props.saleorApiUrl;
    this.configurationId = props.configurationId;
    this.appId = props.appId;
  }

  private static getSaleorApiUrlOrThrow(searchParams: URLSearchParams): SaleorApiUrl {
    const saleorApiUrlRawString = searchParams.get(ZiinaWebhookParams.saleorApiUrlSearchParam);

    if (!saleorApiUrlRawString) {
      throw new BaseError(`Missing ${ZiinaWebhookParams.saleorApiUrlSearchParam} param`);
    }

    const saleorApiUrlVo = createSaleorApiUrl(saleorApiUrlRawString);

    if (saleorApiUrlVo.isErr()) {
      throw new BaseError(`${ZiinaWebhookParams.saleorApiUrlSearchParam} URL param is invalid`);
    }

    return saleorApiUrlVo.value;
  }

  private static getConfigurationIdOrThrow(searchParams: URLSearchParams): string {
    const configurationId = searchParams.get(this.configurationIdSearchParam);
    const parsedUUID = z.string().uuid().safeParse(configurationId);

    if (parsedUUID.success) {
      return parsedUUID.data;
    }

    throw new BaseError(`${this.configurationIdSearchParam} URL param is invalid`);
  }

  private static getAppIdOrThrow(searchParams: URLSearchParams): string {
    const appId = searchParams.get(this.appIdSearchParam);
    const parsedAppId = z.string().min(3).safeParse(appId);

    if (parsedAppId.success) {
      return parsedAppId.data;
    }

    throw new BaseError(`${this.appIdSearchParam} URL param is invalid`);
  }

  static createFromWebhookUrl(
    url: string,
  ): Result<ZiinaWebhookParams, InstanceType<typeof WebhookParamsValidationError>> {
    try {
      const { searchParams } = new URL(url);

      // Inner error will be caught by catch and remapped
      const saleorApiUrlVo = this.getSaleorApiUrlOrThrow(searchParams);
      const configurationId = this.getConfigurationIdOrThrow(searchParams);
      const appId = this.getAppIdOrThrow(searchParams);

      return ok(
        new ZiinaWebhookParams({
          saleorApiUrl: saleorApiUrlVo,
          configurationId,
          appId,
        }),
      );
    } catch (error) {
      return err(
        new WebhookParamsValidationError("Cant parse Ziina incoming webhook URL", {
          cause: error,
        }),
      );
    }
  }
}
