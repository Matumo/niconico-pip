/**
 * pipドメインイベント処理テスト
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createTsSimpleLoggerMockHarness, type TsSimpleLoggerMockHarness } from "@test/unit/main/shared/logger";

const requestExitOwnPictureInPictureMock = vi.fn();
const hasAnyPipElementMock = vi.fn(() => false);
const syncOwnPipPresentationMock = vi.fn();
const syncPipEnabledMock = vi.fn();
const syncSourceVisibilityForPipEnabledMock = vi.fn();
const updateRendererSourcesMock = vi.fn();

let createPipEventHandlers: typeof import("@main/domain/pip/pip-handlers").createPipEventHandlers;
let loggerMockHarness: TsSimpleLoggerMockHarness;

const createRuntime = () => ({
  context: {
    config: {
      shouldExitPipOnNonWatchPage: true,
    },
    state: {
      pip: {
        get: () => ({ enabled: true }),
      },
      info: {
        get: () => ({ thumbnail: "https://example.test/default-thumbnail.jpg" }),
      },
    },
  },
  pipStream: {
    isRunning: vi.fn(() => true),
  },
  pipVideoElementAdapter: {
    isOwnPictureInPictureElement: vi.fn(() => false),
    requestPictureInPicture: vi.fn(async () => true),
    updatePipVideoPlacement: vi.fn(() => true),
    updatePoster: vi.fn(async () => true),
  },
}) as unknown as import("@main/domain/pip/pip-runtime").PipDomainRuntime;

const createEmptySnapshot = () =>
  Object.freeze({
    commentToggleButton: null,
    fullscreenToggleButton: null,
    playerContainer: null,
    playerMenu: null,
    video: null,
    commentsCanvas: null,
  });

describe("pipドメインイベント処理", () => {
  beforeEach(async () => {
    vi.resetModules();
    loggerMockHarness = createTsSimpleLoggerMockHarness();
    vi.doMock("@main/domain/pip/pip-fullscreen", async () => ({
      requestExitOwnPictureInPicture: requestExitOwnPictureInPictureMock,
    }));
    vi.doMock("@main/domain/pip/pip-runtime", async () => ({
      hasAnyPipElement: hasAnyPipElementMock,
    }));
    vi.doMock("@main/domain/pip/pip-presentation", async () => ({
      syncOwnPipPresentation: syncOwnPipPresentationMock,
      syncPipEnabled: syncPipEnabledMock,
      syncSourceVisibilityForPipEnabled: syncSourceVisibilityForPipEnabledMock,
      updateRendererSources: updateRendererSourcesMock,
    }));
    vi.doMock("@matumo/ts-simple-logger", () => loggerMockHarness.createModuleFactory());
    ({ createPipEventHandlers } = await import("@main/domain/pip/pip-handlers"));

    requestExitOwnPictureInPictureMock.mockReset();
    hasAnyPipElementMock.mockReset();
    hasAnyPipElementMock.mockReturnValue(false);
    syncOwnPipPresentationMock.mockReset();
    syncPipEnabledMock.mockReset();
    syncSourceVisibilityForPipEnabledMock.mockReset();
    updateRendererSourcesMock.mockReset();
    loggerMockHarness.clearLoggerCalls();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("runtime未初期化時は各処理を何もしないで返すこと", () => {
    const handlers = createPipEventHandlers({
      resolveRuntime: () => null,
      syncFullscreenToggleObserver: vi.fn(),
    });

    handlers.syncInitialPipState();
    handlers.handleElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: [],
      snapshot: createEmptySnapshot(),
    });
    handlers.handleVideoInfoChanged({
      title: null,
      author: null,
      thumbnail: null,
      pageGeneration: 1,
      infoGeneration: 1,
    });
    handlers.handleEnterPictureInPicture(new Event("enterpictureinpicture"));
    handlers.handleLeavePictureInPicture(new Event("leavepictureinpicture"));
    handlers.handleFullscreenChange();
    handlers.handlePageUrlChanged({
      url: "https://www.nicovideo.jp/watch/sm9",
      isWatchPage: false,
      generation: 1,
    });

    expect(syncPipEnabledMock).not.toHaveBeenCalled();
    expect(updateRendererSourcesMock).not.toHaveBeenCalled();
    expect(requestExitOwnPictureInPictureMock).not.toHaveBeenCalled();
  });

  test("initial-startでforeign PiPを検知したら拡張PiPを要求すること", async () => {
    const runtime = createRuntime();
    hasAnyPipElementMock.mockReturnValue(true);
    const handlers = createPipEventHandlers({
      resolveRuntime: () => runtime,
      syncFullscreenToggleObserver: vi.fn(),
    });

    handlers.syncInitialPipState();
    await Promise.resolve();

    expect(syncOwnPipPresentationMock).not.toHaveBeenCalled();
    expect(syncPipEnabledMock).toHaveBeenCalledWith(runtime, false, "initial-start");
    expect(runtime.pipVideoElementAdapter.requestPictureInPicture).toHaveBeenCalledTimes(1);
  });

  test("reset後にin-flight完了しても内部状態を壊さないこと", async () => {
    let resolveRequest: ((value: boolean) => void) | null = null;
    const runtime = createRuntime();
    runtime.pipVideoElementAdapter.requestPictureInPicture = vi.fn(() => new Promise<boolean>((resolve) => {
      resolveRequest = resolve;
    }));
    hasAnyPipElementMock.mockReturnValue(true);
    const handlers = createPipEventHandlers({
      resolveRuntime: () => runtime,
      syncFullscreenToggleObserver: vi.fn(),
    });

    handlers.syncInitialPipState();
    handlers.reset();
    expect(resolveRequest).not.toBeNull();
    const resolveRequestValue = resolveRequest as unknown as (value: boolean) => void;
    resolveRequestValue(true);
    await Promise.resolve();
    await Promise.resolve();

    handlers.syncInitialPipState();
    await Promise.resolve();

    expect(runtime.pipVideoElementAdapter.requestPictureInPicture).toHaveBeenCalledTimes(2);
  });

  test("ElementsUpdatedでfullscreen監視、visibility同期、placement、poster更新を切り替えること", async () => {
    const runtime = createRuntime();
    const syncFullscreenToggleObserver = vi.fn();
    const handlers = createPipEventHandlers({
      resolveRuntime: () => runtime,
      syncFullscreenToggleObserver,
    });
    const fullscreenToggleButton = new EventTarget() as unknown as HTMLButtonElement;
    const playerContainer = new EventTarget() as unknown as HTMLDivElement;

    handlers.handleElementsUpdated({
      pageGeneration: 1,
      elementsGeneration: 1,
      changedKeys: ["fullscreenToggleButton", "playerContainer"],
      snapshot: Object.freeze({
        ...createEmptySnapshot(),
        fullscreenToggleButton,
        playerContainer,
      }),
    });
    await Promise.resolve();

    expect(updateRendererSourcesMock).toHaveBeenCalledWith(
      runtime,
      expect.objectContaining({
        fullscreenToggleButton,
        playerContainer,
      }),
    );
    expect(syncFullscreenToggleObserver).toHaveBeenCalledWith(runtime, fullscreenToggleButton);
    expect(syncSourceVisibilityForPipEnabledMock).toHaveBeenCalledWith(runtime);
    expect(runtime.pipVideoElementAdapter.updatePipVideoPlacement).toHaveBeenCalledWith(playerContainer);
    expect(runtime.pipVideoElementAdapter.updatePoster).toHaveBeenCalledWith("https://example.test/default-thumbnail.jpg");
  });

  test("PageUrlChangedは設定無効とwatch継続中をスキップし、non-watchだけ終了要求すること", () => {
    const runtime = createRuntime();
    const handlers = createPipEventHandlers({
      resolveRuntime: () => runtime,
      syncFullscreenToggleObserver: vi.fn(),
    });

    runtime.context.config.shouldExitPipOnNonWatchPage = false;
    handlers.handlePageUrlChanged({
      url: "https://www.nicovideo.jp/ranking",
      isWatchPage: false,
      generation: 1,
    });

    runtime.context.config.shouldExitPipOnNonWatchPage = true;
    handlers.handlePageUrlChanged({
      url: "https://www.nicovideo.jp/watch/sm9",
      isWatchPage: true,
      generation: 2,
    });
    handlers.handlePageUrlChanged({
      url: "https://www.nicovideo.jp/ranking",
      isWatchPage: false,
      generation: 3,
    });

    expect(requestExitOwnPictureInPictureMock).toHaveBeenCalledTimes(1);
    expect(requestExitOwnPictureInPictureMock).toHaveBeenCalledWith(runtime, "page-url-changed:non-watch");
  });
});
