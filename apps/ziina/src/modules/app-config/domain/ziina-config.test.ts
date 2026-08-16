import { describe, expect, it } from "vitest";

import { mockedConfigurationId } from "@/__tests__/mocks/constants";
import { mockedZiinaConfig } from "@/__tests__/mocks/mock-ziina-config";
import { mockedZiinaAccessToken } from "@/__tests__/mocks/mocked-ziina-access-token";
import { mockedZiinaWebhookSecret } from "@/__tests__/mocks/mocked-ziina-webhook-secret";

import { ZiinaConfig, ZiinaFrontendConfig } from "./ziina-config";

describe("ZiinaConfig", () => {
  it("should create a valid config", () => {
    const result = ZiinaConfig.create({
      name: "Test Config",
      id: "test-config-1",
      accessToken: mockedZiinaAccessToken,
      webhookSecret: mockedZiinaWebhookSecret,
      webhookId: "wh_123456789",
      ziinaEnv: "LIVE",
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().name).toBe("Test Config");
    expect(result._unsafeUnwrap().id).toBe("test-config-1");
    expect(result._unsafeUnwrap().accessToken).toBe(mockedZiinaAccessToken);
    expect(result._unsafeUnwrap().ziinaEnv).toBe("LIVE");
  });

  it("should return error for empty name", () => {
    const result = ZiinaConfig.create({
      name: "",
      id: "test-config-1",
      accessToken: mockedZiinaAccessToken,
      webhookSecret: mockedZiinaWebhookSecret,
      webhookId: "wh_123456789",
      ziinaEnv: "LIVE",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ZiinaConfig.ValidationError);
    expect(result._unsafeUnwrapErr().message).toBe("Config name cannot be empty");
  });

  it("should return error for empty id", () => {
    const result = ZiinaConfig.create({
      name: "Test Config",
      id: "",
      accessToken: mockedZiinaAccessToken,
      webhookSecret: mockedZiinaWebhookSecret,
      webhookId: "wh_123456789",
      ziinaEnv: "LIVE",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ZiinaConfig.ValidationError);
    expect(result._unsafeUnwrapErr().message).toBe("Config id cannot be empty");
  });

  it("stores the ziinaEnv explicitly - not derived from key prefix", () => {
    const result = ZiinaConfig.create({
      name: "Test Config",
      id: "test-config-1",
      accessToken: mockedZiinaAccessToken,
      webhookSecret: mockedZiinaWebhookSecret,
      webhookId: "wh_123456789",
      ziinaEnv: "TEST",
    })._unsafeUnwrap();

    expect(result.getZiinaEnvValue()).toBe("TEST");
  });
});

describe("ZiinaFrontendConfig", () => {
  it("Creates from Ziina Config and sets expected data", () => {
    const frontendConfig = ZiinaFrontendConfig.createFromZiinaConfig(mockedZiinaConfig);

    expect(frontendConfig.id).toStrictEqual(mockedZiinaConfig.id);
    expect(frontendConfig.name).toStrictEqual(mockedZiinaConfig.name);
    expect(frontendConfig.ziinaEnv).toStrictEqual(mockedZiinaConfig.ziinaEnv);

    // Ensure access token is masked
    expect(frontendConfig.accessToken).toMatchInlineSnapshot(`"...ZGVy"`);
  });

  it("Serializes and deserializes from itself", () => {
    const frontendConfig = ZiinaFrontendConfig.createFromZiinaConfig(mockedZiinaConfig);

    const serialized = JSON.stringify(frontendConfig);

    /**
     * Ensure serialized data doesn't have secrets!
     */
    expect(serialized).toMatchInlineSnapshot(
      `"{"name":"config-name","id":"81f323bd-91e2-4838-ab6e-5affd81ffc3b","accessToken":"...ZGVy","ziinaEnv":"LIVE"}"`,
    );

    //@ts-expect-error - JSON is arbitrary
    const parsedBack = ZiinaFrontendConfig.createFromSerializedFields(JSON.parse(serialized));

    expect(parsedBack.id).toStrictEqual(mockedZiinaConfig.id);
    expect(parsedBack.name).toStrictEqual(mockedZiinaConfig.name);
    expect(parsedBack.ziinaEnv).toStrictEqual(mockedZiinaConfig.ziinaEnv);

    // Ensure access token is masked
    expect(parsedBack.accessToken).toMatchInlineSnapshot(`"...ZGVy"`);
  });

  it("Returns TEST and LIVE information about the config", () => {
    const testConfig = ZiinaFrontendConfig.createFromSerializedFields({
      name: "Test",
      id: mockedConfigurationId,
      accessToken: "...token",
      ziinaEnv: "TEST",
    });

    const liveConfig = ZiinaFrontendConfig.createFromSerializedFields({
      name: "Test",
      id: mockedConfigurationId,
      accessToken: "...token",
      ziinaEnv: "LIVE",
    });

    expect(testConfig.getZiinaEnvValue()).toBe("TEST");
    expect(liveConfig.getZiinaEnvValue()).toBe("LIVE");
  });
});
