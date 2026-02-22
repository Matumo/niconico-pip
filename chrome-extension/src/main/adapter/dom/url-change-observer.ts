/**
 * URL変更監視アダプター
 */
import type { AppObserverRegistry } from "@main/types/app-context";

// URL再チェックの発火要因
type UrlCheckTrigger =
  | "initial-start"
  | "popstate"
  | "history.pushState"
  | "history.replaceState"
  | "mutation-observer";

// URL監視の入力型
interface CreateUrlChangeObserverOptions {
  observerRegistry: AppObserverRegistry;
  onUrlCheckRequested: (trigger: UrlCheckTrigger) => void;
}

// URL監視開始時のオプション型
interface UrlChangeObserverStartOptions {
  usePopStateTrigger?: boolean;
  useHistoryStateTrigger?: boolean;
}

// URL監視インターフェース型
interface UrlChangeObserver {
  start(options?: UrlChangeObserverStartOptions): void;
  stop(): void;
}

// 実行環境へアクセスするための最小型
type BrowserGlobal = typeof globalThis & {
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  history?: History;
  document?: Document;
};

const urlMutationObserverKey = "page:url-change-observer";

// Nodeインターフェースの最小判定関数
const isNodeLike = (value: unknown): value is Node =>
  typeof value === "object" && value !== null &&
  typeof (value as { nodeType?: unknown }).nodeType === "number";

// add/removeEventListenerが利用可能か判定する関数
const hasEventApi = (
  browserGlobal: BrowserGlobal,
): browserGlobal is BrowserGlobal & Required<Pick<BrowserGlobal, "addEventListener" | "removeEventListener">> =>
  typeof browserGlobal.addEventListener === "function" &&
  typeof browserGlobal.removeEventListener === "function";

// historyのpushState/replaceStateが利用可能か判定する関数
const hasHistoryApi = (browserGlobal: BrowserGlobal): browserGlobal is BrowserGlobal & { history: History } =>
  typeof browserGlobal.history?.pushState === "function" &&
  typeof browserGlobal.history?.replaceState === "function";

// URL変更監視を作成する関数
const createUrlChangeObserver = (options: CreateUrlChangeObserverOptions): UrlChangeObserver => {
  // 監視の二重開始を防ぐフラグ
  let started = false;
  // popstate監視の解除に使うリスナー参照
  let popStateListener: (() => void) | null = null;
  // historyフック解除関数
  let restoreHistoryMethods: (() => void) | null = null;

  // pushState/replaceStateを一時的にフックする関数
  const patchHistoryMethods = (browserGlobal: BrowserGlobal): (() => void) => {
    if (!hasHistoryApi(browserGlobal)) return () => undefined;

    const history = browserGlobal.history;
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = (...args) => {
      originalPushState(...args);
      options.onUrlCheckRequested("history.pushState");
    };
    history.replaceState = (...args) => {
      originalReplaceState(...args);
      options.onUrlCheckRequested("history.replaceState");
    };

    // 呼び出し側のstopで元メソッドへ戻す
    return () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  };

  // URL変更監視を開始する関数
  const start = (startOptions?: UrlChangeObserverStartOptions): void => {
    if (started) return;
    started = true;

    const browserGlobal = globalThis as BrowserGlobal;
    // SPA遷移直後はUI未反映のケースがあるため、即時トリガーは既定で無効化する
    const usePopStateTrigger = startOptions?.usePopStateTrigger ?? false;
    const useHistoryStateTrigger = startOptions?.useHistoryStateTrigger ?? false;

    // 起動直後の初回同期
    options.onUrlCheckRequested("initial-start");

    if (usePopStateTrigger && hasEventApi(browserGlobal)) {
      popStateListener = () => options.onUrlCheckRequested("popstate");
      browserGlobal.addEventListener("popstate", popStateListener);
    }

    restoreHistoryMethods = useHistoryStateTrigger ? patchHistoryMethods(browserGlobal) : null;

    const documentHead = browserGlobal.document?.head;
    if (isNodeLike(documentHead)) {
      options.observerRegistry.observe({
        key: urlMutationObserverKey,
        target: documentHead,
        callback: () => {
          options.onUrlCheckRequested("mutation-observer");
        },
        options: {
          childList: true,
          attributes: true,
        },
      });
    }
  };

  // URL変更監視を停止する関数
  const stop = (): void => {
    if (!started) return;
    started = false;

    const browserGlobal = globalThis as BrowserGlobal;
    if (popStateListener && hasEventApi(browserGlobal)) {
      browserGlobal.removeEventListener("popstate", popStateListener);
    }
    popStateListener = null;

    if (restoreHistoryMethods) restoreHistoryMethods();
    restoreHistoryMethods = null;

    options.observerRegistry.disconnect(urlMutationObserverKey);
  };

  return {
    start,
    stop,
  };
};

// エクスポート
export { createUrlChangeObserver };
export type {
  CreateUrlChangeObserverOptions,
  UrlChangeObserver,
  UrlChangeObserverStartOptions,
  UrlCheckTrigger,
};
