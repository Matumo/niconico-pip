/**
 * 拡張機能 + fixture実行環境ヘルパー
 * fixtureサーバー起動、拡張機能ロード、ログ収集をまとめて提供する
 */
import { resolve } from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import {
  createBrowserLogCollector,
  type BrowserLogCollector,
} from "@test/shared/browser/browser-log-collector";
import { launchExtensionContext } from "@test/shared/browser/extension-context";
import { startStaticFixtureServer } from "@test/browser-headless/shared/static-fixture-server";

interface StartExtensionFixtureEnvironmentOptions {
  fixtureRootDirPath?: string;
  extensionDistDirPath?: string;
  defaultDocumentPath?: string;
  additionalMatchPatterns?: string[];
  headless?: boolean;
}

interface ExtensionFixtureSession {
  context: BrowserContext;
  page: Page;
  logCollector: BrowserLogCollector;
  goto(pathname?: string): Promise<void>;
  close(): Promise<void>;
}

interface ExtensionFixtureEnvironment {
  baseUrl: string;
  createSession(): Promise<ExtensionFixtureSession>;
  close(): Promise<void>;
}

// 既定のfixture配置先と拡張機能dist配置先
const defaultFixtureRootDirPath = resolve(__dirname, "../fixtures");
const defaultExtensionDistDirPath = resolve(__dirname, "../../../../../dist-test/chrome-extension");

// fixtureサーバーURLから、拡張機能match用のローカルパターンを作る
const createLocalMatchPattern = (baseUrl: string): string => {
  const fixtureUrl = new URL(baseUrl);
  return `${fixtureUrl.protocol}//${fixtureUrl.hostname}/*`;
};

// fixtureサーバーと拡張機能実行コンテキストをまとめて初期化する関数
const startExtensionFixtureEnvironment = async (
  options: StartExtensionFixtureEnvironmentOptions = {},
): Promise<ExtensionFixtureEnvironment> => {
  // まずfixtureサーバーを起動する
  const fixtureServer = await startStaticFixtureServer({
    rootDirPath: options.fixtureRootDirPath ?? defaultFixtureRootDirPath,
    defaultDocumentPath: options.defaultDocumentPath,
  });

  // ローカルfixtureアクセス用のmatchは常に追加し、追加指定があれば後ろに連結する
  const additionalMatchPatterns = [
    createLocalMatchPattern(fixtureServer.baseUrl),
    ...(options.additionalMatchPatterns ?? []),
  ];

  // 1テスト分の拡張機能セッション（page+log+close）を生成する関数
  const createSession = async (): Promise<ExtensionFixtureSession> => {
    // 拡張機能をロードしたブラウザコンテキストを起動する
    const extension = await launchExtensionContext({
      extensionDistDirPath: options.extensionDistDirPath ?? defaultExtensionDistDirPath,
      additionalMatchPatterns,
      headless: options.headless,
    });
    // テスト本体で使うpageとログ収集を初期化する
    const page = await extension.context.newPage();
    const logCollector = createBrowserLogCollector();
    const detachLogCollector = logCollector.attach(page);

    return {
      context: extension.context,
      page,
      logCollector,
      // fixtureサーバー基準のURLへ遷移する関数
      goto: async (pathname = "/"): Promise<void> => {
        // fixtureサーバー基準で遷移先URLを構成する
        const targetUrl = new URL(pathname, fixtureServer.baseUrl);
        await page.goto(targetUrl.toString());
      },
      // セッション単位の後処理（ログ解除と拡張終了）を行う関数
      close: async (): Promise<void> => {
        // ログ購読を解除してから拡張コンテキストを閉じる
        detachLogCollector();
        await extension.close();
      },
    };
  };

  return {
    baseUrl: fixtureServer.baseUrl,
    createSession,
    close: fixtureServer.close,
  };
};

// エクスポート
export { startExtensionFixtureEnvironment };
export type {
  StartExtensionFixtureEnvironmentOptions,
  ExtensionFixtureSession,
  ExtensionFixtureEnvironment,
};
