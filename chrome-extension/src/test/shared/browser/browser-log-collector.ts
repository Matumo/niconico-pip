/**
 * ブラウザログ収集ヘルパー
 * Playwrightのpageからconsole/pageerrorを収集してテスト内で参照可能な配列へ蓄積する
 */
import type { ConsoleMessage, Page } from "@playwright/test";

type BrowserLogSource = "console" | "pageerror";

interface BrowserLogEntry {
  source: BrowserLogSource;
  level: string;
  text: string;
  location: string | null;
}

interface BrowserLogCollectorOptions {
  shouldEchoToConsole?: boolean;
}

interface BrowserLogCollector {
  entries: BrowserLogEntry[];
  attach(page: Page): () => void;
}

// 環境変数でログの標準出力を切り替える関数
const shouldEchoBrowserLogs = (): boolean => {
  const raw = process.env.BROWSER_TEST_ECHO_LOGS;
  if (!raw) return false;
  return raw === "1" || raw.toLowerCase() === "true";
};

// ログ出力時の共通整形フォーマット
const formatLogEntry = (entry: BrowserLogEntry): string => {
  const location = entry.location ? ` (${entry.location})` : "";
  return `[browser:${entry.source}:${entry.level}] ${entry.text}${location}`;
};

// browserログ収集器を生成し、pageへの購読開始関数を返す関数
const createBrowserLogCollector = (
  options: BrowserLogCollectorOptions = {},
): BrowserLogCollector => {
  // テストが参照するログの蓄積先
  const entries: BrowserLogEntry[] = [];
  // 収集したブラウザログをテスト実行中の標準出力へそのまま表示するかどうか
  // オプション未指定時は環境変数 `BROWSER_TEST_ECHO_LOGS` の設定結果を使う
  const echoLogs = options.shouldEchoToConsole ?? shouldEchoBrowserLogs();

  // 対象pageへconsole/pageerrorの購読を登録し、解除関数を返す関数
  const attach = (page: Page): (() => void) => {
    // consoleイベントを収集するハンドラー
    const onConsole = (message: ConsoleMessage): void => {
      const { url, lineNumber, columnNumber } = message.location();
      const location = url ? `${url}:${lineNumber}:${columnNumber}` : null;
      const entry: BrowserLogEntry = {
        source: "console",
        level: message.type(),
        text: message.text(),
        location,
      };
      entries.push(entry);
      if (echoLogs) {
        console.log(formatLogEntry(entry));
      }
    };

    // ページ上の未捕捉エラーを収集するハンドラー
    const onPageError = (error: Error): void => {
      const entry: BrowserLogEntry = {
        source: "pageerror",
        level: "error",
        text: error.stack ?? error.message,
        location: null,
      };
      entries.push(entry);
      if (echoLogs) {
        console.log(formatLogEntry(entry));
      }
    };

    // 収集開始
    page.on("console", onConsole);
    page.on("pageerror", onPageError);

    // 収集終了（テスト後処理）として購読解除関数を返す
    return () => {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
    };
  };

  return {
    entries,
    attach,
  };
};

// エクスポート
export { createBrowserLogCollector };
export type { BrowserLogCollector, BrowserLogCollectorOptions, BrowserLogEntry, BrowserLogSource };
