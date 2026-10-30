export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        process: "readonly", console: "readonly", URL: "readonly", Buffer: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly",
        window: "readonly", document: "readonly", localStorage: "readonly", fetch: "readonly", navigator: "readonly", location: "readonly",
      },
    },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }], "no-undef": "error", "prefer-const": "error" },
  },
];
