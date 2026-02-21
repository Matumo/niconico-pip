/**
 * ブラウザログのアサーションヘルパー
 * BrowserLogCollectorに蓄積されたログの中身を確認する処理を提供する
 */
import { expect } from "@playwright/test";
import type { BrowserLogCollector } from "@test/shared/browser/browser-log-collector";

// consoleログの本文に指定文字列が含まれるか判定する関数
const hasConsoleLogContaining = (collector: BrowserLogCollector, text: string): boolean =>
  collector.entries.some((entry) => entry.source === "console" && entry.text.includes(text));

// ログ出力が非同期に到着する前提で、pollしながら一致を待つ関数
const expectBrowserConsoleLogContaining = async (
  collector: BrowserLogCollector,
  text: string,
): Promise<void> => {
  await expect.poll(() => hasConsoleLogContaining(collector, text)).toBe(true);
};

// pageerrorのみを抽出し、1件も発生していないことを確認する関数
const expectNoBrowserPageErrors = (collector: BrowserLogCollector): void => {
  const pageErrors = collector.entries.filter((entry) => entry.source === "pageerror");
  expect(pageErrors).toEqual([]);
};

// エクスポート
export { expectBrowserConsoleLogContaining, expectNoBrowserPageErrors };
