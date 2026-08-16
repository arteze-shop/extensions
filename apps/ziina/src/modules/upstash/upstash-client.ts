import { env } from "@/lib/env";
import { BaseError } from "@/lib/errors";

export const UpstashClientError = {
  MissingCredentials: BaseError.subclass("UpstashClientError.MissingCredentialsError", {
    props: {
      _internalName: "UpstashClientError.MissingCredentialsError" as const,
    },
  }),
};

export interface UpstashClientLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setIfNotExists(key: string, value: string): Promise<boolean>;
  del(key: string): Promise<void>;
}

type UpstashCommand = [string, ...string[]];

type ConstructorParams = {
  url?: string;
  token?: string;
};

export class UpstashClient implements UpstashClientLike {
  private url: string;
  private token: string;

  constructor(params: ConstructorParams = {}) {
    const url = params.url ?? env.UPSTASH_URL;
    const token = params.token ?? env.UPSTASH_TOKEN;

    if (!url || !token) {
      throw new UpstashClientError.MissingCredentials(
        "Missing Upstash credentials. Set UPSTASH_URL and UPSTASH_TOKEN env vars.",
      );
    }

    this.url = url;
    this.token = token;
  }

  private async exec(command: UpstashCommand): Promise<string | null> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      throw new BaseError("Upstash REST API request failed", {
        props: {
          statusCode: response.status,
        },
      });
    }

    const [data, error] = (await response.json()) as [string | null, string | null];

    if (error) {
      throw new BaseError("Upstash REST API returned an error", {
        cause: error,
      });
    }

    return data;
  }

  async get(key: string): Promise<string | null> {
    return this.exec(["GET", key]);
  }

  async set(key: string, value: string): Promise<void> {
    await this.exec(["SET", key, value]);
  }

  async setIfNotExists(key: string, value: string): Promise<boolean> {
    const data = await this.exec(["SET", key, value, "NX"]);

    return data === "OK";
  }

  async del(key: string): Promise<void> {
    await this.exec(["DEL", key]);
  }
}
