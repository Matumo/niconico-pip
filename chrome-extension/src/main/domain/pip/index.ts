/**
 * pipドメイン
 */
import { createPipVideoElementAdapter, type PipVideoElementAdapter } from "@main/adapter/media/pip-video-element";
import type { AppEventMap } from "@main/config/event";
import { createDomainModule, type DomainModule } from "@main/domain/create-domain-module";
import { appLoggerNames } from "@main/platform/logger";
import { getLogger } from "@matumo/ts-simple-logger";
import type { AppContext, AppStateWriters, Unsubscribe } from "@main/types/app-context";

// 実行環境へアクセスするための最小型
type BrowserGlobal = typeof globalThis & {
  addEventListener?: typeof globalThis.addEventListener;
  removeEventListener?: typeof globalThis.removeEventListener;
  dispatchEvent?: (event: Event) => boolean;
  document?: Pick<Document, "pictureInPictureElement">;
};

// pipドメイン実行時に利用するランタイム依存型
interface PipDomainRuntime {
  context: AppContext;
  stateWriters: AppStateWriters;
  pipVideoElementAdapter: PipVideoElementAdapter;
  unsubscribeElementsUpdated: Unsubscribe | null;
  unsubscribeVideoInfoChanged: Unsubscribe | null;
  enterPictureInPictureListener: EventListener | null;
  leavePictureInPictureListener: EventListener | null;
}

const log = getLogger(appLoggerNames.domain);

// globalThisをEventTargetとして扱えるか判定する関数
const resolveEventTarget = (): EventTarget | null => {
  const browserGlobal = globalThis as BrowserGlobal;
  if (typeof browserGlobal.dispatchEvent !== "function") return null;
  return browserGlobal as unknown as EventTarget;
};

// globalThisへネイティブイベントを登録できるか判定する関数
const canUseNativeEventApi = (): boolean => {
  const browserGlobal = globalThis as BrowserGlobal;
  return typeof browserGlobal.addEventListener === "function" &&
    typeof browserGlobal.removeEventListener === "function";
};

// いずれかの要素でPiPが有効か判定する関数
const hasAnyPipElement = (): boolean => {
  const browserGlobal = globalThis as BrowserGlobal;
  return !!browserGlobal.document?.pictureInPictureElement;
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

  runtime.context.eventRegistry.emit({
    target: eventTarget,
    eventKey: "PipStatusChanged",
    payload: {
      enabled,
    },
  });
  log.info(`pip status updated: enabled=${enabled} (trigger=${trigger})`);
};

