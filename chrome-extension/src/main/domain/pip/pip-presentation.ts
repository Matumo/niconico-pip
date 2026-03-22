/**
 * pipドメイン 表示同期
 */
import type { AppEventMap } from "@main/config/event";
import { resolveEventTarget } from "@main/domain/shared/resolve-event-target";
import { appLoggerNames } from "@main/platform/logger";
import { getLogger } from "@matumo/ts-simple-logger";
import { requestExitBrowserSizeFullscreenForOwnPipEnter } from "./pip-fullscreen";
import type { BrowserGlobal, PipDomainRuntime } from "./pip-runtime";

const log = getLogger(appLoggerNames.domain);

// 描画ソースを更新する関数
const updateRendererSources = (
  runtime: PipDomainRuntime,
  snapshot: AppEventMap["ElementsUpdated"]["snapshot"],
): void => {
  const previousVideoElement = runtime.sourceVideoElement;
  const previousCommentsCanvas = runtime.sourceCommentsCanvas;
  runtime.sourceVideoElement = snapshot.video;
  runtime.sourceCommentsCanvas = snapshot.commentsCanvas;
  runtime.pipRenderer.setSources({
    video: runtime.sourceVideoElement,
    commentsCanvas: runtime.sourceCommentsCanvas,
  });
  log.debug(
    `pip renderer sources updated: ` +
    `videoPresent=${runtime.sourceVideoElement !== null} ` +
    `commentsPresent=${runtime.sourceCommentsCanvas !== null} ` +
    `videoChanged=${previousVideoElement !== runtime.sourceVideoElement} ` +
    `commentsChanged=${previousCommentsCanvas !== runtime.sourceCommentsCanvas}`,
  );
};

// 現在の合成元要素一覧を取得する関数
const resolveCurrentSourceElements = (runtime: PipDomainRuntime): HTMLElement[] => {
  const elements: HTMLElement[] = [];
  if (runtime.sourceVideoElement) elements.push(runtime.sourceVideoElement);
  if (runtime.sourceCommentsCanvas) elements.push(runtime.sourceCommentsCanvas);
  return elements;
};

// 現在の合成元要素だけを非表示に同期する関数
const syncSourceVisibilityForPipEnabled = (runtime: PipDomainRuntime): void => {
  const currentSources = new Set(resolveCurrentSourceElements(runtime));

  for (const element of runtime.hiddenSourceElements) {
    if (currentSources.has(element)) continue;
    element.hidden = false;
    runtime.hiddenSourceElements.delete(element);
  }

  for (const element of currentSources) {
    runtime.hiddenSourceElements.add(element);
    element.hidden = true;
  }
};

// 非表示化した要素を復帰する関数
const restoreHiddenElements = (runtime: PipDomainRuntime): void => {
  for (const element of runtime.hiddenSourceElements) {
    element.hidden = false;
  }
  runtime.hiddenSourceElements.clear();
};

// PiP動画要素の表示状態を切り替える関数
const setPipVideoElementVisible = (runtime: PipDomainRuntime, visible: boolean): void => {
  const pipVideoElement = runtime.pipVideoElementAdapter.getElement() as HTMLVideoElement & {
    hidden?: boolean;
  };
  pipVideoElement.hidden = !visible;
};

// pip state更新とイベント通知を同期する関数
const syncPipEnabled = (
  runtime: PipDomainRuntime,
  enabled: boolean,
  trigger: string,
): void => {
  const currentState = runtime.context.state.pip.get();
  if (currentState.enabled === enabled) {
    log.debug(`pip status unchanged: enabled=${enabled} (trigger=${trigger})`);
    return;
  }

  runtime.stateWriters.pip.patch({ enabled });
  const eventTarget = resolveEventTarget();
  if (!eventTarget) {
    log.warn("PipStatusChanged emit skipped: global event target is unavailable");
    return;
  }
  const changedKeys: AppEventMap["PipStatusChanged"]["changedKeys"][number][] = [];
  changedKeys.push("enabled");

  runtime.context.eventRegistry.emit({
    target: eventTarget,
    eventKey: "PipStatusChanged",
    ownerDomain: "pip",
    payload: {
      enabled,
      changedKeys: Object.freeze(changedKeys),
    },
  });
  log.info(`pip status updated: enabled=${enabled} (trigger=${trigger})`);
};

// own PiP表示状態に応じて描画と表示制御を同期する関数
const syncOwnPipPresentation = (
  runtime: PipDomainRuntime,
  enabled: boolean,
  trigger: string,
): void => {
  if (enabled) {
    // own PiP開始時
    // 全画面系を閉じる
    requestExitBrowserSizeFullscreenForOwnPipEnter(runtime, trigger);
    const browserGlobal = globalThis as BrowserGlobal;
    const documentNode = browserGlobal.document;
    if (documentNode?.fullscreenElement && typeof documentNode.exitFullscreen === "function") {
      void documentNode.exitFullscreen()
        .then(() => {
          log.debug(`exitFullscreen succeeded on own PiP enter (trigger=${trigger})`);
        })
        .catch((error: unknown) => {
          log.warn(`failed to exit fullscreen on own PiP enter (trigger=${trigger})`, error);
        });
    }
    // 描画を開始
    const started = runtime.pipStream.start();
    if (!started) {
      log.warn(`pip stream start skipped or failed (trigger=${trigger})`);
      return;
    }
    // 合成元要素の表示を切り替え
    syncSourceVisibilityForPipEnabled(runtime);
    setPipVideoElementVisible(runtime, true);
  } else {
    // own PiP終了時
    // 合成元要素の表示を切り替え
    setPipVideoElementVisible(runtime, false);
    restoreHiddenElements(runtime);
    // 描画を停止
    runtime.pipStream.stop();
  }
  log.debug(`pip presentation synced: enabled=${enabled} (trigger=${trigger})`);
};

// エクスポート
export {
  updateRendererSources,
  syncSourceVisibilityForPipEnabled,
  syncPipEnabled,
  syncOwnPipPresentation,
};
