import { createZiinaWebhookSecret } from "@/modules/ziina/ziina-webhook-secret";

export const mockedZiinaWebhookSecret =
  createZiinaWebhookSecret("ziina_whsec_test_secret")._unsafeUnwrap();
