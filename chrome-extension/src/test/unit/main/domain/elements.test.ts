/**
 * elementsドメインテスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createAppConfig } from "@main/config/config";
import type { AppEventKey, AppEventMap } from "@main/config/event";
import type {
  AppContext,
  AppEventRegistry,
  AppObserverRegistry,
  AppStateWriters,
} from "@main/types/app-context";
import type {
  CreateVideoElementObserverOptions,
  VideoElementObserver,
  VideoElementObserverTrigger,
} from "@main/adapter/dom/video-element-observer";
import type { SelectorElementMap, SelectorKey } from "@main/config/selector";
import { createForbiddenHttpClient } from "@test/unit/main/shared/http-client";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";
import { createTsSimpleLoggerMockHarness, type TsSimpleLoggerMockHarness } from "@test/unit/main/shared/logger";

const createVideoElementObserverMock = vi.fn();
let createElementsDomain: typeof import("@main/domain/elements").createElementsDomain;
let loggerMockHarness: TsSimpleLoggerMockHarness;

// テストで差し替えるglobalThisプロパティの一覧
const globalPropertyKeys = ["dispatchEvent"] as const;

// 要素スナップショットのテスト表現型
type TestElementsSnapshot = {
  [K in SelectorKey]: SelectorElementMap[K] | null;
};

// null初期化済みスナップショットを作る関数
const createSnapshot = (overrides: Partial<TestElementsSnapshot> = {}): TestElementsSnapshot => ({
  commentToggleButton: null,
  playerContainer: null,
  playerMenu: null,
  video: null,
  commentsCanvas: null,
  ...overrides,
});

// VideoElementObserverモックを準備する関数
const prepareVideoElementObserverMock = () => {
  let onDiscoverCheckRequested: ((trigger: VideoElementObserverTrigger) => void) | null = null;
  let onPlayerCheckRequested: ((trigger: VideoElementObserverTrigger) => void) | null = null;

  const start = vi.fn();
  const switchToDiscover = vi.fn();
  const switchToPlayer = vi.fn();
  const stop = vi.fn();

  createVideoElementObserverMock.mockImplementation(
    (options: CreateVideoElementObserverOptions): VideoElementObserver => {
      onDiscoverCheckRequested = options.onDiscoverCheckRequested;
      onPlayerCheckRequested = options.onPlayerCheckRequested;
      return {
        start,
        switchToDiscover,
        switchToPlayer,
        stop,
      };
    },
  );

  const emitDiscoverTrigger = (trigger: VideoElementObserverTrigger): void => {
    if (!onDiscoverCheckRequested) throw new Error("discover callback is not initialized");
    onDiscoverCheckRequested(trigger);
  };
  const emitPlayerTrigger = (trigger: VideoElementObserverTrigger): void => {
    if (!onPlayerCheckRequested) throw new Error("player callback is not initialized");
    onPlayerCheckRequested(trigger);
  };

  return {
    start,
    switchToDiscover,
    switchToPlayer,
    stop,
    emitDiscoverTrigger,
    emitPlayerTrigger,
  };
};

// elementsドメインテスト用コンテキストを作る関数
const createElementsDomainTestContext = () => {
  let resolvedSnapshot = createSnapshot();
  const setResolvedSnapshot = (nextSnapshot: TestElementsSnapshot): void => {
    resolvedSnapshot = nextSnapshot;
  };

  let pageGeneration = 5;
  const setPageGeneration = (nextGeneration: number): void => {
    pageGeneration = nextGeneration;
  };

  const pageState = {
    url: "https://www.nicovideo.jp/watch/sm9",
    isWatchPage: true,
    generation: 5,
  };
  const elementsState = {
    lastResolvedGeneration: 10,
    lastResolvedAt: null as number | null,
  };

  const elementsPatch = vi.fn((partial: Partial<typeof elementsState>) => {
    Object.assign(elementsState, partial);
  });
  const resolve = <K extends SelectorKey>(key: K): SelectorElementMap[K] | null =>
    resolvedSnapshot[key] as SelectorElementMap[K] | null;
  const invalidateAll = vi.fn();

  let pageUrlChangedListener: ((payload: AppEventMap["PageUrlChanged"]) => void) | null = null;
  const unsubscribePageUrlChanged = vi.fn();

  const eventRegistryEmit = vi.fn();
  const eventRegistryOn = vi.fn(
    <K extends AppEventKey>(params: {
      target: EventTarget;
      key: string;
      eventKey: K;
      listener: (payload: AppEventMap[K]) => void;
      options?: AddEventListenerOptions;
    }) => {
      if (params.eventKey === "PageUrlChanged") {
        pageUrlChangedListener = params.listener as (payload: AppEventMap["PageUrlChanged"]) => void;
      }
      return unsubscribePageUrlChanged;
    },
  );

  const emitPageUrlChanged = (payload: AppEventMap["PageUrlChanged"]): void => {
    if (!pageUrlChangedListener) throw new Error("PageUrlChanged listener is not initialized");
    pageUrlChangedListener(payload);
  };

  const eventRegistry = {
    on: eventRegistryOn,
    emit: eventRegistryEmit,
    off: vi.fn(() => false),
    clear: vi.fn(),
    size: vi.fn(() => 0),
  } as AppEventRegistry;

  const observerRegistry = {
    observe: vi.fn(() => ({ disconnect: vi.fn() }) as unknown as MutationObserver),
    disconnect: vi.fn(() => false),
    disconnectAll: vi.fn(),
    size: vi.fn(() => 0),
  } as AppObserverRegistry;

  const context: AppContext = {
    config: createAppConfig(),
    eventRegistry,
    observerRegistry,
    state: {
      page: { get: () => ({ ...pageState, generation: pageGeneration }) },
      elements: { get: () => ({ ...elementsState }) },
      status: { get: () => ({ playbackStatus: "idle" as const }) },
      time: { get: () => ({ currentTime: 0, duration: 0 }) },
      pip: { get: () => ({ enabled: false, reason: "unknown" as const }) },
      info: { get: () => ({ title: null, videoId: null }) },
    },
    elementResolver: {
      resolve,
      peek: vi.fn(() => null),
      invalidate: vi.fn(),
      invalidateAll,
    },
    httpClient: createForbiddenHttpClient("elements domain tests"),
  };

  const stateWriters: AppStateWriters = {
    page: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    elements: { set: vi.fn(), patch: elementsPatch, reset: vi.fn() },
    status: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    time: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    pip: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    info: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
  };

  return {
    context,
    stateWriters,
    resolve,
    invalidateAll,
    eventRegistryOn,
    eventRegistryEmit,
    elementsPatch,
    unsubscribePageUrlChanged,
    setResolvedSnapshot,
    setPageGeneration,
    emitPageUrlChanged,
  };
};

describe("elementsドメイン", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(async () => {
    vi.resetModules();
    loggerMockHarness = createTsSimpleLoggerMockHarness();
    vi.doMock("@main/adapter/dom/video-element-observer", async () => ({
      createVideoElementObserver: createVideoElementObserverMock,
    }));
    vi.doMock("@matumo/ts-simple-logger", () => loggerMockHarness.createModuleFactory());
    ({ createElementsDomain } = await import("@main/domain/elements"));

    loggerMockHarness.clearLoggerCalls();
    createVideoElementObserverMock.mockReset();
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreGlobalDescriptors(globalDescriptors);
  });

  test("init/start/stopでobserver初期化とPageUrlChanged購読を行うこと", async () => {
    const {
      context,
      stateWriters,
      eventRegistryOn,
      unsubscribePageUrlChanged,
    } = createElementsDomainTestContext();
    const {
      start,
      stop,
      emitDiscoverTrigger,
    } = prepareVideoElementObserverMock();
    const domain = createElementsDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    await domain.init(context, stateWriters);
    await domain.start();
    emitDiscoverTrigger("initial-start");
    await domain.stop();

    expect(createVideoElementObserverMock).toHaveBeenCalledWith({
      observerRegistry: context.observerRegistry,
      onDiscoverCheckRequested: expect.any(Function),
      onPlayerCheckRequested: expect.any(Function),
    });
    expect(eventRegistryOn).toHaveBeenCalledWith({
      target: globalThis,
      key: "domain:elements:page-url-changed",
      eventKey: "PageUrlChanged",
      listener: expect.any(Function),
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(unsubscribePageUrlChanged).toHaveBeenCalledTimes(1);
  });

  test("差分あり時のみElementsUpdatedを通知しpayloadをfreezeすること", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
      elementsPatch,
      invalidateAll,
      setResolvedSnapshot,
      setPageGeneration,
    } = createElementsDomainTestContext();
    const {
      emitDiscoverTrigger,
      switchToPlayer,
    } = prepareVideoElementObserverMock();
    const domain = createElementsDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    const commentToggleButton = { nodeType: 1 } as unknown as HTMLButtonElement;
    const playerContainer = { nodeType: 1 } as unknown as HTMLDivElement;
    setResolvedSnapshot(createSnapshot({
      commentToggleButton,
      playerContainer,
    }));
    setPageGeneration(7);

    await domain.init(context, stateWriters);
    await domain.start();
    emitDiscoverTrigger("discover-mutation");

    expect(invalidateAll).toHaveBeenCalledTimes(1);
    expect(switchToPlayer).toHaveBeenCalledWith(playerContainer);
    expect(elementsPatch).toHaveBeenCalledWith({
      lastResolvedGeneration: 11,
      lastResolvedAt: expect.any(Number),
    });
    expect(eventRegistryEmit).toHaveBeenCalledTimes(1);
    expect(eventRegistryEmit).toHaveBeenCalledWith({
      target: globalThis,
      eventKey: "ElementsUpdated",
      payload: expect.any(Object),
    });

    const payload = eventRegistryEmit.mock.calls[0][0].payload as AppEventMap["ElementsUpdated"];
    expect(payload.pageGeneration).toBe(7);
    expect(payload.elementsGeneration).toBe(11);
    expect(payload.changedKeys).toEqual(["commentToggleButton", "playerContainer"]);
    expect(payload.snapshot.commentToggleButton).toBe(commentToggleButton);
    expect(payload.snapshot.playerContainer).toBe(playerContainer);
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.changedKeys)).toBe(true);
    expect(Object.isFrozen(payload.snapshot)).toBe(true);

    // 同一要素（前回との差分なし）の場合は通知しない
    eventRegistryEmit.mockClear();
    elementsPatch.mockClear();
    emitDiscoverTrigger("discover-mutation");
    expect(eventRegistryEmit).not.toHaveBeenCalled();
    expect(elementsPatch).not.toHaveBeenCalled();
  });

  test("PageUrlChanged受信時はdiscoverへ戻して再同期すること", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
      setResolvedSnapshot,
      emitPageUrlChanged,
    } = createElementsDomainTestContext();
    const {
      emitDiscoverTrigger,
      switchToDiscover,
    } = prepareVideoElementObserverMock();
    const domain = createElementsDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    const playerContainer = { nodeType: 1 } as unknown as HTMLDivElement;
    setResolvedSnapshot(createSnapshot({ playerContainer }));

    await domain.init(context, stateWriters);
    await domain.start();
    emitDiscoverTrigger("discover-mutation");

    // URL変更後はplayerContainerが消えた想定に切り替える
    setResolvedSnapshot(createSnapshot({ playerContainer: null }));
    emitPageUrlChanged({
      url: "https://www.nicovideo.jp/watch/sm10",
      generation: 6,
      isWatchPage: true,
    });

    expect(switchToDiscover).toHaveBeenCalled();
    expect(eventRegistryEmit).toHaveBeenCalledTimes(2);

    const payload = eventRegistryEmit.mock.calls[1][0].payload as AppEventMap["ElementsUpdated"];
    expect(payload.changedKeys).toContain("playerContainer");
    expect(payload.snapshot.playerContainer).toBeNull();
  });

  test("PageUrlChanged受信時に非watchなら監視停止と空スナップショット通知を行うこと", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
      setResolvedSnapshot,
      emitPageUrlChanged,
    } = createElementsDomainTestContext();
    const {
      emitDiscoverTrigger,
      stop,
      switchToDiscover,
    } = prepareVideoElementObserverMock();
    const domain = createElementsDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    const playerContainer = { nodeType: 1 } as unknown as HTMLDivElement;
    setResolvedSnapshot(createSnapshot({ playerContainer }));

    await domain.init(context, stateWriters);
    await domain.start();
    emitDiscoverTrigger("discover-mutation");

    emitPageUrlChanged({
      url: "https://www.nicovideo.jp/ranking",
      generation: 6,
      isWatchPage: false,
    });

    expect(stop).toHaveBeenCalledTimes(1);
    expect(switchToDiscover).not.toHaveBeenCalled();
    expect(eventRegistryEmit).toHaveBeenCalledTimes(2);

    const payload = eventRegistryEmit.mock.calls[1][0].payload as AppEventMap["ElementsUpdated"];
    expect(payload.changedKeys).toContain("playerContainer");
    expect(payload.snapshot.playerContainer).toBeNull();
    expect(payload.snapshot.playerMenu).toBeNull();
    expect(payload.snapshot.video).toBeNull();
  });

  test("playerContainerが消えたときはplayer監視からdiscover監視へ戻すこと", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
      setResolvedSnapshot,
    } = createElementsDomainTestContext();
    const {
      emitDiscoverTrigger,
      emitPlayerTrigger,
      switchToDiscover,
    } = prepareVideoElementObserverMock();
    const domain = createElementsDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    const playerContainer = { nodeType: 1 } as unknown as HTMLDivElement;
    setResolvedSnapshot(createSnapshot({ playerContainer }));

    await domain.init(context, stateWriters);
    await domain.start();
    emitDiscoverTrigger("discover-mutation");

    setResolvedSnapshot(createSnapshot());
    emitPlayerTrigger("player-mutation");

    expect(switchToDiscover).toHaveBeenCalledTimes(1);
    expect(eventRegistryEmit).toHaveBeenCalledTimes(2);
    const payload = eventRegistryEmit.mock.calls[1][0].payload as AppEventMap["ElementsUpdated"];
    expect(payload.changedKeys).toContain("playerContainer");
  });

  test("event targetが使えない場合はElementsUpdated通知をスキップすること", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
      elementsPatch,
      setResolvedSnapshot,
    } = createElementsDomainTestContext();
    const {
      emitDiscoverTrigger,
    } = prepareVideoElementObserverMock();
    const domain = createElementsDomain();
    const domainLogger = loggerMockHarness.resolveMockLogger("domain");

    setGlobalProperty("dispatchEvent", undefined);
    setResolvedSnapshot(createSnapshot({
      playerContainer: { nodeType: 1 } as unknown as HTMLDivElement,
    }));

    await domain.init(context, stateWriters);
    await domain.start();
    emitDiscoverTrigger("discover-mutation");
    await domain.stop();

    expect(elementsPatch).toHaveBeenCalledWith({
      lastResolvedGeneration: 11,
      lastResolvedAt: expect.any(Number),
    });
    expect(eventRegistryEmit).not.toHaveBeenCalled();
    expect(domainLogger.warn).toHaveBeenCalledWith(
      "ElementsUpdated emit skipped: global event target is unavailable",
    );
  });

  test("stop後に遅延トリガーが来た場合はwarnしてスキップすること", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
      setResolvedSnapshot,
      emitPageUrlChanged,
    } = createElementsDomainTestContext();
    const {
      emitDiscoverTrigger,
    } = prepareVideoElementObserverMock();
    const domain = createElementsDomain();
    const domainLogger = loggerMockHarness.resolveMockLogger("domain");

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setResolvedSnapshot(createSnapshot({
      playerContainer: { nodeType: 1 } as unknown as HTMLDivElement,
    }));

    await domain.init(context, stateWriters);
    await domain.start();
    await domain.stop();

    expect(() => emitDiscoverTrigger("discover-mutation")).not.toThrow();
    expect(() => emitPageUrlChanged({
      url: "https://www.nicovideo.jp/watch/sm10",
      generation: 6,
      isWatchPage: true,
    })).not.toThrow();

    expect(eventRegistryEmit).not.toHaveBeenCalled();
    const runtimeWarnCalls = domainLogger.warn.mock.calls.filter(
      (args) => args[0] === "elements runtime is not initialized",
    );
    expect(runtimeWarnCalls).toHaveLength(2);
  });

  test("init途中失敗時はstartでruntime未初期化エラーを返すこと", async () => {
    const { context, stateWriters } = createElementsDomainTestContext();
    const domain = createElementsDomain();
    const domainLogger = loggerMockHarness.resolveMockLogger("domain");

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    createVideoElementObserverMock.mockImplementationOnce(() => {
      throw new Error("observer init failed");
    });

    await expect(domain.init(context, stateWriters)).rejects.toThrow("observer init failed");
    await expect(domain.start()).rejects.toThrow("Elements domain runtime is not initialized");
    expect(domainLogger.warn).toHaveBeenCalledWith("elements runtime is not initialized");
  });

  test("init前のstopは何もせず完了すること", async () => {
    const domain = createElementsDomain();

    await expect(domain.stop()).resolves.toBeUndefined();
    expect(createVideoElementObserverMock).not.toHaveBeenCalled();
  });
});
