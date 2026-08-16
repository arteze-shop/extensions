export class ZiinaWebhookSuccessResponse {
  readonly statusCode = 200;

  getResponse() {
    return Response.json({ success: true }, { status: this.statusCode });
  }
}

export class ZiinaWebhookMalformedRequestResponse {
  readonly statusCode = 400;

  getResponse() {
    return Response.json({ success: false }, { status: this.statusCode });
  }
}

export class ZiinaWebhookFailureResponse {
  readonly statusCode = 500;

  getResponse() {
    return Response.json({ success: false }, { status: this.statusCode });
  }
}

export type PossibleZiinaWebhookSuccessResponses = ZiinaWebhookSuccessResponse;

export type PossibleZiinaWebhookErrorResponses =
  | ZiinaWebhookMalformedRequestResponse
  | ZiinaWebhookFailureResponse;
