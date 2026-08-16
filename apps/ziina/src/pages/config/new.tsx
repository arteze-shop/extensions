import { Layout } from "@saleor/apps-ui";
import { Box, Text } from "@saleor/macaw-ui";
import { type NextPage } from "next";

import { AppBreadcrumbs } from "@/modules/ui/app-breadcrumbs";
import { useHasAppAccess } from "@/modules/ui/use-has-app-access";
import { NewZiinaConfigForm } from "@/modules/ui/ziina-configs/new-ziina-config-form";

const NewConfiguration: NextPage = () => {
  const { haveAccessToApp } = useHasAppAccess();

  if (!haveAccessToApp) {
    return <Text>You do not have permission to access this page.</Text>;
  }

  return (
    <Box>
      <AppBreadcrumbs
        marginBottom={12}
        breadcrumbs={[
          {
            label: "Configuration",
            href: "/config",
          },
          {
            label: "New Ziina Configuration",
          },
        ]}
      />

      <Layout.AppSection
        marginBottom={14}
        heading="Ziina configuration"
        sideContent={
          <Box display="flex" flexDirection="column" gap={4}>
            <Text>
              Provide the access token generated in the Ziina dashboard and select the environment
              it belongs to (TEST or LIVE).
            </Text>
            <Text>
              The app creates the Ziina webhook automatically and stores the generated webhook
              secret.
            </Text>
          </Box>
        }
      >
        <NewZiinaConfigForm />
      </Layout.AppSection>
    </Box>
  );
};

export default NewConfiguration;
