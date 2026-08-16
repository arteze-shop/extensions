import { type WebhookContext } from "@saleor/app-sdk/handlers/shared";
import { type NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { withRecipientVerification } from "./with-recipient-verification";

describe("withRecipientVerification", () => {
  it("Returns 403 response when recipient ID does not match auth data ID", async () => {
    const handler = async () => Response.json({}, { status: 200 });
    const wrapped = withRecipientVerification(handler);

    const response = await wrapped(
      {} as NextRequest,
      {
        authData: { appId: "saleor-app-id-1" },
        payload: { recipient: { id: "saleor-app-id-2" } },
      } as WebhookContext<{ recipient: { id: string } | null }>,
    );

    expect(response.status).toBe(403);
  });

  it("Calls handler when recipient ID matches auth data ID", async () => {
    const handler = vi.fn(async () => Response.json({}, { status: 200 }));
    const wrapped = withRecipientVerification(handler);

    const response = await wrapped(
      {} as NextRequest,
      {
        authData: { appId: "saleor-app-id-1" },
        payload: { recipient: { id: "saleor-app-id-1" } },
      } as WebhookContext<{ recipient: { id: string } | null }>,
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });
});
