import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockedAppConfigRepo } from "@/__tests__/mocks/app-config-repo";
import { mockedAppToken, mockedSaleorAppId } from "@/__tests__/mocks/constants";
import { mockedGraphqlClient } from "@/__tests__/mocks/graphql-client";
import { mockedZiinaAccessToken } from "@/__tests__/mocks/mocked-ziina-access-token";
import { mockedZiinaWebhookSecret } from "@/__tests__/mocks/mocked-ziina-webhook-secret";
import { mockedSaleorApiUrl } from "@/__tests__/mocks/saleor-api-url";
import { TEST_Procedure } from "@/__tests__/trpc-testing-procedure";
import { BaseError } from "@/lib/errors";
import { NewZiinaConfigTrpcHandler } from "@/modules/app-config/trpc-handlers/new-ziina-config-trpc-handler";
import { router } from "@/modules/trpc/trpc-server";
import { mapZiinaErrorToApiError } from "@/modules/ziina/ziina-api-error";
import { ZiinaAuthValidator } from "@/modules/ziina/ziina-auth-validator";
import { ZiinaWebhookManager } from "@/modules/ziina/ziina-webhook-manager";

const webhookCreator = new ZiinaWebhookManager();

/**
 * TODO: Probably create some test abstraction to bootstrap trpc handler for testing
 */
const getTestCaller = () => {
  const instance = new NewZiinaConfigTrpcHandler({
    webhookManager: webhookCreator,
  });

  // @ts-expect-error - context doesnt match but its applied in test
  instance.baseProcedure = TEST_Procedure;

  const testRouter = router({
    testProcedure: instance.getTrpcProcedure(),
  });

  return {
    mockedAppConfigRepo,
    webhookCreator,
    caller: testRouter.createCaller({
      appId: mockedSaleorAppId,
      saleorApiUrl: mockedSaleorApiUrl,
      token: mockedAppToken,
      configRepo: mockedAppConfigRepo,
      apiClient: mockedGraphqlClient,
      appUrl: "https://localhost:3000",
    }),
  };
};

describe("NewZiinaConfigTrpcHandler", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.spyOn(ZiinaAuthValidator.prototype, "validateZiinaAuth").mockResolvedValue(ok(null));
    vi.spyOn(webhookCreator, "createWebhook").mockImplementation(async () =>
      ok({
        id: "whid_1234",
        secret: mockedZiinaWebhookSecret,
      }),
    );
  });

  it("Returns error 500 if repository fails to save config", async () => {
    const { caller, mockedAppConfigRepo } = getTestCaller();

    vi.spyOn(mockedAppConfigRepo, "saveZiinaConfig").mockImplementationOnce(async () =>
      err(new BaseError("TEST")),
    );

    return expect(() =>
      caller.testProcedure({
        name: "Test config",
        accessToken: mockedZiinaAccessToken,
        ziinaEnv: "LIVE",
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[TRPCError: Failed to create Ziina configuration. Data can't be saved.]`,
    );
  });

  it("Returns 400 if config is in invalid shape (model can't be created)", () => {
    const { caller, mockedAppConfigRepo } = getTestCaller();

    vi.spyOn(mockedAppConfigRepo, "saveZiinaConfig").mockImplementationOnce(async () => ok(null));

    return expect(
      caller.testProcedure({
        name: "", //empty name should throw
        accessToken: mockedZiinaAccessToken,
        ziinaEnv: "LIVE",
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
      [TRPCError: [
        {
          "code": "too_small",
          "minimum": 1,
          "type": "string",
          "inclusive": true,
          "exact": false,
          "message": "String must contain at least 1 character(s)",
          "path": [
            "name"
          ]
        }
      ]]
    `);
  });

  it("Doesn't throw if everything set properly. Config repo is called to save data", async () => {
    const { caller, mockedAppConfigRepo } = getTestCaller();

    vi.spyOn(mockedAppConfigRepo, "saveZiinaConfig").mockImplementationOnce(async () => ok(null));

    await expect(
      caller.testProcedure({
        name: "Test config",
        accessToken: mockedZiinaAccessToken,
        ziinaEnv: "LIVE",
      }),
    ).resolves.not.toThrow();

    const mockCallArg = vi.mocked(mockedAppConfigRepo.saveZiinaConfig).mock.calls[0][0];

    expect(mockCallArg).toMatchInlineSnapshot(
      {
        config: {
          id: expect.any(String),
        },
      },
      `
      {
        "appId": "saleor-app-id",
        "config": {
          "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6aWluYS1hY2NvdW50Iiwic2NvcGVzIjpbIndyaXRlX3BheW1lbnRfaW50ZW50cyJdLCJpYXQiOjE3MTY3MTQwMDB9.c2lnbmF0dXJlX3BsYWNlaG9sZGVy",
          "id": Any<String>,
          "name": "Test config",
          "webhookId": "whid_1234",
          "webhookSecret": "ziina_whsec_test_secret",
          "ziinaEnv": "LIVE",
        },
        "saleorApiUrl": "https://foo.bar.saleor.cloud/graphql/",
      }
    `,
    );
  });

  describe("Ziina Auth", () => {
    it("Calls auth service and returns error if Ziina access token is invalid", async () => {
      vi.spyOn(ZiinaAuthValidator.prototype, "validateZiinaAuth").mockResolvedValueOnce(
        err(mapZiinaErrorToApiError({ error: new Error("Invalid key") })),
      );

      const { caller } = getTestCaller();

      return expect(() =>
        caller.testProcedure({
          name: "Test config",
          accessToken: mockedZiinaAccessToken,
          ziinaEnv: "LIVE",
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `[TRPCError: Failed to create Ziina configuration. Access token is invalid]`,
      );
    });
  });
});
