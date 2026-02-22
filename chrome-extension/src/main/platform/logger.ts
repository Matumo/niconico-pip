/**
 * ロガー初期化
 */
import { getLogger, setDefaultConfig, setLoggerConfig } from "@matumo/ts-simple-logger";
import type { Logger } from "@matumo/ts-simple-logger";

// initializeLoggersの入力型
interface InitializeLoggersOptions {
  appName: string;
  useDebugLog: boolean;
  now?: () => number;
}

// アプリで使うロガー名定義
const appLoggerNames = {
  logger: "logger",
  main: "main",
  bootstrap: "bootstrap",
  domain: "domain",
  elementResolver: "element-resolver",
  http: "http",
  safeRunner: "safe-runner",
} as const;

const log = getLogger(appLoggerNames.logger);

// アプリで使うロガー集合型
type AppLoggerMap = {
  [TLoggerName in keyof typeof appLoggerNames]: Logger;
};

// process.onのみを使うための最小Node互換型
type NodeLikeProcess = {
  on(
    event: "uncaughtException" | "unhandledRejection",
    listener: (reason: unknown) => void,
  ): void;
};

// ロガー初期化の二重実行を防ぐフラグ
let initialized = false;

// Node互換processを取得する関数
const getNodeProcess = (): NodeLikeProcess | null => {
  const candidate = (globalThis as { process?: unknown }).process;
  if (!candidate || typeof candidate !== "object") return null;
  if (typeof (candidate as { on?: unknown }).on !== "function") return null;
  return candidate as NodeLikeProcess;
};

// ブラウザの未捕捉エラー監視を登録する関数
const registerBrowserUnhandledErrorHandlers = (): void => {
  if (typeof globalThis.addEventListener !== "function") return;

  globalThis.addEventListener("error", (event: ErrorEvent): void => {
    const detail = event.error ?? event.message;
    log.error("Unhandled error:", detail);
  });

  globalThis.addEventListener("unhandledrejection", (event: PromiseRejectionEvent): void => {
    log.error("Unhandled rejection:", event.reason);
  });
};

// Nodeの未捕捉エラー監視を登録する関数
const registerNodeUnhandledErrorHandlers = (): void => {
  const nodeProcess = getNodeProcess();
  if (!nodeProcess) return;

  nodeProcess.on("uncaughtException", (error: unknown): void => {
    log.error("Uncaught exception:", error);
  });
  nodeProcess.on("unhandledRejection", (reason: unknown): void => {
    log.error("Unhandled rejection:", reason);
  });
};

// ロガー集合を作成する関数
const createAppLoggers = (): AppLoggerMap => ({
  logger: getLogger(appLoggerNames.logger),
  main: getLogger(appLoggerNames.main),
  bootstrap: getLogger(appLoggerNames.bootstrap),
  domain: getLogger(appLoggerNames.domain),
  elementResolver: getLogger(appLoggerNames.elementResolver),
  http: getLogger(appLoggerNames.http),
  safeRunner: getLogger(appLoggerNames.safeRunner),
});

// ロガー設定を初期化してロガー集合を返す関数
const initializeLoggers = (options: InitializeLoggersOptions): AppLoggerMap => {
  if (initialized) return createAppLoggers();

  const now = options.now ?? (() => performance.now());

  setDefaultConfig({
    placeholders: {
      "%appName": options.appName,
      "%time": () => now().toFixed(1),
    },
    prefixFormat: "[%appName] %loggerName (%time ms) %logLevel:",
  });

  const level = options.useDebugLog ? "debug" : "info";
  for (const loggerName of Object.values(appLoggerNames)) {
    setLoggerConfig(loggerName, { level });
  }

  const loggers = createAppLoggers();
  registerBrowserUnhandledErrorHandlers();
  registerNodeUnhandledErrorHandlers();
  initialized = true;
  return loggers;
};

// エクスポート
export { appLoggerNames, initializeLoggers };
export type { InitializeLoggersOptions };
