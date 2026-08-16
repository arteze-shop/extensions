import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import { mockedAppConfigRepo } from "@/__tests__/mocks/app-config-repo";
import { mockedSaleorAppId, mockedSaleorChannelId } from "@/__tests__/mocks/constants";
import { mockedSaleorApiUrl } from "@/__tests__/mocks/saleor-api-url";
import { AppIsNotConfiguredResponse } from "@/app/api/webhooks/saleor/saleor-webhook-responses";

import { PaymentGatewayInitializeSessionUseCase } from "./use-case";
import { PaymentGatewayInitializeSessionUseCaseResponses } from "./use-case-response";

describe("PaymentGatewayInitializeSessionUseCase", () => {
  it("Returns Success response if config found for channel", async () => {
    const uc = new PaymentGatewayInitializeSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
    });

    const responsePayload = await uc.execute({
      channelId: mockedSaleorChannelId,
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
    });

    expect(responsePayload._unsafeUnwrap()).toBeInstanceOf(
      PaymentGatewayInitializeSessionUseCaseResponses.Success,
    );

    const jsonResponse = await responsePayload._unsafeUnwrap().getResponse().json();

    expect(jsonResponse).toStrictEqual({
      data: {},
    });
  });

  it("Returns AppIsNotConfiguredResponse if config not found for specified channel", async () => {
    const spy = vi
      .spyOn(mockedAppConfigRepo, "getZiinaConfig")
      .mockImplementationOnce(async () => ok(null));

    const uc = new PaymentGatewayInitializeSessionUseCase({
      appConfigRepo: mockedAppConfigRepo,
    });

    const responsePayload = await uc.execute({
      channelId: mockedSaleorChannelId,
      saleorApiUrl: mockedSaleorApiUrl,
      appId: mockedSaleorAppId,
    });

    expect(responsePayload._unsafeUnwrapErr()).toBeInstanceOf(AppIsNotConfiguredResponse);
    expect(spy).toHaveBeenCalledOnce();
  });
});
