import { describe, expect, it } from "vitest";

import { mockedConfigurationId, mockedSaleorAppId } from "@/__tests__/mocks/constants";
import { mockedSaleorApiUrl } from "@/__tests__/mocks/saleor-api-url";

import { WebhookParamsValidationError, ZiinaWebhookParams } from "./webhook-params";

describe("ZiinaWebhookParams", () => {
  const validSearchParams = new URLSearchParams({
    [ZiinaWebhookParams.saleorApiUrlSearchParam]: mockedSaleorApiUrl,
    [ZiinaWebhookParams.configurationIdSearchParam]: mockedConfigurationId,
    [ZiinaWebhookParams.appIdSearchParam]: mockedSaleorAppId,
  });

  const validUrl = new URL(
    "https://test-deployment.com?" + validSearchParams.toString(),
  ).toString();

  // Ensure testing entities are valid from human perspective
  it("Valid url is valid", () => {
    expect(validUrl).toMatchInlineSnapshot(
      `"https://test-deployment.com/?saleorApiUrl=https%3A%2F%2Ffoo.bar.saleor.cloud%2Fgraphql%2F&configurationId=81f323bd-91e2-4838-ab6e-5affd81ffc3b&appId=saleor-app-id"`,
    );
  });

  // Ensure param names that are public contract are preserved by a test, if this changes, contract is broken
  it("Ensure public params are stable", () => {
    expect(ZiinaWebhookParams.saleorApiUrlSearchParam).toStrictEqual("saleorApiUrl");
    expect(ZiinaWebhookParams.configurationIdSearchParam).toStrictEqual("configurationId");
    expect(ZiinaWebhookParams.appIdSearchParam).toStrictEqual("appId");
  });

  describe("working on saleorApiUrl", () => {
    it("Parses saleorApiUrl to the field", () => {
      const result = ZiinaWebhookParams.createFromWebhookUrl(validUrl);

      const vo = result._unsafeUnwrap();

      expect(vo.saleorApiUrl).toStrictEqual(mockedSaleorApiUrl);
    });

    it("Throws if saleorApiUrl is missing", () => {
      const params = new URLSearchParams({
        [ZiinaWebhookParams.configurationIdSearchParam]: mockedConfigurationId,
        [ZiinaWebhookParams.appIdSearchParam]: mockedSaleorAppId,
      });

      const result = ZiinaWebhookParams.createFromWebhookUrl(
        new URL("https://test-deployment.com?" + params.toString()).toString(),
      );

      const error = result._unsafeUnwrapErr();

      expect(error).toMatchInlineSnapshot(`
        [WebhookParamsValidationError: Missing saleorApiUrl param
        Cant parse Ziina incoming webhook URL]
      `);
    });

    it("Throws if saleorApiUrl is malformed", () => {
      const params = new URLSearchParams({
        [ZiinaWebhookParams.saleorApiUrlSearchParam]: "test",
        [ZiinaWebhookParams.configurationIdSearchParam]: mockedConfigurationId,
        [ZiinaWebhookParams.appIdSearchParam]: mockedSaleorAppId,
      });

      const result = ZiinaWebhookParams.createFromWebhookUrl(
        new URL(`https://test-deployment.com?${params.toString()}`).toString(),
      );

      const error = result._unsafeUnwrapErr();

      expect(error).toMatchInlineSnapshot(`
        [WebhookParamsValidationError: saleorApiUrl URL param is invalid
        Cant parse Ziina incoming webhook URL]
      `);
    });
  });

  describe("working on configurationId", () => {
    it("Parses configurationId to the field", () => {
      const result = ZiinaWebhookParams.createFromWebhookUrl(validUrl);

      const vo = result._unsafeUnwrap();

      expect(vo.configurationId).toStrictEqual(mockedConfigurationId);
    });

    it("Throws if configurationId is missing", () => {
      const params = new URLSearchParams({
        [ZiinaWebhookParams.saleorApiUrlSearchParam]: mockedSaleorApiUrl,
        [ZiinaWebhookParams.appIdSearchParam]: mockedSaleorAppId,
      });

      const result = ZiinaWebhookParams.createFromWebhookUrl(
        new URL("https://test-deployment.com?" + params.toString()).toString(),
      );

      const error = result._unsafeUnwrapErr();

      expect(error).toMatchInlineSnapshot(`
        [WebhookParamsValidationError: configurationId URL param is invalid
        Cant parse Ziina incoming webhook URL]
      `);
    });

    it("Throws if configurationId is malformed", () => {
      const params = new URLSearchParams({
        [ZiinaWebhookParams.configurationIdSearchParam]: "",
        [ZiinaWebhookParams.saleorApiUrlSearchParam]: mockedSaleorApiUrl,
        [ZiinaWebhookParams.appIdSearchParam]: mockedSaleorAppId,
      });

      const result = ZiinaWebhookParams.createFromWebhookUrl(
        new URL(`https://test-deployment.com?${params.toString()}`).toString(),
      );

      const error = result._unsafeUnwrapErr();

      expect(error).toMatchInlineSnapshot(`
        [WebhookParamsValidationError: configurationId URL param is invalid
        Cant parse Ziina incoming webhook URL]
      `);
    });
  });

  describe("working on appId", () => {
    it("Parses appId to the field", () => {
      const result = ZiinaWebhookParams.createFromWebhookUrl(validUrl);

      const vo = result._unsafeUnwrap();

      expect(vo.appId).toStrictEqual(mockedSaleorAppId);
    });

    it("Throws if appId is missing", () => {
      const params = new URLSearchParams({
        [ZiinaWebhookParams.saleorApiUrlSearchParam]: mockedSaleorApiUrl,
        [ZiinaWebhookParams.configurationIdSearchParam]: mockedConfigurationId,
      });

      const result = ZiinaWebhookParams.createFromWebhookUrl(
        new URL("https://test-deployment.com?" + params.toString()).toString(),
      );

      const error = result._unsafeUnwrapErr();

      expect(error).toMatchInlineSnapshot(`
        [WebhookParamsValidationError: appId URL param is invalid
        Cant parse Ziina incoming webhook URL]
      `);
    });

    it("Throws if appId is malformed", () => {
      const params = new URLSearchParams({
        [ZiinaWebhookParams.configurationIdSearchParam]: mockedConfigurationId,
        [ZiinaWebhookParams.saleorApiUrlSearchParam]: mockedSaleorApiUrl,
        [ZiinaWebhookParams.appIdSearchParam]: "",
      });

      const result = ZiinaWebhookParams.createFromWebhookUrl(
        new URL(`https://test-deployment.com?${params.toString()}`).toString(),
      );

      const error = result._unsafeUnwrapErr();

      expect(error).toMatchInlineSnapshot(`
        [WebhookParamsValidationError: appId URL param is invalid
        Cant parse Ziina incoming webhook URL]
      `);
    });
  });

  it("Attaches a public message to the validation error", () => {
    const result = ZiinaWebhookParams.createFromWebhookUrl("https://test-deployment.com");

    const error = result._unsafeUnwrapErr();

    expect(error).toBeInstanceOf(WebhookParamsValidationError);
    expect(error.publicMessage).toStrictEqual("Webhook URL parameters are invalid");
  });
});
