import { useDashboardNotification } from "@saleor/apps-shared/use-dashboard-notification";
import { ConfigsList } from "@saleor/apps-ui";
import { Chip, Text } from "@saleor/macaw-ui";
import { useRouter } from "next/router";

import {
  ZiinaFrontendConfig,
  type ZiinaFrontendConfigSerializedFields,
} from "@/modules/app-config/domain/ziina-config";
import { trpcClient } from "@/modules/trpc/trpc-client";

type Props = {
  configs: Array<ZiinaFrontendConfigSerializedFields>;
};

const webhookDisabled = <Text color="warning1">Webhook disabled, app will not work properly</Text>;
const webhookMissing = <Text color="critical1">Webhook missing, create config again</Text>;

const testEnvChip = (
  <Chip marginLeft="auto" __backgroundColor="#CC4B00" borderColor="transparent" size="large">
    <Text __color={"#FFF"} size={1} whiteSpace="nowrap">
      Ziina TEST environment
    </Text>
  </Chip>
);
const liveEnvChip = (
  <Chip marginLeft={"auto"} size="large" whiteSpace="nowrap">
    <Text size={1}>Ziina LIVE environment</Text>
  </Chip>
);

export const ZiinaConfigsList = ({ configs }: Props) => {
  const router = useRouter();
  const { notifyError, notifySuccess } = useDashboardNotification();
  const configsList = trpcClient.appConfig.getZiinaConfigsList.useQuery();
  const mappings = trpcClient.appConfig.channelsConfigsMapping.useQuery();
  const { mutate: removeZiinaConfig, isLoading } =
    trpcClient.appConfig.removeZiinaConfig.useMutation({
      onSuccess() {
        notifySuccess("Configuration deleted");
      },
      onError(err) {
        notifyError("Error deleting config", err.message);
      },
      onSettled() {
        mappings.refetch();
        configsList.refetch();
      },
    });

  return (
    <ConfigsList
      onConfigDelete={(id) => {
        removeZiinaConfig({
          configId: id,
        });
      }}
      configs={configs.map((config) => {
        const configInstance = ZiinaFrontendConfig.createFromSerializedFields(config);
        const envValue = configInstance.getZiinaEnvValue();

        const webhookStatusInfo =
          configInstance.webhookStatus === "disabled"
            ? webhookDisabled
            : configInstance.webhookStatus === "missing"
            ? webhookMissing
            : null;

        return {
          id: configInstance.id,
          name: configInstance.name,
          deleteButtonSlotLeft() {
            return envValue === "TEST" ? testEnvChip : liveEnvChip;
          },
          deleteButtonSlotRight() {
            return webhookStatusInfo;
          },
        };
      })}
      onNewConfigAdd={() => {
        router.push("/config/new");
      }}
      isLoading={isLoading}
    />
  );
};
