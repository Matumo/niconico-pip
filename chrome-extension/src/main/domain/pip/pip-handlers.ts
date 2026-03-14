/**
 * pipドメイン イベント処理
 */
import type { AppEventMap } from "@main/config/event";
import { appLoggerNames } from "@main/platform/logger";
import { getLogger } from "@matumo/ts-simple-logger";
import { requestExitOwnPictureInPicture } from "./pip-fullscreen";
import { hasAnyPipElement, type PipDomainRuntime, type ResolvePipRuntime } from "./pip-runtime";
import {
  syncOwnPipPresentation,
  syncPipEnabled,
  syncSourceVisibilityForPipEnabled,
  updateRendererSources,
} from "./pip-presentation";

// fullscreen監視同期関数型
type SyncFullscreenToggleButtonObserver = (
  runtime: PipDomainRuntime,
  nextFullscreenToggleButton: HTMLButtonElement | null,
) => void;

// イベント処理生成の入力型
interface CreatePipEventHandlersOptions {
  resolveRuntime: ResolvePipRuntime;
  syncFullscreenToggleObserver: SyncFullscreenToggleButtonObserver;
}

// pipドメインイベント処理集合型
interface PipEventHandlers {
  reset(): void;
  syncInitialPipState(): void;
  handleElementsUpdated(payload: AppEventMap["ElementsUpdated"]): void;
  handleVideoInfoChanged(payload: AppEventMap["VideoInfoChanged"]): void;
  handleEnterPictureInPicture(event: Event): void;
  handleLeavePictureInPicture(event: Event): void;
  handleFullscreenChange(): void;
  handlePageUrlChanged(payload: AppEventMap["PageUrlChanged"]): void;
}

const log = getLogger(appLoggerNames.domain);

