import { afterEach, describe, expect, it, type Mock, vi } from "vitest";

import { UpstashClient } from "./upstash-client";

const upstashUrl = "https://example.upstash.io";
const upstashToken = "test-token";

const createFetchMock = (body: unknown, ok = true, status = 200): Mock<typeof fetch> =>
  vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
      ({
        ok,
        status,
        json: async () => body,
      }) as unknown as Response,
  );

const createClient = () => new UpstashClient({ url: upstashUrl, token: upstashToken });

const getRequestedBody = (fetchMock: Mock<typeof fetch>) => {
  const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];

  return JSON.parse(options.body as string);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UpstashClient", () => {
  it("returns the string result of the GET command", async () => {
    const fetchMock = createFetchMock({ result: "value" });

    vi.stubGlobal("fetch", fetchMock);

    const result = await createClient().get("key");

    expect(getRequestedBody(fetchMock)).toStrictEqual(["GET", "key"]);
    expect(result).toBe("value");
  });

  it("returns null when the GET command result is null", async () => {
    const fetchMock = createFetchMock({ result: null });

    vi.stubGlobal("fetch", fetchMock);

    const result = await createClient().get("missing-key");

    expect(result).toBeNull();
  });

  it("sends the SET command with the value", async () => {
    const fetchMock = createFetchMock({ result: "OK" });

    vi.stubGlobal("fetch", fetchMock);

    await createClient().set("key", "value");

    expect(getRequestedBody(fetchMock)).toStrictEqual(["SET", "key", "value"]);
  });

  it("returns true when SET with NX results in OK", async () => {
    const fetchMock = createFetchMock({ result: "OK" });

    vi.stubGlobal("fetch", fetchMock);

    const result = await createClient().setIfNotExists("key", "value");

    expect(getRequestedBody(fetchMock)).toStrictEqual(["SET", "key", "value", "NX"]);
    expect(result).toBe(true);
  });

  it("returns false when SET with NX finds the key already exists", async () => {
    const fetchMock = createFetchMock({ result: null });

    vi.stubGlobal("fetch", fetchMock);

    const result = await createClient().setIfNotExists("key", "value");

    expect(result).toBe(false);
  });

  it("sends the DEL command", async () => {
    const fetchMock = createFetchMock({ result: 1 });

    vi.stubGlobal("fetch", fetchMock);

    await createClient().del("key");

    expect(getRequestedBody(fetchMock)).toStrictEqual(["DEL", "key"]);
  });

  it("throws when the REST API returns an error", async () => {
    const fetchMock = createFetchMock({ error: "unknown command" });

    vi.stubGlobal("fetch", fetchMock);

    await expect(createClient().get("key")).rejects.toThrow();
  });

  it("throws when the REST API responds with a non-OK status", async () => {
    const fetchMock = createFetchMock({ error: "forbidden" }, false, 401);

    vi.stubGlobal("fetch", fetchMock);

    await expect(createClient().get("key")).rejects.toThrow();
  });

  it("throws when credentials are missing", () => {
    expect(() => new UpstashClient()).toThrow();
  });
});
