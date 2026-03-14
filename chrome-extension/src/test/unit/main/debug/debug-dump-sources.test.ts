/**
 * debug dump source生成テスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createAppConfig } from "@main/config/config";
import {
  createAppContextDebugDumpSource,
  createElementsDomainDebugDumpSource,
  createPageDomainDebugDumpSource,
  createPipDomainDebugDumpSource,
  createStatusDomainDebugDumpSource,
  debugDumpSourceNames,
} from "@main/debug/debug-dump-sources";
import {
  captureGlobalDescriptors,
  restoreGlobalDescriptors,
  setGlobalProperty,
  type GlobalDescriptorMap,
} from "@test/unit/main/shared/global-property";
import type { AppContext, AppEventRegistry, AppObserverRegistry } from "@main/types/app-context";

const domSnapshotMocks = vi.hoisted(() => ({
  createElementDebugSnapshotMock: vi.fn((value: unknown) => ({ kind: "element", value })),
  createElementListDebugSnapshotMock: vi.fn((elements: Iterable<unknown>) =>
    Array.from(elements, (value) => ({ kind: "list-item", value })),
  ),
}));

vi.mock("@main/debug/debug-dump-dom-snapshot", () => ({
  createElementDebugSnapshot: domSnapshotMocks.createElementDebugSnapshotMock,
  createElementListDebugSnapshot: domSnapshotMocks.createElementListDebugSnapshotMock,
}));

const globalPropertyKeys = ["document"] as const;

const createContext = (): AppContext => {
  const eventRegistry: AppEventRegistry = {
    on: vi.fn(() => () => undefined),
    emit: vi.fn(),
    off: vi.fn(() => false),
    clear: vi.fn(),
    size: vi.fn(() => 2),
  };
  const observerRegistry: AppObserverRegistry = {
    observe: vi.fn(() => ({ disconnect: vi.fn() }) as unknown as MutationObserver),
    disconnect: vi.fn(() => false),
    disconnectAll: vi.fn(),
    size: vi.fn(() => 3),
  };

  return {
    config: createAppConfig({
      debugMode: true,
      shouldUseDebugLog: true,
      watchPageUrlPattern: /watch/,
      pipButtonElementId: "pip-button",
      pipVideoElementId: "pip-video",
      videoPipCanvasWidth: 1280,
      videoPipCanvasHeight: 720,
    }),
    debugDumpRegistry: {
      registerAppContext: vi.fn(),
      unregisterAppContext: vi.fn(),
      registerPageDomain: vi.fn(),
      unregisterPageDomain: vi.fn(),
      registerElementsDomain: vi.fn(),
      unregisterElementsDomain: vi.fn(),
      registerStatusDomain: vi.fn(),
      unregisterStatusDomain: vi.fn(),
      registerPipDomain: vi.fn(),
      unregisterPipDomain: vi.fn(),
      installTrigger: vi.fn(),
      uninstallTrigger: vi.fn(),
      clearSources: vi.fn(),
      size: vi.fn(() => 1),
      collect: vi.fn(() => ({})),
    },
    eventRegistry,
    observerRegistry,
    state: {
      page: { get: () => ({ url: "https://example.test/watch/sm9", isWatchPage: true, generation: 11 }) },
      elements: { get: () => ({ lastResolvedGeneration: 12, lastResolvedElapsedMs: 1234 }) },
      status: { get: () => ({ playbackStatus: "ready" as const }) },
      time: { get: () => ({ currentTime: 5, duration: 10 }) },
      pip: { get: () => ({ enabled: true }) },
      info: { get: () => ({
        title: "title",
        author: "author",
        thumbnail: "https://example.test/thumb.jpg",
        pageGeneration: 11,
        infoGeneration: 22,
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

describe("debug dump source生成", () => {
  let globalDescriptors: GlobalDescriptorMap<(typeof globalPropertyKeys)[number]>;

  beforeEach(() => {
    globalDescriptors = captureGlobalDescriptors(globalPropertyKeys);
    domSnapshotMocks.createElementDebugSnapshotMock.mockClear();
    domSnapshotMocks.createElementListDebugSnapshotMock.mockClear();
  });

  afterEach(() => {
    restoreGlobalDescriptors(globalDescriptors);
  });

  test("source名一覧とapp/page sourceを生成できること", () => {
    const context = createContext();

    expect(debugDumpSourceNames).toEqual({
      appContext: "app/context",
      pageDomain: "domain/page",
      elementsDomain: "domain/elements",
      statusDomain: "domain/status",
      pipDomain: "domain/pip",
    });

    expect(createAppContextDebugDumpSource(context)()).toEqual({
      config: {
        appName: "niconico-pip",
        prefixId: "com-matumo-dev-niconico-pip",
        debugMode: true,
        shouldUseDebugLog: true,
        shouldExitPipOnNonWatchPage: true,
        watchPageUrlPatternSource: "watch",
        pipButtonElementId: "pip-button",
        pipVideoElementId: "pip-video",
        videoPipCanvasWidth: 1280,
        videoPipCanvasHeight: 720,
      },
      state: {
        page: { url: "https://example.test/watch/sm9", isWatchPage: true, generation: 11 },
        elements: { lastResolvedGeneration: 12, lastResolvedElapsedMs: 1234 },
        status: { playbackStatus: "ready" },
        time: { currentTime: 5, duration: 10 },
        pip: { enabled: true },
        info: {
          title: "title",
          author: "author",
          thumbnail: "https://example.test/thumb.jpg",
          pageGeneration: 11,
          infoGeneration: 22,
        },
      },
      registrySizes: {
        debugDumpRegistry: 1,
        eventRegistry: 2,
        observerRegistry: 3,
      },
    });

    expect(createPageDomainDebugDumpSource(context, {
      resolveRuntime: () => null,
      resolveCurrentUrl: () => "https://example.test/watch/sm10",
    })()).toEqual({
      state: { url: "https://example.test/watch/sm9", isWatchPage: true, generation: 11 },
      currentUrl: "https://example.test/watch/sm10",
      lastKnownUrl: null,
    });

    const contextWithoutRegistry = createContext();
    contextWithoutRegistry.debugDumpRegistry = undefined;
    expect(createAppContextDebugDumpSource(contextWithoutRegistry)()).toMatchObject({
      registrySizes: {
        debugDumpRegistry: 0,
      },
    });
  });

  test("elements/status sourceのruntimeをdebug dump出力へ変換できること", () => {
    const context = createContext();
    const playerContainer = { id: "player-container" };
    const videoElement = { id: "video" };
    const emptySnapshot = {
      commentToggleButton: null,
      fullscreenToggleButton: null,
      playerContainer: null,
      playerMenu: null,
      video: null,
      commentsCanvas: null,
    } as const;

    const elementsSource = createElementsDomainDebugDumpSource(context, {
      resolveRuntime: () => ({
        snapshot: {
          commentToggleButton: null,
          fullscreenToggleButton: null,
          playerContainer: null,
          playerMenu: null,
          video: videoElement as never,
          commentsCanvas: null,
        },
        elementsGeneration: 99,
        activePlayerContainer: playerContainer as unknown as HTMLDivElement,
        unsubscribePageUrlChanged: () => undefined,
      }),
      createEmptySnapshot: () => emptySnapshot as never,
    });

    expect(elementsSource()).toEqual({
      state: { lastResolvedGeneration: 12, lastResolvedElapsedMs: 1234 },
      pageState: { url: "https://example.test/watch/sm9", isWatchPage: true, generation: 11 },
      elementsGeneration: 99,
      activePlayerContainer: { kind: "element", value: playerContainer },
      snapshot: {
        commentToggleButton: { kind: "element", value: null },
        fullscreenToggleButton: { kind: "element", value: null },
        playerContainer: { kind: "element", value: null },
        playerMenu: { kind: "element", value: null },
        video: { kind: "element", value: videoElement },
        commentsCanvas: { kind: "element", value: null },
      },
      subscriptions: {
        hasPageUrlChangedSubscription: true,
      },
    });

    const statusSource = createStatusDomainDebugDumpSource(context, {
      resolveRuntime: () => ({
        snapshot: {
          title: "runtime title",
          author: "runtime author",
          thumbnail: "runtime thumbnail",
        },
        infoGeneration: 30,
        pageGeneration: 40,
        unsubscribePageUrlChanged: () => undefined,
        unsubscribeElementsUpdated: null,
      }),
    });

    expect(statusSource()).toEqual({
      infoState: {
        title: "title",
        author: "author",
        thumbnail: "https://example.test/thumb.jpg",
        pageGeneration: 11,
        infoGeneration: 22,
      },
      pageState: { url: "https://example.test/watch/sm9", isWatchPage: true, generation: 11 },
      snapshot: {
        title: "runtime title",
        author: "runtime author",
        thumbnail: "runtime thumbnail",
      },
      infoGeneration: 30,
      pageGeneration: 40,
      subscriptions: {
        hasPageUrlChangedSubscription: true,
        hasElementsUpdatedSubscription: false,
      },
    });
  });

  test("elements/status sourceはruntime未初期化時にfallback値を使うこと", () => {
    const context = createContext();
    const emptySnapshot = {
      commentToggleButton: null,
      fullscreenToggleButton: null,
      playerContainer: null,
      playerMenu: null,
      video: null,
      commentsCanvas: null,
    } as const;

    const elementsSource = createElementsDomainDebugDumpSource(context, {
      resolveRuntime: () => null,
      createEmptySnapshot: () => emptySnapshot as never,
    });
    expect(elementsSource()).toEqual({
      state: { lastResolvedGeneration: 12, lastResolvedElapsedMs: 1234 },
      pageState: { url: "https://example.test/watch/sm9", isWatchPage: true, generation: 11 },
      elementsGeneration: null,
      activePlayerContainer: { kind: "element", value: null },
      snapshot: {
        commentToggleButton: { kind: "element", value: null },
        fullscreenToggleButton: { kind: "element", value: null },
        playerContainer: { kind: "element", value: null },
        playerMenu: { kind: "element", value: null },
        video: { kind: "element", value: null },
        commentsCanvas: { kind: "element", value: null },
      },
      subscriptions: {
        hasPageUrlChangedSubscription: false,
      },
    });

    const statusSource = createStatusDomainDebugDumpSource(context, {
      resolveRuntime: () => null,
    });
    expect(statusSource()).toEqual({
      infoState: {
        title: "title",
        author: "author",
        thumbnail: "https://example.test/thumb.jpg",
        pageGeneration: 11,
        infoGeneration: 22,
      },
      pageState: { url: "https://example.test/watch/sm9", isWatchPage: true, generation: 11 },
      snapshot: null,
      infoGeneration: null,
      pageGeneration: null,
      subscriptions: {
        hasPageUrlChangedSubscription: false,
        hasElementsUpdatedSubscription: false,
      },
    });
  });

  test("PiP sourceでdocument状態とruntime状態をまとめて出力できること", () => {
    const context = createContext();
    const documentPictureInPictureElement = { id: "pip-document-element" };
    const documentFullscreenElement = { id: "fullscreen-document-element" };
    const pipVideoElement = { id: "pip-video-element" };
    const sourceVideoElement = { id: "source-video-element" };
    const sourceCommentsCanvas = { id: "source-comments-canvas" };
    const fullscreenToggleButton = { id: "fullscreen-toggle-button" };
    const hiddenElementA = { id: "hidden-a" };
    const hiddenElementB = { id: "hidden-b" };
    setGlobalProperty("document", {
      pictureInPictureElement: documentPictureInPictureElement,
      fullscreenElement: documentFullscreenElement,
    });

    const source = createPipDomainDebugDumpSource(context, {
      resolveRuntime: () => ({
        pipVideoElementAdapter: {
          getElement: () => pipVideoElement as unknown as HTMLVideoElement,
          isOwnPictureInPictureElement: () => true,
        },
        pipStream: {
          isRunning: () => true,
        },
        unsubscribePageUrlChanged: () => undefined,
        unsubscribeElementsUpdated: null,
        unsubscribeVideoInfoChanged: () => undefined,
        enterPictureInPictureListener: (() => undefined) as EventListener,
        leavePictureInPictureListener: null,
        fullscreenChangeListener: (() => undefined) as EventListener,
        sourceVideoElement: sourceVideoElement as unknown as HTMLVideoElement,
        sourceCommentsCanvas: sourceCommentsCanvas as unknown as HTMLCanvasElement,
        fullscreenToggleButton: fullscreenToggleButton as unknown as HTMLButtonElement,
        browserSizeFullscreenActive: true,
        hiddenSourceElements: new Set([
          hiddenElementA as unknown as HTMLElement,
          hiddenElementB as unknown as HTMLElement,
        ]),
      }),
    });

    expect(source()).toEqual({
      pipState: { enabled: true },
      infoState: {
        title: "title",
        author: "author",
        thumbnail: "https://example.test/thumb.jpg",
        pageGeneration: 11,
        infoGeneration: 22,
      },
      ownPictureInPictureActive: true,
      pipStreamRunning: true,
      documentPictureInPictureElement: { kind: "element", value: documentPictureInPictureElement },
      documentFullscreenElement: { kind: "element", value: documentFullscreenElement },
      pipVideoElement: { kind: "element", value: pipVideoElement },
      sourceVideoElement: { kind: "element", value: sourceVideoElement },
      sourceCommentsCanvas: { kind: "element", value: sourceCommentsCanvas },
      fullscreenToggleButton: { kind: "element", value: fullscreenToggleButton },
      browserSizeFullscreenActive: true,
      hiddenSourceElements: [
        { kind: "list-item", value: hiddenElementA },
        { kind: "list-item", value: hiddenElementB },
      ],
      subscriptions: {
        hasPageUrlChangedSubscription: true,
        hasElementsUpdatedSubscription: false,
        hasVideoInfoChangedSubscription: true,
      },
      nativeListeners: {
        enterPictureInPicture: true,
        leavePictureInPicture: false,
        fullscreenChange: true,
      },
    });
  });
});