// pipドメインを作成する関数
const createPipDomain = (): DomainModule => {
  const baseDomain = createDomainModule("pip", "control");
  // 実行時の情報
  let runtime: PipDomainRuntime | null = null;
  let requestExtensionPipInFlight: Promise<boolean> | null = null;

  // pipドメイン実行時に必要な依存が揃っているか確認して返す関数
  const resolveRuntime = (): PipDomainRuntime | null => {
    if (!runtime) log.warn("pip runtime is not initialized");
    return runtime;
  };

  // 拡張側PiPの再要求を多重実行しない関数
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

  // ElementsUpdated通知を受けてPiP動画要素を挿入する関数
  const handleElementsUpdated = (payload: AppEventMap["ElementsUpdated"]): void => {
    const runtime = resolveRuntime();
    if (!runtime) return;

    // TODO: 必要ならそれ以外のキーでも処理するようにする
    if (!payload.changedKeys.includes("playerContainer")) return;
    const playerContainer = payload.snapshot.playerContainer;
    if (!playerContainer) return;

    const inserted = runtime.pipVideoElementAdapter.ensureInserted(playerContainer);
    if (!inserted) {
      log.warn("pip video element insert skipped: playerContainer is unavailable");
      return;
    }

    const thumbnail = runtime.context.state.info.get().thumbnail;
    void runtime.pipVideoElementAdapter.updatePoster(thumbnail).catch((error: unknown) => {
      log.warn("pip poster update failed after element insert:", error);
    });
  };

  // VideoInfoChanged通知を受けてposterを更新する関数
  const handleVideoInfoChanged = (payload: AppEventMap["VideoInfoChanged"]): void => {
    const runtime = resolveRuntime();
    if (!runtime) return;

    // TODO: 同じURLは省く処理を入れる

    void runtime.pipVideoElementAdapter.updatePoster(payload.thumbnail).catch((error: unknown) => {
      log.warn("pip poster update failed:", error);
    });
  };

  // PiP開始イベントを処理する関数
  const handleEnterPictureInPicture = (event: Event): void => {
    const runtime = resolveRuntime();
    if (!runtime) return;

    // 他要素がPiPを開始した場合は、拡張側のPiPへ即時で開き直す
    if (!runtime.pipVideoElementAdapter.isOwnPictureInPictureElement(event.target)) {
      log.info("foreign PiP detected, requesting extension PiP");
      requestExtensionPictureInPicture(runtime, "enterpictureinpicture:foreign");
      return;
    }

    syncPipEnabled(runtime, true, "enterpictureinpicture");
  };

  // PiP終了イベントを処理する関数
  const handleLeavePictureInPicture = (_: Event): void => {
    const runtime = resolveRuntime();
    if (!runtime) return;
    syncPipEnabled(
      runtime,
      runtime.pipVideoElementAdapter.isOwnPictureInPictureElement(),
      "leavepictureinpicture",
    );
  };

  return {
    ...baseDomain,
    // pipドメインを初期化する関数
    init: async (nextContext, nextStateWriters): Promise<void> => {
      await baseDomain.init(nextContext, nextStateWriters);
      requestExtensionPipInFlight = null;

      const pipVideoElementAdapter = createPipVideoElementAdapter({
        elementId: nextContext.config.pipVideoElementId,
        canvasWidth: nextContext.config.videoPipCanvasWidth,
        canvasHeight: nextContext.config.videoPipCanvasHeight,
      });

      let unsubscribeElementsUpdated: Unsubscribe | null = null;
      let unsubscribeVideoInfoChanged: Unsubscribe | null = null;
      const eventTarget = resolveEventTarget();
      if (eventTarget) {
        unsubscribeElementsUpdated = nextContext.eventRegistry.on({
          target: eventTarget,
          key: "domain:pip:elements-updated",
          eventKey: "ElementsUpdated",
          listener: (payload) => {
            handleElementsUpdated(payload);
          },
        });
        unsubscribeVideoInfoChanged = nextContext.eventRegistry.on({
          target: eventTarget,
          key: "domain:pip:video-info-changed",
          eventKey: "VideoInfoChanged",
          listener: (payload) => {
            handleVideoInfoChanged(payload);
          },
        });
      } else {
        log.warn("pip event listen skipped: global event target is unavailable");
      }

      runtime = {
        context: nextContext,
        stateWriters: nextStateWriters,
        pipVideoElementAdapter,
        unsubscribeElementsUpdated,
        unsubscribeVideoInfoChanged,
        enterPictureInPictureListener: null,
        leavePictureInPictureListener: null,
      };
      log.debug("pip domain init completed");
    },
    // pipドメインを開始する関数
    start: async (): Promise<void> => {
      await baseDomain.start();
      const runtime = resolveRuntime();
      if (!runtime) throw new Error("Pip domain runtime is not initialized");

      if (canUseNativeEventApi()) {
        runtime.enterPictureInPictureListener = (event: Event) => {
          handleEnterPictureInPicture(event);
        };
        runtime.leavePictureInPictureListener = (event: Event) => {
          handleLeavePictureInPicture(event);
        };
        globalThis.addEventListener("enterpictureinpicture", runtime.enterPictureInPictureListener);
        globalThis.addEventListener("leavepictureinpicture", runtime.leavePictureInPictureListener);
      } else {
        log.warn("pip native event listen skipped: addEventListener/removeEventListener is unavailable");
      }

      const ownPipEnabled = runtime.pipVideoElementAdapter.isOwnPictureInPictureElement();
      syncPipEnabled(runtime, ownPipEnabled, "initial-start");
      if (!ownPipEnabled && hasAnyPipElement()) {
        log.info("foreign PiP detected on initial-start, requesting extension PiP");
        requestExtensionPictureInPicture(runtime, "initial-start:foreign");
      }
      log.debug("pip domain start completed");
    },
    // pipドメインを停止する関数
    stop: async (): Promise<void> => {
      if (runtime) {
        log.debug("pip domain stopping");
        if (canUseNativeEventApi()) {
          if (runtime.enterPictureInPictureListener) {
            globalThis.removeEventListener("enterpictureinpicture", runtime.enterPictureInPictureListener);
          }
          if (runtime.leavePictureInPictureListener) {
            globalThis.removeEventListener("leavepictureinpicture", runtime.leavePictureInPictureListener);
          }
        }
        runtime.unsubscribeElementsUpdated?.();
        runtime.unsubscribeVideoInfoChanged?.();
        runtime.pipVideoElementAdapter.stop();
        runtime.stateWriters.pip.patch({ enabled: false });
      }
      requestExtensionPipInFlight = null;
      runtime = null;
      await baseDomain.stop();
    },
  };
};

// エクスポート
export { createPipDomain };
