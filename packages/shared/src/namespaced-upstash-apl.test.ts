import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NamespacedUpstashAPL } from "./namespaced-upstash-apl";

const upstashUrl = "https://example.upstash.io";
const upstashToken = "test-token";
const saleorApiUrl = "https://api.example.com/graphql/";
const authData = { token: "token", saleorApiUrl, appId: "app-id" };

const mockFetch = vi.fn();

const createApl = (keyNamespace: string) =>
  new NamespacedUpstashAPL(keyNamespace, { restURL: upstashUrl, restToken: upstashToken });

const mockUpstashResponse = (result?: unknown) => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ result }) });
};

const getRequestedBody = () => {
  const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];

  return JSON.parse(options.body as string);
};

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NamespacedUpstashAPL", () => {
  it("sends the SET command with a namespaced key", async () => {
    mockUpstashResponse();

    await createApl("ziina").set(authData);

    expect(getRequestedBody()).toStrictEqual([
      "SET",
      `ziina:${saleorApiUrl}`,
      JSON.stringify(authData),
    ]);
  });

  it("sends the GET command with a namespaced key and returns parsed auth data", async () => {
    mockUpstashResponse(JSON.stringify(authData));

    const result = await createApl("smtp").get(saleorApiUrl);

    expect(getRequestedBody()).toStrictEqual(["GET", `smtp:${saleorApiUrl}`]);
    expect(result).toStrictEqual(authData);
  });

  it("returns undefined when nothing is stored under the key", async () => {
    mockUpstashResponse();

    await expect(createApl("ziina").get(saleorApiUrl)).resolves.toBeUndefined();
  });

  it("sends the DEL command with a namespaced key", async () => {
    mockUpstashResponse();

    await createApl("ziina").delete(saleorApiUrl);

    expect(getRequestedBody()).toStrictEqual(["DEL", `ziina:${saleorApiUrl}`]);
  });

  it("uses different keys for different namespaces", async () => {
    mockUpstashResponse();

    await createApl("ziina").set(authData);
    await createApl("smtp").set(authData);

    const firstBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    const secondBody = JSON.parse((mockFetch.mock.calls[1][1] as RequestInit).body as string);

    expect(firstBody).toStrictEqual(["SET", `ziina:${saleorApiUrl}`, JSON.stringify(authData)]);
    expect(secondBody).toStrictEqual(["SET", `smtp:${saleorApiUrl}`, JSON.stringify(authData)]);
  });

  it("reports not ready when configuration is missing", async () => {
    const apl = new NamespacedUpstashAPL("ziina", { restURL: "", restToken: "" });

    await expect(apl.isReady()).resolves.toStrictEqual({ ready: false, error: expect.any(Error) });
  });

  it("reports ready when configured", async () => {
    await expect(createApl("ziina").isReady()).resolves.toStrictEqual({ ready: true });
  });
});
