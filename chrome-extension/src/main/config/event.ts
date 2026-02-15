/**
 * イベント設定
 */
// アプリで扱うイベントのペイロード型
interface AppEventMap {
  // ページURL変更を通知するイベント
  PageUrlChanged: {
    url: string;
    generation: number;
  };
  // 主要要素の再解決完了を通知するイベント
  ElementsUpdated: {
    generation: number;
  };
  // 再生状態の変化を通知するイベント
  StatusChanged: {
    status: "idle" | "loading" | "ready" | "error";
  };
  // 動画メタ情報の更新を通知するイベント
  VideoInfoChanged: {
    title: string | null;
    videoId: string | null;
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
  PageUrlChanged: `${prefixId}-page-url-changed`,
  ElementsUpdated: `${prefixId}-elements-updated`,
  StatusChanged: `${prefixId}-status-changed`,
  VideoInfoChanged: `${prefixId}-video-info-changed`,
  VideoTimeChanged: `${prefixId}-video-time-changed`,
  PipStatusChanged: `${prefixId}-pip-status-changed`,
});

// エクスポート
export { createAppEventNameMap };
export type { AppEventMap, AppEventKey, AppEventNameMap };
