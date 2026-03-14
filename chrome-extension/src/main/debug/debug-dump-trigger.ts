/**
 * debug dump起動トリガー
 */
import { appLoggerNames } from "@main/platform/logger";
import { getLogger } from "@matumo/ts-simple-logger";
import type { DebugDumpObject } from "./debug-dump-types";

// debug dumpトリガー登録の入力型
interface InstallDebugDumpTriggerOptions {
  prefixId: string;
  collectSources: () => DebugDumpObject;
}

type GlobalWithEventApi = typeof globalThis & {
  addEventListener?: typeof globalThis.addEventListener;
  removeEventListener?: typeof globalThis.removeEventListener;
};

const log = getLogger(appLoggerNames.debug);

// debug dump要求イベント名を作る関数
const createDebugDumpRequestEventName = (prefixId: string): string => `${prefixId}-debug-dump-request`;

// debug dumpの出力本体を作る関数
const createDebugDumpOutput = (params: {
  requestEventName: string;
  sources: DebugDumpObject;
}): DebugDumpObject => ({
  requestedAt: new Date().toISOString(),
  requestedAtPerformanceNow: globalThis.performance?.now() ?? null,
  requestEventName: params.requestEventName,
  sourceCount: Object.keys(params.sources).length,
  sources: params.sources,
});

// debug dumpトリガーを登録する関数
const installDebugDumpTrigger = (options: InstallDebugDumpTriggerOptions): (() => void) => {
  const browserGlobal = globalThis as GlobalWithEventApi;
  if (typeof browserGlobal.addEventListener !== "function" ||
      typeof browserGlobal.removeEventListener !== "function") {
    log.warn("debug dump trigger skipped: event api is unavailable");
    return () => undefined;
  }
  const requestEventName = createDebugDumpRequestEventName(options.prefixId);

  const listener = (): void => {
    const sources = options.collectSources();
    const output = createDebugDumpOutput({
      requestEventName,
      sources,
    });
    log.info(`debug dump requested (sources=${Object.keys(sources).length})`, output);
  };

  browserGlobal.addEventListener(requestEventName, listener);
  log.info(`debug dump trigger enabled: ${requestEventName}`);

  return (): void => {
    browserGlobal.removeEventListener?.(requestEventName, listener);
    log.info(`debug dump trigger disabled: ${requestEventName}`);
  };
};

// エクスポート
export { createDebugDumpRequestEventName, installDebugDumpTrigger };
export type { InstallDebugDumpTriggerOptions };
