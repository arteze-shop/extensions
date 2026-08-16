import { describe, expect, it } from "vitest";

import { mockedConfigurationId } from "@/__tests__/mocks/constants";
import { mockedZiinaConfig } from "@/__tests__/mocks/mock-ziina-config";
import { AppRootConfig } from "@/modules/app-config/domain/app-root-config";
import { ZiinaConfig } from "@/modules/app-config/domain/ziina-config";

describe("AppRootConfig", () => {
  describe("getAllConfigsAsList", () => {
    it("Returns stored configs as list", () => {
      const appRootConfig = new AppRootConfig(
        {
          "channel-1": "config-1",
        },
        {
          [mockedZiinaConfig.id]: mockedZiinaConfig,
          "config-2": ZiinaConfig.create({
            name: "c2",
            webhookId: mockedZiinaConfig.webhookId,
            webhookSecret: mockedZiinaConfig.webhookSecret,
            accessToken: mockedZiinaConfig.accessToken,
            id: "config-2",
            ziinaEnv: "LIVE",
          })._unsafeUnwrap(),
        },
      );

      expect(appRootConfig.getAllConfigsAsList()).toMatchInlineSnapshot(`
        [
          ZiinaConfig {
            "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6aWluYS1hY2NvdW50Iiwic2NvcGVzIjpbIndyaXRlX3BheW1lbnRfaW50ZW50cyJdLCJpYXQiOjE3MTY3MTQwMDB9.c2lnbmF0dXJlX3BsYWNlaG9sZGVy",
            "id": "81f323bd-91e2-4838-ab6e-5affd81ffc3b",
            "name": "config-name",
            "webhookId": "wh_123456789",
            "webhookSecret": "ziina_whsec_test_secret",
            "ziinaEnv": "LIVE",
          },
          ZiinaConfig {
            "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6aWluYS1hY2NvdW50Iiwic2NvcGVzIjpbIndyaXRlX3BheW1lbnRfaW50ZW50cyJdLCJpYXQiOjE3MTY3MTQwMDB9.c2lnbmF0dXJlX3BsYWNlaG9sZGVy",
            "id": "config-2",
            "name": "c2",
            "webhookId": "wh_123456789",
            "webhookSecret": "ziina_whsec_test_secret",
            "ziinaEnv": "LIVE",
          },
        ]
      `);
    });
  });

  describe("getChannelsBoundToGivenConfig", () => {
    it("Returns empty list if no mapping found", () => {
      const rootConfig = new AppRootConfig({}, {});

      expect(rootConfig.getChannelsBoundToGivenConfig(mockedConfigurationId)).toStrictEqual([]);
    });

    it("Returns list of channels IDs if they are mapped to given config ID", () => {
      const rootConfig = new AppRootConfig(
        {
          "channel-1": mockedConfigurationId,
          "channel-2": mockedConfigurationId,
          "channel-3": "another-config-id",
        },
        {},
      );

      expect(rootConfig.getChannelsBoundToGivenConfig(mockedConfigurationId)).toStrictEqual([
        "channel-1",
        "channel-2",
      ]);
    });
  });
});
