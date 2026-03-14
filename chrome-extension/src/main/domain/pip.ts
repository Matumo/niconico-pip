/**
 * pipドメイン
 */
import { createPipRenderer } from "@main/adapter/media/pip-renderer";
import { createPipStream } from "@main/adapter/media/pip-stream";
import { createPipVideoElementAdapter } from "@main/adapter/media/pip-video-element";
import { createDomainModule, type DomainModule } from "@main/domain/shared/create-domain-module";
import { appLoggerNames } from "@main/platform/logger";
import { getLogger } from "@matumo/ts-simple-logger";
import { createPipEventHandlers } from "@main/domain/pip/pip-handlers";
import { fullscreenToggleObserverKey, syncFullscreenToggleObserver } from "@main/domain/pip/pip-fullscreen";
import { canUseNativeEventApi, resolveEventTarget, type PipDomainRuntime } from "@main/domain/pip/pip-runtime";
import { syncOwnPipPresentation } from "@main/domain/pip/pip-presentation";
import type { Unsubscribe } from "@main/types/app-context";

const log = getLogger(appLoggerNames.domain);

// pipドメインを作成する関数
const createPipDomain = (): DomainModule => {
  const baseDomain = createDomainModule("pip", "control");
  // 実行時の情報
  let runtime: PipDomainRuntime | null = null;

  // pipドメイン実行時に必要な依存が揃っているか確認して返す関数
  const resolveRuntime = (): PipDomainRuntime | null => {
    if (!runtime) log.warn("pip runtime is not initialized");
    return runtime;
  };
  const handlers = createPipEventHandlers({
    resolveRuntime,
    syncFullscreenToggleObserver: (runtime, nextFullscreenToggleButton) => {
      syncFullscreenToggleObserver({
        runtime,
        nextFullscreenToggleButton,
        resolveRuntime,
      });
    },
  });

  return {
    ...baseDomain,
    // pipドメインを初期化する関数
    init: async (nextContext, nextStateWriters): Promise<void> => {
      await baseDomain.init(nextContext, nextStateWriters);
      handlers.reset();

      const pipVideoElementAdapter = createPipVideoElementAdapter({
        elementId: nextContext.config.pipVideoElementId,
        canvasWidth: nextContext.config.videoPipCanvasWidth,
        canvasHeight: nextContext.config.videoPipCanvasHeight,
      });
      const pipRenderer = createPipRenderer();
      const pipStream = createPipStream({
        pipVideoElement: pipVideoElementAdapter.getElement(),
        renderFrame: pipRenderer.drawFrame,
        canvasWidth: nextContext.config.videoPipCanvasWidth,
        canvasHeight: nextContext.config.videoPipCanvasHeight,
      });

      // イベントリスナー登録
      let unsubscribePageUrlChanged: Unsubscribe | null = null;
      let unsubscribeElementsUpdated: Unsubscribe | null = null;
      let unsubscribeVideoInfoChanged: Unsubscribe | null = null;
      const eventTarget = resolveEventTarget();
      if (eventTarget) {
        // PageUrlChangedイベント
        unsubscribePageUrlChanged = nextContext.eventRegistry.on({
          target: eventTarget,
          key: "domain:pip:page-url-changed",
          eventKey: "PageUrlChanged",
          listener: (payload) => {
            handlers.handlePageUrlChanged(payload);
          },
        });
        // ElementsUpdatedイベント
        unsubscribeElementsUpdated = nextContext.eventRegistry.on({
          target: eventTarget,
          key: "domain:pip:elements-updated",
          eventKey: "ElementsUpdated",
          listener: (payload) => {
            handlers.handleElementsUpdated(payload);
          },
        });
        // VideoInfoChangedイベント
        unsubscribeVideoInfoChanged = nextContext.eventRegistry.on({
          target: eventTarget,
          key: "domain:pip:video-info-changed",
          eventKey: "VideoInfoChanged",
          listener: (payload) => {
            handlers.handleVideoInfoChanged(payload);
          },
        });
      } else {
        log.warn("pip event listen skipped: global event target is unavailable");
      }

      runtime = {
        context: nextContext,
        stateWriters: nextStateWriters,
        pipVideoElementAdapter,
        pipRenderer,
        pipStream,
        unsubscribePageUrlChanged,
        unsubscribeElementsUpdated,
        unsubscribeVideoInfoChanged,
        enterPictureInPictureListener: null,
        leavePictureInPictureListener: null,
        fullscreenChangeListener: null,
        sourceVideoElement: null,
        sourceCommentsCanvas: null,
        fullscreenToggleButton: null,
        browserSizeFullscreenActive: null,
        hiddenSourceElements: new Set(),
      };
      log.debug("pip domain init completed");
    },
    // pipドメインを開始する関数
    start: async (): Promise<void> => {
      await baseDomain.start();
      const runtime = resolveRuntime();
      if (!runtime) throw new Error("Pip domain runtime is not initialized");

      // ネイティブイベントのリスナー登録
      // TODO: ネイティブイベントの管理も管理する機能の追加を検討する
      if (canUseNativeEventApi()) {
        runtime.enterPictureInPictureListener = (event: Event) => {
          handlers.handleEnterPictureInPicture(event);
        };
        runtime.leavePictureInPictureListener = (event: Event) => {
          handlers.handleLeavePictureInPicture(event);
        };
        runtime.fullscreenChangeListener = () => {
          handlers.handleFullscreenChange();
        };
        globalThis.addEventListener("enterpictureinpicture", runtime.enterPictureInPictureListener);
        globalThis.addEventListener("leavepictureinpicture", runtime.leavePictureInPictureListener);
        globalThis.addEventListener("fullscreenchange", runtime.fullscreenChangeListener);
      } else {
        log.warn("pip native event listen skipped: addEventListener/removeEventListener is unavailable");
      }

      // start時点のPiP状態を評価して表示とstateを同期する
      handlers.syncInitialPipState();
      log.debug("pip domain start completed");
    },
    // pipドメインを停止する関数
    stop: async (): Promise<void> => {
      if (runtime) {
        log.debug("pip domain stopping");
        // ネイティブイベントのリスナー解除
        if (canUseNativeEventApi()) {
          if (runtime.enterPictureInPictureListener) {
            globalThis.removeEventListener("enterpictureinpicture", runtime.enterPictureInPictureListener);
          }
          if (runtime.leavePictureInPictureListener) {
            globalThis.removeEventListener("leavepictureinpicture", runtime.leavePictureInPictureListener);
          }
          if (runtime.fullscreenChangeListener) {
            globalThis.removeEventListener("fullscreenchange", runtime.fullscreenChangeListener);
          }
        }
        // fullscreenトグル監視と関連キャッシュを破棄
        runtime.context.observerRegistry.disconnect(fullscreenToggleObserverKey);
        runtime.fullscreenToggleButton = null;
        runtime.browserSizeFullscreenActive = null;
        // イベントリスナー解除
        syncOwnPipPresentation(runtime, false, "domain-stop");
        runtime.unsubscribePageUrlChanged?.();
        runtime.unsubscribeElementsUpdated?.();
        runtime.unsubscribeVideoInfoChanged?.();
        // 依存オブジェクトの後処理
        runtime.pipStream.teardown();
        runtime.pipVideoElementAdapter.stop();
        // pip stateを無効に更新
        // TODO: own PiP 有効中の stop では exitPictureInPicture() を先行要求する案も検討する
        runtime.stateWriters.pip.patch({ enabled: false });
      }
      // 進行中requestとruntime参照を破棄する
      handlers.reset();
      runtime = null;
      await baseDomain.stop();
    },
  };
};

// エクスポート
export { createPipDomain };
