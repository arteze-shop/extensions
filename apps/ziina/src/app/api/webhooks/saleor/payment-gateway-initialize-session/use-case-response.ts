import { z } from "zod";

import { SuccessWebhookResponse } from "@/app/api/webhooks/saleor/saleor-webhook-responses";
import { type PaymentGatewayInitializeSession } from "@/generated/app-webhooks-types/payment-gateway-initialize-session";
import { type AppContext } from "@/lib/app-context";
import { type ZiinaApiError, ZiinaApiErrorPublicCode } from "@/modules/ziina/ziina-api-error";

class Success extends SuccessWebhookResponse {
  constructor(args: { appContext: AppContext }) {
    super(args.appContext);
  }

  getResponse() {
    const typeSafeResponse: PaymentGatewayInitializeSession = { data: {} };

    return Response.json(typeSafeResponse, { status: this.statusCode });
  }
}

class Failure extends SuccessWebhookResponse {
  readonly error: ZiinaApiError;

  private static ResponseDataSchema = z.object({
    errors: z.array(
      z.object({
        code: z.literal(ZiinaApiErrorPublicCode),
        message: z.string(),
      }),
    ),
  });

  constructor(args: { error: ZiinaApiError; appContext: AppContext }) {
    super(args.appContext);
    this.error = args.error;
  }

  getResponse() {
    const typeSafeResponse: PaymentGatewayInitializeSession = {
      data: Failure.ResponseDataSchema.parse({
        errors: [
          {
            code: this.error.publicCode,
            message: this.messageFormatter.formatMessage(this.error.publicMessage, this.error),
          },
        ],
      }),
    };

    return Response.json(typeSafeResponse, { status: this.statusCode });
  }
}

export const PaymentGatewayInitializeSessionUseCaseResponses = {
  Success,
  Failure,
};

export type PaymentGatewayInitializeSessionUseCaseResponsesType = InstanceType<
  typeof PaymentGatewayInitializeSessionUseCaseResponses.Success
>;
