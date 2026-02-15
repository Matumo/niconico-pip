import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir,
      },
    },
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: {
      js,
      import: importPlugin,
    },
    extends: ["js/recommended"],
    languageOptions: { globals: { ...globals.browser, chrome: "readonly" } },
    rules: {
      // exportを末尾へ集約する
      "import/exports-last": "error",
    },
  },
  {
    files: ["chrome-extension/src/**/*.{ts,mts,cts}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      // 型exportは `export type` へ統一する
      "@typescript-eslint/consistent-type-exports": [
        "error",
        {
          fixMixedExportsWithInlineTypeSpecifier: true,
        },
      ],
      // 宣言時の型exportを禁止し、末尾 `export type { ... }` へ統一する
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportNamedDeclaration > TSInterfaceDeclaration",
          message:
            "Do not use `export interface`. Declare locally and export at bottom via `export type { ... }`.",
        },
        {
          selector: "ExportNamedDeclaration > TSTypeAliasDeclaration",
          message:
            "Do not use `export type X = ...`. Declare locally and export at bottom via `export type { ... }`.",
        },
      ],
    },
  },
  tseslint.configs.recommended,
  {
    files: ["**/src/main/**/*.{js,mjs,cjs,ts,mts,cts}"],
    rules: {
      // 実装コードではconsole APIを使わずロガー経由に統一
      "no-console": "error",
    },
  },
  {
    rules: {
      // 未使用変数チェック
      "@typescript-eslint/no-unused-vars": [
        "warn", // エラーではなく警告にする
        {
          // アンダーバーだけの変数はチェックを除外
          varsIgnorePattern: "^_+$",
          argsIgnorePattern: "^_+$",
          caughtErrorsIgnorePattern: "^_+$",
          destructuredArrayIgnorePattern: "^_+$"
        }
      ]
    }
  }
]);
