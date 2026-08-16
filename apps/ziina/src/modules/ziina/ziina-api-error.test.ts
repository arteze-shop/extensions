import { describe, expect, it } from "vitest";

import {
  mapZiinaErrorToApiError,
  ZiinaApiAuthenticationError,
  ZiinaApiConnectionError,
  ZiinaApiInvalidRequestError,
  ZiinaApiRateLimitError,
  ZiinaApiResponseError,
  ZiinaApiUnknownError,
} from "./ziina-api-error";

describe("mapZiinaErrorToApiError", () => {
  it("maps network error (TypeError) to ZiinaApiConnectionError", () => {
    const result = mapZiinaErrorToApiError({ error: new TypeError("Failed to fetch") });

    expect(result).toBeInstanceOf(ZiinaApiConnectionError);
  });

  it("maps 400 error with body to ZiinaApiInvalidRequestError with publicMessage from body", () => {
    const result = mapZiinaErrorToApiError({
      error: new Error("Request to Ziina API failed with status 400"),
      httpStatusCode: 400,
      errorBody: { message: "Invalid amount", code: "invalid_amount" },
    });

    expect(result).toBeInstanceOf(ZiinaApiInvalidRequestError);
    expect(result.publicMessage).toBe("Invalid amount");
    expect(result.publicCode).toBe("invalid_amount");
  });

  it("maps 404 error to ZiinaApiInvalidRequestError", () => {
    const result = mapZiinaErrorToApiError({
      error: new Error("Request to Ziina API failed with status 404"),
      httpStatusCode: 404,
      errorBody: { message: "Payment intent not found", code: "not_found" },
    });

    expect(result).toBeInstanceOf(ZiinaApiInvalidRequestError);
  });

  it("maps 401 error to ZiinaApiAuthenticationError", () => {
    const result = mapZiinaErrorToApiError({
      error: new Error("Request to Ziina API failed with status 401"),
      httpStatusCode: 401,
      errorBody: { message: "Invalid token", code: "unauthorized" },
    });

    expect(result).toBeInstanceOf(ZiinaApiAuthenticationError);
    expect(result.publicMessage).toBe("Invalid token");
  });

  it("maps 403 error to ZiinaApiAuthenticationError", () => {
    const result = mapZiinaErrorToApiError({
      error: new Error("Request to Ziina API failed with status 403"),
      httpStatusCode: 403,
      errorBody: { message: "Forbidden", code: "forbidden" },
    });

    expect(result).toBeInstanceOf(ZiinaApiAuthenticationError);
  });

  it("maps 429 error to ZiinaApiRateLimitError", () => {
    const result = mapZiinaErrorToApiError({
      error: new Error("Request to Ziina API failed with status 429"),
      httpStatusCode: 429,
      errorBody: { message: "Too many requests", code: "rate_limit" },
    });

    expect(result).toBeInstanceOf(ZiinaApiRateLimitError);
  });

  it("maps 500 error to ZiinaApiResponseError", () => {
    const result = mapZiinaErrorToApiError({
      error: new Error("Request to Ziina API failed with status 500"),
      httpStatusCode: 500,
      errorBody: { message: "Internal server error", code: "internal_error" },
    });

    expect(result).toBeInstanceOf(ZiinaApiResponseError);
  });

  it("falls back to a generic public message when the error body has no message", () => {
    const result = mapZiinaErrorToApiError({
      error: new Error("Request to Ziina API failed with status 400"),
      httpStatusCode: 400,
    });

    expect(result).toBeInstanceOf(ZiinaApiInvalidRequestError);
    expect(result.publicMessage).toBe("There is a problem with the request to Ziina API");
  });

  it("maps unknown error to ZiinaApiUnknownError", () => {
    const unknownError = new Error("Unknown error");

    const result = mapZiinaErrorToApiError({ error: unknownError });

    expect(result).toBeInstanceOf(ZiinaApiUnknownError);
  });
});
