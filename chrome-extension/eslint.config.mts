import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));
const srcTypeScriptFiles = ["chrome-extension/src/**/*.{ts,mts,cts}"];

export default defineConfig([
  // 全体のparserOptionsのルートディレクトリを設定
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir,
      },
    },
  },
  // JavaScriptファイルに適用される推奨ルール
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
  // 型情報を必要とするルールのための設定
  {
    files: srcTypeScriptFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    }
  },
  // TypeScriptファイルに適用される推奨ルール
  tseslint.configs.recommended,
  {
    files: srcTypeScriptFiles,
    extends: [tseslint.configs.recommendedTypeChecked],
    rules: {
      // awaitを使わないasync関数を許可する
      "@typescript-eslint/require-await": "off",
    },
  },
  // export関連のルール
  {
    files: srcTypeScriptFiles,
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
          message: "Do not use `export interface`. Declare locally and export at bottom via `export type { ... }`.",
        },
        {
          selector: "ExportNamedDeclaration > TSTypeAliasDeclaration",
          message: "Do not use `export type X = ...`. Declare locally and export at bottom via `export type { ... }`.",
        },
      ],
    },
  },
  // ロガーの利用を強制するルール
  {
    files: ["**/src/main/**/*.{js,mjs,cjs,ts,mts,cts}"],
    rules: {
      "no-console": "error",
    },
  },
  // 未使用変数チェック
  {
    files: srcTypeScriptFiles,
    rules: {
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
  },
  // 廃止予定のAPIの使用を禁止
  // {
  //   files: srcTypeScriptFiles,
  //   rules: {
  //     "@typescript-eslint/no-deprecated": "error"
  //   }
  // }
]);
