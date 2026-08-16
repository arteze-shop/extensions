import { describe, expect, it } from "vitest";

import {
  ZiinaWebhookFailureResponse,
  ZiinaWebhookMalformedRequestResponse,
  ZiinaWebhookSuccessResponse,
} from "./ziina-webhook-responses";

describe("ZiinaWebhookSuccessResponse", () => {
  it("Returns response with status 200 and success body to Ziina", async () => {
    const response = new ZiinaWebhookSuccessResponse().getResponse();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ success: true });
  });
});

describe("ZiinaWebhookMalformedRequestResponse", () => {
  it("Returns response with status 400 and failure body to Ziina", async () => {
    const response = new ZiinaWebhookMalformedRequestResponse().getResponse();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toStrictEqual({ success: false });
  });
});

describe("ZiinaWebhookFailureResponse", () => {
  it("Returns response with status 500 and failure body to Ziina", async () => {
    const response = new ZiinaWebhookFailureResponse().getResponse();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toStrictEqual({ success: false });
  });
});
