/**
 * アプリ設定
 */
// アプリの設定型
interface AppConfig {
  appName: string;
  prefixId: string;
  watchPageUrlPattern: RegExp;
  shouldUseDebugLog: boolean;
}

// 既定の設定項目
const appName = "niconico-pip";
const prefixId = "com-matumo-dev-niconico-pip";
const watchPageUrlPattern = /^https:\/\/www\.nicovideo\.jp\/watch\/.+$/;
const shouldUseDebugLog = false;

// 既定の設定値
const defaultAppConfig: AppConfig = {
  appName,
  prefixId,
  watchPageUrlPattern,
  shouldUseDebugLog,
};

// 既定値に上書きを適用して設定を作成する関数
const createAppConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  ...defaultAppConfig,
  ...overrides,
});

// エクスポート
export { createAppConfig };
export type { AppConfig };
