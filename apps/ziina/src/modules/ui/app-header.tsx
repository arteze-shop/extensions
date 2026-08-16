import { Box, type BoxProps, Text } from "@saleor/macaw-ui";

export const AppHeader = ({ ...props }: BoxProps) => {
  return (
    <Box marginBottom={20} paddingBottom={6} {...props}>
      <Text as="h1" marginBottom={4} size={10} fontWeight="bold">
        Configuration
      </Text>
      <Text>Configure the app by connecting to Ziina.</Text>
      <Box>{props.children}</Box>
    </Box>
  );
};
