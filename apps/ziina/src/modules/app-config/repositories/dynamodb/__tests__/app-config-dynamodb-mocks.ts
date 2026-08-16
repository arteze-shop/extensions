import {
  mockedConfigurationId,
  mockedSaleorAppId,
  mockedSaleorChannelId,
} from "@/__tests__/mocks/constants";
import { mockEncryptor } from "@/__tests__/mocks/mock-encryptor";
import { mockedSaleorApiUrl } from "@/__tests__/mocks/saleor-api-url";

const mockedZiinaConfig = {
  configName: "tasdafsdf",
  createdAt: "2025-04-25T09:19:13.402Z",
  ziinaWebhookId: "we_1RHiPdKFxIUko8m01KAnXiRQ",
  configId: mockedConfigurationId,
  ziinaAccessToken: mockEncryptor.encrypt(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6aWluYS1hY2NvdW50Iiwic2NvcGVzIjpbIndyaXRlX3BheW1lbnRfaW50ZW50cyJdLCJpYXQiOjE3MTY3MTQwMDB9.c2lnbmF0dXJlX3BsYWNlaG9sZGVy",
  ),
  modifiedAt: "2025-04-25T09:19:13.402Z",
  ziinaWebhookSecret: mockEncryptor.encrypt("whsec_ZOsiN376Ahfo0N8lWg7PYXNGpnDXShS5"),
  SK: `CONFIG_ID#${mockedConfigurationId}`,
  ziinaEnv: "TEST",
  PK: `${mockedSaleorApiUrl}#${mockedSaleorAppId}`,
  _et: "ZiinaConfig",
};

const mockedMapping = {
  createdAt: "2025-04-25T10:26:30.219Z",
  configId: mockedConfigurationId,
  modifiedAt: "2025-04-25T10:26:30.219Z",
  SK: `CHANNEL_ID#${mockedSaleorChannelId}`,
  PK: `${mockedSaleorApiUrl}#${mockedSaleorAppId}`,
  channelId: mockedSaleorChannelId,
  _et: "ChannelConfigMapping",
};

export const mockedDynamoConfigItems = {
  mockedZiinaConfig,
  mockedMapping,
};
