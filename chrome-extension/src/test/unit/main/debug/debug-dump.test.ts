/**
 * debug dump テスト
 */
import { describe, expect, test, vi } from "vitest";
import { createAppConfig } from "@main/config/config";
import { createDebugDumpRegistry } from "@main/debug/debug-dump";
import type {
  AppContext,
  AppEventRegistry,
  AppObserverRegistry,
} from "@main/types/app-context";

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

describe("debug dump public api", () => {
  test("debug dump sourceの登録と解除と全解除を行えること", () => {
    const context = createContext({
      debugMode: true,
    });
    const debugDumpRegistry = createDebugDumpRegistry(context);
    context.debugDumpRegistry = debugDumpRegistry;

    debugDumpRegistry.registerAppContext();
    debugDumpRegistry.unregisterAppContext();
    debugDumpRegistry.registerAppContext();
    debugDumpRegistry.clearSources();

    expect(debugDumpRegistry.size()).toBe(0);
  });

  test("debugDumpRegistryがない状態でpublic apiを呼ぶとエラーにすること", () => {
    const context = createContext({
      debugMode: true,
    });
    const debugDumpRegistry = createDebugDumpRegistry(context);

    expect(() => debugDumpRegistry.clearSources()).toThrowError("debug dump clear sources requires context.debugDumpRegistry");
  });

  test("debugMode=falseなのにdebugDumpRegistryがある状態でpublic apiを呼ぶとエラーにすること", () => {
    const context = createContext({
      debugMode: false,
    });
    const debugDumpRegistry = createDebugDumpRegistry(context);
    context.debugDumpRegistry = debugDumpRegistry;

    expect(() => debugDumpRegistry.registerAppContext())
      .toThrowError("debug dump register source \"app/context\" requires config.debugMode === true");
  });
});
