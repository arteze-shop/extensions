import { parseArgs } from "node:util";

import { Encryptor } from "@saleor/apps-shared/encryptor";
import { createDynamoDBSecretKeyRotationRunner } from "@saleor/apps-shared/key-rotation/dynamodb-secret-key-rotation-runner";
import {
  resolveRotationSourceKeys,
  resolveRotationTargetKey,
} from "@saleor/apps-shared/secret-key-resolution";
import * as Sentry from "@sentry/nextjs";

import { env } from "@/lib/env";
import { getDynamoEnv } from "@/lib/env-dynamodb";
import {
  createDynamoDBClient,
  createDynamoDBDocumentClient,
} from "@/modules/dynamodb/dynamodb-client";

import { createMigrationScriptLogger } from "./migration-logger";

const {
  values: { "dry-run": dryRun },
} = parseArgs({
  options: {
    "dry-run": {
      type: "boolean",
      default: false,
    },
  },
});

const logger = createMigrationScriptLogger("RotateSecretKey");

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.ENV,
  includeLocalVariables: true,
  skipOpenTelemetrySetup: true,
  ignoreErrors: [],
  integrations: [],
});

const dynamoEnv = getDynamoEnv();

const documentClient = createDynamoDBDocumentClient(
  createDynamoDBClient({
    requestTimeout: 30_000,
    connectionTimeout: 10_000,
    region: dynamoEnv.AWS_REGION,
    accessKeyId: dynamoEnv.AWS_ACCESS_KEY_ID,
    secretAccessKey: dynamoEnv.AWS_SECRET_ACCESS_KEY,
    roleArn: dynamoEnv.AWS_ROLE_ARN,
  }),
);

const runner = createDynamoDBSecretKeyRotationRunner({
  secretKey: resolveRotationTargetKey(env),
  fallbackKeys: resolveRotationSourceKeys(env),
  dryRun: dryRun ?? false,
  logger,
  documentClient,
  tableName: dynamoEnv.DYNAMODB_MAIN_TABLE_NAME,
  encryptedFieldNames: ["ziinaAccessToken", "ziinaWebhookSecret"],
  decrypt: (value, key) => new Encryptor(key).decrypt(value),
  encrypt: (plaintext, key) => new Encryptor(key).encrypt(plaintext),
});

runner
  .run()
  .then(({ failed }) => {
    if (failed > 0) process.exit(1);
  })
  .catch(async (error) => {
    logger.error("Fatal error during secret key rotation", { error: error });
    Sentry.captureException(error);
    await Sentry.flush(5000);
    process.exit(1);
  });
