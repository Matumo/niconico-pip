"use strict";

// デバッグモード
let debugMode = false;

// prefix
const prefixId = 'com-matumo-dev-niconico-pip';

// ログ設定
const logPrefix = '[niconico-pip-ad]';
let logLevel = 'log'; // ログレベル: 'error', 'warn', 'info', 'log', 'debug'
let logSufixType = 'none'; // ログのサフィックスタイプ: 'none', 'short', 'long'

// 拡張機能の有効化設定
let extensionEnabled = true;
// 広告スキップボタンの表示
let debug_adSkipButton = false;
// 広告の自動スキップ
let debug_adAutoSkip = false;
// 広告スキップ機能の有効化（ボタン表示か自動スキップのいずれかが有効なら必要）
let debug_adSkip = debug_adSkipButton || debug_adAutoSkip;

const exec_ad_config_js = async function() {
  // ストレージの設定を使って上書き
  debugMode = storageConfig[STORAGE_CONFIG_KEY_DEBUG_MODE_ENABLED];
  logLevel = debugMode ? 'debug' : 'log';
  logSufixType = debugMode ? 'long' : 'none';
  extensionEnabled = storageConfig[STORAGE_CONFIG_KEY_ENABLED];
  debug_adSkipButton = storageConfig[STORAGE_CONFIG_KEY_AD_SKIP_BUTTON_ENABLED];
  debug_adAutoSkip = storageConfig[STORAGE_CONFIG_KEY_AD_AUTO_SKIP_ENABLED];
  debug_adSkip = debug_adSkipButton || debug_adAutoSkip;
}
