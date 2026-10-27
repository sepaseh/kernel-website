import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/coverage/**",
      "**/dist/**",
      "**/reports/**",
      "server/data/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { ...reactHooks.configs.flat.recommended, files: ["src/**/*.{ts,tsx}"] },
  {
    files: ["**/*.{ts,tsx,mjs}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "separate-type-imports", prefer: "type-imports" },
      ],
      "no-dupe-keys": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: ["FC", "FunctionComponent"],
              message: "Type component parameters directly.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "TSTypeReference > TSQualifiedName[right.name=/^(FC|FunctionComponent)$/]",
          message: "Type component parameters directly.",
        },
      ],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
];
