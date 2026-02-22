/**
 * テスト共通ロガー
 */
import { getLogger } from "@matumo/ts-simple-logger";

type TestLogDetails = Record<string, boolean>;

const log = getLogger("test");

// ランタイムテスト失敗時の情報を出力する関数
const logRuntimeTestFailure = (path: string, details: TestLogDetails): void => {
  log.error(`runtime test failed path=${path}`);
  for (const [name, result] of Object.entries(details)) {
    log.error(`detail ${name}: ${result ? "OK" : "NG"}`);
  }
};

// エクスポート
export { logRuntimeTestFailure };
export type { TestLogDetails };
