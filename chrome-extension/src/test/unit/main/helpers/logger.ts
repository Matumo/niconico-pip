/**
 * テスト用ロガーヘルパー
 */
import type { AppLoggers } from "@main/types/app-context";
import type { Logger } from "@matumo/ts-simple-logger";
import { vi } from "vitest";

// 単体テスト向けロガーを作成する関数
const createMockLogger = (name = "test"): Logger => ({
  name,
  trace: vi.fn() as Logger["trace"],
  debug: vi.fn() as Logger["debug"],
  info: vi.fn() as Logger["info"],
  warn: vi.fn() as Logger["warn"],
  error: vi.fn() as Logger["error"],
});

// AppContext向けロガー集合を作成する関数
const createMockAppLoggers = (overrides: Partial<AppLoggers> = {}): AppLoggers => ({
  main: createMockLogger("test-main"),
  bootstrap: createMockLogger("test-bootstrap"),
  domain: createMockLogger("test-domain"),
  elementResolver: createMockLogger("test-element-resolver"),
  http: createMockLogger("test-http"),
  safeRunner: createMockLogger("test-safe-runner"),
  ...overrides,
});

export { createMockLogger, createMockAppLoggers };
