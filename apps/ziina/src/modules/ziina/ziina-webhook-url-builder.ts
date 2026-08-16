import { type SaleorApiUrl } from "@/modules/saleor/saleor-api-url";

export const createZiinaWebhookUrl = (args: {
  appUrl: string;
  saleorApiUrl: SaleorApiUrl;
  configurationId: string;
  appId: string;
}): string => {
  const webhookUrl = new URL(args.appUrl + "/api/webhooks/ziina");

  webhookUrl.searchParams.set("saleorApiUrl", args.saleorApiUrl);
  webhookUrl.searchParams.set("configurationId", args.configurationId);
  webhookUrl.searchParams.set("appId", args.appId);

  return webhookUrl.toString();
};
