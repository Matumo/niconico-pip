/**
 * debug dump registryテスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createAppConfig } from "@main/config/config";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";
import { createTsSimpleLoggerMockHarness, type TsSimpleLoggerMockHarness } from "@test/unit/main/shared/logger";
import type { AppContext, AppEventRegistry, AppObserverRegistry } from "@main/types/app-context";

const globalPropertyKeys = ["addEventListener", "removeEventListener", "document"] as const;
let createDebugDumpRegistry: typeof import("@main/debug/debug-dump-registry").createDebugDumpRegistry;
let loggerMockHarness: TsSimpleLoggerMockHarness;

function namedThrowValue(): undefined {
  return undefined;
}

function createAnonymousThrowValue(): () => undefined {
  return function () {
    return undefined;
  };
}

const createContext = (debugMode = true): AppContext => {
  const eventRegistry: AppEventRegistry = {
    on: () => () => undefined,
    emit: () => undefined,
    off: () => false,
    clear: () => undefined,
    size: () => 0,
  };
  const observerRegistry: AppObserverRegistry = {
    observe: () => ({ disconnect: () => undefined } as unknown as MutationObserver),
    disconnect: () => false,
    disconnectAll: () => undefined,
    size: () => 0,
  };

  return {
    config: createAppConfig({
      debugMode,
      shouldUseDebugLog: debugMode,
    }),
    eventRegistry,
    observerRegistry,
    state: {
      page: { get: () => ({ url: "", isWatchPage: false, generation: 0 }) },
      elements: { get: () => ({ lastResolvedGeneration: 0, lastResolvedElapsedMs: null }) },
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
      resolve: () => null,
      peek: () => null,
      invalidate: () => undefined,
      invalidateAll: () => undefined,
    },
    httpClient: {
      client: {} as never,
      request: () => { throw new Error("unused"); },
      get: () => { throw new Error("unused"); },
      post: () => { throw new Error("unused"); },
      put: () => { throw new Error("unused"); },
      patch: () => { throw new Error("unused"); },
      delete: () => { throw new Error("unused"); },
      head: () => { throw new Error("unused"); },
      clearCache: () => undefined,
      clearInFlight: () => undefined,
    },
  };
};

describe("createDebugDumpRegistry", () => {
  beforeEach(async () => {
    vi.resetModules();
    loggerMockHarness = createTsSimpleLoggerMockHarness();
    vi.doMock("@matumo/ts-simple-logger", () => loggerMockHarness.createModuleFactory());
    ({ createDebugDumpRegistry } = await import("@main/debug/debug-dump-registry"));
    loggerMockHarness.clearLoggerCalls();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("登録したsourceを収集できること", () => {
    const context = createContext();
    const registry = createDebugDumpRegistry(context);
    context.debugDumpRegistry = registry;

    registry.registerAppContext();
    registry.registerPageDomain({
      resolveRuntime: () => ({
        lastKnownUrl: "https://www.nicovideo.jp/watch/sm9",
      }),
      resolveCurrentUrl: () => "https://www.nicovideo.jp/watch/sm9",
    });

    expect(registry.size()).toBe(2);
    expect(registry.collect()).toMatchObject({
      "app/context": {
        config: {
          debugMode: true,
        },
      },
      "domain/page": {
        currentUrl: "https://www.nicovideo.jp/watch/sm9",
        lastKnownUrl: "https://www.nicovideo.jp/watch/sm9",
      },
    });
  });

  test("同じnameを再登録すると上書きすること", () => {
    const context = createContext();
    const registry = createDebugDumpRegistry(context);
    context.debugDumpRegistry = registry;

    registry.registerPageDomain({
      resolveRuntime: () => ({
        lastKnownUrl: "https://www.nicovideo.jp/watch/sm8",
      }),
      resolveCurrentUrl: () => "https://www.nicovideo.jp/watch/sm8",
    });
    registry.registerPageDomain({
      resolveRuntime: () => ({
        lastKnownUrl: "https://www.nicovideo.jp/watch/sm9",
      }),
      resolveCurrentUrl: () => "https://www.nicovideo.jp/watch/sm9",
    });

    expect(registry.size()).toBe(1);
    expect(registry.collect()).toEqual({
      "domain/page": {
        state: {
          url: "",
          isWatchPage: false,
          generation: 0,
        },
        currentUrl: "https://www.nicovideo.jp/watch/sm9",
        lastKnownUrl: "https://www.nicovideo.jp/watch/sm9",
      },
    });
  });

  test("sourceが例外を投げても他sourceの収集を継続すること", () => {
    const context = createContext();
    const registry = createDebugDumpRegistry(context);
    context.debugDumpRegistry = registry;

    registry.registerAppContext();
    registry.registerPageDomain({
      resolveRuntime: () => {
        throw new Error("broken dump");
      },
      resolveCurrentUrl: () => "https://www.nicovideo.jp/watch/sm9",
    });

    expect(registry.collect()).toMatchObject({
      "app/context": {
        config: {
          debugMode: true,
        },
      },
      "domain/page": {
        __debugDumpError: true,
        message: "broken dump",
      },
    });
    expect(loggerMockHarness.resolveMockLogger("debug").warn).toHaveBeenCalledWith(
      "debug dump source failed: domain/page",
      expect.any(Error),
    );
  });

  test("Error以外のobject例外も読みやすい文字列へ変換すること", () => {
    const context = createContext();
    const registry = createDebugDumpRegistry(context);
    context.debugDumpRegistry = registry;

    registry.registerPageDomain({
      resolveRuntime: () => {
        const thrownValue = {
          reason: "broken dump",
          retriable: false,
        };
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw thrownValue;
      },
      resolveCurrentUrl: () => "https://www.nicovideo.jp/watch/sm9",
    });

    expect(registry.collect()).toEqual({
      "domain/page": {
        __debugDumpError: true,
        message: "{\"reason\":\"broken dump\",\"retriable\":false}",
      },
    });
  });

  test("runtime未初期化時の購読状態とlistener状態をfalseで出力すること", () => {
    const context = createContext();
    const registry = createDebugDumpRegistry(context);
    context.debugDumpRegistry = registry;

    registry.registerPipDomain({
      resolveRuntime: () => null,
    });

    expect(registry.collect()).toEqual({
      "domain/pip": {
        pipState: {
          enabled: false,
        },
        infoState: {
          title: null,
          author: null,
          thumbnail: null,
          pageGeneration: 0,
          infoGeneration: 0,
        },
        ownPictureInPictureActive: false,
        pipStreamRunning: false,
        documentPictureInPictureElement: null,
        documentFullscreenElement: null,
        pipVideoElement: null,
        sourceVideoElement: null,
        sourceCommentsCanvas: null,
        fullscreenToggleButton: null,
        browserSizeFullscreenActive: null,
        hiddenSourceElements: [],
        subscriptions: {
          hasPageUrlChangedSubscription: false,
          hasElementsUpdatedSubscription: false,
          hasVideoInfoChangedSubscription: false,
        },
        nativeListeners: {
          enterPictureInPicture: false,
          leavePictureInPicture: false,
          fullscreenChange: false,
        },
      },
    });
  });

  test("elements/status/pip sourceの登録と解除を行えること", () => {
    const context = createContext();
    const registry = createDebugDumpRegistry(context);
    context.debugDumpRegistry = registry;

    registry.registerElementsDomain({
      resolveRuntime: () => ({
        snapshot: {
          video: null,
        } as never,
        elementsGeneration: 10,
        activePlayerContainer: null,
        unsubscribePageUrlChanged: () => undefined,
      }),
      createEmptySnapshot: () => ({ video: null } as never),
    });
    registry.registerStatusDomain({
      resolveRuntime: () => ({
        snapshot: {
          title: "runtime title",
          author: "runtime author",
          thumbnail: "runtime thumbnail",
        },
        infoGeneration: 20,
        pageGeneration: 30,
        unsubscribePageUrlChanged: () => undefined,
        unsubscribeElementsUpdated: () => undefined,
      }),
    });
    registry.registerPipDomain({
      resolveRuntime: () => ({
        pipVideoElementAdapter: {
          getElement: () => null,
          isOwnPictureInPictureElement: () => false,
        },
        pipStream: {
          isRunning: () => false,
        },
        unsubscribePageUrlChanged: () => undefined,
        unsubscribeElementsUpdated: () => undefined,
        unsubscribeVideoInfoChanged: () => undefined,
        enterPictureInPictureListener: null,
        leavePictureInPictureListener: null,
        fullscreenChangeListener: null,
        sourceVideoElement: null,
        sourceCommentsCanvas: null,
        fullscreenToggleButton: null,
        browserSizeFullscreenActive: false,
        hiddenSourceElements: new Set(),
      }),
    });

    expect(registry.collect()).toMatchObject({
      "domain/elements": {
        elementsGeneration: 10,
        subscriptions: {
          hasPageUrlChangedSubscription: true,
        },
      },
      "domain/status": {
        infoGeneration: 20,
        pageGeneration: 30,
        subscriptions: {
          hasPageUrlChangedSubscription: true,
          hasElementsUpdatedSubscription: true,
        },
      },
      "domain/pip": {
        browserSizeFullscreenActive: false,
        subscriptions: {
          hasPageUrlChangedSubscription: true,
          hasElementsUpdatedSubscription: true,
          hasVideoInfoChangedSubscription: true,
        },
      },
    });

    registry.unregisterElementsDomain();
    registry.unregisterStatusDomain();
    registry.unregisterPipDomain();
    expect(registry.size()).toBe(0);
  });

  test("page sourceの解除とtriggerの再登録を行えること", () => {
    const globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]> =
      captureGlobalDescriptors(globalPropertyKeys);
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    setGlobalProperty("addEventListener", addEventListener);
    setGlobalProperty("removeEventListener", removeEventListener);
    setGlobalProperty("document", {});

    try {
      const context = createContext();
      const registry = createDebugDumpRegistry(context);
      context.debugDumpRegistry = registry;

      registry.registerPageDomain({
        resolveRuntime: () => ({
          lastKnownUrl: "https://www.nicovideo.jp/watch/sm9",
        }),
        resolveCurrentUrl: () => "https://www.nicovideo.jp/watch/sm9",
      });
      registry.unregisterPageDomain();

      registry.installTrigger();
      registry.installTrigger();
      registry.uninstallTrigger();

      expect(addEventListener).toHaveBeenCalledTimes(2);
      expect(removeEventListener).toHaveBeenCalledTimes(2);
    } finally {
      restoreGlobalDescriptors(globalDescriptors);
    }
  });

  test("循環objectと匿名関数のthrow値も文字列化できること", () => {
    const context = createContext();
    const registry = createDebugDumpRegistry(context);
    context.debugDumpRegistry = registry;

    const circular: { self?: unknown } = {};
    circular.self = circular;
    registry.registerPageDomain({
      resolveRuntime: () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw circular;
      },
      resolveCurrentUrl: () => "https://www.nicovideo.jp/watch/sm9",
    });

    expect(registry.collect()).toEqual({
      "domain/page": {
        __debugDumpError: true,
        message: "[object Object]",
      },
    });

    registry.registerPageDomain({
      resolveRuntime: () => {
        const thrownValue = createAnonymousThrowValue();
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw thrownValue;
      },
      resolveCurrentUrl: () => "https://www.nicovideo.jp/watch/sm10",
    });

    expect(registry.collect()).toEqual({
      "domain/page": {
        __debugDumpError: true,
        message: "[Function anonymous]",
      },
    });
  });

  test.each([
    {
      testName: "string",
      valueFactory: () => "broken dump",
      expected: "broken dump",
    },
    {
      testName: "number",
      valueFactory: () => 123,
      expected: "123",
    },
    {
      testName: "boolean",
      valueFactory: () => false,
      expected: "false",
    },
    {
      testName: "bigint",
      valueFactory: () => 123n,
      expected: "123",
    },
    {
      testName: "null",
      valueFactory: () => null,
      expected: "null",
    },
    {
      testName: "undefined",
      valueFactory: () => undefined,
      expected: "undefined",
    },
    {
      testName: "symbol",
      valueFactory: () => Symbol("broken-dump"),
      expected: "Symbol(broken-dump)",
    },
    {
      testName: "named function",
      valueFactory: () => namedThrowValue,
      expected: "[Function namedThrowValue]",
    },
  ])("各種throw値($testName)を文字列化できること", ({ valueFactory, expected }) => {
    const context = createContext();
    const registry = createDebugDumpRegistry(context);
    context.debugDumpRegistry = registry;

    registry.registerPageDomain({
      resolveRuntime: () => {
        const thrownValue: unknown = valueFactory();
        throw thrownValue;
      },
      resolveCurrentUrl: () => "https://www.nicovideo.jp/watch/sm9",
    });

    expect(registry.collect()).toEqual({
      "domain/page": {
        __debugDumpError: true,
        message: expected,
      },
    });
  });

  test("sourceがundefinedを返したときnullへ正規化すること", async () => {
    vi.resetModules();
    vi.doMock("@main/debug/debug-dump-sources", async () => {
      const actual = await vi.importActual<typeof import("@main/debug/debug-dump-sources")>("@main/debug/debug-dump-sources");
      return {
        ...actual,
        createAppContextDebugDumpSource: () => () => undefined,
      };
    });

    try {
      const { createDebugDumpRegistry: createMockedDebugDumpRegistry } = await import("@main/debug/debug-dump-registry");
      const context = createContext();
      const registry = createMockedDebugDumpRegistry(context);
      context.debugDumpRegistry = registry;

      registry.registerAppContext();

      expect(registry.collect()).toEqual({
        "app/context": null,
      });
    } finally {
      vi.doUnmock("@main/debug/debug-dump-sources");
      vi.resetModules();
    }
  });
});
