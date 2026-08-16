import { Parser } from "dynamodb-toolbox";
import { describe, expect, it } from "vitest";

import { mockedConfigurationId, mockedSaleorAppId } from "@/__tests__/mocks/constants";
import { mockedZiinaAccessToken } from "@/__tests__/mocks/mocked-ziina-access-token";
import { mockedZiinaWebhookSecret } from "@/__tests__/mocks/mocked-ziina-webhook-secret";
import { mockedSaleorApiUrl } from "@/__tests__/mocks/saleor-api-url";

import { DynamoDbZiinaConfig } from "./ziina-config-db-model";

describe("DynamoDbZiinaConfig", () => {
  const saleorApiUrl = mockedSaleorApiUrl;
  const appId = mockedSaleorAppId;
  const configId = mockedConfigurationId;

  describe("accessPattern", () => {
    describe("getPK", () => {
      it("should return primary key scoped to installation", () => {
        const result = DynamoDbZiinaConfig.accessPattern.getPK({ saleorApiUrl, appId });

        expect(result).toBe(`${saleorApiUrl}#${appId}`);
      });
    });

    describe("getSKforSpecificItem", () => {
      it("should return sort key for specific config ID", () => {
        const result = DynamoDbZiinaConfig.accessPattern.getSKforSpecificItem({ configId });

        expect(result).toBe(`CONFIG_ID#${configId}`);
      });
    });

    describe("getSKforAllItems", () => {
      it("should return sort key prefix for all configs", () => {
        const result = DynamoDbZiinaConfig.accessPattern.getSKforAllItems();

        expect(result).toBe("CONFIG_ID#");
      });
    });
  });

  describe("schema", () => {
    it("Properly parses data and doesn't throw", () => {
      const schema = DynamoDbZiinaConfig.entitySchema;

      const result = schema.build(Parser).parse({
        PK: DynamoDbZiinaConfig.accessPattern.getPK({ saleorApiUrl, appId }),
        SK: DynamoDbZiinaConfig.accessPattern.getSKforSpecificItem({ configId }),
        configName: "name",
        configId: mockedConfigurationId,
        ziinaAccessToken: mockedZiinaAccessToken,
        ziinaWebhookSecret: mockedZiinaWebhookSecret,
        ziinaWebhookId: "wh_123456789",
        ziinaEnv: "TEST",
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "PK": "https://foo.bar.saleor.cloud/graphql/#saleor-app-id",
          "SK": "CONFIG_ID#81f323bd-91e2-4838-ab6e-5affd81ffc3b",
          "configId": "81f323bd-91e2-4838-ab6e-5affd81ffc3b",
          "configName": "name",
          "ziinaAccessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6aWluYS1hY2NvdW50Iiwic2NvcGVzIjpbIndyaXRlX3BheW1lbnRfaW50ZW50cyJdLCJpYXQiOjE3MTY3MTQwMDB9.c2lnbmF0dXJlX3BsYWNlaG9sZGVy",
          "ziinaEnv": "TEST",
          "ziinaWebhookId": "wh_123456789",
          "ziinaWebhookSecret": "ziina_whsec_test_secret",
        }
      `);
    });
  });
});
