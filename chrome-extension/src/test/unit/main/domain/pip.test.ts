/**
 * pipドメインテスト
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
  PipRenderer,
} from "@main/adapter/media/pip-renderer";
import type {
  CreatePipStreamOptions,
  PipStream,
} from "@main/adapter/media/pip-stream";
import type {
  CreatePipVideoElementAdapterOptions,
  PipVideoElementAdapter,
} from "@main/adapter/media/pip-video-element";
import type { SelectorElementMap, SelectorKey } from "@main/config/selector";
import { createForbiddenHttpClient } from "@test/unit/main/shared/http-client";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";
import { createTsSimpleLoggerMockHarness, type TsSimpleLoggerMockHarness } from "@test/unit/main/shared/logger";

const createPipVideoElementAdapterMock = vi.fn();
const createPipRendererMock = vi.fn();
const createPipStreamMock = vi.fn();
let createPipDomain: typeof import("@main/domain/pip").createPipDomain;
let loggerMockHarness: TsSimpleLoggerMockHarness;

// テスト中に差し替えるglobalThisプロパティの一覧
const globalPropertyKeys = ["dispatchEvent", "addEventListener", "removeEventListener", "document"] as const;

// テスト用のElementsUpdatedスナップショット型
type TestElementsSnapshot = {
  [K in SelectorKey]: SelectorElementMap[K] | null;
};

// 空のElementsUpdatedスナップショットを作る関数
const createEmptyElementsSnapshot = (overrides: Partial<TestElementsSnapshot> = {}): TestElementsSnapshot => ({
  commentToggleButton: null,
  fullscreenToggleButton: null,
  playerContainer: null,
  playerMenu: null,
  video: null,
  commentsCanvas: null,
  ...overrides,
});

// PiP動画要素アダプターモックを準備する関数
const preparePipVideoElementAdapterMock = () => {
  const pipElement = Object.assign(new EventTarget(), {
    hidden: true,
  }) as unknown as HTMLVideoElement;
  const updatePipVideoPlacement = vi.fn(() => true);
  const updateSize = vi.fn(() => true);
  const updatePoster = vi.fn(async () => true);
  const requestPictureInPicture = vi.fn(async () => true);
  const isOwnPictureInPictureElement = vi.fn(() => false);
  const stop = vi.fn();

  createPipVideoElementAdapterMock.mockImplementation(
    (_: CreatePipVideoElementAdapterOptions): PipVideoElementAdapter => ({
      getElement: () => pipElement,
      updatePipVideoPlacement,
      updateSize,
      updatePoster,
      requestPictureInPicture,
      isOwnPictureInPictureElement,
      stop,
    }),
  );

  return {
    pipElement,
    updatePipVideoPlacement,
    updateSize,
    updatePoster,
    requestPictureInPicture,
    isOwnPictureInPictureElement,
    stop,
  };
};

// PiPレンダラーモックを準備する関数
const preparePipRendererMock = () => {
  const setSources = vi.fn();
  const drawFrame = vi.fn(() => true);

  createPipRendererMock.mockImplementation(
    (): PipRenderer => ({
      setSources,
      drawFrame,
    }),
  );

  return {
    setSources,
    drawFrame,
  };
};

// PiPストリームモックを準備する関数
const preparePipStreamMock = () => {
  let running = false;
  const start = vi.fn(() => {
    running = true;
    return true;
  });
  const stop = vi.fn(() => {
    running = false;
  });
  const teardown = vi.fn(() => {
    running = false;
  });
  const isRunning = vi.fn(() => running);

  createPipStreamMock.mockImplementation(
    (_: CreatePipStreamOptions): PipStream => ({
      start,
      stop,
      teardown,
      isRunning,
    }),
  );

  return {
    start,
    stop,
    teardown,
    isRunning,
  };
};

// ネイティブイベントAPIモックを作る関数
const createNativeEventApiMock = () => {
  const listenerMap = new Map<string, EventListener>();
  const addEventListener = vi.fn((eventName: string, listener: EventListener) => {
    listenerMap.set(eventName, listener);
  });
  const removeEventListener = vi.fn((eventName: string, listener: EventListener) => {
    const registered = listenerMap.get(eventName);
    if (registered === listener) listenerMap.delete(eventName);
  });

  const dispatch = (eventName: string, event: Event = new Event(eventName)): void => {
    const listener = listenerMap.get(eventName);
    listener?.(event);
  };

  return {
    addEventListener,
    removeEventListener,
    dispatch,
    getListener: (eventName: string) => listenerMap.get(eventName) ?? null,
  };
};

// pipドメインテスト用コンテキストを作る関数
const createPipDomainTestContext = () => {
  const config = createAppConfig();
  const pipState = {
    enabled: false,
  };
  const infoState = {
    title: null as string | null,
    author: null as string | null,
    thumbnail: "https://example.test/default-thumbnail.jpg",
    pageGeneration: 0,
    infoGeneration: 0,
  };

  let elementsUpdatedListener: ((payload: AppEventMap["ElementsUpdated"]) => void) | null = null;
  let videoInfoChangedListener: ((payload: AppEventMap["VideoInfoChanged"]) => void) | null = null;
  let pageUrlChangedListener: ((payload: AppEventMap["PageUrlChanged"]) => void) | null = null;
  const unsubscribePageUrlChanged = vi.fn();
  const unsubscribeElementsUpdated = vi.fn();
  const unsubscribeVideoInfoChanged = vi.fn();

  const eventRegistryEmit = vi.fn();
  const eventRegistryOn = vi.fn(
    <K extends AppEventKey>(params: {
      target: EventTarget;
      key: string;
      eventKey: K;
      listener: (payload: AppEventMap[K]) => void;
      options?: AddEventListenerOptions;
    }) => {
      if (params.eventKey === "ElementsUpdated") {
        elementsUpdatedListener = params.listener as (payload: AppEventMap["ElementsUpdated"]) => void;
        return unsubscribeElementsUpdated;
      }
      if (params.eventKey === "VideoInfoChanged") {
        videoInfoChangedListener = params.listener as (payload: AppEventMap["VideoInfoChanged"]) => void;
        return unsubscribeVideoInfoChanged;
      }
      if (params.eventKey === "PageUrlChanged") {
        pageUrlChangedListener = params.listener as (payload: AppEventMap["PageUrlChanged"]) => void;
        return unsubscribePageUrlChanged;
      }
      return () => undefined;
    },
  );

  const emitElementsUpdated = (payload: AppEventMap["ElementsUpdated"]): void => {
    if (!elementsUpdatedListener) throw new Error("ElementsUpdated listener is not initialized");
    elementsUpdatedListener(payload);
  };
  const emitVideoInfoChanged = (payload: AppEventMap["VideoInfoChanged"]): void => {
    if (!videoInfoChangedListener) throw new Error("VideoInfoChanged listener is not initialized");
    videoInfoChangedListener(payload);
  };
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

  const observerRegistryObserve = vi.fn((_: {
    key: string;
    target: Node;
    callback: MutationCallback;
    options: MutationObserverInit;
  }) => ({ disconnect: vi.fn() }) as unknown as MutationObserver);
  const observerRegistryDisconnect = vi.fn(() => false);
  const observerRegistry = {
    observe: observerRegistryObserve,
    disconnect: observerRegistryDisconnect,
    disconnectAll: vi.fn(),
    size: vi.fn(() => 0),
  } as AppObserverRegistry;

  const context: AppContext = {
    config,
    eventRegistry,
    observerRegistry,
    state: {
      page: { get: () => ({ url: "", isWatchPage: true, generation: 1 }) },
      elements: { get: () => ({ lastResolvedGeneration: 0, lastResolvedAt: null }) },
      status: { get: () => ({ playbackStatus: "idle" as const }) },
      time: { get: () => ({ currentTime: 0, duration: 0 }) },
      pip: { get: () => ({ ...pipState }) },
      info: { get: () => ({ ...infoState }) },
    },
    elementResolver: {
      resolve: vi.fn(() => null),
      peek: vi.fn(() => null),
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
    },
    httpClient: createForbiddenHttpClient("pip domain tests"),
  };

  const pipPatch = vi.fn((partial: Partial<typeof pipState>) => {
    Object.assign(pipState, partial);
  });

  const stateWriters: AppStateWriters = {
    page: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    elements: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    status: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    time: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
    pip: { set: vi.fn(), patch: pipPatch, reset: vi.fn() },
    info: { set: vi.fn(), patch: vi.fn(), reset: vi.fn() },
  };

  return {
    context,
    stateWriters,
    eventRegistryOn,
    eventRegistryEmit,
    observerRegistryObserve,
    observerRegistryDisconnect,
    emitPageUrlChanged,
    emitElementsUpdated,
    emitVideoInfoChanged,
    unsubscribePageUrlChanged,
    unsubscribeElementsUpdated,
    unsubscribeVideoInfoChanged,
    pipPatch,
    pipState,
  };
};

describe("pipドメイン", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(async () => {
    vi.resetModules();
    loggerMockHarness = createTsSimpleLoggerMockHarness();
    vi.doMock("@main/adapter/media/pip-renderer", async () => ({
      createPipRenderer: createPipRendererMock,
    }));
    vi.doMock("@main/adapter/media/pip-stream", async () => ({
      createPipStream: createPipStreamMock,
    }));
    vi.doMock("@main/adapter/media/pip-video-element", async () => ({
      createPipVideoElementAdapter: createPipVideoElementAdapterMock,
    }));
    vi.doMock("@matumo/ts-simple-logger", () => loggerMockHarness.createModuleFactory());
    ({ createPipDomain } = await import("@main/domain/pip"));

    createPipVideoElementAdapterMock.mockReset();
    createPipRendererMock.mockReset();
    createPipStreamMock.mockReset();
    preparePipRendererMock();
    preparePipStreamMock();
    loggerMockHarness.clearLoggerCalls();
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreGlobalDescriptors(globalDescriptors);
  });

  test("init/start/stopで購読とネイティブイベント登録を行うこと", async () => {
    const {
      context,
      stateWriters,
      eventRegistryOn,
      unsubscribePageUrlChanged,
      unsubscribeElementsUpdated,
      unsubscribeVideoInfoChanged,
      pipPatch,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const { drawFrame } = preparePipRendererMock();
    const { teardown } = preparePipStreamMock();
    const { stop } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);

    await domain.init(context, stateWriters);
    await domain.start();
    await domain.stop();

    expect(createPipVideoElementAdapterMock).toHaveBeenCalledWith({
      elementId: context.config.pipVideoElementId,
      canvasWidth: context.config.videoPipCanvasWidth,
      canvasHeight: context.config.videoPipCanvasHeight,
    });
    expect(createPipRendererMock).toHaveBeenCalledWith();
    expect(createPipStreamMock).toHaveBeenCalledWith({
      pipVideoElement: expect.any(EventTarget),
      renderFrame: drawFrame,
      canvasWidth: context.config.videoPipCanvasWidth,
      canvasHeight: context.config.videoPipCanvasHeight,
    });
    expect(eventRegistryOn).toHaveBeenCalledWith({
      target: globalThis,
      key: "domain:pip:page-url-changed",
      eventKey: "PageUrlChanged",
      listener: expect.any(Function),
    });
    expect(eventRegistryOn).toHaveBeenCalledWith({
      target: globalThis,
      key: "domain:pip:elements-updated",
      eventKey: "ElementsUpdated",
      listener: expect.any(Function),
    });
    expect(eventRegistryOn).toHaveBeenCalledWith({
      target: globalThis,
      key: "domain:pip:video-info-changed",
      eventKey: "VideoInfoChanged",
      listener: expect.any(Function),
    });
    expect(nativeEventApi.addEventListener).toHaveBeenCalledWith("enterpictureinpicture", expect.any(Function));
    expect(nativeEventApi.addEventListener).toHaveBeenCalledWith("leavepictureinpicture", expect.any(Function));
    expect(nativeEventApi.removeEventListener).toHaveBeenCalledWith("enterpictureinpicture", expect.any(Function));
    expect(nativeEventApi.removeEventListener).toHaveBeenCalledWith("leavepictureinpicture", expect.any(Function));
    expect(unsubscribePageUrlChanged).toHaveBeenCalledTimes(1);
    expect(unsubscribeElementsUpdated).toHaveBeenCalledTimes(1);
    expect(unsubscribeVideoInfoChanged).toHaveBeenCalledTimes(1);
    expect(teardown).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(pipPatch).toHaveBeenCalledWith({ enabled: false });
  });

  test("ElementsUpdatedで挿入し、VideoInfoChangedでposter更新すること", async () => {
    const {
      context,
      stateWriters,
      emitElementsUpdated,
      emitVideoInfoChanged,
    } = createPipDomainTestContext();
    const domainLogger = loggerMockHarness.resolveMockLogger("domain");
    const { setSources } = preparePipRendererMock();
    preparePipStreamMock();
    const {
      updatePipVideoPlacement,
      updatePoster,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", vi.fn());
    setGlobalProperty("removeEventListener", vi.fn());

    await domain.init(context, stateWriters);

    const playerContainer = new EventTarget() as unknown as HTMLDivElement;
    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["playerContainer"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        playerContainer,
      })),
    });
    emitVideoInfoChanged({
      title: "title",
      author: "author",
      thumbnail: "https://example.test/updated-thumbnail.jpg",
      pageGeneration: 1,
      infoGeneration: 1,
    });

    expect(setSources).toHaveBeenCalledWith({
      video: null,
      commentsCanvas: null,
    });
    expect(updatePipVideoPlacement).toHaveBeenCalledWith(playerContainer);
    expect(domainLogger.debug).toHaveBeenCalledWith(
      "pip video element placement synced: attached=true (trigger=elements-updated)",
    );
    expect(updatePoster).toHaveBeenCalledWith("https://example.test/default-thumbnail.jpg");
    expect(updatePoster).toHaveBeenCalledWith("https://example.test/updated-thumbnail.jpg");
  });

  test("挿入失敗時はposter更新をスキップすること", async () => {
    const {
      context,
      stateWriters,
      emitElementsUpdated,
    } = createPipDomainTestContext();
    const {
      updatePipVideoPlacement,
      updatePoster,
    } = preparePipVideoElementAdapterMock();
    updatePipVideoPlacement.mockReturnValue(false);
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", vi.fn());
    setGlobalProperty("removeEventListener", vi.fn());

    await domain.init(context, stateWriters);

    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["playerContainer"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        playerContainer: new EventTarget() as unknown as HTMLDivElement,
      })),
    });

    expect(updatePipVideoPlacement).toHaveBeenCalledTimes(1);
    expect(updatePoster).not.toHaveBeenCalled();
  });

  test("other PiP検知時は直接requestPictureInPictureを要求すること", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
      pipPatch,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const {
      requestPictureInPicture,
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    isOwnPictureInPictureElement.mockReturnValue(false);
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);

    await domain.init(context, stateWriters);
    await domain.start();

    const foreignTarget = new EventTarget();
    nativeEventApi.dispatch("enterpictureinpicture", { target: foreignTarget } as Event);
    await Promise.resolve();

    expect(isOwnPictureInPictureElement).toHaveBeenLastCalledWith(foreignTarget);
    expect(requestPictureInPicture).toHaveBeenCalledTimes(1);
    expect(eventRegistryEmit).not.toHaveBeenCalled();
    expect(pipPatch).not.toHaveBeenCalledWith({ enabled: true });
  });

  test("other PiP検知が連続しても再要求はin-flight中に多重実行しないこと", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
      pipPatch,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const {
      requestPictureInPicture,
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    isOwnPictureInPictureElement.mockReturnValue(false);

    let resolveFirstRequest!: (value: boolean) => void;
    requestPictureInPicture
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => {
        resolveFirstRequest = resolve;
      }))
      .mockResolvedValueOnce(true);

    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);

    await domain.init(context, stateWriters);
    await domain.start();

    nativeEventApi.dispatch("enterpictureinpicture", { target: new EventTarget() } as Event);
    nativeEventApi.dispatch("enterpictureinpicture", { target: new EventTarget() } as Event);
    expect(requestPictureInPicture).toHaveBeenCalledTimes(1);

    resolveFirstRequest(false);
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 0);
    });

    nativeEventApi.dispatch("enterpictureinpicture", { target: new EventTarget() } as Event);
    await Promise.resolve();
    expect(requestPictureInPicture).toHaveBeenCalledTimes(2);
    expect(eventRegistryEmit).not.toHaveBeenCalled();
    expect(pipPatch).not.toHaveBeenCalledWith({ enabled: true });
  });

  test("in-flight中にstopした後で再要求Promiseが完了しても安全に終了すること", async () => {
    const {
      context,
      stateWriters,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const {
      requestPictureInPicture,
      isOwnPictureInPictureElement,
      stop,
    } = preparePipVideoElementAdapterMock();
    isOwnPictureInPictureElement.mockReturnValue(false);

    let resolveFirstRequest!: (value: boolean) => void;
    requestPictureInPicture.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
      resolveFirstRequest = resolve;
    }));

    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);

    await domain.init(context, stateWriters);
    await domain.start();

    nativeEventApi.dispatch("enterpictureinpicture", { target: new EventTarget() } as Event);
    expect(requestPictureInPicture).toHaveBeenCalledTimes(1);

    await domain.stop();
    expect(stop).toHaveBeenCalledTimes(1);

    resolveFirstRequest(false);
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 0);
    });
  });

  test("start時点で他要素PiPが有効なら拡張PiPへ切り替え要求すること", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
      pipPatch,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const {
      requestPictureInPicture,
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    isOwnPictureInPictureElement.mockReturnValue(false);
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);
    setGlobalProperty("document", {
      pictureInPictureElement: new EventTarget() as unknown as Element,
    });

    await domain.init(context, stateWriters);
    await domain.start();
    await Promise.resolve();

    expect(requestPictureInPicture).toHaveBeenCalledTimes(1);
    expect(eventRegistryEmit).not.toHaveBeenCalled();
    expect(pipPatch).not.toHaveBeenCalledWith({ enabled: true });
  });

  test("start時点で他要素PiPが有効かつ再要求失敗時も継続すること", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
      pipPatch,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const {
      requestPictureInPicture,
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    // start時点で「他要素がPiP中」かつ「拡張側への奪取リクエストが失敗する」条件を再現する
    isOwnPictureInPictureElement.mockReturnValue(false);
    requestPictureInPicture.mockResolvedValue(false);
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);
    setGlobalProperty("document", {
      pictureInPictureElement: new EventTarget() as unknown as Element,
    });

    await domain.init(context, stateWriters);
    await domain.start();
    await Promise.resolve();

    expect(requestPictureInPicture).toHaveBeenCalledTimes(1);
    expect(eventRegistryEmit).not.toHaveBeenCalled();
    expect(pipPatch).not.toHaveBeenCalledWith({ enabled: true });
  });

  test("自身PiP開始/終了時はenabledを更新し、重複enterでは追加通知しないこと", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
      pipPatch,
      pipState,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    preparePipRendererMock();
    const { start } = preparePipStreamMock();
    const {
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);

    await domain.init(context, stateWriters);
    await domain.start();

    const ownTarget = new EventTarget();
    isOwnPictureInPictureElement.mockReturnValue(true);
    nativeEventApi.dispatch("enterpictureinpicture", { target: ownTarget } as Event);
    expect(isOwnPictureInPictureElement).toHaveBeenLastCalledWith(ownTarget);
    expect(start).toHaveBeenCalledTimes(1);
    expect(pipState.enabled).toBe(true);
    expect(eventRegistryEmit).toHaveBeenCalledWith({
      target: globalThis,
      eventKey: "PipStatusChanged",
      payload: {
        enabled: true,
      },
    });

    const emitCallCountAfterEnter = eventRegistryEmit.mock.calls.length;
    // 既にenabled=trueの状態でenterが重複しても、追加通知しないことを確認する
    nativeEventApi.dispatch("enterpictureinpicture");
    expect(eventRegistryEmit.mock.calls).toHaveLength(emitCallCountAfterEnter);

    isOwnPictureInPictureElement.mockReturnValue(true);
    nativeEventApi.dispatch("leavepictureinpicture", { target: ownTarget } as Event);
    expect(isOwnPictureInPictureElement).toHaveBeenLastCalledWith(ownTarget);
    expect(pipPatch).toHaveBeenCalledWith({ enabled: false });
    expect(eventRegistryEmit).toHaveBeenLastCalledWith({
      target: globalThis,
      eventKey: "PipStatusChanged",
      payload: {
        enabled: false,
      },
    });
  });

  test("leavepictureinpictureが連続しても2回目以降は追加通知しないこと", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
      pipState,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const {
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);

    await domain.init(context, stateWriters);
    await domain.start();

    const ownTarget = new EventTarget();
    isOwnPictureInPictureElement.mockReturnValue(true);
    nativeEventApi.dispatch("enterpictureinpicture", { target: ownTarget } as Event);
    expect(pipState.enabled).toBe(true);

    isOwnPictureInPictureElement.mockReturnValue(true);
    nativeEventApi.dispatch("leavepictureinpicture", { target: ownTarget } as Event);
    expect(pipState.enabled).toBe(false);
    const emitCallCountAfterFirstLeave = eventRegistryEmit.mock.calls.length;

    nativeEventApi.dispatch("leavepictureinpicture", { target: ownTarget } as Event);
    expect(eventRegistryEmit.mock.calls).toHaveLength(emitCallCountAfterFirstLeave);
  });

  test("PiP有効中に描画ソースが変わると現在ソースだけhidden同期すること", async () => {
    const {
      context,
      stateWriters,
      emitElementsUpdated,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    preparePipRendererMock();
    const { start } = preparePipStreamMock();
    const {
      pipElement,
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);

    await domain.init(context, stateWriters);
    await domain.start();

    const ownTarget = new EventTarget();
    const videoElement = { hidden: false } as unknown as HTMLVideoElement;
    const firstCommentsCanvas = { hidden: false } as unknown as HTMLCanvasElement;
    const secondCommentsCanvas = { hidden: false } as unknown as HTMLCanvasElement;

    isOwnPictureInPictureElement.mockReturnValue(true);
    nativeEventApi.dispatch("enterpictureinpicture", { target: ownTarget } as Event);
    expect(start).toHaveBeenCalledTimes(1);

    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["video", "commentsCanvas"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        video: videoElement,
        commentsCanvas: firstCommentsCanvas,
      })),
    });
    expect(videoElement.hidden).toBe(true);
    expect(firstCommentsCanvas.hidden).toBe(true);
    expect((pipElement as HTMLVideoElement & { hidden: boolean }).hidden).toBe(false);

    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 2,
      changedKeys: ["commentsCanvas"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        video: videoElement,
        commentsCanvas: secondCommentsCanvas,
      })),
    });
    expect(videoElement.hidden).toBe(true);
    expect(firstCommentsCanvas.hidden).toBe(false);
    expect(secondCommentsCanvas.hidden).toBe(true);

    nativeEventApi.dispatch("leavepictureinpicture", { target: ownTarget } as Event);
    expect(videoElement.hidden).toBe(false);
    expect(secondCommentsCanvas.hidden).toBe(false);
    expect((pipElement as HTMLVideoElement & { hidden: boolean }).hidden).toBe(true);
  });

  test("foreign leavepictureinpictureは終了同期を行わないこと", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const { stop } = preparePipStreamMock();
    const {
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();

    isOwnPictureInPictureElement.mockReturnValue(false);
    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);

    await domain.init(context, stateWriters);
    await domain.start();

    nativeEventApi.dispatch("leavepictureinpicture", { target: new EventTarget() } as Event);

    expect(stop).not.toHaveBeenCalled();
    expect(eventRegistryEmit).not.toHaveBeenCalled();
  });

  test("ElementsUpdatedでfullscreenToggleButtonを受けたらaria-label監視を開始しstopで解除すること", async () => {
    const {
      context,
      stateWriters,
      emitElementsUpdated,
      observerRegistryObserve,
      observerRegistryDisconnect,
    } = createPipDomainTestContext();
    preparePipVideoElementAdapterMock();
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", vi.fn());
    setGlobalProperty("removeEventListener", vi.fn());

    await domain.init(context, stateWriters);
    await domain.start();

    const fullscreenToggleButton = {
      getAttribute: vi.fn(() => "全画面表示する"),
    } as unknown as HTMLButtonElement;
    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["fullscreenToggleButton"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        fullscreenToggleButton,
      })),
    });

    expect(observerRegistryObserve).toHaveBeenCalledWith({
      key: "domain:pip:fullscreen-toggle-label",
      target: fullscreenToggleButton,
      callback: expect.any(Function),
      options: {
        attributes: true,
        attributeFilter: ["aria-label"],
      },
    });

    await domain.stop();
    expect(observerRegistryDisconnect).toHaveBeenCalledWith("domain:pip:fullscreen-toggle-label");
  });

  test("fullscreenToggleButton監視は同一要素再通知と解除後callbackを安全に扱うこと", async () => {
    const {
      context,
      stateWriters,
      emitElementsUpdated,
      observerRegistryObserve,
      observerRegistryDisconnect,
    } = createPipDomainTestContext();
    preparePipVideoElementAdapterMock();
    const domain = createPipDomain();
    let ariaLabel = "全画面表示する";
    const fullscreenToggleButton = {
      getAttribute: vi.fn((attributeName: string) => {
        if (attributeName !== "aria-label") return null;
        return ariaLabel;
      }),
    } as unknown as HTMLButtonElement;

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", vi.fn());
    setGlobalProperty("removeEventListener", vi.fn());

    await domain.init(context, stateWriters);
    await domain.start();

    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["fullscreenToggleButton"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        fullscreenToggleButton,
      })),
    });
    const observerCallback = observerRegistryObserve.mock.calls[0]?.[0]?.callback as MutationCallback;

    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 2,
      changedKeys: ["fullscreenToggleButton"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        fullscreenToggleButton,
      })),
    });
    expect(observerRegistryObserve).toHaveBeenCalledTimes(1);

    observerCallback(
      [{ type: "attributes", attributeName: "data-state" } as MutationRecord],
      {} as MutationObserver,
    );

    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 3,
      changedKeys: ["fullscreenToggleButton"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        fullscreenToggleButton: null,
      })),
    });
    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 4,
      changedKeys: ["fullscreenToggleButton"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        fullscreenToggleButton: null,
      })),
    });
    expect(observerRegistryDisconnect).toHaveBeenCalledWith("domain:pip:fullscreen-toggle-label");

    ariaLabel = "全画面表示を終了";
    observerCallback(
      [{ type: "attributes", attributeName: "aria-label" } as MutationRecord],
      {} as MutationObserver,
    );

    await domain.stop();
    observerCallback(
      [{ type: "attributes", attributeName: "aria-label" } as MutationRecord],
      {} as MutationObserver,
    );
  });

  test("fullscreenToggleButtonのaria-labelが想定外ならブラウザサイズ全画面状態更新をskipすること", async () => {
    const {
      context,
      stateWriters,
      emitElementsUpdated,
    } = createPipDomainTestContext();
    preparePipVideoElementAdapterMock();
    const domain = createPipDomain();
    const fullscreenToggleButton = {
      getAttribute: vi.fn(() => "想定外ラベル"),
    } as unknown as HTMLButtonElement;

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", vi.fn());
    setGlobalProperty("removeEventListener", vi.fn());

    await domain.init(context, stateWriters);
    await domain.start();

    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["fullscreenToggleButton"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        fullscreenToggleButton,
      })),
    });
  });

  test("ブラウザサイズ全画面の開始ラベルへ変化したらown PiP中のみexitPictureInPictureすること", async () => {
    const {
      context,
      stateWriters,
      emitElementsUpdated,
      observerRegistryObserve,
    } = createPipDomainTestContext();
    const {
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();
    const exitPictureInPicture = vi.fn(async () => undefined);
    let ownPipActive = false;
    let ariaLabel = "全画面表示する";
    const fullscreenToggleButton = {
      getAttribute: vi.fn((attributeName: string) => {
        if (attributeName !== "aria-label") return null;
        return ariaLabel;
      }),
    } as unknown as HTMLButtonElement;

    isOwnPictureInPictureElement.mockImplementation(() => ownPipActive);
    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", vi.fn());
    setGlobalProperty("removeEventListener", vi.fn());
    setGlobalProperty("document", {
      exitPictureInPicture,
    });

    await domain.init(context, stateWriters);
    await domain.start();
    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["fullscreenToggleButton"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        fullscreenToggleButton,
      })),
    });

    const observerCallback = observerRegistryObserve.mock.calls[0]?.[0]?.callback as MutationCallback | undefined;
    expect(typeof observerCallback).toBe("function");

    ownPipActive = true;
    ariaLabel = "全画面表示を終了";
    observerCallback?.([{ type: "attributes", attributeName: "aria-label" } as MutationRecord], {} as MutationObserver);
    await Promise.resolve();
    expect(exitPictureInPicture).toHaveBeenCalledTimes(1);

    // 同じ状態の再通知では重複終了しないこと
    observerCallback?.([{ type: "attributes", attributeName: "aria-label" } as MutationRecord], {} as MutationObserver);
    await Promise.resolve();
    expect(exitPictureInPicture).toHaveBeenCalledTimes(1);

    // 全画面解除ラベル側へ戻っても追加終了しないこと
    ariaLabel = "全画面表示する";
    observerCallback?.([{ type: "attributes", attributeName: "aria-label" } as MutationRecord], {} as MutationObserver);
    await Promise.resolve();
    expect(exitPictureInPicture).toHaveBeenCalledTimes(1);
  });

  test("own PiP開始時にブラウザサイズ全画面中ならfullscreenToggleButtonをクリックして解除要求すること", async () => {
    const {
      context,
      stateWriters,
      emitElementsUpdated,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const {
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();
    let ariaLabel = "全画面表示する";
    const click = vi.fn();
    const fullscreenToggleButton = {
      getAttribute: vi.fn((attributeName: string) => {
        if (attributeName !== "aria-label") return null;
        return ariaLabel;
      }),
      click,
    } as unknown as HTMLButtonElement;

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);

    await domain.init(context, stateWriters);
    await domain.start();

    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["fullscreenToggleButton"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        fullscreenToggleButton,
      })),
    });

    const ownTarget = new EventTarget();
    isOwnPictureInPictureElement.mockReturnValue(true);
    ariaLabel = "全画面表示を終了";
    nativeEventApi.dispatch("enterpictureinpicture", { target: ownTarget } as Event);
    expect(click).toHaveBeenCalledTimes(1);
  });

  test("own PiP開始時にブラウザサイズ全画面解除クリックが失敗しても継続すること", async () => {
    const {
      context,
      stateWriters,
      emitElementsUpdated,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const { start } = preparePipStreamMock();
    const {
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();
    const fullscreenToggleButton = {
      getAttribute: vi.fn(() => "全画面表示を終了"),
      click: vi.fn(() => {
        throw new Error("click failed");
      }),
    } as unknown as HTMLButtonElement;

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);

    await domain.init(context, stateWriters);
    await domain.start();
    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["fullscreenToggleButton"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        fullscreenToggleButton,
      })),
    });

    isOwnPictureInPictureElement.mockReturnValue(true);
    nativeEventApi.dispatch("enterpictureinpicture", { target: new EventTarget() } as Event);

    expect(start).toHaveBeenCalledTimes(1);
  });

  test("own PiP開始時にブラウザサイズ全画面でなければクリックせずfullscreen終了だけ要求すること", async () => {
    const {
      context,
      stateWriters,
      emitElementsUpdated,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const { start } = preparePipStreamMock();
    const {
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();
    const click = vi.fn();
    const exitFullscreen = vi.fn(async () => undefined);
    const fullscreenToggleButton = {
      getAttribute: vi.fn(() => "全画面表示する"),
      click,
    } as unknown as HTMLButtonElement;

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);
    setGlobalProperty("document", {
      fullscreenElement: {} as Element,
      exitFullscreen,
    });

    await domain.init(context, stateWriters);
    await domain.start();
    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["fullscreenToggleButton"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        fullscreenToggleButton,
      })),
    });

    isOwnPictureInPictureElement.mockReturnValue(true);
    nativeEventApi.dispatch("enterpictureinpicture", { target: new EventTarget() } as Event);
    await Promise.resolve();

    expect(click).not.toHaveBeenCalled();
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  test("own PiP開始時にfullscreen終了が失敗してもstream開始失敗を含めて継続すること", async () => {
    const {
      context,
      stateWriters,
      pipPatch,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const { start } = preparePipStreamMock();
    const {
      pipElement,
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();
    const exitFullscreen = vi.fn(async () => {
      throw new Error("exit fullscreen failed");
    });
    start.mockReturnValueOnce(false);

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);
    setGlobalProperty("document", {
      fullscreenElement: {} as Element,
      exitFullscreen,
    });

    await domain.init(context, stateWriters);
    await domain.start();

    isOwnPictureInPictureElement.mockReturnValue(true);
    nativeEventApi.dispatch("enterpictureinpicture", { target: new EventTarget() } as Event);
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 0);
    });

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect((pipElement as HTMLVideoElement & { hidden: boolean }).hidden).toBe(true);
    expect(pipPatch).toHaveBeenCalledWith({ enabled: true });
  });

  test("fullscreenchangeでfullscreenElementがnullなら終了要求しないこと", async () => {
    const {
      context,
      stateWriters,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const {
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();
    const exitPictureInPicture = vi.fn(async () => undefined);

    isOwnPictureInPictureElement.mockReturnValue(true);
    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);
    setGlobalProperty("document", {
      fullscreenElement: null,
      exitPictureInPicture,
    });

    await domain.init(context, stateWriters);
    await domain.start();
    nativeEventApi.dispatch("fullscreenchange");

    expect(exitPictureInPicture).not.toHaveBeenCalled();
  });

  test("fullscreenchangeでown PiP終了要求がrejectしても継続すること", async () => {
    const {
      context,
      stateWriters,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const {
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();
    const exitPictureInPicture = vi.fn(async () => {
      throw new Error("exit pip failed");
    });

    isOwnPictureInPictureElement.mockReturnValue(true);
    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);
    setGlobalProperty("document", {
      fullscreenElement: {} as Element,
      exitPictureInPicture,
    });

    await domain.init(context, stateWriters);
    await domain.start();
    nativeEventApi.dispatch("fullscreenchange");
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 0);
    });

    expect(exitPictureInPicture).toHaveBeenCalledTimes(1);
  });

  test("fullscreenchangeでexitPictureInPicture未対応なら終了要求をskipすること", async () => {
    const {
      context,
      stateWriters,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const {
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();

    isOwnPictureInPictureElement.mockReturnValue(true);
    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);
    setGlobalProperty("document", {
      fullscreenElement: {} as Element,
    });

    await domain.init(context, stateWriters);
    await domain.start();

    expect(() => {
      nativeEventApi.dispatch("fullscreenchange");
    }).not.toThrow();
  });

  test("PageUrlChangedでwatch外へ遷移したらown PiP中のみexitPictureInPictureすること", async () => {
    const {
      context,
      stateWriters,
      emitPageUrlChanged,
    } = createPipDomainTestContext();
    const {
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();
    let ownPipActive = false;
    const exitPictureInPicture = vi.fn(async () => undefined);

    isOwnPictureInPictureElement.mockImplementation(() => ownPipActive);
    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", vi.fn());
    setGlobalProperty("removeEventListener", vi.fn());
    setGlobalProperty("document", {
      exitPictureInPicture,
    });

    await domain.init(context, stateWriters);
    await domain.start();

    emitPageUrlChanged({
      url: "https://www.nicovideo.jp/watch/sm9",
      generation: 1,
      isWatchPage: true,
    });
    await Promise.resolve();
    expect(exitPictureInPicture).toHaveBeenCalledTimes(0);

    ownPipActive = true;
    emitPageUrlChanged({
      url: "https://www.nicovideo.jp/ranking",
      generation: 2,
      isWatchPage: false,
    });
    await Promise.resolve();
    expect(exitPictureInPicture).toHaveBeenCalledTimes(1);

    ownPipActive = false;
    emitPageUrlChanged({
      url: "https://www.nicovideo.jp/tag/test",
      generation: 3,
      isWatchPage: false,
    });
    await Promise.resolve();
    expect(exitPictureInPicture).toHaveBeenCalledTimes(1);
  });

  test("設定OFF時はPageUrlChangedでwatch外へ遷移してもPiP終了を要求しないこと", async () => {
    const {
      context,
      stateWriters,
      emitPageUrlChanged,
    } = createPipDomainTestContext();
    const {
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();
    const exitPictureInPicture = vi.fn(async () => undefined);

    context.config = {
      ...context.config,
      shouldExitPipOnNonWatchPage: false,
    };
    isOwnPictureInPictureElement.mockReturnValue(true);
    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", vi.fn());
    setGlobalProperty("removeEventListener", vi.fn());
    setGlobalProperty("document", {
      exitPictureInPicture,
    });

    await domain.init(context, stateWriters);
    await domain.start();

    emitPageUrlChanged({
      url: "https://www.nicovideo.jp/ranking",
      generation: 1,
      isWatchPage: false,
    });
    await Promise.resolve();
    expect(exitPictureInPicture).not.toHaveBeenCalled();
  });

  test("init失敗後のstartはruntime未初期化エラーになること", async () => {
    const {
      context,
      stateWriters,
    } = createPipDomainTestContext();
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", vi.fn());
    setGlobalProperty("removeEventListener", vi.fn());

    createPipVideoElementAdapterMock.mockImplementationOnce(() => {
      throw new Error("adapter init failed");
    });

    await expect(domain.init(context, stateWriters)).rejects.toThrow("adapter init failed");
    await expect(domain.start()).rejects.toThrow("Pip domain runtime is not initialized");
  });

  test("dispatchEvent未対応かつ状態変化がある場合は通知emitをskipすること", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
      pipState,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const {
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    isOwnPictureInPictureElement.mockReturnValue(true);
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", undefined);
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);

    await domain.init(context, stateWriters);
    await domain.start();

    expect(pipState.enabled).toBe(true);
    expect(eventRegistryEmit).not.toHaveBeenCalled();
  });

  test("ElementsUpdatedでplayerContainerがない場合は挿入を行わないこと", async () => {
    const {
      context,
      stateWriters,
      emitElementsUpdated,
    } = createPipDomainTestContext();
    const domainLogger = loggerMockHarness.resolveMockLogger("domain");
    const {
      updatePipVideoPlacement,
      updatePoster,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", vi.fn());
    setGlobalProperty("removeEventListener", vi.fn());

    await domain.init(context, stateWriters);
    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["playerContainer"],
      snapshot: Object.freeze(createEmptyElementsSnapshot()),
    });

    expect(updatePipVideoPlacement).toHaveBeenCalledWith(null);
    expect(domainLogger.debug).toHaveBeenCalledWith(
      "pip video element placement synced: attached=false (trigger=elements-updated)",
    );
    expect(updatePoster).not.toHaveBeenCalled();
  });

  test("ElementsUpdatedでplayerContainerが変更対象に含まれない場合は挿入しないこと", async () => {
    const {
      context,
      stateWriters,
      emitElementsUpdated,
    } = createPipDomainTestContext();
    const {
      updatePipVideoPlacement,
      updatePoster,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", vi.fn());
    setGlobalProperty("removeEventListener", vi.fn());

    await domain.init(context, stateWriters);
    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["video"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        playerContainer: new EventTarget() as unknown as HTMLDivElement,
      })),
    });

    expect(updatePipVideoPlacement).not.toHaveBeenCalled();
    expect(updatePoster).not.toHaveBeenCalled();
  });

  test("poster更新がrejectした場合はcatchして継続すること", async () => {
    const {
      context,
      stateWriters,
      emitElementsUpdated,
      emitVideoInfoChanged,
    } = createPipDomainTestContext();
    const {
      updatePoster,
    } = preparePipVideoElementAdapterMock();
    updatePoster.mockRejectedValue(new Error("poster update failed"));
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", vi.fn());
    setGlobalProperty("removeEventListener", vi.fn());

    await domain.init(context, stateWriters);
    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["playerContainer"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        playerContainer: new EventTarget() as unknown as HTMLDivElement,
      })),
    });
    emitVideoInfoChanged({
      title: "title",
      author: "author",
      thumbnail: "https://example.test/updated-thumbnail.jpg",
      pageGeneration: 1,
      infoGeneration: 1,
    });
    await Promise.resolve();

    expect(updatePoster).toHaveBeenCalledTimes(2);
  });

  test("foreign PiP時にrequestPictureInPictureがfalseなら再要求失敗として継続すること", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const {
      requestPictureInPicture,
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    // 他要素PiPのenter検知時に、拡張側への再要求が失敗する条件を再現する
    isOwnPictureInPictureElement.mockReturnValue(false);
    requestPictureInPicture.mockResolvedValue(false);
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);

    await domain.init(context, stateWriters);
    await domain.start();
    nativeEventApi.dispatch("enterpictureinpicture");
    await Promise.resolve();

    expect(requestPictureInPicture).toHaveBeenCalledTimes(1);
    expect(eventRegistryEmit).not.toHaveBeenCalled();
  });

  test("foreign PiP時にrequestPictureInPictureがrejectしても継続し、次回再要求できること", async () => {
    const {
      context,
      stateWriters,
      eventRegistryEmit,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const {
      requestPictureInPicture,
      isOwnPictureInPictureElement,
    } = preparePipVideoElementAdapterMock();
    isOwnPictureInPictureElement.mockReturnValue(false);
    requestPictureInPicture
      .mockRejectedValueOnce(new Error("request failed"))
      .mockResolvedValueOnce(true);
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);

    await domain.init(context, stateWriters);
    await domain.start();

    nativeEventApi.dispatch("enterpictureinpicture");
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 0);
    });
    expect(requestPictureInPicture).toHaveBeenCalledTimes(1);

    nativeEventApi.dispatch("enterpictureinpicture");
    await Promise.resolve();
    expect(requestPictureInPicture).toHaveBeenCalledTimes(2);
    expect(eventRegistryEmit).not.toHaveBeenCalled();
  });

  test("stop後に残存リスナーが呼ばれてもruntime未初期化で処理が中断されること", async () => {
    const {
      context,
      stateWriters,
      emitElementsUpdated,
      emitVideoInfoChanged,
      emitPageUrlChanged,
      updatePipVideoPlacement,
      updatePoster,
    } = (() => {
      const base = createPipDomainTestContext();
      const adapter = preparePipVideoElementAdapterMock();
      return {
        ...base,
        updatePipVideoPlacement: adapter.updatePipVideoPlacement,
        updatePoster: adapter.updatePoster,
      };
    })();
    const nativeEventApi = createNativeEventApiMock();
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);

    await domain.init(context, stateWriters);
    await domain.start();

    const enterListener = nativeEventApi.getListener("enterpictureinpicture");
    const leaveListener = nativeEventApi.getListener("leavepictureinpicture");
    const fullscreenListener = nativeEventApi.getListener("fullscreenchange");

    await domain.stop();

    emitElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["playerContainer"],
      snapshot: Object.freeze(createEmptyElementsSnapshot({
        playerContainer: new EventTarget() as unknown as HTMLDivElement,
      })),
    });
    emitVideoInfoChanged({
      title: "title",
      author: "author",
      thumbnail: "https://example.test/updated-thumbnail.jpg",
      pageGeneration: 1,
      infoGeneration: 1,
    });
    emitPageUrlChanged({
      url: "https://www.nicovideo.jp/ranking",
      generation: 2,
      isWatchPage: false,
    });
    enterListener?.(new Event("enterpictureinpicture"));
    leaveListener?.(new Event("leavepictureinpicture"));
    fullscreenListener?.(new Event("fullscreenchange"));

    expect(updatePipVideoPlacement).not.toHaveBeenCalled();
    expect(updatePoster).not.toHaveBeenCalled();
  });

  test("stopを未初期化時と未start時に呼んでも安全に終了できること", async () => {
    const {
      context,
      stateWriters,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
    const {
      stop,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", vi.fn(() => true));
    setGlobalProperty("addEventListener", nativeEventApi.addEventListener);
    setGlobalProperty("removeEventListener", nativeEventApi.removeEventListener);

    await domain.stop();
    await domain.init(context, stateWriters);
    await domain.stop();

    expect(nativeEventApi.removeEventListener).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test("dispatchEvent未対応時は購読/通知をskipし、native API未対応でも起動継続すること", async () => {
    const {
      context,
      stateWriters,
      eventRegistryOn,
      eventRegistryEmit,
    } = createPipDomainTestContext();
    const {
      updatePipVideoPlacement,
      updatePoster,
      requestPictureInPicture,
    } = preparePipVideoElementAdapterMock();
    const domain = createPipDomain();

    setGlobalProperty("dispatchEvent", undefined);
    setGlobalProperty("addEventListener", undefined);
    setGlobalProperty("removeEventListener", undefined);

    await domain.init(context, stateWriters);
    await domain.start();

    expect(eventRegistryOn).not.toHaveBeenCalled();
    expect(eventRegistryEmit).not.toHaveBeenCalled();
    expect(updatePipVideoPlacement).not.toHaveBeenCalled();
    expect(updatePoster).not.toHaveBeenCalled();
    expect(requestPictureInPicture).not.toHaveBeenCalled();
  });
});
