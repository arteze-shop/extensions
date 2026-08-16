import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import { mockedAppConfigRepo } from "@/__tests__/mocks/app-config-repo";
import { mockedAppToken, mockedSaleorAppId } from "@/__tests__/mocks/constants";
import { mockedGraphqlClient } from "@/__tests__/mocks/graphql-client";
import { mockedZiinaConfig } from "@/__tests__/mocks/mock-ziina-config";
import { mockedSaleorApiUrl } from "@/__tests__/mocks/saleor-api-url";
import { TEST_Procedure } from "@/__tests__/trpc-testing-procedure";
import { BaseError } from "@/lib/errors";
import { AppRootConfig } from "@/modules/app-config/domain/app-root-config";
import { GetZiinaConfigsChannelsMappingTrpcHandler } from "@/modules/app-config/trpc-handlers/get-ziina-configs-channels-mapping-trpc-handler";
import { router } from "@/modules/trpc/trpc-server";

/**
 * TODO: Probably create some test abstraction to bootstrap trpc handler for testing
 */
const getTestCaller = () => {
  const instance = new GetZiinaConfigsChannelsMappingTrpcHandler();

  // @ts-expect-error - context doesnt match but its applied in test
  instance.baseProcedure = TEST_Procedure;

  const testRouter = router({
    testProcedure: instance.getTrpcProcedure(),
  });

  return {
    mockedAppConfigRepo,
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

describe("GetZiinaConfigsChannelsMappingTrpcHandler", () => {
  it("Returns error 500 if repository is down", async () => {
    const { caller, mockedAppConfigRepo } = getTestCaller();

    vi.spyOn(mockedAppConfigRepo, "getRootConfig").mockImplementationOnce(async () =>
      err(new BaseError("test")),
    );

    return expect(() => caller.testProcedure()).rejects.toThrowErrorMatchingInlineSnapshot(
      `[TRPCError: App failed to fetch config, please contact Saleor]`,
    );
  });

  it("Returns channels mapping from repository", async () => {
    const { caller, mockedAppConfigRepo } = getTestCaller();

    vi.spyOn(mockedAppConfigRepo, "getRootConfig").mockImplementationOnce(async () =>
      ok(
        new AppRootConfig(
          {
            "c-id1": "id-1",
          },
          {
            "id-1": mockedZiinaConfig,
          },
        ),
      ),
    );

    // Missing webhook status is expected - we dont have to show this field in the UI
    return expect(caller.testProcedure()).resolves.toMatchInlineSnapshot(`
      {
        "c-id1": ZiinaFrontendConfig {
          "accessToken": "...ZGVy",
          "id": "81f323bd-91e2-4838-ab6e-5affd81ffc3b",
          "name": "config-name",
          "webhookStatus": undefined,
          "ziinaEnv": "LIVE",
        },
      }
    `);
  });
});
