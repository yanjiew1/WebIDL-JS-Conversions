import domenicConfig from "@domenic/eslint-config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["lib/"]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node
    }
  },
  ...domenicConfig,
  {
    files: ["**/*.ts"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
      parser: tseslint.parser,
      parserOptions: {
        project: true
      }
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "error"
    }
  },
  {
    files: ["**/*.js", "**/*.ts"],
    rules: {
      "new-cap": "off"
    }
  },
  {
    files: ["test/**.js"],
    rules: {
      "func-style": "off"
    }
  }
];
