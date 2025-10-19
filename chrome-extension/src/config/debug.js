"use strict";

// デバッグモード
let debugMode = true;

// デバッグログの出力
const debug_log = true;

// 広告の自動スキップ
const debug_adAutoSkip = true;

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
}
