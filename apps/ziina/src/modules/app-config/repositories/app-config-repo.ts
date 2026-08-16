import { type Result } from "neverthrow";

import { BaseError } from "@/lib/errors";
import { type AppRootConfig } from "@/modules/app-config/domain/app-root-config";
import { type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";

import { type ZiinaConfig } from "../domain/ziina-config";

export type BaseAccessPattern = {
  saleorApiUrl: SaleorApiUrl;
  appId: string;
};

/**
 * Saleor webhook will have available channel as access pattern. Repo must store channel<->config relation for this case
 */
export type ZiinaConfigByChannelIdAccessPattern = BaseAccessPattern & {
  channelId: string;
};

/**
 * Ziina webhook will provide ID of config from URL. Repo must be able to access it
 */
export type ZiinaConfigByConfigIdAccessPattern = BaseAccessPattern & {
  configId: string;
};

export type GetZiinaConfigAccessPattern =
  | ZiinaConfigByChannelIdAccessPattern
  | ZiinaConfigByConfigIdAccessPattern;

export const AppConfigRepoError = {
  FailureSavingConfig: BaseError.subclass("FailureSavingConfigError", {
    props: {
      _internalName: "AppConfigRepoError.FailureSavingConfigError",
    },
  }),
  FailureFetchingConfig: BaseError.subclass("FailureFetchingConfigError", {
    props: {
      _internalName: "AppConfigRepoError.FailureFetchingConfigError",
    },
  }),
  FailureRemovingConfig: BaseError.subclass("FailureRemovingConfigError", {
    props: {
      _internalName: "AppConfigRepoError.FailureRemovingConfig",
    },
  }),
};

export interface AppConfigRepo {
  saveZiinaConfig: (args: {
    config: ZiinaConfig;
    saleorApiUrl: SaleorApiUrl;
    appId: string;
  }) => Promise<Result<null | void, InstanceType<typeof AppConfigRepoError.FailureSavingConfig>>>;
  getZiinaConfig: (
    access: GetZiinaConfigAccessPattern,
  ) => Promise<
    Result<ZiinaConfig | null, InstanceType<typeof AppConfigRepoError.FailureFetchingConfig>>
  >;
  getRootConfig: (
    access: BaseAccessPattern,
  ) => Promise<
    Result<AppRootConfig, InstanceType<typeof AppConfigRepoError.FailureFetchingConfig>>
  >;
  removeConfig: (
    access: BaseAccessPattern,
    data: {
      configId: string;
    },
  ) => Promise<Result<null, InstanceType<typeof AppConfigRepoError.FailureRemovingConfig>>>;
  updateMapping: (
    access: BaseAccessPattern,
    data: {
      configId: string | null;
      channelId: string;
    },
  ) => Promise<Result<void | null, InstanceType<typeof AppConfigRepoError.FailureSavingConfig>>>;
}
