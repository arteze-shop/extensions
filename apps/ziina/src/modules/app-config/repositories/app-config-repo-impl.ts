import { env } from "@/lib/env";
import { DynamodbAppConfigRepo } from "@/modules/app-config/repositories/dynamodb/dynamodb-app-config-repo";
import { FileAppConfigRepo } from "@/modules/app-config/repositories/file/file-app-config-repo";
import { UpstashAppConfigRepo } from "@/modules/app-config/repositories/upstash/upstash-app-config-repo";

/*
 * Replace this implementation with custom DB (Redis, Metadata etc) to drop DynamoDB and bring something else
 */
export const appConfigRepoImpl =
  env.CONFIG_STORAGE_MODE === "upstash"
    ? new UpstashAppConfigRepo()
    : env.CONFIG_STORAGE_MODE === "file"
    ? new FileAppConfigRepo()
    : new DynamodbAppConfigRepo();
