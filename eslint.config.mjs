import js from "@eslint/js";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";

export default [
  { ignores: ["**/node_modules/**", "**/coverage/**", "**/dist/**"] },
  js.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: globals.node },
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "no-dupe-keys": "error",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
];
