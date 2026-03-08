/**
 * pipドメイン
 */
import { createPipRenderer, type PipRenderer } from "@main/adapter/media/pip-renderer";
import { createPipStream, type PipStream } from "@main/adapter/media/pip-stream";
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
  document?: Pick<Document, "pictureInPictureElement" | "fullscreenElement" | "exitFullscreen" | "exitPictureInPicture">;
};

// pipドメイン実行時に利用するランタイム依存型
interface PipDomainRuntime {
  // 基本依存
  context: AppContext;
  stateWriters: AppStateWriters;
  pipVideoElementAdapter: PipVideoElementAdapter;
  pipRenderer: PipRenderer;
  pipStream: PipStream;
  // イベントリスナー解除関数
  unsubscribePageUrlChanged: Unsubscribe | null;
  unsubscribeElementsUpdated: Unsubscribe | null;
  unsubscribeVideoInfoChanged: Unsubscribe | null;
  // ネイティブイベントリスナー
  enterPictureInPictureListener: EventListener | null;
  leavePictureInPictureListener: EventListener | null;
  fullscreenChangeListener: EventListener | null;
  // 現在の合成元要素
  sourceVideoElement: HTMLVideoElement | null;
  sourceCommentsCanvas: HTMLCanvasElement | null;
  // fullscreen関連の補助状態
  fullscreenToggleButton: HTMLButtonElement | null;
  browserSizeFullscreenActive: boolean | null;
  hiddenSourceElements: Set<HTMLElement>;
}

const log = getLogger(appLoggerNames.domain);
const fullscreenToggleObserverKey = "domain:pip:fullscreen-toggle-label";
const fullscreenEnterLabel = "全画面表示する";
const fullscreenLeaveLabel = "全画面表示を終了";

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

