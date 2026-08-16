import { type AuthData } from "@saleor/app-sdk/APL";

import { createInstrumentedGraphqlClient } from "@/lib/graphql-client";

import { ZiinaProblemReporter } from "./ziina-problem-reporter";

export function createZiinaProblemReporter(authData: AuthData): ZiinaProblemReporter {
  const client = createInstrumentedGraphqlClient(authData);

  return new ZiinaProblemReporter(client);
}
