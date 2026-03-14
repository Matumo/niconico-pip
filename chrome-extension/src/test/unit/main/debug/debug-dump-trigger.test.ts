/**
 * debug dump triggerテスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createAppConfig } from "@main/config/config";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
} from "@test/unit/main/shared/global-property";
import { createTsSimpleLoggerMockHarness, type TsSimpleLoggerMockHarness } from "@test/unit/main/shared/logger";
import type {
  AppContext,
  AppEventRegistry,
  AppObserverRegistry,
} from "@main/types/app-context";

let loggerMockHarness: TsSimpleLoggerMockHarness;

const fixedRequestedAt = "2000-01-01T00:00:00.000Z";
const fixedRequestedAtPerformanceNow = 1000;

const createContext = (params: {
  debugMode: boolean;
}): AppContext => {
  const eventRegistry: AppEventRegistry = {
    on: vi.fn(() => () => undefined),
    emit: vi.fn(),
    off: vi.fn(() => false),
    clear: vi.fn(),
    size: vi.fn(() => 0),
  };
  const observerRegistry: AppObserverRegistry = {
    observe: vi.fn(() => ({ disconnect: vi.fn() }) as unknown as MutationObserver),
    disconnect: vi.fn(() => false),
    disconnectAll: vi.fn(),
    size: vi.fn(() => 0),
  };

  return {
    config: createAppConfig({
      debugMode: params.debugMode,
      shouldUseDebugLog: params.debugMode,
    }),
    eventRegistry,
    observerRegistry,
    state: {
      page: { get: () => ({ url: "", isWatchPage: false, generation: 0 }) },
      elements: { get: () => ({ lastResolvedGeneration: 0, lastResolvedAt: null }) },
      status: { get: () => ({ playbackStatus: "idle" as const }) },
      time: { get: () => ({ currentTime: 0, duration: 0 }) },
      pip: { get: () => ({ enabled: false }) },
      info: { get: () => ({
        title: null,
        author: null,
        thumbnail: null,
        pageGeneration: 0,
        infoGeneration: 0,
      }) },
    },
    elementResolver: {
      resolve: vi.fn(() => null),
      peek: vi.fn(() => null),
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
    },
    httpClient: {
      client: {} as never,
      request: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      head: vi.fn(),
      clearCache: vi.fn(),
      clearInFlight: vi.fn(),
    },
  };
};

describe("installDebugDumpTrigger", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedRequestedAt));
    loggerMockHarness = createTsSimpleLoggerMockHarness();
    vi.doMock("@matumo/ts-simple-logger", () => loggerMockHarness.createModuleFactory());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test("debug dump要求イベントを登録してログ出力できること", async () => {
    const globalDescriptors = captureGlobalDescriptors(["addEventListener", "removeEventListener"] as const);
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    setGlobalProperty("addEventListener", addEventListener);
    setGlobalProperty("removeEventListener", removeEventListener);

    try {
      vi.spyOn(performance, "now").mockReturnValue(fixedRequestedAtPerformanceNow);
      const { installDebugDumpTrigger, createDebugDumpRequestEventName } = await import("@main/debug/debug-dump-trigger");
      const uninstall = installDebugDumpTrigger({
        prefixId: "test-prefix",
        collectSources: () => ({
          "domain/pip": {
            enabled: true,
          },
        }),
      });

      const requestEventName = createDebugDumpRequestEventName("test-prefix");
      expect(addEventListener).toHaveBeenCalledWith(requestEventName, expect.any(Function));

      const listener = addEventListener.mock.calls[0]?.[1] as (() => void) | undefined;
      if (!listener) throw new Error("listener is not registered");

      listener();

      const debugLogger = loggerMockHarness.resolveMockLogger("debug");
      expect(debugLogger.info).toHaveBeenCalledWith(
        "debug dump requested (sources=1)",
        {
          requestedAt: fixedRequestedAt,
          requestedAtPerformanceNow: fixedRequestedAtPerformanceNow,
          requestEventName,
          sourceCount: 1,
          sources: {
            "domain/pip": {
              enabled: true,
            },
          },
        },
      );

      uninstall();
      expect(removeEventListener).toHaveBeenCalledWith(requestEventName, listener);
    } finally {
      restoreGlobalDescriptors(globalDescriptors);
    }
  });

  test("performance未対応時はrequestedAtPerformanceNowをnullで出力すること", async () => {
    const globalDescriptors = captureGlobalDescriptors(["addEventListener", "removeEventListener", "performance"] as const);
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    setGlobalProperty("addEventListener", addEventListener);
    setGlobalProperty("removeEventListener", removeEventListener);
    setGlobalProperty("performance", undefined);

    try {
      const { installDebugDumpTrigger } = await import("@main/debug/debug-dump-trigger");
      const uninstall = installDebugDumpTrigger({
        prefixId: "test-prefix",
        collectSources: () => ({
          "app/context": {},
        }),
      });

      const listener = addEventListener.mock.calls[0]?.[1] as (() => void) | undefined;
      if (!listener) throw new Error("listener is not registered");

      listener();

      const debugLogger = loggerMockHarness.resolveMockLogger("debug");
      expect(debugLogger.info).toHaveBeenCalledWith(
        "debug dump requested (sources=1)",
        expect.objectContaining({
          requestedAtPerformanceNow: null,
        }),
      );

      uninstall();
    } finally {
      restoreGlobalDescriptors(globalDescriptors);
    }
  });

  test("event api未対応時はwarningを出してno-op uninstallerを返すこと", async () => {
    const globalDescriptors = captureGlobalDescriptors(["addEventListener", "removeEventListener"] as const);
    setGlobalProperty("addEventListener", undefined);
    setGlobalProperty("removeEventListener", undefined);

    try {
      const { installDebugDumpTrigger } = await import("@main/debug/debug-dump-trigger");
      const uninstall = installDebugDumpTrigger({
        prefixId: "test-prefix",
        collectSources: () => ({
          "app/context": {},
        }),
      });

      expect(() => uninstall()).not.toThrow();
      const debugLogger = loggerMockHarness.resolveMockLogger("debug");
      expect(debugLogger.warn).toHaveBeenCalledWith("debug dump trigger skipped: event api is unavailable");
    } finally {
      restoreGlobalDescriptors(globalDescriptors);
    }
  });

  test("AppContextからdebug dump triggerを登録できること", async () => {
    const globalDescriptors = captureGlobalDescriptors(["addEventListener", "removeEventListener"] as const);
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    setGlobalProperty("addEventListener", addEventListener);
    setGlobalProperty("removeEventListener", removeEventListener);

    try {
      const { createDebugDumpRegistry, createDebugDumpRequestEventName } = await import("@main/debug/debug-dump");
      const context = createContext({
        debugMode: true,
      });
      const registry = createDebugDumpRegistry(context);
      context.debugDumpRegistry = registry;
      registry.registerAppContext();
      registry.installTrigger();

      const requestEventName = createDebugDumpRequestEventName(context.config.prefixId);
      expect(addEventListener).toHaveBeenCalledWith(requestEventName, expect.any(Function));

      registry.uninstallTrigger();
      expect(removeEventListener).toHaveBeenCalledWith(requestEventName, expect.any(Function));
    } finally {
      restoreGlobalDescriptors(globalDescriptors);
    }
  });
});
