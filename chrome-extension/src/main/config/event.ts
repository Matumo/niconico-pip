/**
 * イベント設定
 */
import type { SelectorElementMap, SelectorKey } from "@main/config/selector";

// 要素スナップショット型
type ElementsSnapshot = {
  [K in SelectorKey]: SelectorElementMap[K] | null;
};

// ElementsUpdatedで公開する読み取り専用スナップショット型
type ReadonlyElementsSnapshot = Readonly<ElementsSnapshot>;

// アプリで扱うイベントのペイロード型
interface AppEventMap {
  // ページURL変更を通知するイベント
  PageUrlChanged: {
    url: string;
    generation: number;
    isWatchPage: boolean;
  };
  // 主要要素の再解決完了を通知するイベント
  ElementsUpdated: {
    readonly pageGeneration: number;
    readonly elementsGeneration: number;
    readonly changedKeys: readonly SelectorKey[];
    readonly snapshot: ReadonlyElementsSnapshot;
  };
  // 再生状態の変化を通知するイベント
  StatusChanged: {
    status: "idle" | "loading" | "ready" | "error";
  };
  // 動画メタ情報の更新を通知するイベント
  VideoInfoChanged: {
    title: string | null;
    author: string | null;
    thumbnail: string | null;
    pageGeneration: number;
    infoGeneration: number;
  };
  // 再生時刻情報の更新を通知するイベント
  VideoTimeChanged: {
    currentTime: number;
    duration: number;
  };
  // PiP有効状態の変化を通知するイベント
  PipStatusChanged: {
    enabled: boolean;
    reason: "user" | "system" | "unknown";
  };
}

// イベントキー型
type AppEventKey = keyof AppEventMap;
// イベント名マップ型
type AppEventNameMap = Record<AppEventKey, string>;

// prefix付きイベント名マップを作成する関数
const createAppEventNameMap = (prefixId: string): AppEventNameMap => ({
  PageUrlChanged: `${prefixId}-event-page-url-changed`,
  ElementsUpdated: `${prefixId}-event-elements-updated`,
  StatusChanged: `${prefixId}-event-status-changed`,
  VideoInfoChanged: `${prefixId}-event-video-info-changed`,
  VideoTimeChanged: `${prefixId}-event-video-time-changed`,
  PipStatusChanged: `${prefixId}-event-pip-status-changed`,
});

// エクスポート
export { createAppEventNameMap };
export type { ElementsSnapshot, ReadonlyElementsSnapshot, AppEventMap, AppEventKey, AppEventNameMap };
