/**
 * アプリ設定
 */

type GlobalWithAppDebug = typeof globalThis & {
  __APP_DEBUG__?: boolean;
};

// アプリの設定型
interface AppConfig {
  appName: string;
  prefixId: string;
  watchPageUrlPattern: RegExp;
  shouldUseDebugLog: boolean;
  pipButtonElementId: string;
  pipVideoElementId: string;
  videoPipCanvasHeight: number;
  videoPipCanvasWidth: number;
  pipButtonOnMouseOverColor: string;
  pipButtonOnMouseOutColor: string;
  seekBackwardDefaultOffset: number;
  seekForwardDefaultOffset: number;
}

// 既定の設定項目
const appName = "niconico-pip";
const prefixId = `com-matumo-dev-${appName}`;
const shouldUseDebugLog = (globalThis as GlobalWithAppDebug).__APP_DEBUG__ ?? false;
const watchPageUrlPattern = /^https:\/\/www\.nicovideo\.jp\/watch\/.+$/;
// 要素ID
const pipButtonElementId = `${prefixId}-elem-pip-button`;
const pipVideoElementId = `${prefixId}-elem-pip-video`;
// PiPキャンバスのサイズ
const videoPipCanvasHeight = 720;
const videoPipCanvasWidth = 1280;
// PiPボタンのホバー時/通常時の文字色
const pipButtonOnMouseOverColor = "#ffffff";
const pipButtonOnMouseOutColor = "#cccccc";
// seekbackward/seekforwardの既定シーク秒数
const seekBackwardDefaultOffset = 10;
const seekForwardDefaultOffset = 10;

// 既定の設定値
const defaultAppConfig: AppConfig = {
  appName,
  prefixId,
  shouldUseDebugLog,
  watchPageUrlPattern,
  pipButtonElementId,
  pipVideoElementId,
  videoPipCanvasHeight,
  videoPipCanvasWidth,
  pipButtonOnMouseOverColor,
  pipButtonOnMouseOutColor,
  seekBackwardDefaultOffset,
  seekForwardDefaultOffset,
};

// 既定値に上書きを適用して設定を作成する関数
const createAppConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  ...defaultAppConfig,
  ...overrides,
});

// エクスポート
export { createAppConfig };
export type { AppConfig };
