import { mockedConfigurationId } from "@/__tests__/mocks/constants";
import { mockedZiinaAccessToken } from "@/__tests__/mocks/mocked-ziina-access-token";
import { mockedZiinaWebhookSecret } from "@/__tests__/mocks/mocked-ziina-webhook-secret";
import { ZiinaConfig } from "@/modules/app-config/domain/ziina-config";

export const mockedZiinaConfig = ZiinaConfig.create({
  id: mockedConfigurationId,
  name: "config-name",
  accessToken: mockedZiinaAccessToken,
  webhookSecret: mockedZiinaWebhookSecret,
  webhookId: "wh_123456789",
  ziinaEnv: "LIVE",
})._unsafeUnwrap();
