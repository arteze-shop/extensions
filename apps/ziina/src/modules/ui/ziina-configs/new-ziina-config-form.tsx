import { zodResolver } from "@hookform/resolvers/zod";
import { useDashboardNotification } from "@saleor/apps-shared/use-dashboard-notification";
import { Layout } from "@saleor/apps-ui";
import { Box, Button, Text } from "@saleor/macaw-ui";
import { Input, Select } from "@saleor/react-hook-form-macaw";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";

import { newZiinaConfigInputSchema } from "@/modules/app-config/trpc-handlers/new-ziina-config-input-schema";
import { trpcClient } from "@/modules/trpc/trpc-client";

type FormShape = {
  name: string;
  accessToken: string;
  ziinaEnv: "TEST" | "LIVE";
};

const RequiredInputLabel = (props: { labelText: string }) => {
  return (
    <Box>
      <Text size={2} color="default2">
        {props.labelText}
      </Text>{" "}
      <Text size={2} color="critical2">
        *
      </Text>
    </Box>
  );
};

export const NewZiinaConfigForm = () => {
  const router = useRouter();
  const { notifyError, notifySuccess } = useDashboardNotification();

  const { mutate } = trpcClient.appConfig.saveNewZiinaConfig.useMutation({
    onSuccess() {
      notifySuccess("Configuration saved");

      return router.push("/config");
    },
    onError(err) {
      notifyError("Error saving config", err.message);
    },
  });

  const {
    handleSubmit,
    control,
    formState: { errors, isLoading },
  } = useForm<FormShape>({
    defaultValues: {
      name: "",
      accessToken: "",
      ziinaEnv: "TEST",
    },
    resolver: zodResolver(newZiinaConfigInputSchema),
  });

  const onSubmit = (values: FormShape) => {
    mutate({
      name: values.name,
      accessToken: values.accessToken,
      ziinaEnv: values.ziinaEnv,
    });
  };

  return (
    <Layout.AppSectionCard
      footer={
        <Box display="flex" justifyContent="space-between">
          <Button
            onClick={() => router.push("/")}
            variant="tertiary"
            data-testid="create-ziina-cancel-button"
          >
            Go back
          </Button>
          <Button form="new_ziina_config_form" type="submit">
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </Box>
      }
    >
      <Box id="new_ziina_config_form" as="form" onSubmit={handleSubmit(onSubmit)}>
        <Box display="flex" flexDirection="column" gap={6}>
          <Input
            label={<RequiredInputLabel labelText="Configuration name" />}
            name="name"
            control={control}
            helperText={
              errors.name?.message ??
              "Friendly name of your configuration. For example 'Live' or 'UK Live'."
            }
            error={!!errors.name}
          />
          <Input
            label={<RequiredInputLabel labelText="Access token" />}
            name="accessToken"
            control={control}
            type="password"
            helperText={
              errors.accessToken?.message ?? "Access token generated in the Ziina dashboard."
            }
            error={!!errors.accessToken}
          />
          <Select
            label={<RequiredInputLabel labelText="Ziina environment" />}
            name="ziinaEnv"
            control={control}
            options={[
              { value: "TEST", label: "TEST" },
              { value: "LIVE", label: "LIVE" },
            ]}
            helperText={
              errors.ziinaEnv?.message ?? "Environment the access token belongs to in Ziina."
            }
            error={!!errors.ziinaEnv}
          />
        </Box>
      </Box>
    </Layout.AppSectionCard>
  );
};