// 全画面トグルボタンのaria-labelからブラウザサイズ全画面状態を判定する関数
const resolveBrowserSizeFullscreenActive = (button: HTMLButtonElement): boolean | null => {
  const ariaLabel = button.getAttribute("aria-label");
  if (ariaLabel === fullscreenLeaveLabel) return true;
  if (ariaLabel === fullscreenEnterLabel) return false;
  return null;
};

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
  // 拡張機能PiP再要求の多重実行を防ぐin-flight Promise
  let requestExtensionPipInFlight: Promise<boolean> | null = null;

  // pipドメイン実行時に必要な依存が揃っているか確認して返す関数
  const resolveRuntime = (): PipDomainRuntime | null => {
    if (!runtime) log.warn("pip runtime is not initialized");
    return runtime;
  };

  // own PiPが有効な場合に終了を要求する関数
  const requestExitOwnPictureInPicture = (
    runtime: PipDomainRuntime,
    trigger: string,
  ): void => {
    if (!runtime.pipVideoElementAdapter.isOwnPictureInPictureElement()) {
      log.debug(`pip exit handling ignored: own PiP is not active (trigger=${trigger})`);
      return;
    }

    const documentNode = (globalThis as BrowserGlobal).document;
    if (!documentNode || typeof documentNode.exitPictureInPicture !== "function") {
      log.debug(`pip exit handling ignored: exitPictureInPicture is unavailable (trigger=${trigger})`);
      return;
    }

    void documentNode.exitPictureInPicture()
      .then(() => {
        log.debug(`exitPictureInPicture succeeded (trigger=${trigger})`);
      })
      .catch((error: unknown) => {
        log.warn(`failed to exit Picture-in-Picture (trigger=${trigger})`, error);
      });
  };

  // own PiP開始時にブラウザサイズ全画面を終了する関数
  const requestExitBrowserSizeFullscreenForOwnPipEnter = (
    runtime: PipDomainRuntime,
    trigger: string,
  ): void => {
    const fullscreenToggleButton = runtime.fullscreenToggleButton;
    if (!fullscreenToggleButton) return;

    const browserSizeFullscreenActive = resolveBrowserSizeFullscreenActive(fullscreenToggleButton);
    if (browserSizeFullscreenActive !== true) return;

    try {
      fullscreenToggleButton.click();
      log.debug(`browser-size fullscreen exit requested on own PiP enter (trigger=${trigger})`);
    } catch (error: unknown) {
      log.warn(`failed to request browser-size fullscreen exit on own PiP enter (trigger=${trigger})`, error);
    }
  };

  // ブラウザサイズ全画面状態を評価し、変化があれば反映する関数
  const syncBrowserSizeFullscreenStateFromToggle = (
    runtime: PipDomainRuntime,
    trigger: string,
  ): void => {
    const fullscreenToggleButton = runtime.fullscreenToggleButton;
    if (!fullscreenToggleButton) return;

    const nextState = resolveBrowserSizeFullscreenActive(fullscreenToggleButton);
    if (nextState === null) {
      log.debug(`browser-size fullscreen state unresolved: aria-label is unexpected (trigger=${trigger})`);
      return;
    }
    if (runtime.browserSizeFullscreenActive === nextState) return;

    runtime.browserSizeFullscreenActive = nextState;
    log.debug(`browser-size fullscreen state updated: active=${nextState} (trigger=${trigger})`);
    if (!nextState) return;
    requestExitOwnPictureInPicture(runtime, `${trigger}:browser-size-fullscreen-enter`);
  };

  // 全画面トグルボタンのaria-label監視を同期する関数
  const syncFullscreenToggleObserver = (
    runtime: PipDomainRuntime,
    nextFullscreenToggleButton: HTMLButtonElement | null,
  ): void => {
    // ボタン消失時は監視を停止してキャッシュを破棄
    if (!nextFullscreenToggleButton) {
      if (runtime.fullscreenToggleButton) {
        runtime.context.observerRegistry.disconnect(fullscreenToggleObserverKey);
        runtime.fullscreenToggleButton = null;
        runtime.browserSizeFullscreenActive = null;
        log.debug("browser-size fullscreen observer stopped: fullscreen toggle button is unavailable");
      }
      return;
    }
    // 同じボタンを監視中ならスキップ
    if (runtime.fullscreenToggleButton === nextFullscreenToggleButton) return;

    // キャッシュを破棄して新しい要素の監視を開始
    runtime.fullscreenToggleButton = nextFullscreenToggleButton;
    runtime.browserSizeFullscreenActive = null;
    runtime.context.observerRegistry.observe({
      key: fullscreenToggleObserverKey,
      target: nextFullscreenToggleButton,
      callback: (mutationList) => {
        if (!mutationList.some((mutation) => mutation.type === "attributes" && mutation.attributeName === "aria-label")) {
          return;
        }
        const runtime = resolveRuntime();
        if (!runtime) return;
        syncBrowserSizeFullscreenStateFromToggle(runtime, "fullscreen-toggle-observer");
      },
      options: {
        attributes: true,
        attributeFilter: ["aria-label"],
      },
    });
    // 監視開始直後に現在のaria-labelも1回評価して状態を同期する
    syncBrowserSizeFullscreenStateFromToggle(runtime, "fullscreen-toggle-observer:start");
    log.debug("browser-size fullscreen observer started");
  };

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

  // ElementsUpdated通知を受けてPiP動画要素を挿入する関数
  const handleElementsUpdated = (payload: AppEventMap["ElementsUpdated"]): void => {
    const runtime = resolveRuntime();
    if (!runtime) return;

    // 最新の合成元要素を描画側へ反映する
    updateRendererSources(runtime, payload.snapshot);
    // 全画面トグルボタンが差し替わった場合は監視対象も同期する
    if (payload.changedKeys.includes("fullscreenToggleButton")) {
      syncFullscreenToggleObserver(runtime, payload.snapshot.fullscreenToggleButton);
    }
    // TODO: PiPウインドウ表示中はdummy stream時も同様に扱うかを再検討する
    // TODO: soft-fail観点で、常に hidden 状態を同期して不整合を自己修復する案も検討する
    // own PiP表示中は、合成元要素の hidden 状態も最新 snapshot に追従させる
    if (runtime.context.state.pip.get().enabled && runtime.pipStream.isRunning()) {
      syncSourceVisibilityForPipEnabled(runtime);
    }

    // TODO: 必要ならそれ以外のキーでも処理するようにする
    // TODO: 様々な処理が混在してきたのでいつか整理する
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
  };

  // VideoInfoChanged通知を受けてposterを更新する関数
  const handleVideoInfoChanged = (payload: AppEventMap["VideoInfoChanged"]): void => {
    const runtime = resolveRuntime();
    if (!runtime) return;

    // TODO: 同じURLは省く処理を入れる

    void runtime.pipVideoElementAdapter.updatePoster(payload.thumbnail)
      .then((updated) => {
        log.debug(`pip poster update synced: updated=${updated} (trigger=video-info-changed)`);
      })
      .catch((error: unknown) => {
        log.warn("pip poster update failed:", error);
      });
  };

  // PiP開始イベントを処理する関数
  const handleEnterPictureInPicture = (event: Event): void => {
    const runtime = resolveRuntime();
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
  };

  // PiP終了イベントを処理する関数
  const handleLeavePictureInPicture = (event: Event): void => {
    const runtime = resolveRuntime();
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
  };

  // 全画面変更イベントを処理する関数
  const handleFullscreenChange = (): void => {
    const runtime = resolveRuntime();
    if (!runtime) return;

    const browserGlobal = globalThis as BrowserGlobal;
    const documentNode = browserGlobal.document;
    // fullscreen終了時は何もしない
    if (!documentNode?.fullscreenElement) {
      log.debug("fullscreenchange ignored: fullscreenElement is null");
      return;
    }
    // fullscreen開始時にown PiP終了を要求
    requestExitOwnPictureInPicture(runtime, "fullscreenchange");
  };

  // PageUrlChangedを受けてwatch外遷移時にPiP終了を要求する関数
  const handlePageUrlChanged = (payload: AppEventMap["PageUrlChanged"]): void => {
    const runtime = resolveRuntime();
    if (!runtime) return;
    // 設定で無効ならPiP終了要求は出さない
    if (!runtime.context.config.shouldExitPipOnNonWatchPage) return;
    // watchページ継続中なら何もしない
    if (payload.isWatchPage) return;
    // PiP終了を要求
    requestExitOwnPictureInPicture(runtime, "page-url-changed:non-watch");
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
            handlePageUrlChanged(payload);
          },
        });
        // ElementsUpdatedイベント
        unsubscribeElementsUpdated = nextContext.eventRegistry.on({
          target: eventTarget,
          key: "domain:pip:elements-updated",
          eventKey: "ElementsUpdated",
          listener: (payload) => {
            handleElementsUpdated(payload);
          },
        });
        // VideoInfoChangedイベント
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
          handleEnterPictureInPicture(event);
        };
        runtime.leavePictureInPictureListener = (event: Event) => {
          handleLeavePictureInPicture(event);
        };
        runtime.fullscreenChangeListener = () => {
          handleFullscreenChange();
        };
        globalThis.addEventListener("enterpictureinpicture", runtime.enterPictureInPictureListener);
        globalThis.addEventListener("leavepictureinpicture", runtime.leavePictureInPictureListener);
        globalThis.addEventListener("fullscreenchange", runtime.fullscreenChangeListener);
      } else {
        log.warn("pip native event listen skipped: addEventListener/removeEventListener is unavailable");
      }

      // start時点のPiP状態を評価して表示とstateを同期する
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
        runtime.stateWriters.pip.patch({ enabled: false });
      }
      // 進行中requestとruntime参照を破棄する
      requestExtensionPipInFlight = null;
      runtime = null;
      await baseDomain.stop();
    },
  };
};

// エクスポート
export { createPipDomain };
