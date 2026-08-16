import { describe, expect, it } from "vitest";

import { type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";
import { createZiinaWebhookUrl } from "@/modules/ziina/ziina-webhook-url-builder";

const mockedSaleorApiUrl = "https://foo.bar.saleor.cloud/graphql/" as unknown as SaleorApiUrl;
const mockedConfigurationId = "81f323bd-91e2-4838-ab6e-5affd81ffc3b";
const mockedSaleorAppId = "saleor-app-id";

describe("createZiinaWebhookUrl", () => {
  it("Builds valid url from provided app origin and params", () => {
    const url = createZiinaWebhookUrl({
      appUrl: "http://localhost:3000",
      saleorApiUrl: mockedSaleorApiUrl,
      configurationId: mockedConfigurationId,
      appId: mockedSaleorAppId,
    });

    expect(url).toBe(
      "http://localhost:3000/api/webhooks/ziina?saleorApiUrl=https%3A%2F%2Ffoo.bar.saleor.cloud%2Fgraphql%2F&configurationId=81f323bd-91e2-4838-ab6e-5affd81ffc3b&appId=saleor-app-id",
    );
  });
});
