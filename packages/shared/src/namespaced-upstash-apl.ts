import {
  type APL,
  type AplConfiguredResult,
  type AplReadyResult,
  type AuthData,
} from "@saleor/app-sdk/APL";

type UpstashResponse = {
  result?: string;
  error?: string;
};

/**
 * Upstash APL variant that namespaces the Redis keys, so multiple Saleor apps
 * can safely share a single Upstash instance without overwriting each other's
 * auth data.
 */
export class NamespacedUpstashAPL implements APL {
  private readonly keyNamespace: string;

  private readonly restURL?: string;

  private readonly restToken?: string;

  constructor(keyNamespace: string, config?: { restURL?: string; restToken?: string }) {
    this.keyNamespace = keyNamespace;
    this.restURL = config?.restURL ?? process.env.UPSTASH_URL;
    this.restToken = config?.restToken ?? process.env.UPSTASH_TOKEN;
  }

  private buildKey(saleorApiUrl: string): string {
    return `${this.keyNamespace}:${saleorApiUrl}`;
  }

  private async upstashRequest(request: unknown[]): Promise<string | undefined> {
    if (!this.restURL || !this.restToken) {
      throw new Error(
        "NamespacedUpstashAPL is not configured. Make sure UPSTASH_URL and UPSTASH_TOKEN env variables are set.",
      );
    }

    let response: Response;

    try {
      response = await fetch(this.restURL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.restToken}` },
        body: JSON.stringify(request),
      });
    } catch (error) {
      throw new Error(`NamespacedUpstashAPL was unable to perform a request: ${error}`);
    }

    const parsedResponse = (await response.json()) as UpstashResponse;

    if (!response.ok || "error" in parsedResponse) {
      const errorMessage = parsedResponse.error ? `. Error: ${parsedResponse.error}` : "";

      throw new Error(
        `NamespacedUpstashAPL was not able to perform operation. Status code: ${response.status}${errorMessage}`,
      );
    }

    return parsedResponse.result;
  }

  async get(saleorApiUrl: string): Promise<AuthData | undefined> {
    const result = await this.upstashRequest(["GET", this.buildKey(saleorApiUrl)]);

    if (result) {
      return JSON.parse(result) as AuthData;
    }

    return undefined;
  }

  async set(authData: AuthData): Promise<void> {
    await this.upstashRequest([
      "SET",
      this.buildKey(authData.saleorApiUrl),
      JSON.stringify(authData),
    ]);
  }

  async delete(saleorApiUrl: string): Promise<void> {
    await this.upstashRequest(["DEL", this.buildKey(saleorApiUrl)]);
  }

  async getAll(): Promise<AuthData[]> {
    throw new Error("NamespacedUpstashAPL does not support the getAll method");
  }

  async isReady(): Promise<AplReadyResult> {
    const missingConf: string[] = [];

    if (!this.restToken) {
      missingConf.push("restToken");
    }

    if (!this.restURL) {
      missingConf.push("restURL");
    }

    if (missingConf.length > 0) {
      return {
        ready: false,
        error: new Error(
          `Configuration values for: ${missingConf.join(
            ", ",
          )} not found or is empty. Pass them to the constructor or set the UPSTASH_URL and UPSTASH_TOKEN env variables.`,
        ),
      };
    }

    return { ready: true };
  }

  async isConfigured(): Promise<AplConfiguredResult> {
    if (this.restToken && this.restURL) {
      return { configured: true };
    }

    return {
      configured: false,
      error: new Error(
        "NamespacedUpstashAPL not configured. Check if REST URL and token are provided in the constructor or env",
      ),
    };
  }
}
