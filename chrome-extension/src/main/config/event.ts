/**
 * イベント設定
 */
import type { SelectorElementMap, SelectorKey } from "@main/config/selector";
import type { DomainName } from "@main/domain/shared/domain-name";

// 要素スナップショット型
type ElementsSnapshot = {
  [K in SelectorKey]: SelectorElementMap[K] | null;
};

// ElementsUpdatedで公開する読み取り専用スナップショット型
type ReadonlyElementsSnapshot = Readonly<ElementsSnapshot>;
// NOTE: changedKeysは実質データ差分だけを表し、generation系の補助メタデータは含めない。
// PageUrlChangedで通知するchanged key型
type PageUrlChangedKey = "url" | "isWatchPage";
// VideoInfoChangedで通知するchanged key型
type VideoInfoChangedKey = "title" | "author" | "thumbnail";
// PipStatusChangedで通知するchanged key型
type PipStatusChangedKey = "enabled";

// アプリで扱うイベントのペイロード型
interface AppEventMap {
  // ページURL変更を通知するイベント
  PageUrlChanged: Readonly<{
    url: string;
    generation: number;
    isWatchPage: boolean;
    changedKeys: readonly PageUrlChangedKey[];
  }>;
  // 主要要素の再解決完了を通知するイベント
  ElementsUpdated: Readonly<{
    pageGeneration: number;
    elementsGeneration: number;
    changedKeys: readonly SelectorKey[];
    snapshot: ReadonlyElementsSnapshot;
  }>;
  // 再生状態の変化を通知するイベント
  StatusChanged: Readonly<{
    status: "idle" | "loading" | "ready" | "error";
  }>;
  // 動画メタ情報の更新を通知するイベント
  VideoInfoChanged: Readonly<{
    title: string | null;
    author: string | null;
    thumbnail: string | null;
    pageGeneration: number;
    infoGeneration: number;
    changedKeys: readonly VideoInfoChangedKey[];
  }>;
  // 再生時刻情報の更新を通知するイベント
  VideoTimeChanged: Readonly<{
    currentTime: number;
    duration: number;
  }>;
  // PiP有効状態の変化を通知するイベント
  PipStatusChanged: Readonly<{
    enabled: boolean;
    changedKeys: readonly PipStatusChangedKey[];
  }>;
}

// イベントキー型
type AppEventKey = keyof AppEventMap;
// イベント名マップ型
type AppEventNameMap = Record<AppEventKey, string>;
// イベント契約型
type AppEventContract = Readonly<{
  ownerDomain: DomainName;
  allowCrossDomainEmit: boolean;
}>;
// イベント契約マップ型
type AppEventContractRecord = Record<AppEventKey, AppEventContract>;

// app event 順序の正本
const appEventOrderList = [
  "PageUrlChanged",
  "ElementsUpdated",
  "StatusChanged",
  "VideoInfoChanged",
  "VideoTimeChanged",
  "PipStatusChanged",
] as const satisfies readonly AppEventKey[];

// app event 契約の正本
const appEventContractRecord = {
  PageUrlChanged: {
    ownerDomain: "page",
    allowCrossDomainEmit: true,
  },
  ElementsUpdated: {
    ownerDomain: "elements",
    allowCrossDomainEmit: true,
  },
  StatusChanged: {
    ownerDomain: "status",
    allowCrossDomainEmit: false,
  },
  VideoInfoChanged: {
    ownerDomain: "status",
    allowCrossDomainEmit: true,
  },
  VideoTimeChanged: {
    ownerDomain: "time",
    allowCrossDomainEmit: false,
  },
  PipStatusChanged: {
    ownerDomain: "pip",
    allowCrossDomainEmit: false,
  },
} as const satisfies AppEventContractRecord;

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
export { appEventOrderList, appEventContractRecord, createAppEventNameMap };
export type {
  ElementsSnapshot,
  ReadonlyElementsSnapshot,
  PageUrlChangedKey,
  VideoInfoChangedKey,
  PipStatusChangedKey,
  AppEventContract,
  AppEventContractRecord,
  AppEventMap,
  AppEventKey,
  AppEventNameMap,
};
