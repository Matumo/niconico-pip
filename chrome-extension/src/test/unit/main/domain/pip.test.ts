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
  playerContainer: null,
  playerMenu: null,
  video: null,
  commentsCanvas: null,
  ...overrides,
});

// PiP動画要素アダプターモックを準備する関数
const preparePipVideoElementAdapterMock = () => {
  const pipElement = new EventTarget() as unknown as HTMLVideoElement;
  const ensureInserted = vi.fn(() => true);
  const updateSize = vi.fn(() => true);
  const updatePoster = vi.fn(async () => true);
  const requestPictureInPicture = vi.fn(async () => true);
  const isOwnPictureInPictureElement = vi.fn(() => false);
  const stop = vi.fn();

  createPipVideoElementAdapterMock.mockImplementation(
    (_: CreatePipVideoElementAdapterOptions): PipVideoElementAdapter => ({
      getElement: () => pipElement,
      ensureInserted,
      updateSize,
      updatePoster,
      requestPictureInPicture,
      isOwnPictureInPictureElement,
      stop,
    }),
  );

  return {
    pipElement,
    ensureInserted,
    updateSize,
    updatePoster,
    requestPictureInPicture,
    isOwnPictureInPictureElement,
    stop,
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
    emitElementsUpdated,
    emitVideoInfoChanged,
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
    vi.doMock("@main/adapter/media/pip-video-element", async () => ({
      createPipVideoElementAdapter: createPipVideoElementAdapterMock,
    }));
    vi.doMock("@matumo/ts-simple-logger", () => loggerMockHarness.createModuleFactory());
    ({ createPipDomain } = await import("@main/domain/pip"));

    createPipVideoElementAdapterMock.mockReset();
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
      unsubscribeElementsUpdated,
      unsubscribeVideoInfoChanged,
      pipPatch,
    } = createPipDomainTestContext();
    const nativeEventApi = createNativeEventApiMock();
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
    expect(unsubscribeElementsUpdated).toHaveBeenCalledTimes(1);
    expect(unsubscribeVideoInfoChanged).toHaveBeenCalledTimes(1);
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
    const {
      ensureInserted,
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

    expect(ensureInserted).toHaveBeenCalledWith(playerContainer);
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
      ensureInserted,
      updatePoster,
    } = preparePipVideoElementAdapterMock();
    ensureInserted.mockReturnValue(false);
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

    expect(ensureInserted).toHaveBeenCalledTimes(1);
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

    isOwnPictureInPictureElement.mockReturnValue(false);
    nativeEventApi.dispatch("leavepictureinpicture", { target: ownTarget } as Event);
    expect(isOwnPictureInPictureElement).toHaveBeenLastCalledWith();
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

    isOwnPictureInPictureElement.mockReturnValue(false);
    nativeEventApi.dispatch("leavepictureinpicture", { target: ownTarget } as Event);
    expect(pipState.enabled).toBe(false);
    const emitCallCountAfterFirstLeave = eventRegistryEmit.mock.calls.length;

    nativeEventApi.dispatch("leavepictureinpicture", { target: ownTarget } as Event);
    expect(eventRegistryEmit.mock.calls).toHaveLength(emitCallCountAfterFirstLeave);
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
    const {
      ensureInserted,
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

    expect(ensureInserted).not.toHaveBeenCalled();
    expect(updatePoster).not.toHaveBeenCalled();
  });

  test("ElementsUpdatedでplayerContainerが変更対象に含まれない場合は挿入しないこと", async () => {
    const {
      context,
      stateWriters,
      emitElementsUpdated,
    } = createPipDomainTestContext();
    const {
      ensureInserted,
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

    expect(ensureInserted).not.toHaveBeenCalled();
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
      ensureInserted,
      updatePoster,
    } = (() => {
      const base = createPipDomainTestContext();
      const adapter = preparePipVideoElementAdapterMock();
      return {
        ...base,
        ensureInserted: adapter.ensureInserted,
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
    enterListener?.(new Event("enterpictureinpicture"));
    leaveListener?.(new Event("leavepictureinpicture"));

    expect(ensureInserted).not.toHaveBeenCalled();
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
      ensureInserted,
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
    expect(ensureInserted).not.toHaveBeenCalled();
    expect(updatePoster).not.toHaveBeenCalled();
    expect(requestPictureInPicture).not.toHaveBeenCalled();
  });
});
