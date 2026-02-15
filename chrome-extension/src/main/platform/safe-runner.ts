/**
 * fail-soft実行ラッパー
 */
import type { Logger } from "@matumo/ts-simple-logger";

// 安全実行の戻り値型
type SafeResult<TValue> =
  | { ok: true; value: TValue }
  | { ok: false; error: unknown };

// 同期、非同期タスクの安全実行インターフェース
interface SafeRunner {
  run<TValue>(label: string, task: () => TValue): SafeResult<TValue>;
  runAsync<TValue>(label: string, task: () => Promise<TValue>): Promise<SafeResult<TValue>>;
}

// 例外を捕捉して結果型で返す実行器を作成する関数
const createSafeRunner = (logger: Logger): SafeRunner => {
  // 同期タスクを安全実行する関数
  const run = <TValue>(label: string, task: () => TValue): SafeResult<TValue> => {
    try {
      return {
        ok: true,
        value: task(),
      };
    } catch (error) {
      logger.error(`${label} failed`, error);
      return {
        ok: false,
        error,
      };
    }
  };

  // 非同期タスクを安全実行する関数
  const runAsync = async <TValue>(
    label: string,
    task: () => Promise<TValue>,
  ): Promise<SafeResult<TValue>> => {
    try {
      const value = await task();
      return {
        ok: true,
        value,
      };
    } catch (error) {
      logger.error(`${label} failed`, error);
      return {
        ok: false,
        error,
      };
    }
  };

  return {
    run,
    runAsync,
  };
};

// エクスポート
export { createSafeRunner };
export type { SafeResult, SafeRunner };
