/**
 * テスト用ロガーヘルパー
 */
import { vi } from "vitest";

// ロガーテストダブル型
interface LoggerDouble {
  name: string;
  trace: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

// ts-simple-loggerモックハーネスインターフェース型
interface TsSimpleLoggerMockHarness {
  createModuleFactory: () => {
    getLogger: (name: string) => LoggerDouble;
    setDefaultConfig: ReturnType<typeof vi.fn>;
    setLoggerConfig: ReturnType<typeof vi.fn>;
  };
  clearLoggerCalls: () => void;
  resolveMockLogger: (name: string) => LoggerDouble;
}

// 単体テスト向けロガーを作成する関数
const createMockLogger = (name = "test"): LoggerDouble => ({
  name,
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

// ts-simple-loggerの共通モックハーネスを作成する関数
const createTsSimpleLoggerMockHarness = (): TsSimpleLoggerMockHarness => {
  const loggerDoubleMap = new Map<string, LoggerDouble>();
  const setDefaultConfig = vi.fn();
  const setLoggerConfig = vi.fn();

  // ロガー名からテストダブルを解決する関数
  const resolveOrCreateMockLogger = (name: string): LoggerDouble => {
    const existingLogger = loggerDoubleMap.get(name);
    if (existingLogger) return existingLogger;

    const nextLogger = createMockLogger(name);
    loggerDoubleMap.set(name, nextLogger);
    return nextLogger;
  };

  // モック済みロガーの呼び出し履歴をクリアする関数
  const clearLoggerCalls = (): void => {
    for (const logger of loggerDoubleMap.values()) {
      logger.trace.mockClear();
      logger.debug.mockClear();
      logger.info.mockClear();
      logger.warn.mockClear();
      logger.error.mockClear();
    }
    setDefaultConfig.mockClear();
    setLoggerConfig.mockClear();
  };

  // ロガー名で作成済みテストダブルを取得する関数
  const resolveMockLogger = (name: string): LoggerDouble => {
    const logger = loggerDoubleMap.get(name);
    if (!logger) throw new Error(`logger not found: ${name}`);
    return logger;
  };

  // vi.mockへ渡すfactoryを作成する関数
  const createModuleFactory = () => ({
    getLogger: resolveOrCreateMockLogger,
    setDefaultConfig,
    setLoggerConfig,
  });

  return {
    createModuleFactory,
    clearLoggerCalls,
    resolveMockLogger,
  };
};

// エクスポート
export { createMockLogger, createTsSimpleLoggerMockHarness };
export type { LoggerDouble, TsSimpleLoggerMockHarness };
