import { describe, expect, it } from "vitest";

import { mockedZiinaAccessToken } from "@/__tests__/mocks/mocked-ziina-access-token";
import { newZiinaConfigInputSchema } from "@/modules/app-config/trpc-handlers/new-ziina-config-input-schema";

describe("newZiinaConfigInputSchema", () => {
  it("Properly parses valid input", () => {
    expect(
      newZiinaConfigInputSchema.parse({
        name: "test",
        accessToken: mockedZiinaAccessToken,
        ziinaEnv: "LIVE",
      }),
    ).toStrictEqual({
      name: "test",
      accessToken: mockedZiinaAccessToken,
      ziinaEnv: "LIVE",
    });
  });

  it("Returns list of errors for invalid input", () => {
    expect(() =>
      newZiinaConfigInputSchema.parse({
        name: "",
        accessToken: "",
        ziinaEnv: "INVALID",
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
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
        },
        {
          "code": "too_small",
          "minimum": 1,
          "type": "string",
          "inclusive": true,
          "exact": false,
          "message": "String must contain at least 1 character(s)",
          "path": [
            "accessToken"
          ]
        },
        {
          "received": "INVALID",
          "code": "invalid_enum_value",
          "options": [
            "TEST",
            "LIVE"
          ],
          "path": [
            "ziinaEnv"
          ],
          "message": "Invalid enum value. Expected 'TEST' | 'LIVE', received 'INVALID'"
        }
      ]]
    `);
  });
});