// pipドメインイベント処理を作成する関数
const createPipEventHandlers = (
  options: CreatePipEventHandlersOptions,
): PipEventHandlers => {
  // 拡張機能PiP再要求の多重実行を防ぐin-flight Promise
  let requestExtensionPipInFlight: Promise<boolean> | null = null;

  // 拡張機能PiPの再要求を多重実行しない関数
  const requestExtensionPictureInPicture = (
    runtime: PipDomainRuntime,
    trigger: string,
  ): void => {
    if (requestExtensionPipInFlight) {
      log.debug(`extension PiP request skipped: already in-flight (trigger=${trigger})`);
      return;
    }

    const requestPromise = runtime.pipVideoElementAdapter.requestPictureInPicture();
    requestExtensionPipInFlight = requestPromise;
    void requestPromise
      .then((requested) => {
        log.debug(`extension PiP request resolved: requested=${requested} (trigger=${trigger})`);
        if (!requested) {
          log.warn(`requestPictureInPicture skipped or failed for extension PiP (trigger=${trigger})`);
        }
      })
      .catch((error: unknown) => {
        log.warn(`requestPictureInPicture failed with error for extension PiP (trigger=${trigger})`, error);
      })
      .finally(() => {
        if (requestExtensionPipInFlight === requestPromise) {
          requestExtensionPipInFlight = null;
        }
      });
  };

  return {
    reset: (): void => {
      requestExtensionPipInFlight = null;
    },
    // start時点のPiP状態を評価して表示とstateを同期する関数
    syncInitialPipState: (): void => {
      const runtime = options.resolveRuntime();
      if (!runtime) return;

      const ownPipEnabled = runtime.pipVideoElementAdapter.isOwnPictureInPictureElement();
      if (ownPipEnabled) {
        syncOwnPipPresentation(runtime, true, "initial-start:own");
      }
      syncPipEnabled(runtime, ownPipEnabled, "initial-start");
      // 他要素がPiP中なら拡張機能PiPへ切り替え
      if (!ownPipEnabled && hasAnyPipElement()) {
        log.info("foreign PiP detected on initial-start, requesting extension PiP");
        requestExtensionPictureInPicture(runtime, "initial-start:foreign");
      }
    },
    // ElementsUpdated通知を受けてPiP動画要素を挿入する関数
    handleElementsUpdated: (payload: AppEventMap["ElementsUpdated"]): void => {
      const runtime = options.resolveRuntime();
      if (!runtime) return;

      // 最新の合成元要素を描画側へ反映する
      updateRendererSources(runtime, payload.snapshot);
      // 全画面トグルボタンが差し替わった場合は監視対象も同期する
      if (payload.changedKeys.includes("fullscreenToggleButton")) {
        options.syncFullscreenToggleObserver(runtime, payload.snapshot.fullscreenToggleButton);
      }
      // TODO: PiPウインドウ表示中はdummy stream時も同様に扱うかを再検討する
      // TODO: soft-fail観点で、常に hidden 状態を同期して不整合を自己修復する案も検討する
      // own PiP表示中は、合成元要素の hidden 状態も最新 snapshot に追従させる
      if (runtime.context.state.pip.get().enabled && runtime.pipStream.isRunning()) {
        syncSourceVisibilityForPipEnabled(runtime);
      }

      // TODO: 必要ならそれ以外のキーでも処理するようにする
      if (payload.changedKeys.includes("playerContainer")) {
        const playerContainer = payload.snapshot.playerContainer;
        // playerContainerが更新されたらPiP動画要素の挿入先を更新
        const updated = runtime.pipVideoElementAdapter.updatePipVideoPlacement(playerContainer);
        if (!updated) {
          log.warn("pip video element placement update failed: playerContainer is unavailable");
          return;
        }
        log.debug(`pip video element placement synced: attached=${playerContainer !== null} (trigger=elements-updated)`);

        // poster更新
        if (playerContainer === null) return;
        const thumbnail = runtime.context.state.info.get().thumbnail;
        void runtime.pipVideoElementAdapter.updatePoster(thumbnail)
          .then((updated) => {
            log.debug(`pip poster update synced: updated=${updated} (trigger=elements-updated)`);
          })
          .catch((error: unknown) => {
            log.warn("pip poster update failed after element insert:", error);
          });
      }
    },
    // VideoInfoChanged通知を受けてposterを更新する関数
    handleVideoInfoChanged: (payload: AppEventMap["VideoInfoChanged"]): void => {
      const runtime = options.resolveRuntime();
      if (!runtime) return;

      // TODO: 同じURLは省く処理を入れる
      void runtime.pipVideoElementAdapter.updatePoster(payload.thumbnail)
        .then((updated) => {
          log.debug(`pip poster update synced: updated=${updated} (trigger=video-info-changed)`);
        })
        .catch((error: unknown) => {
          log.warn("pip poster update failed:", error);
        });
    },
    // PiP開始イベントを処理する関数
    handleEnterPictureInPicture: (event: Event): void => {
      const runtime = options.resolveRuntime();
      if (!runtime) return;

      // 他要素がPiPを開始した場合は、拡張機能PiPに即時切り替え
      if (!runtime.pipVideoElementAdapter.isOwnPictureInPictureElement(event.target)) {
        log.info("foreign PiP detected, requesting extension PiP");
        requestExtensionPictureInPicture(runtime, "enterpictureinpicture:foreign");
        return;
      }

      // 表示と描画を切り替え
      syncOwnPipPresentation(runtime, true, "enterpictureinpicture:own");
      // stateとイベント通知を更新
      syncPipEnabled(runtime, true, "enterpictureinpicture");
    },
    // PiP終了イベントを処理する関数
    handleLeavePictureInPicture: (event: Event): void => {
      const runtime = options.resolveRuntime();
      if (!runtime) return;

      // 他要素のPiPが終了した場合はスキップ
      // TODO: スキップしなくても問題ないならfail-soft観点で常に同期するようにする案も検討する
      if (!runtime.pipVideoElementAdapter.isOwnPictureInPictureElement(event.target)) {
        log.debug("leavepictureinpicture ignored: event target is not own PiP element");
        return;
      }

      // 表示と描画を切り替え
      syncOwnPipPresentation(runtime, false, "leavepictureinpicture");
      // stateとイベント通知を更新
      syncPipEnabled(runtime, false, "leavepictureinpicture");
    },
    // 全画面変更イベントを処理する関数
    handleFullscreenChange: (): void => {
      const runtime = options.resolveRuntime();
      if (!runtime) return;

      const documentNode = globalThis.document;
      // fullscreen終了時は何もしない
      if (!documentNode?.fullscreenElement) {
        log.debug("fullscreenchange ignored: fullscreenElement is null");
        return;
      }
      // fullscreen開始時にown PiP終了を要求
      requestExitOwnPictureInPicture(runtime, "fullscreenchange");
    },
    // PageUrlChangedを受けてwatch外遷移時にPiP終了を要求する関数
    handlePageUrlChanged: (payload: AppEventMap["PageUrlChanged"]): void => {
      const runtime = options.resolveRuntime();
      if (!runtime) return;
      // 設定で無効ならPiP終了要求は出さない
      if (!runtime.context.config.shouldExitPipOnNonWatchPage) return;
      // watchページ継続中なら何もしない
      if (payload.isWatchPage) return;
      // PiP終了を要求
      requestExitOwnPictureInPicture(runtime, "page-url-changed:non-watch");
    },
  };
};

// エクスポート
export { createPipEventHandlers };
export type {
  CreatePipEventHandlersOptions,
  PipEventHandlers,
  SyncFullscreenToggleButtonObserver,
};
