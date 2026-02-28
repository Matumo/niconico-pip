/**
 * statusドメインテスト
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
import type { VideoInfoAdapter, VideoInfoSnapshot } from "@main/adapter/dom/video-info";
import { createForbiddenHttpClient } from "@test/unit/main/shared/http-client";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";
import { createTsSimpleLoggerMockHarness, type TsSimpleLoggerMockHarness } from "@test/unit/main/shared/logger";

const createVideoInfoAdapterMock = vi.fn();
let createStatusDomain: typeof import("@main/domain/status").createStatusDomain;
let loggerMockHarness: TsSimpleLoggerMockHarness;

// テストで差し替えるglobalThisプロパティの一覧
const globalPropertyKeys = ["dispatchEvent"] as const;

// 動画情報スナップショットを作る関数
const createVideoInfoSnapshot = (
  overrides: Partial<VideoInfoSnapshot> = {},
): VideoInfoSnapshot => ({
  title: null,
  author: null,
  thumbnail: null,
  ...overrides,
});

// VideoInfoAdapterモックを準備する関数
const prepareVideoInfoAdapterMock = () => {
  let resolvedSnapshot = createVideoInfoSnapshot();
  const setResolvedSnapshot = (nextSnapshot: VideoInfoSnapshot): void => {
    resolvedSnapshot = nextSnapshot;
  };

  const resolve = vi.fn(() => resolvedSnapshot);
  createVideoInfoAdapterMock.mockImplementation(
    (): VideoInfoAdapter => ({
      resolve,
    }),
  );

  return {
    resolve,
    setResolvedSnapshot,
  };
};

// statusドメインテスト用コンテキストを作る関数
const createStatusDomainTestContext = () => {
  const pageState = {
    url: "https://www.nicovideo.jp/watch/sm9",
    isWatchPage: false,
    generation: 1,
  };
  const setPageState = (partial: Partial<typeof pageState>): void => {
    Object.assign(pageState, partial);
  };

  const infoState = {
    title: null as string | null,
    author: null as string | null,
    thumbnail: null as string | null,
    pageGeneration: 0,
    infoGeneration: 0,
  };
  const infoPatch = vi.fn((partial: Partial<typeof infoState>) => {
    Object.assign(infoState, partial);
  });

  let pageUrlChangedListener: ((payload: AppEventMap["PageUrlChanged"]) => void) | null = null;
  let elementsUpdatedListener: ((payload: AppEventMap["ElementsUpdated"]) => void) | null = null;
  const unsubscribePageUrlChanged = vi.fn();
  const unsubscribeElementsUpdated = vi.fn();

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
        return unsubscribePageUrlChanged;
      }
      if (params.eventKey === "ElementsUpdated") {
        elementsUpdatedListener = params.listener as (payload: AppEventMap["ElementsUpdated"]) => void;
        return unsubscribeElementsUpdated;
      }
      return () => undefined;
    },
  );

  const emitPageUrlChanged = (payload: AppEventMap["PageUrlChanged"]): void => {
    if (!pageUrlChangedListener) throw new Error("PageUrlChanged listener is not initialized");
    pageUrlChangedListener(payload);
  };
  const emitElementsUpdated = (): void => {
    if (!elementsUpdatedListener) throw new Error("ElementsUpdated listener is not initialized");
    elementsUpdatedListener({} as AppEventMap["ElementsUpdated"]);
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
      page: { get: () => ({ ...pageState }) },
      elements: { get: () => ({ lastResolvedGeneration: 0, lastResolvedAt: null }) },
      status: { get: () => ({ playbackStatus: "idle" as const }) },
      time: { get: () => ({ currentTime: 0, duration: 0 }) },
      pip: { get: () => ({ enabled: false, reason: "unknown" as const }) },
      info: { get: () => ({ ...infoState }) },
    },
    elementResolver: {
      resolve: vi.fn(() => null),
      peek: vi.fn(() => null),
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
    },
    httpClient: createForbiddenHttpClient("status domain tests"),
  };

  const stateWriters: AppStateWriters = {
    page: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    elements: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    status: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    time: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    pip: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    info: { set: vi.fn(), patch: infoPatch, reset: vi.fn() },
  };

  return {
    context,
    stateWriters,
    setPageState,
    infoPatch,
    eventRegistryEmit,
    eventRegistryOn,
    unsubscribePageUrlChanged,
    unsubscribeElementsUpdated,
    emitPageUrlChanged,
    emitElementsUpdated,
  };
};

describe("statusドメイン", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(async () => {
    vi.resetModules();
    loggerMockHarness = createTsSimpleLoggerMockHarness();
    vi.doMock("@main/adapter/dom/video-info", async () => ({
      createVideoInfoAdapter: createVideoInfoAdapterMock,
    }));
    vi.doMock("@matumo/ts-simple-logger", () => loggerMockHarness.createModuleFactory());
    ({ createStatusDomain } = await import("@main/domain/status"));

    loggerMockHarness.clearLoggerCalls();
    createVideoInfoAdapterMock.mockReset();
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreGlobalDescriptors(globalDescriptors);
  });

  test("init/start/stopで購読を行い、stop後の遅延イベントは無視すること", async () => {
    const {
      context,
      stateWriters,
      eventRegistryOn,
      unsubscribePageUrlChanged,
      unsubscribeElementsUpdated,
      emitPageUrlChanged,
      emitElementsUpdated,
      infoPatch,
      eventRegistryEmit,
    } = createStatusDomainTestContext();
    prepareVideoInfoAdapterMock();
    const domain = createStatusDomain();
    const domainLogger = loggerMockHarness.resolveMockLogger("domain");

    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    await domain.init(context, stateWriters);
    await domain.start();
    await domain.stop();

    expect(createVideoInfoAdapterMock).toHaveBeenCalledTimes(1);
    expect(eventRegistryOn).toHaveBeenCalledWith({
      target: globalThis,
      key: "domain:status:page-url-changed",
      eventKey: "PageUrlChanged",
      listener: expect.any(Function),
    });
    expect(eventRegistryOn).toHaveBeenCalledWith({
      target: globalThis,
      key: "domain:status:elements-updated",
      eventKey: "ElementsUpdated",
      listener: expect.any(Function),
    });
    expect(unsubscribePageUrlChanged).toHaveBeenCalledTimes(1);
    expect(unsubscribeElementsUpdated).toHaveBeenCalledTimes(1);
    expect(infoPatch).not.toHaveBeenCalled();
    expect(eventRegistryEmit).not.toHaveBeenCalled();

    // stop後に古いイベントが遅延到達してもruntime未初期化としてスキップする
    emitPageUrlChanged({
      url: "https://www.nicovideo.jp/watch/sm9",
      generation: 2,
      isWatchPage: true,
    });
    emitElementsUpdated();
    expect(domainLogger.warn).toHaveBeenCalledWith("status runtime is not initialized");
  });

  test("init前stopは無視されること", async () => {
    const domain = createStatusDomain();
    await expect(domain.stop()).resolves.toBeUndefined();
  });

  test("watchページ開始時に動画情報を同期しVideoInfoChangedを通知すること", async () => {
    const {
      context,
      stateWriters,
      setPageState,
      infoPatch,
      eventRegistryEmit,
    } = createStatusDomainTestContext();
    const { setResolvedSnapshot } = prepareVideoInfoAdapterMock();
    const domain = createStatusDomain();

    setPageState({
      isWatchPage: true,
      generation: 5,
    });
    setResolvedSnapshot(createVideoInfoSnapshot({
      title: "watch title",
      author: "watch author",
      thumbnail: "https://example.test/watch.jpg",
    }));
    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    await domain.init(context, stateWriters);
    await domain.start();

    expect(infoPatch).toHaveBeenCalledWith({
      title: "watch title",
      author: "watch author",
      thumbnail: "https://example.test/watch.jpg",
      pageGeneration: 5,
      infoGeneration: 1,
    });
    expect(eventRegistryEmit).toHaveBeenCalledWith({
      target: globalThis,
      eventKey: "VideoInfoChanged",
      payload: expect.any(Object),
    });

    const payload = eventRegistryEmit.mock.calls[0][0].payload as AppEventMap["VideoInfoChanged"];
    expect(payload).toEqual({
      title: "watch title",
      author: "watch author",
      thumbnail: "https://example.test/watch.jpg",
      pageGeneration: 5,
      infoGeneration: 1,
    });
    expect(Object.isFrozen(payload)).toBe(true);
  });

  test("page-url-changedはgeneration差分のみでも同期できること", async () => {
    const {
      context,
      stateWriters,
      setPageState,
      infoPatch,
      eventRegistryEmit,
      emitPageUrlChanged,
    } = createStatusDomainTestContext();
    const { setResolvedSnapshot } = prepareVideoInfoAdapterMock();
    const domain = createStatusDomain();

    setPageState({
      isWatchPage: false,
      generation: 1,
    });
    setResolvedSnapshot(createVideoInfoSnapshot());
    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    await domain.init(context, stateWriters);
    await domain.start();

    infoPatch.mockClear();
    eventRegistryEmit.mockClear();

    setPageState({
      isWatchPage: true,
      generation: 2,
    });
    emitPageUrlChanged({
      url: "https://www.nicovideo.jp/watch/sm9",
      generation: 2,
      isWatchPage: true,
    });

    expect(infoPatch).toHaveBeenCalledWith({
      title: null,
      author: null,
      thumbnail: null,
      pageGeneration: 2,
      infoGeneration: 1,
    });
    expect(eventRegistryEmit).toHaveBeenCalledTimes(1);
  });

  test("non-watch遷移時は空スナップショットを通知すること", async () => {
    const {
      context,
      stateWriters,
      setPageState,
      infoPatch,
      eventRegistryEmit,
      emitPageUrlChanged,
    } = createStatusDomainTestContext();
    const { setResolvedSnapshot } = prepareVideoInfoAdapterMock();
    const domain = createStatusDomain();

    setPageState({
      isWatchPage: true,
      generation: 5,
    });
    setResolvedSnapshot(createVideoInfoSnapshot({
      title: "watch title",
      author: "watch author",
      thumbnail: "https://example.test/watch.jpg",
    }));
    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    await domain.init(context, stateWriters);
    await domain.start();

    infoPatch.mockClear();
    eventRegistryEmit.mockClear();

    setPageState({
      isWatchPage: false,
      generation: 6,
    });
    emitPageUrlChanged({
      url: "https://www.nicovideo.jp/ranking",
      generation: 6,
      isWatchPage: false,
    });

    expect(infoPatch).toHaveBeenCalledWith({
      title: null,
      author: null,
      thumbnail: null,
      pageGeneration: 6,
      infoGeneration: 2,
    });
    const payload = eventRegistryEmit.mock.calls[0][0].payload as AppEventMap["VideoInfoChanged"];
    expect(payload).toEqual({
      title: null,
      author: null,
      thumbnail: null,
      pageGeneration: 6,
      infoGeneration: 2,
    });
  });

  test("elements-updatedはwatchページ時のみ再評価し、差分なしなら通知しないこと", async () => {
    const {
      context,
      stateWriters,
      setPageState,
      infoPatch,
      eventRegistryEmit,
      emitElementsUpdated,
    } = createStatusDomainTestContext();
    const { setResolvedSnapshot } = prepareVideoInfoAdapterMock();
    const domain = createStatusDomain();
    const domainLogger = loggerMockHarness.resolveMockLogger("domain");

    setPageState({
      isWatchPage: false,
      generation: 2,
    });
    setResolvedSnapshot(createVideoInfoSnapshot({
      title: "watch title",
      author: "watch author",
      thumbnail: "https://example.test/watch.jpg",
    }));
    setGlobalProperty("dispatchEvent", vi.fn(() => true));

    await domain.init(context, stateWriters);
    await domain.start();

    // watchページ時は再評価する
    setPageState({ isWatchPage: true });
    emitElementsUpdated();
    expect(infoPatch).toHaveBeenCalledTimes(1);
    expect(eventRegistryEmit).toHaveBeenCalledTimes(1);

    // 同一スナップショットなら通知しない
    infoPatch.mockClear();
    eventRegistryEmit.mockClear();
    emitElementsUpdated();
    expect(infoPatch).not.toHaveBeenCalled();
    expect(eventRegistryEmit).not.toHaveBeenCalled();
    expect(domainLogger.debug).toHaveBeenCalledWith("video info unchanged (trigger=elements-updated)");

    // non-watchページ時は再評価しない
    setPageState({ isWatchPage: false });
    setResolvedSnapshot(createVideoInfoSnapshot({
      title: "next title",
      author: "next author",
      thumbnail: "https://example.test/next.jpg",
    }));
    emitElementsUpdated();
    expect(infoPatch).not.toHaveBeenCalled();
    expect(eventRegistryEmit).not.toHaveBeenCalled();
  });

  test("event targetが使えない場合は購読と通知をスキップしてwarnすること", async () => {
    const {
      context,
      stateWriters,
      setPageState,
      infoPatch,
      eventRegistryOn,
      eventRegistryEmit,
    } = createStatusDomainTestContext();
    const { setResolvedSnapshot } = prepareVideoInfoAdapterMock();
    const domain = createStatusDomain();
    const domainLogger = loggerMockHarness.resolveMockLogger("domain");

    setPageState({
      isWatchPage: true,
      generation: 5,
    });
    setResolvedSnapshot(createVideoInfoSnapshot({
      title: "watch title",
      author: "watch author",
      thumbnail: "https://example.test/watch.jpg",
    }));
    setGlobalProperty("dispatchEvent", undefined);

    await domain.init(context, stateWriters);
    await domain.start();

    expect(eventRegistryOn).not.toHaveBeenCalled();
    expect(infoPatch).toHaveBeenCalledTimes(1);
    expect(eventRegistryEmit).not.toHaveBeenCalled();
    expect(domainLogger.warn).toHaveBeenCalledWith(
      "status event listen skipped: global event target is unavailable",
    );
    expect(domainLogger.warn).toHaveBeenCalledWith(
      "VideoInfoChanged emit skipped: global event target is unavailable",
    );
  });

  test("init途中失敗でruntime未初期化のままstartするとエラーになること", async () => {
    const {
      context,
      stateWriters,
    } = createStatusDomainTestContext();
    const domain = createStatusDomain();
    const domainLogger = loggerMockHarness.resolveMockLogger("domain");

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    createVideoInfoAdapterMock.mockImplementationOnce(() => {
      throw new Error("video info adapter init failed");
    });

    await expect(domain.init(context, stateWriters)).rejects.toThrow("video info adapter init failed");
    await expect(domain.start()).rejects.toThrow("Status domain runtime is not initialized");
    expect(domainLogger.warn).toHaveBeenCalledWith("status runtime is not initialized");
  });
});
