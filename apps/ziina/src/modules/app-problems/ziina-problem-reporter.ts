import { AppProblemsReporter } from "@saleor/app-problems";
import { type Client } from "urql";

import { createLogger } from "@/lib/logger";

const logger = createLogger("ZiinaProblemReporter");

export const PROBLEM_KEYS = {
  authFailure: (configId: string) => `ziina-auth-failure:${configId}`,
  webhookSecretMismatch: (configId: string) => `ziina-webhook-secret-mismatch:${configId}`,
  configMissing: (configId: string) => `ziina-config-missing:${configId}`,
  apiProblem: (configId: string) => `ziina-api-problem:${configId}`,
} as const;

export class ZiinaProblemReporter {
  private reporter: AppProblemsReporter;

  constructor(client: Client) {
    this.reporter = new AppProblemsReporter(client);
  }

  async reportAuthFailure(configId: string, configName: string): Promise<void> {
    const result = await this.reporter.reportProblem({
      key: PROBLEM_KEYS.authFailure(configId),
      criticalThreshold: 1,
      message: `Ziina access token for configuration "${configName}" is invalid or expired. Payments for channels using this configuration will fail. Please update the access token.`,
    });

    if (result.isErr()) {
      logger.error("Failed to report auth failure problem", { error: result.error });
    }
  }

  async reportWebhookSecretMismatch(configId: string, configName: string): Promise<void> {
    const result = await this.reporter.reportProblem({
      key: PROBLEM_KEYS.webhookSecretMismatch(configId),
      criticalThreshold: 1,
      message: `Webhook signature verification failed for configuration "${configName}". Payment status updates from Ziina are not being processed. The webhook secret may have been rotated in Ziina. Please recreate the configuration.`,
    });

    if (result.isErr()) {
      logger.error("Failed to report webhook secret mismatch problem", {
        error: result.error,
      });
    }
  }

  async reportConfigMissing(configId: string): Promise<void> {
    const result = await this.reporter.reportProblem({
      key: PROBLEM_KEYS.configMissing(configId),
      criticalThreshold: 1,
      message: `Ziina is sending webhook events for configuration "${configId}" but no matching configuration was found. The configuration may have been deleted while the Ziina webhook endpoint is still active. Please remove the orphaned webhook in your Ziina Dashboard.`,
    });

    if (result.isErr()) {
      logger.error("Failed to report config missing problem", { error: result.error });
    }
  }

  async reportApiProblem(_error: Error, config: { id: string; name: string }): Promise<void> {
    const result = await this.reporter.reportProblem({
      key: PROBLEM_KEYS.apiProblem(config.id),
      criticalThreshold: 1,
      message: `Ziina API returned an error for configuration "${config.name}". Payments for channels using this configuration will fail. Please check the access token and Ziina API status.`,
    });

    if (result.isErr()) {
      logger.error("Failed to report API problem", { error: result.error, configId: config.id });
    }
  }

  async clearProblemsForConfig(configId: string): Promise<void> {
    const keys = [
      PROBLEM_KEYS.authFailure(configId),
      PROBLEM_KEYS.webhookSecretMismatch(configId),
      PROBLEM_KEYS.configMissing(configId),
      PROBLEM_KEYS.apiProblem(configId),
    ];
    const result = await this.reporter.clearProblems(keys);

    if (result.isErr()) {
      logger.error("Failed to clear problems for config", { error: result.error, configId });
    }
  }
}
