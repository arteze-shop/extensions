import { err, ok, type Result } from "neverthrow";

import { BaseError } from "@/lib/errors";
import { type ZiinaEnv } from "@/modules/ziina/ziina-env";
import { type ZiinaRestrictedKey } from "@/modules/ziina/ziina-restricted-key";
import { type ZiinaWebhookSecret } from "@/modules/ziina/ziina-webhook-secret";

export class ZiinaConfig {
  readonly name: string;
  readonly id: string;
  readonly accessToken: ZiinaRestrictedKey;
  readonly webhookSecret: ZiinaWebhookSecret;
  readonly webhookId: string;
  readonly ziinaEnv: ZiinaEnv;

  static ValidationError = BaseError.subclass("ValidationError", {
    props: {
      _internalName: "ZiinaConfig.ValidationError" as const,
    },
  });

  private constructor(props: {
    name: string;
    id: string;
    accessToken: ZiinaRestrictedKey;
    webhookSecret: ZiinaWebhookSecret;
    webhookId: string;
    ziinaEnv: ZiinaEnv;
  }) {
    this.name = props.name;
    this.id = props.id;
    this.accessToken = props.accessToken;
    this.webhookSecret = props.webhookSecret;
    this.webhookId = props.webhookId;
    this.ziinaEnv = props.ziinaEnv;
  }

  getZiinaEnvValue(): ZiinaEnv {
    return this.ziinaEnv;
  }

  static create(args: {
    name: string;
    id: string;
    accessToken: ZiinaRestrictedKey;
    webhookSecret: ZiinaWebhookSecret;
    webhookId: string;
    ziinaEnv: ZiinaEnv;
  }): Result<ZiinaConfig, InstanceType<typeof ZiinaConfig.ValidationError>> {
    if (args.name.length === 0) {
      return err(new ZiinaConfig.ValidationError("Config name cannot be empty"));
    }

    if (args.id.length === 0) {
      return err(new ZiinaConfig.ValidationError("Config id cannot be empty"));
    }

    return ok(
      new ZiinaConfig({
        name: args.name,
        id: args.id,
        accessToken: args.accessToken,
        webhookSecret: args.webhookSecret,
        webhookId: args.webhookId,
        ziinaEnv: args.ziinaEnv,
      }),
    );
  }
}

export type ZiinaFrontendConfigSerializedFields = {
  readonly name: string;
  readonly id: string;
  readonly accessToken: string;
  readonly webhookStatus?: "missing" | "disabled" | "active";
  readonly ziinaEnv: ZiinaEnv;
};

/**
 * Safe class that only returns whats permitted to the UI.
 * It also allows to serialize and deserialize itself, so it can be easily transported via tRPC
 */
export class ZiinaFrontendConfig implements ZiinaFrontendConfigSerializedFields {
  readonly name: string;
  readonly id: string;
  readonly accessToken: string;
  readonly ziinaEnv: ZiinaEnv;
  webhookStatus?: ZiinaFrontendConfigSerializedFields["webhookStatus"];

  private constructor(fields: ZiinaFrontendConfigSerializedFields) {
    this.name = fields.name;
    this.id = fields.id;
    this.accessToken = fields.accessToken;
    this.ziinaEnv = fields.ziinaEnv;
    this.webhookStatus = fields.webhookStatus;
  }

  private static getMaskedKeyValue(key: ZiinaRestrictedKey) {
    return `...${key.slice(-4)}`;
  }

  getZiinaEnvValue(): ZiinaEnv {
    return this.ziinaEnv;
  }

  static createFromZiinaConfig(ziinaConfig: ZiinaConfig) {
    return new ZiinaFrontendConfig({
      name: ziinaConfig.name,
      id: ziinaConfig.id,
      accessToken: this.getMaskedKeyValue(ziinaConfig.accessToken),
      ziinaEnv: ziinaConfig.ziinaEnv,
    });
  }

  static createFromSerializedFields(fields: ZiinaFrontendConfigSerializedFields) {
    return new ZiinaFrontendConfig(fields);
  }
}
