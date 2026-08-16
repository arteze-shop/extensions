import { captureException } from "@sentry/nextjs";

import { BaseError } from "@/lib/errors";

export const ZiinaApiErrorPublicCode = "ZiinaApiError";

export type ZiinaApiError = InstanceType<
  | typeof ZiinaApiConnectionError
  | typeof ZiinaApiInvalidRequestError
  | typeof ZiinaApiAuthenticationError
  | typeof ZiinaApiRateLimitError
  | typeof ZiinaApiResponseError
  | typeof ZiinaApiUnknownError
>;

export const ZiinaApiConnectionError = BaseError.subclass("ZiinaApiConnectionError", {
  props: {
    _internalName: "ZiinaClient.ZiinaApiConnectionError" as const,
    publicCode: ZiinaApiErrorPublicCode,
    publicMessage: "There was a network problem between app and Ziina API",
    merchantMessage: "There was a network problem between app and Ziina API",
  },
});

export const ZiinaApiInvalidRequestError = BaseError.subclass("ZiinaApiInvalidRequestError", {
  props: {
    _internalName: "ZiinaClient.ZiinaApiInvalidRequestError" as const,
    publicCode: ZiinaApiErrorPublicCode,
    publicMessage: "There is a problem with the request to Ziina API",
    merchantMessage: "There is a problem with the request to Ziina API",
  },
});

export const ZiinaApiAuthenticationError = BaseError.subclass("ZiinaApiAuthenticationError", {
  props: {
    _internalName: "ZiinaClient.ZiinaApiAuthenticationError" as const,
    publicCode: ZiinaApiErrorPublicCode,
    publicMessage: "App can't authenticate with Ziina API",
    merchantMessage: "App can't authenticate with Ziina API",
  },
});

export const ZiinaApiRateLimitError = BaseError.subclass("ZiinaApiRateLimitError", {
  props: {
    _internalName: "ZiinaClient.ZiinaApiRateLimitError" as const,
    publicCode: ZiinaApiErrorPublicCode,
    publicMessage: "There is a problem with the request to Ziina API",
    merchantMessage: "There is a problem with the request to Ziina API",
  },
});

export const ZiinaApiResponseError = BaseError.subclass("ZiinaApiResponseError", {
  props: {
    _internalName: "ZiinaClient.ZiinaApiResponseError" as const,
    publicCode: ZiinaApiErrorPublicCode,
    publicMessage: "There is a problem with the request to Ziina API",
    merchantMessage: "There is a problem with the request to Ziina API",
  },
});

export const ZiinaApiUnknownError = BaseError.subclass("ZiinaApiUnknownError", {
  props: {
    _internalName: "ZiinaClient.ZiinaApiUnknownError" as const,
    publicCode: ZiinaApiErrorPublicCode,
    publicMessage: "There is a problem with the request to Ziina API",
    merchantMessage: "There is a problem with the request to Ziina API",
  },
});

export type ZiinaErrorBody = {
  message?: string;
  code?: string;
};

const GENERIC_ERROR_MESSAGE = "There is a problem with the request to Ziina API";

/**
 * Maps an unknown error or an HTTP error response into a ZiinaApiError.
 *
 * Ziina returns error bodies shaped as `{ message, code }` - the `message`
 * is surfaced to the storefront as the public message.
 */
export const mapZiinaErrorToApiError = (args: {
  error: unknown;
  httpStatusCode?: number;
  errorBody?: ZiinaErrorBody;
}): ZiinaApiError => {
  const { error, httpStatusCode, errorBody } = args;

  if (httpStatusCode !== undefined) {
    const publicMessage = errorBody?.message ?? GENERIC_ERROR_MESSAGE;
    const publicCode = errorBody?.code ?? ZiinaApiErrorPublicCode;

    switch (httpStatusCode) {
      case 400:
      case 404:
        return new ZiinaApiInvalidRequestError("There is a problem with the request to Ziina API", {
          cause: error,
          props: {
            publicMessage,
            publicCode,
          },
        });
      case 401:
      case 403:
        return new ZiinaApiAuthenticationError("App can't authenticate with Ziina API", {
          cause: error,
          props: {
            publicMessage,
            publicCode,
          },
        });
      case 429:
        return new ZiinaApiRateLimitError("Too many requests made to the API too quickly", {
          cause: error,
          props: {
            publicMessage,
            publicCode,
          },
        });
      default:
        return new ZiinaApiResponseError("Something went wrong on Ziina end", {
          cause: error,
          props: {
            publicMessage,
            publicCode,
          },
        });
    }
  }

  if (error instanceof TypeError) {
    return new ZiinaApiConnectionError("There was a network problem between app and Ziina API", {
      cause: error,
    });
  }

  captureException(error);

  return new ZiinaApiUnknownError("Unknown error", {
    cause: error,
  });
};
