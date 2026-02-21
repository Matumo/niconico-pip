/**
 * ロガーテスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getLogger, setDefaultConfig, setLoggerConfig } from "@matumo/ts-simple-logger";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";

vi.mock("@matumo/ts-simple-logger", () => ({
  getLogger: vi.fn((name: string) => ({
    name,
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  setDefaultConfig: vi.fn(),
  setLoggerConfig: vi.fn(),
}));

const getLoggerMock = vi.mocked(getLogger);
const setDefaultConfigMock = vi.mocked(setDefaultConfig);
const setLoggerConfigMock = vi.mocked(setLoggerConfig);

describe("ロガー", () => {
  const globalPropertyKeys = ["addEventListener", "process"] as const;
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(() => {
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
    vi.resetModules();
    getLoggerMock.mockClear();
    setDefaultConfigMock.mockClear();
    setLoggerConfigMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreGlobalDescriptors(globalDescriptors);
  });

  test("初期化時に設定とロガー集合を作成し、例外ハンドラは一度だけ登録すること", async () => {
    const addEventListener = vi.fn();
    const processOn = vi.fn();
    setGlobalProperty("addEventListener", addEventListener);
    setGlobalProperty("process", { on: processOn });

    const loggerModule = await import("@main/platform/logger");
    const loggers = loggerModule.initializeLoggers({
      appName: "niconico-pip",
      useDebugLog: true,
      now: () => 1,
    });

    const config = setDefaultConfigMock.mock.calls[0][0] as {
      placeholders: Record<string, () => string>;
      prefixFormat: string;
    };

    expect(config.prefixFormat).toContain("%loggerName");
    expect(config.placeholders["%time"]()).toBe("1.0");
    for (const loggerName of ["main", "bootstrap", "domain", "element-resolver", "http", "safe-runner"]) {
      expect(setLoggerConfigMock).toHaveBeenCalledWith(loggerName, { level: "debug" });
      expect(getLoggerMock).toHaveBeenCalledWith(loggerName);
    }
    expect(addEventListener).toHaveBeenCalledTimes(2);
    expect(processOn).toHaveBeenCalledTimes(2);
    expect(loggers.main.name).toBe("main");
    expect(loggers.bootstrap.name).toBe("bootstrap");
    expect(loggers.safeRunner.name).toBe("safe-runner");

    const browserErrorHandler = addEventListener.mock.calls[0][1] as (event: ErrorEvent) => void;
    const browserRejectionHandler = addEventListener.mock.calls[1][1] as (
      event: PromiseRejectionEvent,
    ) => void;
    browserErrorHandler({
      error: new Error("browser-error"),
      message: "browser-message",
    } as ErrorEvent);
    browserErrorHandler({
      error: undefined,
      message: "browser-message-fallback",
    } as ErrorEvent);
    browserRejectionHandler({
      reason: new Error("browser-rejection"),
    } as PromiseRejectionEvent);

    const nodeErrorHandler = processOn.mock.calls[0][1] as (reason: unknown) => void;
    const nodeRejectionHandler = processOn.mock.calls[1][1] as (reason: unknown) => void;
    nodeErrorHandler(new Error("node-error"));
    nodeRejectionHandler(new Error("node-rejection"));
    expect(loggers.main.error).toHaveBeenCalledTimes(5);

    loggerModule.initializeLoggers({
      appName: "niconico-pip",
      useDebugLog: false,
      now: () => 2,
    });
    expect(setDefaultConfigMock).toHaveBeenCalledTimes(1);
    expect(setLoggerConfigMock).toHaveBeenCalledTimes(6);
    expect(addEventListener).toHaveBeenCalledTimes(2);
    expect(processOn).toHaveBeenCalledTimes(2);
  });

  test("ブラウザもNodeも無い環境でも初期化できること", async () => {
    setGlobalProperty("addEventListener", undefined);
    setGlobalProperty("process", undefined);
    vi.spyOn(performance, "now").mockReturnValue(12.34);

    const loggerModule = await import("@main/platform/logger");
    const loggers = loggerModule.initializeLoggers({
      appName: "niconico-pip",
      useDebugLog: false,
    });
    const defaultConfig = setDefaultConfigMock.mock.calls[0][0] as {
      placeholders: Record<string, () => string>;
    };

    expect(loggers.main.name).toBe("main");
    expect(setLoggerConfigMock).toHaveBeenCalledWith("main", { level: "info" });
    expect(defaultConfig.placeholders["%time"]()).toBe("12.3");
  });

  test("process.onを持たないオブジェクトはNode processとして扱わないこと", async () => {
    setGlobalProperty("addEventListener", vi.fn());
    setGlobalProperty("process", {});

    const loggerModule = await import("@main/platform/logger");
    expect(() =>
      loggerModule.initializeLoggers({
        appName: "niconico-pip",
        useDebugLog: false,
      }),
    ).not.toThrow();
  });
});
