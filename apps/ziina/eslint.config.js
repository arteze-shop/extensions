import { config } from "@saleor/eslint-config-apps/index.js";
import nodePlugin from "eslint-plugin-n";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    name: "saleor-app-payment-ziina/ignore-symlinked-graphql-schema",
    ignores: ["graphql/schema.graphql"],
  },
  {
    name: "saleor-app-payment-ziina/custom-config",
    files: ["**/*.ts"],
    plugins: {
      n: nodePlugin,
    },
    rules: {
      "n/no-process-env": "error",
    },
  },
  {
    name: "saleor-app-payment-ziina/override-no-process-env",
    files: [
      "next.config.ts",
      "playwright.config.ts",
      "src/lib/env.ts",
      "src/lib/env-dynamodb.ts",
      "e2e/env.ts",
      "src/__tests__/integration/env.ts",
      "src/instrumentation.ts",
      "src/__tests__/**/*setup.*.ts",
    ],
    rules: {
      "n/no-process-env": "off",
    },
  },
  {
    name: "saleor-app-payment-ziina/override-turbo-env-requirement",
    files: ["src/__tests__/**", "*.test.ts", "e2e/**"],
    rules: {
      "turbo/no-undeclared-env-vars": "off",
    },
  },
  {
    name: "saleor-app-payment-ziina/allow-console-in-tests",
    files: ["src/__tests__/**", "*.test.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    name: "saleor-app-payment-ziina/router-default-exports",
    files: ["src/app/**/*", "src/pages/**/*"],
    rules: {
      "import/no-default-export": "off",
    },
  },
];
