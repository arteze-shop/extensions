import { Layout } from "@saleor/apps-ui";
import { Box, Text } from "@saleor/macaw-ui";
import { type NextPage } from "next";

import { AppHeader } from "@/modules/ui/app-header";
import { ChannelConfigMappingSection } from "@/modules/ui/channel-configs/channel-config-mapping-section";
import { useHasAppAccess } from "@/modules/ui/use-has-app-access";
import { ChannelConfigSection } from "@/modules/ui/ziina-configs/channel-config-section";

const ConfigPage: NextPage = () => {
  const { haveAccessToApp } = useHasAppAccess();

  if (!haveAccessToApp) {
    return <Text>You do not have permission to access this page.</Text>;
  }

  return (
    <Box>
      <AppHeader />
      <Layout.AppSection
        marginBottom={14}
        heading="Ziina configurations"
        sideContent={
          <Box display="flex" flexDirection="column" gap={4}>
            <Text>
              App allows to create and use multiple Ziina configurations e.g one for test mode and
              the other for live mode.
            </Text>
            <Text>
              You can set up multiple Ziina configurations and assign them to each channel
              individually.
            </Text>
          </Box>
        }
      >
        <ChannelConfigSection />
      </Layout.AppSection>
      <Layout.AppSection
        heading="Channels configurations"
        sideContent={
          <Box display="flex" flexDirection="column" gap={4}>
            <Text>Assign created Ziina configurations to Saleor channel.</Text>
            <Text>You can configure multiple channels to use the same Ziina configuration.</Text>
          </Box>
        }
      >
        <ChannelConfigMappingSection />
      </Layout.AppSection>
    </Box>
  );
};

export default ConfigPage;
