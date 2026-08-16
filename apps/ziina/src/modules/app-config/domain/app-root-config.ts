import { type ZiinaConfig } from "@/modules/app-config/domain/ziina-config";

export class AppRootConfig {
  readonly chanelConfigMapping: Record<string, string>;
  readonly ziinaConfigsById: Record<string, ZiinaConfig>;

  constructor(
    chanelConfigMapping: Record<string, string>,
    ziinaConfigsById: Record<string, ZiinaConfig>,
  ) {
    this.chanelConfigMapping = chanelConfigMapping;
    this.ziinaConfigsById = ziinaConfigsById;
  }

  getAllConfigsAsList() {
    return Object.values(this.ziinaConfigsById);
  }

  getChannelsBoundToGivenConfig(configId: string) {
    const keyValues = Object.entries(this.chanelConfigMapping);
    const filtered = keyValues.filter(([_, value]) => value === configId);

    return filtered.map(([channelId]) => channelId);
  }
}
