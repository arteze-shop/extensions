import baseConfig from "../../lint-staged.config.js";

/**
 * @type {import('lint-staged').Configuration}
 */
export default {
  ...baseConfig,
  "*.{jsx,tsx,ts,js}": ["eslint --cache --fix", "prettier --write"],
  "graphql/!(schema.graphql)/**/*.graphql": ["eslint --cache --fix", "prettier --write"],
};
