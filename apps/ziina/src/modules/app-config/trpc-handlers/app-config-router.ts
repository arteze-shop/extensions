import { GetSaleorChannelsTrpcHandler } from "@/modules/app-config/trpc-handlers/get-saleor-channels-trpc-handler";
import { GetZiinaConfigsChannelsMappingTrpcHandler } from "@/modules/app-config/trpc-handlers/get-ziina-configs-channels-mapping-trpc-handler";
import { GetZiinaConfigsListTrpcHandler } from "@/modules/app-config/trpc-handlers/get-ziina-configs-list-trpc-handler";
import { NewZiinaConfigTrpcHandler } from "@/modules/app-config/trpc-handlers/new-ziina-config-trpc-handler";
import { RemoveZiinaConfigTrpcHandler } from "@/modules/app-config/trpc-handlers/remove-ziina-config-trpc-handler";
import { UpdateMappingTrpcHandler } from "@/modules/app-config/trpc-handlers/update-mapping-trpc-handler";
import { ChannelsFetcher } from "@/modules/saleor/channel-fetcher";
import { router } from "@/modules/trpc/trpc-server";
import { ZiinaWebhookManager } from "@/modules/ziina/ziina-webhook-manager";

const webhookManager = new ZiinaWebhookManager();

/**
 * TODO Figure out end-to-end router testing (must somehow check valid jwt token)
 */
export const appConfigRouter = router({
  saveNewZiinaConfig: new NewZiinaConfigTrpcHandler({
    webhookManager,
  }).getTrpcProcedure(),
  getZiinaConfigsList: new GetZiinaConfigsListTrpcHandler({
    webhookManager,
  }).getTrpcProcedure(),
  fetchChannels: new GetSaleorChannelsTrpcHandler({
    channelsFetcherFactory: (client) => new ChannelsFetcher(client),
  }).getTrpcProcedure(),
  channelsConfigsMapping: new GetZiinaConfigsChannelsMappingTrpcHandler().getTrpcProcedure(),
  updateMapping: new UpdateMappingTrpcHandler().getTrpcProcedure(),
  removeZiinaConfig: new RemoveZiinaConfigTrpcHandler({ webhookManager }).getTrpcProcedure(),
});
