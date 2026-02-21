/**
 * bootstrapテスト
 */
import { describe, expect, test, vi } from "vitest";
import { bootstrap } from "@main/bootstrap/bootstrap";
import { createAppConfig } from "@main/config/config";
import { createMockAppLoggers } from "@test/unit/main/shared/logger";
import { createForbiddenHttpClient } from "@test/unit/main/shared/http-client";
import type {
  AppContext,
  AppObserverRegistry,
  AppEventRegistry,
  AppStateWriters,
} from "@main/types/app-context";
import type { DomainModule } from "@main/domain/create-domain-module";

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
    loggers: createMockAppLoggers(),
    eventRegistry,
    observerRegistry,
    state: {
      page: { get: () => ({ url: "", isWatchPage: false, generation: 0 }) },
      elements: { get: () => ({ lastResolvedGeneration: 0, lastResolvedAt: null }) },
      status: { get: () => ({ playbackStatus: "idle" as const }) },
      time: { get: () => ({ currentTime: 0, duration: 0 }) },
      pip: { get: () => ({ enabled: false, reason: "unknown" as const }) },
      info: { get: () => ({ title: null, videoId: null }) },
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
  name: string,
  phase: DomainModule["phase"],
  record: string[],
  throwOn?: "init" | "start" | "stop",
): DomainModule => ({
  name,
  phase,
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
  test("initとstartを順方向、stopを逆方向で実行すること", async () => {
    const record: string[] = [];
    const context = createMockContext();
    const stateWriters = createMockStateWriters();

    const runtime = await bootstrap({
      context,
      stateWriters,
      domainModules: [
        createDomain("p", "presentation", record),
        createDomain("c", "control", record),
        createDomain("d", "coreDetection", record),
      ],
    });

    expect(record).toEqual(["d:init", "c:init", "p:init", "d:start", "c:start", "p:start"]);

    await runtime.stop();

    expect(record).toEqual([
      "d:init",
      "c:init",
      "p:init",
      "d:start",
      "c:start",
      "p:start",
      "p:stop",
      "c:stop",
      "d:stop",
    ]);

    expect(context.observerRegistry.disconnectAll).toHaveBeenCalledTimes(1);
    expect(context.eventRegistry.clear).toHaveBeenCalledTimes(1);
    expect(context.elementResolver.invalidateAll).toHaveBeenCalledTimes(1);
    expect(context.httpClient.clearInFlight).toHaveBeenCalledTimes(1);
    expect(context.httpClient.clearCache).toHaveBeenCalledTimes(1);
  });

  test("init失敗時も他ドメインの起動処理を継続すること", async () => {
    const record: string[] = [];
    const context = createMockContext();
    const stateWriters = createMockStateWriters();

    await bootstrap({
      context,
      stateWriters,
      domainModules: [
        createDomain("broken", "coreDetection", record, "init"),
        createDomain("next", "coreDetection", record),
      ],
    });

    expect(record).toContain("broken:init");
    expect(record).toContain("next:init");
    expect(record).toContain("next:start");
    expect(context.loggers.safeRunner.error).toHaveBeenCalled();
    expect(context.loggers.domain.error).not.toHaveBeenCalled();
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
      name: "writer-check",
      phase: "coreDetection",
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

  test("stop後に再bootstrapしても再初期化できること", async () => {
    const record: string[] = [];
    const generationsAtInit: number[] = [];

    const domain: DomainModule = {
      name: "restart-check",
      phase: "coreDetection",
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
        createDomain("broken-start", "control", firstRecord, "start"),
        createDomain("next-start", "control", firstRecord),
      ],
    });

    expect(firstRecord).toContain("broken-start:start");
    expect(firstRecord).toContain("next-start:start");
    expect(firstContext.loggers.safeRunner.error).toHaveBeenCalledTimes(1);

    const secondRecord: string[] = [];
    const secondContext = createMockContext();
    const secondStateWriters = createMockStateWriters();

    await bootstrap({
      context: secondContext,
      stateWriters: secondStateWriters,
      domainModules: [
        createDomain("first-start", "control", secondRecord),
        createDomain("broken-start-2", "control", secondRecord, "start"),
      ],
    });

    expect(secondRecord).toContain("first-start:start");
    expect(secondRecord).toContain("broken-start-2:start");
    expect(secondContext.loggers.safeRunner.error).toHaveBeenCalledTimes(1);
  });
});
