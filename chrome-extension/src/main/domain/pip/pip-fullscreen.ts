/**
 * pipドメイン フルスクリーン切替処理
 */
import { appLoggerNames } from "@main/platform/logger";
import { getLogger } from "@matumo/ts-simple-logger";
import type { BrowserGlobal, PipDomainRuntime, ResolvePipRuntime } from "./pip-runtime";

// fullscreenトグル監視同期の入力型
interface SyncFullscreenToggleObserverOptions {
  runtime: PipDomainRuntime;
  nextFullscreenToggleButton: HTMLButtonElement | null;
  resolveRuntime: ResolvePipRuntime;
}

const log = getLogger(appLoggerNames.domain);
const fullscreenToggleObserverKey = "domain:pip:fullscreen-toggle-label";
const fullscreenEnterLabel = "全画面表示する";
const fullscreenLeaveLabel = "全画面表示を終了";

// 全画面トグルボタンのaria-labelからブラウザサイズ全画面状態を判定する関数
const resolveBrowserSizeFullscreenActive = (button: HTMLButtonElement): boolean | null => {
  const ariaLabel = button.getAttribute("aria-label");
  if (ariaLabel === fullscreenLeaveLabel) return true;
  if (ariaLabel === fullscreenEnterLabel) return false;
  return null;
};

// own PiPが有効な場合に終了を要求する関数
const requestExitOwnPictureInPicture = (
  runtime: PipDomainRuntime,
  trigger: string,
): void => {
  // foreign PiPまたはPiP未開始の場合はスキップ
  if (!runtime.pipVideoElementAdapter.isOwnPictureInPictureElement()) {
    log.debug(`pip exit handling ignored: own PiP is not active (trigger=${trigger})`);
    return;
  }

  const documentNode = (globalThis as BrowserGlobal).document;
  if (!documentNode || typeof documentNode.exitPictureInPicture !== "function") {
    log.debug(`pip exit handling ignored: exitPictureInPicture is unavailable (trigger=${trigger})`);
    return;
  }

  // PiP終了
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
  // 全画面トグルボタンがない場合はスキップ
  const fullscreenToggleButton = runtime.fullscreenToggleButton;
  if (!fullscreenToggleButton) return;

  // 全画面表示以外の場合はスキップ
  const browserSizeFullscreenActive = resolveBrowserSizeFullscreenActive(fullscreenToggleButton);
  if (browserSizeFullscreenActive !== true) return;

  // ブラウザサイズ全画面を終了
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
  // 全画面トグルボタンがない場合はスキップ
  const fullscreenToggleButton = runtime.fullscreenToggleButton;
  if (!fullscreenToggleButton) return;

  // 全画面表示状態が取得できない場合または全画面表示以外の場合はスキップ
  const nextState = resolveBrowserSizeFullscreenActive(fullscreenToggleButton);
  if (nextState === null) {
    log.debug(`browser-size fullscreen state unresolved: aria-label is unexpected (trigger=${trigger})`);
    return;
  }
  if (runtime.browserSizeFullscreenActive === nextState) return;

  // 状態を更新
  runtime.browserSizeFullscreenActive = nextState;
  log.debug(`browser-size fullscreen state updated: active=${nextState} (trigger=${trigger})`);

  // 全画面表示に入った場合はown PiPを終了
  if (nextState) {
    requestExitOwnPictureInPicture(runtime, `${trigger}:browser-size-fullscreen-enter`);
  }
};

// 全画面トグルボタンのaria-label監視を同期する関数
const syncFullscreenToggleObserver = (
  options: SyncFullscreenToggleObserverOptions,
): void => {
  const { runtime, nextFullscreenToggleButton, resolveRuntime } = options;

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

// エクスポート
export {
  fullscreenToggleObserverKey,
  requestExitOwnPictureInPicture,
  requestExitBrowserSizeFullscreenForOwnPipEnter,
  syncFullscreenToggleObserver,
};
export type { SyncFullscreenToggleObserverOptions };
