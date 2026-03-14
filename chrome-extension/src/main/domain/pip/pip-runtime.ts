/**
 * pipドメイン 共通ランタイム
 */
import type { PipRenderer } from "@main/adapter/media/pip-renderer";
import type { PipStream } from "@main/adapter/media/pip-stream";
import type { PipVideoElementAdapter } from "@main/adapter/media/pip-video-element";
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

// ランタイム解決関数型
type ResolvePipRuntime = () => PipDomainRuntime | null;

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

// エクスポート
export {
  resolveEventTarget,
  canUseNativeEventApi,
  hasAnyPipElement,
};
export type {
  BrowserGlobal,
  PipDomainRuntime,
  ResolvePipRuntime,
};
