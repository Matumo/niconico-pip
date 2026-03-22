/**
 * bootstrapテスト
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createAppConfig } from "@main/config/config";
import { createForbiddenHttpClient } from "@test/unit/main/shared/http-client";
import { createTsSimpleLoggerMockHarness } from "@test/unit/main/shared/logger";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
} from "@test/unit/main/shared/global-property";
import type {
  AppContext,
  AppObserverRegistry,
  AppEventRegistry,
  AppStateWriters,
} from "@main/types/app-context";
import type { DomainModule } from "@main/domain/shared/create-domain-module";
import { domainNameOrderList, type DomainName } from "@main/domain/shared/domain-name";
import type { TsSimpleLoggerMockHarness } from "@test/unit/main/shared/logger";

let bootstrap: typeof import("@main/bootstrap/bootstrap").bootstrap;
let createDebugDumpRegistry: typeof import("@main/debug/debug-dump").createDebugDumpRegistry;
let loggerMockHarness: TsSimpleLoggerMockHarness;

// テスト用のno-op MutationObserverを返す関数
const createObserver = (): MutationObserver =>
  ({
    observe: () => undefined,
    disconnect: () => undefined,
    takeRecords: () => [],
  }) as MutationObserver;

// テスト用コンテキストを作成する関数
const createMockContext = (): AppContext => {
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
  const httpClient = createForbiddenHttpClient("bootstrap tests");

  return {
    config: createAppConfig(),
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
      resolve: vi.fn(() => null),
      peek: vi.fn(() => null),
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
    },
    httpClient,
  };
};

// テスト用writerを作成する関数
const createMockStateWriters = (): AppStateWriters => ({
  page: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
  elements: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
  status: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
  time: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
  pip: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
  info: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
});

// テスト用ドメインを作成する関数
const createDomain = (
  name: DomainName,
  record: string[],
  throwOn?: "init" | "start" | "stop",
): DomainModule => ({
  name,
  init: async () => {
    record.push(`${name}:init`);
    if (throwOn === "init") {
      throw new Error(`${name}:init-error`);
    }
  },
  start: async () => {
    record.push(`${name}:start`);
    if (throwOn === "start") {
      throw new Error(`${name}:start-error`);
    }
  },
  stop: async () => {
    record.push(`${name}:stop`);
    if (throwOn === "stop") {
      throw new Error(`${name}:stop-error`);
    }
  },
});

describe("bootstrap", () => {
  beforeEach(async () => {
    vi.resetModules();
    loggerMockHarness = createTsSimpleLoggerMockHarness();
    vi.doMock("@matumo/ts-simple-logger", () => loggerMockHarness.createModuleFactory());
    ({ bootstrap } = await import("@main/bootstrap/bootstrap"));
    ({ createDebugDumpRegistry } = await import("@main/debug/debug-dump"));
    loggerMockHarness.clearLoggerCalls();
  });

  test("initとstartを順方向、stopを逆方向で実行すること", async () => {
    const record: string[] = [];
    const context = createMockContext();
    const stateWriters = createMockStateWriters();

    const runtime = await bootstrap({
      context,
      stateWriters,
      domainModules: [
        createDomain("page", record),
        createDomain("pip", record),
        createDomain("elements", record),
      ],
    });

    expect(record).toEqual([
      "pip:init",
      "elements:init",
      "page:init",
      "pip:start",
      "elements:start",
      "page:start",
    ]);

    await runtime.stop();

    expect(record).toEqual([
      "pip:init",
      "elements:init",
      "page:init",
      "pip:start",
      "elements:start",
      "page:start",
      "page:stop",
      "elements:stop",
      "pip:stop",
    ]);

    expect(context.observerRegistry.disconnectAll).toHaveBeenCalledTimes(1);
    expect(context.eventRegistry.clear).toHaveBeenCalledTimes(1);
    expect(context.elementResolver.invalidateAll).toHaveBeenCalledTimes(1);
    expect(context.httpClient.clearInFlight).toHaveBeenCalledTimes(1);
    expect(context.httpClient.clearCache).toHaveBeenCalledTimes(1);
  });

  test("既定ドメインを明示リスト順で生成し起動すること", async () => {
    vi.resetModules();
    loggerMockHarness = createTsSimpleLoggerMockHarness();
    vi.doMock("@matumo/ts-simple-logger", () => loggerMockHarness.createModuleFactory());

    const record: string[] = [];
    const context = createMockContext();
    const stateWriters = createMockStateWriters();

    const createFactoryMock = (name: DomainName) => vi.fn(() => createDomain(name, record));

    const createElementsDomain = createFactoryMock("elements");
    const createStatusDomain = createFactoryMock("status");
    const createTimeDomain = createFactoryMock("time");
    const createControllerDomain = createFactoryMock("controller");
    const createMediaSessionDomain = createFactoryMock("media-session");
    const createPipDomain = createFactoryMock("pip");
    const createAdDomain = createFactoryMock("ad");
    const createPageDomain = createFactoryMock("page");

    vi.doMock("@main/domain/elements", () => ({ createElementsDomain }));
    vi.doMock("@main/domain/status", () => ({ createStatusDomain }));
    vi.doMock("@main/domain/time", () => ({ createTimeDomain }));
    vi.doMock("@main/domain/controller", () => ({ createControllerDomain }));
    vi.doMock("@main/domain/media-session", () => ({ createMediaSessionDomain }));
    vi.doMock("@main/domain/pip", () => ({ createPipDomain }));
    vi.doMock("@main/domain/ad", () => ({ createAdDomain }));
    vi.doMock("@main/domain/page", () => ({ createPageDomain }));

    const { bootstrap: bootstrapWithMocks } = await import("@main/bootstrap/bootstrap");
    const runtime = await bootstrapWithMocks({
      context,
      stateWriters,
    });

    expect(record).toEqual([
      "pip:init",
      "status:init",
      "elements:init",
      "time:init",
      "controller:init",
      "media-session:init",
      "ad:init",
      "page:init",
      "pip:start",
      "status:start",
      "elements:start",
      "time:start",
      "controller:start",
      "media-session:start",
      "ad:start",
      "page:start",
    ]);

    await runtime.stop();

    expect(record).toEqual([
      "pip:init",
      "status:init",
      "elements:init",
      "time:init",
      "controller:init",
      "media-session:init",
      "ad:init",
      "page:init",
      "pip:start",
      "status:start",
      "elements:start",
      "time:start",
      "controller:start",
      "media-session:start",
      "ad:start",
      "page:start",
      "page:stop",
      "ad:stop",
      "media-session:stop",
      "controller:stop",
      "time:stop",
      "elements:stop",
      "status:stop",
      "pip:stop",
    ]);

    for (const domainName of domainNameOrderList) {
      const domainCreateRecord = `${domainName}:init`;
      expect(record).toContain(domainCreateRecord);
    }
  });

  test("init失敗時も他ドメインの起動処理を継続すること", async () => {
    const record: string[] = [];
    const context = createMockContext();
    const stateWriters = createMockStateWriters();

    await bootstrap({
      context,
      stateWriters,
      domainModules: [
        createDomain("elements", record, "init"),
        createDomain("status", record),
      ],
    });

    expect(record).toContain("elements:init");
    expect(record).toContain("status:init");
    expect(record).toContain("status:start");
    expect(loggerMockHarness.resolveMockLogger("safe-runner").error).toHaveBeenCalledTimes(1);
    expect(loggerMockHarness.resolveMockLogger("domain").error).not.toHaveBeenCalled();
  });

  test("context未指定でも既定ドメインで起動できること", async () => {
    const runtime = await bootstrap({
      createObserver,
    });
    await expect(runtime.stop()).resolves.toBeUndefined();
  });

  test("context未指定時にstate writerをdomainへ注入すること", async () => {
    let hasStateWriters = false;

    const domain: DomainModule = {
      name: "page",
      init: async (context, dependencies) => {
        hasStateWriters = Boolean(dependencies.page);
        dependencies.page.patch({ generation: 7 });
        expect(context.state.page.get().generation).toBe(7);
      },
      start: async () => undefined,
      stop: async () => undefined,
    };

    const runtime = await bootstrap({
      domainModules: [domain],
      createObserver,
    });

    expect(hasStateWriters).toBe(true);
    expect(runtime.context.state.page.get().generation).toBe(7);
    await runtime.stop();
  });

  test("debugMode=falseのときdebug dump triggerを登録しないこと", async () => {
    const globalDescriptors = captureGlobalDescriptors(["addEventListener", "removeEventListener"] as const);
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    setGlobalProperty("addEventListener", addEventListener);
    setGlobalProperty("removeEventListener", removeEventListener);

    try {
      const context = createMockContext();
      const debugDumpEventName = `${context.config.prefixId}-debug-dump-request`;
      const runtime = await bootstrap({
        context,
        stateWriters: createMockStateWriters(),
        domainModules: [],
      });

      expect(addEventListener).not.toHaveBeenCalledWith(debugDumpEventName, expect.any(Function));

      await runtime.stop();
      expect(removeEventListener).not.toHaveBeenCalledWith(debugDumpEventName, expect.any(Function));
    } finally {
      restoreGlobalDescriptors(globalDescriptors);
    }
  });

  test("debugMode=trueのときだけdebug dump triggerとapp/context sourceを登録すること", async () => {
    const globalDescriptors = captureGlobalDescriptors(["addEventListener", "removeEventListener"] as const);
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    setGlobalProperty("addEventListener", addEventListener);
    setGlobalProperty("removeEventListener", removeEventListener);

    try {
      const context = createMockContext();
      context.config = createAppConfig({
        debugMode: true,
        shouldUseDebugLog: true,
      });
      context.debugDumpRegistry = createDebugDumpRegistry(context);
      const debugDumpEventName = `${context.config.prefixId}-debug-dump-request`;

      const runtime = await bootstrap({
        context,
        stateWriters: createMockStateWriters(),
        domainModules: [],
      });

      expect(context.debugDumpRegistry.collect()).toHaveProperty("app/context");
      expect(addEventListener).toHaveBeenCalledWith(debugDumpEventName, expect.any(Function));

      await runtime.stop();

      expect(context.debugDumpRegistry.size()).toBe(0);
      expect(removeEventListener).toHaveBeenCalledWith(debugDumpEventName, expect.any(Function));
    } finally {
      restoreGlobalDescriptors(globalDescriptors);
    }
  });

  test("stop後に再bootstrapしても再初期化できること", async () => {
    const record: string[] = [];
    const generationsAtInit: number[] = [];

    const domain: DomainModule = {
      name: "page",
      init: async (context, dependencies) => {
        generationsAtInit.push(context.state.page.get().generation);
        dependencies.page.patch({ generation: 1 });
        record.push("init");
      },
      start: async () => {
        record.push("start");
      },
      stop: async () => {
        record.push("stop");
      },
    };

    const firstRuntime = await bootstrap({
      domainModules: [domain],
      createObserver,
    });
    await firstRuntime.stop();

    const secondRuntime = await bootstrap({
      domainModules: [domain],
      createObserver,
    });
    await secondRuntime.stop();

    expect(record).toEqual(["init", "start", "stop", "init", "start", "stop"]);
    expect(generationsAtInit).toEqual([0, 0]);
  });

  test("start失敗時も他ドメインの起動処理を継続すること", async () => {
    const firstRecord: string[] = [];
    const firstContext = createMockContext();
    const firstStateWriters = createMockStateWriters();

    await bootstrap({
      context: firstContext,
      stateWriters: firstStateWriters,
      domainModules: [
        createDomain("elements", firstRecord, "start"),
        createDomain("status", firstRecord),
      ],
    });

    expect(firstRecord).toContain("elements:start");
    expect(firstRecord).toContain("status:start");
    const safeRunnerLogger = loggerMockHarness.resolveMockLogger("safe-runner");
    expect(safeRunnerLogger.error).toHaveBeenCalledTimes(1);
    safeRunnerLogger.error.mockClear();

    const secondRecord: string[] = [];
    const secondContext = createMockContext();
    const secondStateWriters = createMockStateWriters();

    await bootstrap({
      context: secondContext,
      stateWriters: secondStateWriters,
      domainModules: [
        createDomain("elements", secondRecord),
        createDomain("status", secondRecord, "start"),
      ],
    });

    expect(secondRecord).toContain("elements:start");
    expect(secondRecord).toContain("status:start");
    expect(safeRunnerLogger.error).toHaveBeenCalledTimes(1);
  });
});
