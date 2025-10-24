"use strict";

// デバッグモード
let debugMode = true;
// デバッグログの出力
let debug_log = true;
// 広告スキップボタンの表示
let debug_adSkipButton = false;
// 広告の自動スキップ
let debug_adAutoSkip = false;
// 広告スキップ機能の有効化（ボタン表示か自動スキップのいずれかが有効なら必要）
let debug_adSkip = debug_adSkipButton || debug_adAutoSkip;
// Observer軽量化モード無効化フラグ
let debug_observerLightModeDisabled = false;

// ステータスの表示
const debug_viewStatus = true;
// 再生時間の表示
const debug_viewTime = true;
// コントローラーボタンの表示
const debug_viewController = true;
// PIP無効時にもPIP動画の描画を行う
const debug_pipAlwaysDraw = true;
// PIP動画を確認用するためにプレイヤー外に表示する
const debug_pipViewOutside = true;
// プレイヤー外に表示するPIPをPIP風のレイアウトにする
const debug_pipViewOutsideLayout = true;
// Observerのcallback呼び出し回数を表示する
const debug_viewObserverCallbackCount = true;

const exec_config_debug_js = async function() {
  // ストレージの設定を使って上書き
  debugMode = storageConfig[STORAGE_CONFIG_KEY_DEBUG_MODE_ENABLED];
  debug_log = storageConfig[STORAGE_CONFIG_KEY_DEBUG_LOG_ENABLED];
  debug_adSkipButton = storageConfig[STORAGE_CONFIG_KEY_AD_SKIP_BUTTON_ENABLED];
  debug_adAutoSkip = storageConfig[STORAGE_CONFIG_KEY_AD_AUTO_SKIP_ENABLED];
  debug_adSkip = debug_adSkipButton || debug_adAutoSkip;
  debug_observerLightModeDisabled = storageConfig[STORAGE_CONFIG_KEY_DEBUG_OBSERVER_LIGHT_MODE_DISABLED];
};
